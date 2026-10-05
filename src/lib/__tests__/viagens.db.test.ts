import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { concluirCarga, criarCargaUnica, criarCargas, listCargas, marcarItemSeparado } from '../cargas';
import {
  concluirVerificacao,
  confirmarPedido,
  criarPedido,
  findPedido,
  iniciarVerificacao,
  listHistorico,
  listItens,
  marcarDisponibilidade,
} from '../pedidos';
import { insertClienteRapido } from '../pessoas';
import { insertRecipiente } from '../recipientes';
import { SITUACOES_VIAGEM } from '../rotas';
import { withTransaction } from '../transaction';
import {
  adicionarParada,
  adicionarPedido,
  cargasDaViagem,
  concluirViagem,
  definirChegada,
  findViagem,
  iniciarCarregamento,
  listParadas,
  marcarItemCarregado,
  mudarEtapa,
  pedidosDisponiveis,
  removerParada,
  salvarEnderecoDeEntrega,
  salvarOrdem,
  sugerirRota,
  tirarPedido,
  viagemDoDia,
  viagensEmAndamento,
  voltarEtapa,
} from '../viagens';

/**
 * A viagem de entrega (P14) contra Postgres real. O que se confere aqui é o que
 * o teste com mock não alcança: a data gravada no pedido, a troca de posições
 * com a unicidade deferida, a retomada na etapa certa e a viagem ficando pronta
 * pelo carregamento, que é uma contagem própria, e não a da separação (P19).
 */

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `tv${randomUUID().slice(0, 6)}`;
const tx = <T>(fn: (client: PoolClient) => Promise<T>) => withTransaction(pool, fn);

const chefia = () => ({ perfil: 'chefia' as const, usuarioId: usuario });
const gerencia = () => ({ perfil: 'gerencia' as const, usuarioId: usuario });

let usuario: string;
let cliente: string;
let outroCliente: string;
let especie: string;
let tubete: string;

// Cada teste num dia próprio: a viagem é do dia, e dois testes no mesmo dia se enxergariam
let proximoDia = 1;
function umDia(): string {
  return `2031-03-${String(proximoDia++).padStart(2, '0')}`;
}

beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, senha_hash, perfil, deve_trocar_senha)
     VALUES ($1, 'Chefia da viagem', 'x', 'chefia', false) RETURNING id`,
    [prefixo],
  );
  usuario = rows[0].id;
  cliente = await tx((client) => insertClienteRapido(client, { nome: `${prefixo} Prefeitura`, telefone: null }));
  outroCliente = await tx((client) => insertClienteRapido(client, { nome: `${prefixo} Sítio`, telefone: null }));
  await pool.query(
    `INSERT INTO cadastro.pessoas_enderecos (pessoa_id, tipo, logradouro, cidade, uf)
     VALUES ($1, 'entrega', 'Rua XV de Novembro, 1200', 'Rio do Sul', 'SC')`,
    [cliente],
  );

  ({
    rows: [{ id: especie }],
  } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [
    `${prefixo} Handroanthus`,
  ]));
  tubete = await insertRecipiente(pool, { nome: `${prefixo} tubete`, volumeLitros: 0.055 });
});

afterAll(async () => {
  await pool.end();
});

/** Um pedido de um item, levado até `aprovado` pelo caminho normal. */
async function pedidoAprovado(dataEntrega: string | null, clienteId = cliente) {
  const { id } = await tx((client) =>
    criarPedido(client, {
      clienteId,
      canal: 'atacado',
      dataEntrega,
      observacoes: null,
      criadoPor: usuario,
      itens: [{ especieId: especie, recipienteId: tubete, quantidade: 300, precoCentavos: 200 }],
    }),
  );
  await tx((c) => iniciarVerificacao(c, id, gerencia()));
  for (const item of await listItens(pool, id)) {
    await tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel', gerencia()));
  }
  await tx((c) => concluirVerificacao(c, id, gerencia()));
  await tx((c) => confirmarPedido(c, id, chefia()));
  return id;
}

/** Viagem com dois pedidos, já na etapa da rota. */
async function viagemNaRota() {
  const dia = umDia();
  const a = await pedidoAprovado(dia);
  const b = await pedidoAprovado(null, outroCliente);
  const { viagemId } = await tx((c) => adicionarPedido(c, dia, a, gerencia()));
  await tx((c) => adicionarPedido(c, dia, b, gerencia()));
  await tx((c) => mudarEtapa(c, viagemId, 'roteirizando'));
  return { dia, viagemId, a, b };
}

describe('a lista fechada da viagem', () => {
  it('é a mesma no banco e no TypeScript', async () => {
    const { rows } = await pool.query<{ def: string }>(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'viagens_situacao_valida'",
    );
    const noBanco = [...rows[0].def.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(noBanco).toEqual(Object.keys(SITUACOES_VIAGEM).sort());
  });
});

describe('montar a carga (Tela 1)', () => {
  it('o primeiro pedido cria a viagem, e a data de entrega passa a ser a do dia, com nota no histórico', async () => {
    const dia = umDia();
    const pedido = await pedidoAprovado(null);

    const { viagemId } = await tx((c) => adicionarPedido(c, dia, pedido, gerencia()));

    const viagem = await viagemDoDia(pool, dia);
    expect(viagem).toMatchObject({ id: viagemId, situacao: 'montando', partidaDescricao: 'Agrolândia, SC' });
    expect((await findPedido(pool, pedido))!.dataEntrega).toBe(dia);
    const nota = (await listHistorico(pool, pedido)).at(-1)!;
    expect(nota).toMatchObject({ situacaoAnterior: 'aprovado', situacaoNova: 'aprovado' });
    expect(nota.observacoes).toBe(`Entrega marcada para ${dia.slice(8, 10)}/${dia.slice(5, 7)} no planejamento da viagem.`);

    const paradas = await listParadas(pool, viagemId);
    expect(paradas).toHaveLength(1);
    expect(paradas[0]).toMatchObject({ ordem: 1, pedidoId: pedido, cidade: 'Rio do Sul' });
    expect(paradas[0].endereco).toBe('Rua XV de Novembro, 1200, Rio do Sul, SC');
    expect(paradas[0].itens).toEqual([expect.objectContaining({ quantidade: 300 })]);

    // O pedido na viagem sai da lista do que pode entrar
    expect((await pedidosDisponiveis(pool)).map((p) => p.id)).not.toContain(pedido);
  });

  it('pedido que já era do dia não ganha nota', async () => {
    const dia = umDia();
    const pedido = await pedidoAprovado(dia);
    const antes = (await listHistorico(pool, pedido)).length;
    await tx((c) => adicionarPedido(c, dia, pedido, gerencia()));
    expect(await listHistorico(pool, pedido)).toHaveLength(antes);
  });

  it('um pedido só está em uma viagem em andamento', async () => {
    const pedido = await pedidoAprovado(null);
    await tx((c) => adicionarPedido(c, umDia(), pedido, gerencia()));
    await expect(tx((c) => adicionarPedido(c, umDia(), pedido, gerencia()))).rejects.toThrow(/já está em outra viagem/);
  });

  it('só pedido de aprovado para cima entra', async () => {
    const { id } = await tx((client) =>
      criarPedido(client, {
        clienteId: cliente,
        canal: 'atacado',
        dataEntrega: null,
        observacoes: null,
        criadoPor: usuario,
        itens: [{ especieId: especie, recipienteId: tubete, quantidade: 10, precoCentavos: 100 }],
      }),
    );
    await expect(tx((c) => adicionarPedido(c, umDia(), id, gerencia()))).rejects.toThrow(/aprovado para cima/);
  });

  it('pedido separando ou pronto para envio entra, e o que já viajou some da lista', async () => {
    const separando = await pedidoAprovado(null);
    await tx((c) => criarCargaUnica(c, separando, gerencia()));
    const pronto = await pedidoAprovado(null);
    const [carga] = await tx(async (c) => {
      await criarCargaUnica(c, pronto, gerencia());
      return listCargas(c, pronto);
    });
    await tx((c) => marcarItemSeparado(c, carga.itens[0].id, true));
    await tx((c) => concluirCarga(c, carga.id, gerencia()));

    const disponiveis = await pedidosDisponiveis(pool);
    expect(disponiveis.find((p) => p.id === separando)?.situacao).toBe('separando');
    expect(disponiveis.find((p) => p.id === pronto)?.situacao).toBe('pronto_envio');

    const dia = umDia();
    const { viagemId } = await tx((c) => adicionarPedido(c, dia, pronto, gerencia()));
    await tx((c) => mudarEtapa(c, viagemId, 'roteirizando'));
    await tx((c) => iniciarCarregamento(c, viagemId, gerencia()));
    // P19: separado ao lado do carro não é carregado. O item chega por contar no caminhão
    const [grupo] = await cargasDaViagem(pool, viagemId);
    expect(grupo.itens[0]).toMatchObject({ separado: true, carregado: false });
    await expect(tx((c) => concluirViagem(c, viagemId, gerencia()))).rejects.toThrow(/Falta carregar 1 item/);
    await tx((c) => marcarItemCarregado(c, grupo.itens[0].id, true));
    await expect(tx((c) => concluirViagem(c, viagemId, gerencia()))).resolves.toEqual({ pedidos: 1 });
    expect((await findViagem(pool, viagemId))!.situacao).toBe('pronta');

    // Já esteve numa viagem concluída: não volta para a lista nem entra em outra
    expect((await pedidosDisponiveis(pool)).map((p) => p.id)).not.toContain(pronto);
    await expect(tx((c) => adicionarPedido(c, umDia(), pronto, gerencia()))).rejects.toThrow(/já está em outra viagem/);
  });

    it('tirar renumera as paradas, e tirar o último apaga a viagem', async () => {
    const dia = umDia();
    const a = await pedidoAprovado(dia);
    const b = await pedidoAprovado(dia);
    const { viagemId } = await tx((c) => adicionarPedido(c, dia, a, gerencia()));
    await tx((c) => adicionarPedido(c, dia, b, gerencia()));

    await tx((c) => tirarPedido(c, viagemId, a));
    expect((await listParadas(pool, viagemId)).map((p) => [p.pedidoId, p.ordem])).toEqual([[b, 1]]);
    // A data combinada fica: tirar da viagem não a desfaz
    expect((await findPedido(pool, a))!.dataEntrega).toBe(dia);

    await expect(tx((c) => tirarPedido(c, viagemId, b))).resolves.toEqual({ apagada: true });
    expect(await viagemDoDia(pool, dia)).toBeNull();
  });
});

describe('a rota (Tela 2)', () => {
  it('reordenar troca as posições, com a unicidade conferida no fim', async () => {
    const { viagemId, a, b } = await viagemNaRota();
    const [pa, pb] = await listParadas(pool, viagemId);
    await tx((c) => salvarOrdem(c, viagemId, [pb.id, pa.id]));
    expect((await listParadas(pool, viagemId)).map((p) => p.pedidoId)).toEqual([b, a]);
    // Ordem arrumada a mão não é refeita ao voltar da Tela 1
    expect((await findViagem(pool, viagemId))!.sugerirOrdem).toBe(false);
  });

  it('ordem com parada faltando é recusada', async () => {
    const { viagemId } = await viagemNaRota();
    const [pa] = await listParadas(pool, viagemId);
    await expect(tx((c) => salvarOrdem(c, viagemId, [pa.id]))).rejects.toThrow(/paradas mudaram/);
  });

  it('parada extra entra no fim e sai sem deixar buraco', async () => {
    const { viagemId } = await viagemNaRota();
    await tx((c) => adicionarParada(c, viagemId, 'Abastecer', 'Posto BR, Rio do Sul'));
    const paradas = await listParadas(pool, viagemId);
    expect(paradas.map((p) => p.ordem)).toEqual([1, 2, 3]);
    expect(paradas[2]).toMatchObject({ pedidoId: null, descricao: 'Abastecer', endereco: 'Posto BR, Rio do Sul', itens: [] });

    await tx((c) => salvarOrdem(c, viagemId, [paradas[2].id, paradas[0].id, paradas[1].id]));
    await tx((c) => removerParada(c, viagemId, paradas[2].id));
    expect((await listParadas(pool, viagemId)).map((p) => p.ordem)).toEqual([1, 2]);
  });

  it('parada de pedido não sai pela Tela 2', async () => {
    const { viagemId } = await viagemNaRota();
    const [pa] = await listParadas(pool, viagemId);
    await expect(tx((c) => removerParada(c, viagemId, pa.id))).rejects.toThrow(/não encontrada/);
  });

  it('sem chave da API, a sugestão avisa e a ordem fica', async () => {
    vi.stubEnv('ORS_API_KEY', '');
    try {
      const { viagemId, a, b } = await viagemNaRota();
      await expect(sugerirRota(pool, viagemId)).resolves.toBe('mapa_indisponivel');
      expect((await listParadas(pool, viagemId)).map((p) => p.pedidoId)).toEqual([a, b]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('sair e voltar: a viagem reabre na etapa em que parou, com a mesma ordem', async () => {
    const { dia, viagemId, a, b } = await viagemNaRota();
    const [pa, pb] = await listParadas(pool, viagemId);
    await tx((c) => salvarOrdem(c, viagemId, [pb.id, pa.id]));

    expect(await viagemDoDia(pool, dia)).toMatchObject({ id: viagemId, situacao: 'roteirizando' });
    expect((await viagensEmAndamento(pool)).map((v) => v.id)).toContain(viagemId);
    expect((await listParadas(pool, viagemId)).map((p) => p.pedidoId)).toEqual([b, a]);

    // A seta de voltar reabre a carga, e a ordem continua guardada
    await tx((c) => mudarEtapa(c, viagemId, 'montando'));
    expect((await viagemDoDia(pool, dia))!.situacao).toBe('montando');
    expect((await listParadas(pool, viagemId)).map((p) => p.pedidoId)).toEqual([b, a]);
  });

  it('a volta começa igual à saída, e escolhida fica com a coordenada', async () => {
    const { viagemId } = await viagemNaRota();
    expect(await findViagem(pool, viagemId)).toMatchObject({ chegadaDescricao: null, chegadaLat: null });

    await pool.query('UPDATE viagens SET sugerir_ordem = false WHERE id = $1', [viagemId]);
    await tx((c) => definirChegada(c, viagemId, ' Centro, Itapema ', { lat: -27.09, lng: -48.61 }));
    expect(await findViagem(pool, viagemId)).toMatchObject({
      chegadaDescricao: 'Centro, Itapema',
      chegadaLat: -27.09,
      chegadaLng: -48.61,
      sugerirOrdem: true,
    });

    await expect(tx((c) => definirChegada(c, viagemId, '  '))).rejects.toThrow(/endereço de volta/);
    await tx((c) => mudarEtapa(c, viagemId, 'montando'));
    await expect(tx((c) => definirChegada(c, viagemId, 'Itapema, SC'))).rejects.toThrow(/etapa da rota/);
  });
});

describe('o carregamento (Tela 3)', () => {
  it('cria uma carga por pedido, e carregar direto vale como separar', async () => {
    const { dia, viagemId, a, b } = await viagemNaRota();
    await tx((c) => adicionarParada(c, viagemId, 'Almoço', null));

    await tx((c) => iniciarCarregamento(c, viagemId, gerencia()));
    expect((await viagemDoDia(pool, dia))!.situacao).toBe('carregando');
    expect((await findPedido(pool, a))!.situacao).toBe('separando');
    expect((await findPedido(pool, b))!.situacao).toBe('separando');

    const grupos = await cargasDaViagem(pool, viagemId);
    // A parada avulsa não tem item, e não aparece
    expect(grupos.map((g) => [g.pedidoId, g.entrega])).toEqual([
      [a, 1],
      [b, 2],
    ]);

    await expect(tx((c) => concluirViagem(c, viagemId, gerencia()))).rejects.toThrow(/Faltam carregar 2 itens/);

    // Sair no meio: o que foi marcado continua marcado, e marcar não separa
    await tx((c) => marcarItemCarregado(c, grupos[0].itens[0].id, true));
    expect((await cargasDaViagem(pool, viagemId))[0].itens[0]).toMatchObject({ carregado: true, separado: false });

    await tx((c) => marcarItemCarregado(c, grupos[1].itens[0].id, true));
    await expect(tx((c) => concluirViagem(c, viagemId, gerencia()))).resolves.toEqual({ pedidos: 2 });
    // Ninguém passou pela tela Separar: fechar a viagem dá os itens como separados
    expect((await listCargas(pool, a))[0]).toMatchObject({ situacao: 'pronto', itens: [expect.objectContaining({ separado: true })] });

    expect((await findPedido(pool, a))!.situacao).toBe('pronto_envio');
    expect((await findPedido(pool, b))!.situacao).toBe('pronto_envio');
    expect((await viagemDoDia(pool, dia))!.situacao).toBe('pronta');
    expect((await viagensEmAndamento(pool)).map((v) => v.id)).not.toContain(viagemId);
    // "Planejar outra viagem neste dia" ignora a pronta
    expect(await viagemDoDia(pool, dia, { nova: true })).toBeNull();
  });

  it('P19: separar pela tela do pedido não fecha a viagem, e o item continua por carregar', async () => {
    const dia = umDia();
    const pedido = await pedidoAprovado(dia);
    const { viagemId } = await tx((c) => adicionarPedido(c, dia, pedido, gerencia()));
    await tx((c) => mudarEtapa(c, viagemId, 'roteirizando'));
    await tx((c) => iniciarCarregamento(c, viagemId, gerencia()));

    const [carga] = await listCargas(pool, pedido);
    await tx((c) => marcarItemSeparado(c, carga.itens[0].id, true));
    await tx((c) => concluirCarga(c, carga.id, gerencia()));
    expect((await findPedido(pool, pedido))!.situacao).toBe('pronto_envio');
    expect((await viagemDoDia(pool, dia))!.situacao).toBe('carregando');

    // A carga pronta da separação não trava a contagem do caminhão
    await tx((c) => marcarItemCarregado(c, carga.itens[0].id, true));
    await tx((c) => concluirViagem(c, viagemId, gerencia()));
    expect((await viagemDoDia(pool, dia))!.situacao).toBe('pronta');
  });

  it('P19: só se carrega com a viagem em carregamento, e a marcação é idempotente', async () => {
    const { viagemId, a } = await viagemNaRota();
    await tx((c) => iniciarCarregamento(c, viagemId, gerencia()));
    const [carga] = await listCargas(pool, a);
    const item = carga.itens[0].id;
    await tx((c) => marcarItemCarregado(c, item, true));
    await tx((c) => marcarItemCarregado(c, item, true));
    expect((await listCargas(pool, a))[0].itens[0].carregado).toBe(true);

    await tx((c) => voltarEtapa(c, viagemId, 'roteirizando'));
    await expect(tx((c) => marcarItemCarregado(c, item, false))).rejects.toThrow(/não está em carregamento/);
  });

  it('P19: o pedido tirado da viagem perde o que foi carregado nela', async () => {
    const { viagemId, a } = await viagemNaRota();
    await tx((c) => iniciarCarregamento(c, viagemId, gerencia()));
    const [carga] = await listCargas(pool, a);
    await tx((c) => marcarItemCarregado(c, carga.itens[0].id, true));
    await tx((c) => voltarEtapa(c, viagemId, 'montando'));
    await tx((c) => tirarPedido(c, viagemId, a));
    expect((await listCargas(pool, a))[0].itens[0].carregado).toBe(false);
  });

  it('pedido que saiu de aprovado no meio do caminho recusa a viagem inteira', async () => {
    const { viagemId, a, b } = await viagemNaRota();
    await pool.query("UPDATE pedidos SET situacao = 'cancelado' WHERE id = $1", [b]);
    await expect(tx((c) => iniciarCarregamento(c, viagemId, gerencia()))).rejects.toThrow(/ainda não se organiza/);
    expect(await listCargas(pool, a)).toEqual([]);
  });

  it('pedido que já tem cargas leva as dele, todas, sem ganhar outra', async () => {
    const dia = umDia();
    const dividido = await pedidoAprovado(dia);
    const [item] = await listItens(pool, dividido);
    await tx((c) =>
      criarCargas(c, dividido, [[{ itemId: item.id, quantidade: 200 }], [{ itemId: item.id, quantidade: 100 }]], gerencia()),
    );
    const novo = await pedidoAprovado(dia, outroCliente);
    const { viagemId } = await tx((c) => adicionarPedido(c, dia, dividido, gerencia()));
    await tx((c) => adicionarPedido(c, dia, novo, gerencia()));
    await tx((c) => mudarEtapa(c, viagemId, 'roteirizando'));

    await tx((c) => iniciarCarregamento(c, viagemId, gerencia()));
    expect(await listCargas(pool, dividido)).toHaveLength(2);
    expect(await listCargas(pool, novo)).toHaveLength(1);
    const [grupo] = await cargasDaViagem(pool, viagemId);
    expect(grupo.itens.map((i) => i.quantidade)).toEqual([200, 100]);
  });

  it('P17: volta do carregamento à rota e à carga, e o que foi marcado continua marcado', async () => {
    const { dia, viagemId, a, b } = await viagemNaRota();
    await tx((c) => iniciarCarregamento(c, viagemId, gerencia()));
    const [primeiro] = await cargasDaViagem(pool, viagemId);
    await tx((c) => marcarItemCarregado(c, primeiro.itens[0].id, true));

    await tx((c) => voltarEtapa(c, viagemId, 'roteirizando'));
    expect((await viagemDoDia(pool, dia))!.situacao).toBe('roteirizando');
    await tx((c) => voltarEtapa(c, viagemId, 'montando'));
    expect((await viagemDoDia(pool, dia))!.situacao).toBe('montando');
    await expect(tx((c) => voltarEtapa(c, viagemId, 'montando'))).rejects.toThrow(/já está nesta etapa/);

    // Avançar de novo segue com as cargas que existem, sem criar outras
    await tx((c) => mudarEtapa(c, viagemId, 'roteirizando'));
    await tx((c) => iniciarCarregamento(c, viagemId, gerencia()));
    expect(await listCargas(pool, a)).toHaveLength(1);
    expect(await listCargas(pool, b)).toHaveLength(1);
    expect((await cargasDaViagem(pool, viagemId))[0].itens[0].carregado).toBe(true);
  });

  it('P17: a viagem pronta não volta de etapa', async () => {
    const dia = umDia();
    const pedido = await pedidoAprovado(dia);
    const { viagemId } = await tx((c) => adicionarPedido(c, dia, pedido, gerencia()));
    await tx((c) => mudarEtapa(c, viagemId, 'roteirizando'));
    await tx((c) => iniciarCarregamento(c, viagemId, gerencia()));
    const [grupo] = await cargasDaViagem(pool, viagemId);
    await tx((c) => marcarItemCarregado(c, grupo.itens[0].id, true));
    await tx((c) => concluirViagem(c, viagemId, gerencia()));
    await expect(tx((c) => voltarEtapa(c, viagemId, 'roteirizando'))).rejects.toThrow(/já está pronta/);
  });

    it('iniciar de novo é recusado, e nenhum pedido ganha segunda carga', async () => {
    const { viagemId, a, b } = await viagemNaRota();
    await tx((c) => iniciarCarregamento(c, viagemId, gerencia()));
    await expect(tx((c) => iniciarCarregamento(c, viagemId, gerencia()))).rejects.toThrow(/etapa da rota/);
    expect(await listCargas(pool, a)).toHaveLength(1);
    expect(await listCargas(pool, b)).toHaveLength(1);
  });
});

describe('a coordenada guardada no endereço', () => {
  it('some quando o texto do endereço muda', async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO cadastro.pessoas_enderecos (pessoa_id, tipo, cidade, lat, lng, geocodificado_em)
       VALUES ($1, 'cobranca', 'Ibirama', -27.05, -49.51, NOW()) RETURNING id`,
      [outroCliente],
    );
    await pool.query("UPDATE cadastro.pessoas_enderecos SET cep = '89140000' WHERE id = $1", [rows[0].id]);
    const { rows: depois } = await pool.query(
      'SELECT lat, lng, geocodificado_em FROM cadastro.pessoas_enderecos WHERE id = $1',
      [rows[0].id],
    );
    expect(depois[0]).toEqual({ lat: null, lng: null, geocodificado_em: null });
  });

  it('fica quando só a coordenada é gravada', async () => {
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO cadastro.pessoas_enderecos (pessoa_id, tipo, cidade) VALUES ($1, 'cobranca', 'Ibirama') RETURNING id",
      [outroCliente],
    );
    await pool.query('UPDATE cadastro.pessoas_enderecos SET lat = -27.05, lng = -49.51, geocodificado_em = NOW() WHERE id = $1', [
      rows[0].id,
    ]);
    const { rows: depois } = await pool.query('SELECT lat::float8 AS lat FROM cadastro.pessoas_enderecos WHERE id = $1', [
      rows[0].id,
    ]);
    expect(depois[0].lat).toBe(-27.05);
  });
});

describe('P17, P19: o endereço de entrega completado na rota', () => {
  async function entregaDe(clienteId: string) {
    const { rows } = await pool.query(
      `SELECT logradouro, cidade, uf, lat::float8 AS lat, lng::float8 AS lng, geocodificado_em IS NOT NULL AS geocodificado
         FROM cadastro.pessoas_enderecos WHERE pessoa_id = $1 AND tipo = 'entrega'`,
      [clienteId],
    );
    return rows;
  }

  async function destinoDe(pedidoId: string) {
    const { rows } = await pool.query(
      `SELECT entrega_logradouro AS logradouro, entrega_cidade AS cidade, entrega_uf AS uf,
              entrega_lat::float8 AS lat, entrega_lng::float8 AS lng, entrega_geocodificado_em IS NOT NULL AS geocodificado
         FROM pedidos WHERE id = $1`,
      [pedidoId],
    );
    return rows[0];
  }

  async function rotaCom(clienteId: string) {
    const dia = umDia();
    const pedido = await pedidoAprovado(dia, clienteId);
    const { viagemId } = await tx((c) => adicionarPedido(c, dia, pedido, gerencia()));
    await tx((c) => mudarEtapa(c, viagemId, 'roteirizando'));
    return { viagemId, pedido };
  }

  it('pedido sem endereço ganha o seu, com o ponto colado, e o cadastro do cliente fica vazio', async () => {
    const novo = await tx((c) => insertClienteRapido(c, { nome: `${prefixo} Sem endereço`, telefone: null }));
    const { viagemId, pedido } = await rotaCom(novo);
    await tx((c) =>
      salvarEnderecoDeEntrega(c, viagemId, pedido, {
        logradouro: 'Estrada Geral, km 3',
        cidade: 'Ibirama',
        uf: 'SC',
        cep: null,
        ponto: { lat: -27.05, lng: -49.52 },
      }),
    );
    expect(await destinoDe(pedido)).toEqual({
      logradouro: 'Estrada Geral, km 3',
      cidade: 'Ibirama',
      uf: 'SC',
      lat: -27.05,
      lng: -49.52,
      geocodificado: true,
    });
    expect(await entregaDe(novo)).toEqual([]);
    // A rota pede outra sugestão, agora com o ponto
    expect((await findViagem(pool, viagemId))!.sugerirOrdem).toBe(true);
    const [parada] = await listParadas(pool, viagemId);
    expect(parada).toMatchObject({ entregaPropria: true, lat: -27.05, naoAchado: false, cidade: 'Ibirama' });
  });

  it('o destino do pedido tem prioridade sobre o do cliente, sem trocá-lo', async () => {
    const novo = await tx((c) => insertClienteRapido(c, { nome: `${prefixo} Muda de endereço`, telefone: null }));
    await pool.query(
      `INSERT INTO cadastro.pessoas_enderecos (pessoa_id, tipo, logradouro, cidade, lat, lng, geocodificado_em)
       VALUES ($1, 'entrega', 'Rua Velha', 'Lontras', -27.1, -49.5, NOW())`,
      [novo],
    );
    const { viagemId, pedido } = await rotaCom(novo);
    expect((await listParadas(pool, viagemId))[0]).toMatchObject({ entregaPropria: false, cidade: 'Lontras', lat: -27.1 });

    const ponto = { lat: -27.2, lng: -49.6 };
    await tx((c) => salvarEnderecoDeEntrega(c, viagemId, pedido, { logradouro: 'Rua Nova', cidade: 'Ituporanga', uf: null, cep: null, ponto }));
    expect((await listParadas(pool, viagemId))[0]).toMatchObject({ entregaPropria: true, cidade: 'Ituporanga', lat: -27.2 });
    expect((await findPedido(pool, pedido))!.entrega).toEqual({ endereco: 'Rua Nova, Ituporanga', propria: true });
    expect(await entregaDe(novo)).toEqual([
      { logradouro: 'Rua Velha', cidade: 'Lontras', uf: null, lat: -27.1, lng: -49.5, geocodificado: true },
    ]);

    // O texto novo sem ponto apaga a coordenada do texto velho
    await tx((c) => salvarEnderecoDeEntrega(c, viagemId, pedido, { logradouro: 'Rua Outra', cidade: null, uf: null, cep: null, ponto: null }));
    expect(await destinoDe(pedido)).toMatchObject({ logradouro: 'Rua Outra', lat: null, lng: null, geocodificado: false });
  });

  it('só pedido desta viagem, e só na etapa da rota', async () => {
    const { viagemId, pedido } = await rotaCom(cliente);
    const estranho = await pedidoAprovado(null);
    const endereco = { logradouro: 'Rua X', cidade: null, uf: null, cep: null, ponto: null };
    await expect(tx((c) => salvarEnderecoDeEntrega(c, viagemId, estranho, endereco))).rejects.toThrow(/não está nesta viagem/);
    await tx((c) => mudarEtapa(c, viagemId, 'montando'));
    await expect(tx((c) => salvarEnderecoDeEntrega(c, viagemId, pedido, endereco))).rejects.toThrow(/etapa da rota/);
  });
});
