import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { concluirCarga, listCargas, marcarItemSeparado } from '../cargas';
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
  findViagem,
  iniciarCarregamento,
  listParadas,
  mudarEtapa,
  pedidosDisponiveis,
  removerParada,
  salvarOrdem,
  sugerirRota,
  tirarPedido,
  viagemDoDia,
  viagensEmAndamento,
} from '../viagens';

/**
 * A viagem de entrega (P14) contra Postgres real. O que se confere aqui é o que
 * o teste com mock não alcança: a data gravada no pedido, a troca de posições
 * com a unicidade deferida, a retomada na etapa certa e a viagem ficando pronta
 * junto com a última carga.
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

  it('só pedido aprovado entra', async () => {
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
    await expect(tx((c) => adicionarPedido(c, umDia(), id, gerencia()))).rejects.toThrow(/só pedido aprovado/);
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
});

describe('o carregamento (Tela 3)', () => {
  it('cria uma carga por pedido, e a viagem fica pronta junto com a última', async () => {
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

    await expect(tx((c) => concluirViagem(c, viagemId, gerencia()))).rejects.toThrow(/Faltam separar 2 itens/);

    // Sair no meio: o que foi marcado continua marcado
    await tx((c) => marcarItemSeparado(c, grupos[0].itens[0].id, true));
    expect((await cargasDaViagem(pool, viagemId))[0].itens[0].separado).toBe(true);

    await tx((c) => marcarItemSeparado(c, grupos[1].itens[0].id, true));
    await expect(tx((c) => concluirViagem(c, viagemId, gerencia()))).resolves.toEqual({ pedidos: 2 });

    expect((await findPedido(pool, a))!.situacao).toBe('pronto_envio');
    expect((await findPedido(pool, b))!.situacao).toBe('pronto_envio');
    expect((await viagemDoDia(pool, dia))!.situacao).toBe('pronta');
    expect((await viagensEmAndamento(pool)).map((v) => v.id)).not.toContain(viagemId);
    // "Planejar outra viagem neste dia" ignora a pronta
    expect(await viagemDoDia(pool, dia, { nova: true })).toBeNull();
  });

  it('a carga fechada pela tela do pedido também leva a viagem a pronta', async () => {
    const dia = umDia();
    const pedido = await pedidoAprovado(dia);
    const { viagemId } = await tx((c) => adicionarPedido(c, dia, pedido, gerencia()));
    await tx((c) => mudarEtapa(c, viagemId, 'roteirizando'));
    await tx((c) => iniciarCarregamento(c, viagemId, gerencia()));

    const [carga] = await listCargas(pool, pedido);
    await tx((c) => marcarItemSeparado(c, carga.itens[0].id, true));
    await tx((c) => concluirCarga(c, carga.id, gerencia()));
    expect((await viagemDoDia(pool, dia))!.situacao).toBe('pronta');
  });

  it('pedido que saiu de aprovado no meio do caminho recusa a viagem inteira', async () => {
    const { viagemId, a, b } = await viagemNaRota();
    await pool.query("UPDATE pedidos SET situacao = 'cancelado' WHERE id = $1", [b]);
    await expect(tx((c) => iniciarCarregamento(c, viagemId, gerencia()))).rejects.toThrow(/ainda não se organiza/);
    expect(await listCargas(pool, a)).toEqual([]);
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
