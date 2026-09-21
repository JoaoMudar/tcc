import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertArea, insertCanteiro } from '../areas';
import { hojeNoViveiro, somaDias } from '../datas';
import { saldoPronto } from '../estoque';
import { alterarFase, criarLote } from '../lotes';
import { registrarMovimento } from '../movimentos';
import {
  SITUACOES_PEDIDO,
  adicionarItem,
  atualizarItem,
  cancelarPedido,
  concluirVerificacao,
  confirmarPedido,
  criarPedido,
  definirComposicaoGenerico,
  findPedido,
  iniciarVerificacao,
  listClientes,
  listEspeciesPermitidas,
  listHistorico,
  listItens,
  listPedidos,
  marcarDisponibilidade,
  mudarSituacao,
  removerItem,
  salvarObservacoesVerificacao,
  totalPedido,
} from '../pedidos';
import { insertClienteRapido } from '../pessoas';
import { insertRecipiente } from '../recipientes';
import { withTransaction } from '../transaction';

/**
 * O pedido contra Postgres real (T8.1 a T8.4). O que se confere aqui é o que o
 * teste puro não alcança: que confirmar trava o item de verdade (TA-53), que os
 * filtros recortam mesmo (TA-54) e que o saldo exibido no item sai dos lotes, e
 * muda quando uma perda é registrada, que é a interligação da Fase 8.
 */

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `tp${randomUUID().slice(0, 6)}`;
const tx = <T>(fn: (client: PoolClient) => Promise<T>) => withTransaction(pool, fn);

/** Quem assina a mudança de situação nos testes (RN-52). */
const chefia = () => ({ perfil: 'chefia' as const, usuarioId: usuario });
const gerencia = () => ({ perfil: 'gerencia' as const, usuarioId: usuario });

let usuario: string;
let cliente: string;
let outroCliente: string;
let especie: string;
let tubete: string;
let saco: string;
let canteiro: string;

function itens() {
  return [
    { especieId: especie, recipienteId: tubete, quantidade: 200, precoCentavos: 250 },
    { especieId: especie, recipienteId: saco, quantidade: 50, precoCentavos: 1250 },
    { especieId: especie, recipienteId: tubete, quantidade: 1, precoCentavos: 999 },
  ];
}

/**
 * Do maior para o menor. Os três itens de `itens()` entram na mesma transação e
 * dois deles têm a mesma espécie e o mesmo recipiente, então a ordem de leitura
 * os empata e o desempate cai no identificador, que é aleatório. Escolher por
 * posição daria um teste que passa ou falha conforme o UUID sorteado.
 */
function porQuantidade(itens: readonly { id: string; quantidade: number }[]) {
  return [...itens].sort((a, b) => b.quantidade - a.quantidade);
}

function novoPedido(extra: Partial<Parameters<typeof criarPedido>[1]> = {}) {
  return tx((client) =>
    criarPedido(client, {
      clienteId: cliente,
      canal: 'atacado',
      dataEntrega: null,
      observacoes: null,
      itens: itens(),
      criadoPor: usuario,
      ...extra,
    }),
  );
}

/**
 * O caminho até a aprovação. No fluxo de oito situações ela não é mais um passo
 * a partir do cadastro: a gerência confere antes, e é a conferência que
 * habilita a chefia a aprovar.
 */
async function aprovar(id: string) {
  await tx((c) => mudarSituacao(c, id, 'verificando', gerencia()));
  await tx((c) => mudarSituacao(c, id, 'verificado', gerencia()));
  return tx((c) => confirmarPedido(c, id, chefia()));
}

beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, senha_hash, perfil, deve_trocar_senha)
     VALUES ($1, 'Chefia de teste', 'x', 'chefia', false) RETURNING id`,
    [prefixo],
  );
  usuario = rows[0].id;

  cliente = await tx((client) => insertClienteRapido(client, { nome: `${prefixo} Cliente`, telefone: null }));
  outroCliente = await tx((client) => insertClienteRapido(client, { nome: `${prefixo} Outro`, telefone: null }));

  ({
    rows: [{ id: especie }],
  } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [
    `${prefixo} Araucaria`,
  ]));
  tubete = await insertRecipiente(pool, { nome: `${prefixo} tubete`, volumeLitros: 0.055 });
  saco = await insertRecipiente(pool, { nome: `${prefixo} saco`, volumeLitros: 3 });

  const area = await insertArea(pool, { letra: 'P', nome: 'Pedidos' });
  canteiro = (await insertCanteiro(pool, { areaId: area, numero: 1, capacidade: null }))!;
});

afterAll(async () => {
  await pool.end();
});

describe('cadastro do pedido (T8.1, RF-54, RF-55)', () => {
  it('nasce cadastrado, com número sequencial e os três itens (TA-51)', async () => {
    const primeiro = await novoPedido();
    const segundo = await novoPedido();
    expect(segundo.numero).toBe(primeiro.numero + 1);

    const ficha = (await findPedido(pool, primeiro.id))!;
    expect(ficha.situacao).toBe('cadastrado');
    expect(ficha.canal).toBe('atacado');
    expect(ficha.cliente).toBe(`${prefixo} Cliente`);
    expect(ficha.itens).toHaveLength(3);
  });

  it('o total do pedido reproduz a soma de quantidade por preço (TA-52)', async () => {
    const { id } = await novoPedido();
    const ficha = (await findPedido(pool, id))!;
    // 200 × 2,50 + 50 × 12,50 + 1 × 9,99
    expect(totalPedido(ficha.itens)).toBe(50_000 + 62_500 + 999);

    const naLista = (await listPedidos(pool, { de: hojeNoViveiro(), ate: hojeNoViveiro(), clienteId: null, canal: null })).find(
      (p) => p.id === id,
    )!;
    // A lista soma no SQL, e tem de dar o mesmo que a soma dos itens
    expect(naLista.totalCentavos).toBe(totalPedido(ficha.itens));
    expect(naLista.itens).toBe(3);
  });

  it('o preço volta do banco com os centavos intactos', async () => {
    const { id } = await novoPedido();
    const item = (await listItens(pool, id)).find((i) => i.recipienteId === tubete && i.quantidade === 200)!;
    expect(item.precoCentavos).toBe(250);
  });

  it('os itens saem em ordem estável, e não na ordem em que o banco os devolver', async () => {
    const { id } = await novoPedido();
    const chaves = (await listItens(pool, id)).map((i) => `${i.recipiente}:${i.quantidade}`);
    expect(chaves).toEqual((await listItens(pool, id)).map((i) => `${i.recipiente}:${i.quantidade}`));
    // Agrupados por recipiente: o saco antes do tubete, e os dois tubetes juntos
    expect(chaves[0]).toContain('saco');
  });

  it('pedido sem item nenhum não gasta número', async () => {
    await expect(novoPedido({ itens: [] })).rejects.toThrow(/ao menos um item/i);
  });
});

describe('situação do pedido (T8.3, T8.6, RF-57)', () => {
  it('aprovado recusa alterar, acrescentar e remover item (TA-53)', async () => {
    const { id } = await novoPedido();
    const [item] = await listItens(pool, id);
    await aprovar(id);
    expect((await findPedido(pool, id))!.situacao).toBe('aprovado');

    const novo = { especieId: especie, recipienteId: tubete, quantidade: 10, precoCentavos: 100 };
    await expect(tx((c) => atualizarItem(c, id, item.id, { quantidade: 999, precoCentavos: 100 }))).rejects.toThrow(
      /não muda/i,
    );
    await expect(tx((c) => adicionarItem(c, id, novo))).rejects.toThrow(/não muda/i);
    await expect(tx((c) => removerItem(c, id, item.id))).rejects.toThrow(/não muda/i);

    // E o item continua como estava: a recusa não gravou metade
    const [depois] = await listItens(pool, id);
    expect(depois.quantidade).toBe(item.quantidade);
    expect(depois.precoCentavos).toBe(item.precoCentavos);
  });

  it('o pedido cadastrado aceita alterar, acrescentar e remover', async () => {
    const { id } = await novoPedido();
    const item = (await listItens(pool, id)).find((i) => i.recipienteId === tubete && i.quantidade === 200)!;
    await tx((c) => atualizarItem(c, id, item.id, { quantidade: 300, precoCentavos: 275 }));
    await tx((c) => adicionarItem(c, id, { especieId: especie, recipienteId: saco, quantidade: 5, precoCentavos: 1500 }));
    const depois = await listItens(pool, id);
    expect(depois).toHaveLength(4);
    expect(depois.find((i) => i.id === item.id)).toMatchObject({ quantidade: 300, precoCentavos: 275 });

    await tx((c) => removerItem(c, id, item.id));
    expect(await listItens(pool, id)).toHaveLength(3);
  });

  it('aprovar duas vezes é recusado, e o pedido sem item não é aprovado', async () => {
    const { id } = await novoPedido();
    await aprovar(id);
    await expect(tx((c) => confirmarPedido(c, id, chefia()))).rejects.toThrow(/não pode passar/i);

    const vazio = await novoPedido();
    for (const item of await listItens(pool, vazio.id)) await tx((c) => removerItem(c, vazio.id, item.id));
    await expect(tx((c) => confirmarPedido(c, vazio.id, chefia()))).rejects.toThrow(/ao menos um item/i);
  });

  it('o aprovado cancela, e o cancelado não cancela de novo', async () => {
    const { id } = await novoPedido();
    await aprovar(id);
    await tx((c) => cancelarPedido(c, id, chefia()));
    expect((await findPedido(pool, id))!.situacao).toBe('cancelado');
    // Os itens ficam para consulta: cancelar não apaga
    expect(await listItens(pool, id)).toHaveLength(3);
    await expect(tx((c) => cancelarPedido(c, id, chefia()))).rejects.toThrow(/não pode passar/i);
  });

  it('o cancelado também não aceita item novo', async () => {
    const { id } = await novoPedido();
    await tx((c) => cancelarPedido(c, id, chefia()));
    await expect(
      tx((c) => adicionarItem(c, id, { especieId: especie, recipienteId: tubete, quantidade: 1, precoCentavos: 100 })),
    ).rejects.toThrow(/cancelado/i);
  });
});

describe('lista com filtro (T8.4, RF-58, TA-54)', () => {
  const hoje = hojeNoViveiro();
  const periodoDeHoje = { de: hoje, ate: hoje };

  it('filtra por cliente', async () => {
    const meu = await novoPedido();
    const alheio = await novoPedido({ clienteId: outroCliente });
    const lista = await listPedidos(pool, { ...periodoDeHoje, clienteId: cliente, canal: null });
    const ids = lista.map((p) => p.id);
    expect(ids).toContain(meu.id);
    expect(ids).not.toContain(alheio.id);
  });

  it('filtra por canal', async () => {
    const varejo = await novoPedido({ canal: 'varejo' });
    const atacado = await novoPedido();
    const lista = await listPedidos(pool, { ...periodoDeHoje, clienteId: null, canal: 'varejo' });
    const ids = lista.map((p) => p.id);
    expect(ids).toContain(varejo.id);
    expect(ids).not.toContain(atacado.id);
  });

  it('filtra por período, e o pedido de hoje fica fora do intervalo de ontem', async () => {
    const { id } = await novoPedido();
    const ontem = somaDias(hoje, -1);
    const deOntem = await listPedidos(pool, { de: somaDias(hoje, -2), ate: ontem, clienteId: null, canal: null });
    expect(deOntem.map((p) => p.id)).not.toContain(id);

    const deHoje = await listPedidos(pool, { ...periodoDeHoje, clienteId: null, canal: null });
    expect(deHoje.map((p) => p.id)).toContain(id);
  });
});

describe('saldo de muda pronta no item (T8.2, RF-56, UC-32)', () => {
  it('sai dos lotes prontos, e a perda registrada muda o número exibido (TA-64)', async () => {
    const lote = await tx((client) =>
      criarLote(client, {
        especieId: especie,
        recipienteId: tubete,
        canteiroId: canteiro,
        quantidade: 500,
        dataCriacao: hojeNoViveiro(),
        observacoes: null,
        registradoPor: usuario,
      }),
    );

    // Lote que ainda não está pronto não entra no saldo do item (RN-06)
    const antesDePronto = await saldoPronto(pool, { especieId: especie, recipienteId: tubete });
    expect(antesDePronto).toHaveLength(0);

    await alterarFase(pool, lote.id, 'pronto');
    const [pronto] = await saldoPronto(pool, { especieId: especie, recipienteId: tubete });
    expect(pronto.quantidade).toBe(500);

    // É esta a interligação da Fase 8: a perda no lote muda o saldo do item
    await tx((client) =>
      registrarMovimento(client, { loteId: lote.id, tipo: 'perda', quantidade: -120, causa: 'seca', registradoPor: usuario }),
    );
    const [depois] = await saldoPronto(pool, { especieId: especie, recipienteId: tubete });
    expect(depois.quantidade).toBe(380);

    // E o item do pedido daquela espécie e recipiente continua o mesmo: o pedido lê, e não reserva
    const { id } = await novoPedido();
    const item = (await listItens(pool, id)).find((i) => i.recipienteId === tubete && i.precoCentavos === 250)!;
    expect(item.quantidade).toBe(200);
  });
});

describe('fluxo e histórico (T8.6, RF-57, RN-52)', () => {
  it('a lista fechada do banco é a mesma do TypeScript', async () => {
    // As oito situações vivem no CHECK e em SITUACOES_PEDIDO. Este teste existe
    // para as duas não divergirem em silêncio quando uma delas mudar.
    const { rows } = await pool.query<{ def: string }>(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'pedidos_situacao_valida'",
    );
    const noBanco = [...rows[0].def.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(noBanco).toEqual(Object.keys(SITUACOES_PEDIDO).sort());
  });

  it('o pedido nasce com a primeira linha do histórico, e ela não tem situação anterior', async () => {
    const { id } = await novoPedido();
    const historico = await listHistorico(pool, id);
    expect(historico).toHaveLength(1);
    expect(historico[0]).toMatchObject({ situacaoAnterior: null, situacaoNova: 'cadastrado' });
    expect(historico[0].alteradoPor).toBe('Chefia de teste');
  });

  it('cada mudança grava de onde veio, para onde foi e quem assinou', async () => {
    const { id } = await novoPedido();
    await tx((c) => mudarSituacao(c, id, 'verificando', gerencia()));
    await tx((c) => mudarSituacao(c, id, 'verificado', gerencia(), 'Faltou ipê.'));

    const historico = await listHistorico(pool, id);
    expect(historico.map((h) => h.situacaoNova)).toEqual(['cadastrado', 'verificando', 'verificado']);
    expect(historico.at(-1)).toMatchObject({ situacaoAnterior: 'verificando', observacoes: 'Faltou ipê.' });
  });

  it('a gerência não aprova, e a recusa não deixa o pedido pela metade', async () => {
    const { id } = await novoPedido();
    await tx((c) => mudarSituacao(c, id, 'verificando', gerencia()));
    await tx((c) => mudarSituacao(c, id, 'verificado', gerencia()));

    await expect(tx((c) => mudarSituacao(c, id, 'aprovado', gerencia()))).rejects.toThrow(/não pode passar/i);
    expect((await findPedido(pool, id))!.situacao).toBe('verificado');
    expect(await listHistorico(pool, id)).toHaveLength(3);
  });

  it('não se pula etapa: do cadastro não se vai direto a aprovado', async () => {
    const { id } = await novoPedido();
    await expect(tx((c) => mudarSituacao(c, id, 'pronto_envio', chefia()))).rejects.toThrow(/não pode passar/i);
    expect((await findPedido(pool, id))!.situacao).toBe('cadastrado');
  });

  it('o fluxo inteiro chega a pronto para envio, e de lá ainda cancela', async () => {
    const { id } = await novoPedido();
    await tx((c) => mudarSituacao(c, id, 'verificando', gerencia()));
    await tx((c) => mudarSituacao(c, id, 'verificado', gerencia()));
    await tx((c) => mudarSituacao(c, id, 'aprovado', chefia()));
    await tx((c) => mudarSituacao(c, id, 'separando', gerencia()));
    await tx((c) => mudarSituacao(c, id, 'pronto_envio', gerencia()));
    expect((await findPedido(pool, id))!.situacao).toBe('pronto_envio');

    // A decisão de 21/09/2026: a venda que cai depois de pronta fica registrada
    await tx((c) => cancelarPedido(c, id, chefia()));
    expect((await findPedido(pool, id))!.situacao).toBe('cancelado');
  });
});

describe('clientes oferecidos ao pedido', () => {
  it('traz quem tem o papel de cliente ativo (RN-45)', async () => {
    const lista = await listClientes(pool);
    expect(lista.map((c) => c.id)).toContain(cliente);
  });
});

/**
 * A conferência no pátio (T8.10) e a aprovação que consome o que ela apurou
 * (T8.11). Aqui é contra Postgres real porque quase tudo é SQL, e porque as
 * restrições da migration fazem parte da regra: o CHECK é que garante que
 * parcial e indisponível não se confundam.
 */
describe('verificação de disponibilidade (T8.10)', () => {
  async function emVerificacao() {
    const { id } = await novoPedido();
    await tx((c) => iniciarVerificacao(c, id, gerencia()));
    return { id, itens: await listItens(pool, id) };
  }

  it('abrir a conferência é idempotente: a tela a chama toda vez que é aberta', async () => {
    const { id } = await novoPedido();
    expect(await tx((c) => iniciarVerificacao(c, id, gerencia()))).toMatchObject({ iniciada: true });

    // Segunda abertura não muda nada, e não vira linha de histórico
    expect(await tx((c) => iniciarVerificacao(c, id, gerencia()))).toMatchObject({ iniciada: false });
    expect((await findPedido(pool, id))!.situacao).toBe('verificando');
    const idas = (await listHistorico(pool, id)).filter((h) => h.situacaoNova === 'verificando');
    expect(idas).toHaveLength(1);
  });

  it('disponível, parcial e indisponível gravam as três formas da mesma coluna', async () => {
    const { id, itens: doPedido } = await emVerificacao();
    // Escolhidos pela quantidade, e não pela posição: os dois itens de mesma
    // espécie e mesmo recipiente empatam na ordenação, e o desempate é o id
    const [grande, medio, pequeno] = porQuantidade(doPedido);
    await tx((c) => marcarDisponibilidade(c, id, medio.id, 'disponivel'));
    await tx((c) => marcarDisponibilidade(c, id, grande.id, 'parcial', { quantidade: 30, recipienteId: tubete }));
    await tx((c) => marcarDisponibilidade(c, id, pequeno.id, 'indisponivel'));

    const depois = new Map((await listItens(pool, id)).map((item) => [item.id, item]));
    expect(depois.get(medio.id)).toMatchObject({ disponivel: true, quantidadeDisponivel: null });
    // O recipiente conferido pode ser outro: achou em tubete o que foi pedido em saco
    expect(depois.get(grande.id)).toMatchObject({ disponivel: false, quantidadeDisponivel: 30, recipienteDisponivelId: tubete });
    expect(depois.get(pequeno.id)).toMatchObject({ disponivel: false, quantidadeDisponivel: 0, recipienteDisponivelId: null });
  });

  it('parcial igual ou maior que o pedido é recusada, e o CHECK do banco diria o mesmo', async () => {
    const { id, itens: doPedido } = await emVerificacao();
    const cheio = doPedido[0].quantidade;
    await expect(
      tx((c) => marcarDisponibilidade(c, id, doPedido[0].id, 'parcial', { quantidade: cheio, recipienteId: tubete })),
    ).rejects.toThrow(/disponível/i);
    expect((await listItens(pool, id))[0].disponivel).toBeNull();
  });

  it('a observação sozinha não marca o item como respondido', async () => {
    const { id, itens: doPedido } = await emVerificacao();
    await tx((c) => salvarObservacoesVerificacao(c, id, [{ itemId: doPedido[0].id, observacoes: 'ver com o Gilberto' }]));

    const [item] = await listItens(pool, id);
    expect(item.observacoesDisponibilidade).toBe('ver com o Gilberto');
    expect(item.disponivel).toBeNull();
  });

  it('fora da conferência não se marca item, porque o pedido já seguiu adiante', async () => {
    const { id } = await novoPedido();
    const [item] = await listItens(pool, id);
    await expect(tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel'))).rejects.toThrow(/conferência/i);
  });

  it('item de outro pedido não é marcado por aqui', async () => {
    const { id } = await emVerificacao();
    const alheio = await novoPedido();
    const [itemAlheio] = await listItens(pool, alheio.id);
    await expect(tx((c) => marcarDisponibilidade(c, id, itemAlheio.id, 'disponivel'))).rejects.toThrow(/não encontrado/i);
  });

  it('não se envia à chefia pela metade', async () => {
    const { id, itens: doPedido } = await emVerificacao();
    await tx((c) => marcarDisponibilidade(c, id, doPedido[0].id, 'disponivel'));

    await expect(tx((c) => concluirVerificacao(c, id, gerencia()))).rejects.toThrow(/sem resposta/i);
    expect((await findPedido(pool, id))!.situacao).toBe('verificando');
  });

  it('com tudo respondido, o resumo da conferência fica no histórico', async () => {
    const { id, itens: doPedido } = await emVerificacao();
    await tx((c) => marcarDisponibilidade(c, id, doPedido[0].id, 'disponivel'));
    await tx((c) => marcarDisponibilidade(c, id, doPedido[1].id, 'disponivel'));
    await tx((c) => marcarDisponibilidade(c, id, doPedido[2].id, 'indisponivel'));

    const { resumo } = await tx((c) => concluirVerificacao(c, id, gerencia()));
    expect(resumo).toBe('2 de 3 disponíveis.');
    expect((await findPedido(pool, id))!.situacao).toBe('verificado');
    expect((await listHistorico(pool, id)).at(-1)).toMatchObject({ situacaoNova: 'verificado', observacoes: resumo });
  });
});

describe('aprovação consome a conferência (T8.11)', () => {
  /** Leva o pedido até `verificado`, com a mesma resposta para todos os itens. */
  async function verificadoCom(estado: 'disponivel' | 'indisponivel') {
    const { id } = await novoPedido();
    await tx((c) => iniciarVerificacao(c, id, gerencia()));
    for (const item of await listItens(pool, id)) await tx((c) => marcarDisponibilidade(c, id, item.id, estado));
    await tx((c) => concluirVerificacao(c, id, gerencia()));
    return id;
  }

  /** Um disponível, um parcial e um indisponível, e devolve quem é quem. */
  async function conferido(parcial: number) {
    const { id } = await novoPedido();
    await tx((c) => iniciarVerificacao(c, id, gerencia()));
    const [grande, medio, pequeno] = porQuantidade(await listItens(pool, id));
    await tx((c) => marcarDisponibilidade(c, id, medio.id, 'disponivel'));
    await tx((c) => marcarDisponibilidade(c, id, grande.id, 'parcial', { quantidade: parcial, recipienteId: tubete }));
    await tx((c) => marcarDisponibilidade(c, id, pequeno.id, 'indisponivel'));
    await tx((c) => concluirVerificacao(c, id, gerencia()));
    return { id, grande, medio, pequeno };
  }

  it('o indisponível sai do pedido e o parcial passa a valer pelo que existe', async () => {
    const { id, grande, pequeno } = await conferido(30);

    const resultado = await tx((c) => confirmarPedido(c, id, chefia()));
    expect(resultado).toMatchObject({ removidos: 1, ajustados: 1 });

    const depois = await listItens(pool, id);
    expect(depois).toHaveLength(2);
    // O parcial virou quantidade cheia no recipiente real: quem separa não refaz a conta
    const ajustado = depois.find((i) => i.id === grande.id)!;
    expect(ajustado).toMatchObject({ quantidade: 30, recipienteId: tubete });
    // E deixou de ser parcial: o pedido passou a pedir exatamente o que existe
    expect(ajustado).toMatchObject({ disponivel: true, quantidadeDisponivel: null });
    expect(depois.map((i) => i.id)).not.toContain(pequeno.id);
  });

  it('o que a aprovação mexeu fica escrito no histórico', async () => {
    const { id } = await conferido(10);
    await tx((c) => confirmarPedido(c, id, chefia()));

    expect((await listHistorico(pool, id)).at(-1)).toMatchObject({
      situacaoNova: 'aprovado',
      observacoes: '1 item(ns) removido(s), 1 ajustado(s) pela conferência.',
    });
  });

  it('a aprovação sem nada a consumir não inventa observação', async () => {
    const id = await verificadoCom('disponivel');
    await tx((c) => confirmarPedido(c, id, chefia()));
    expect((await listHistorico(pool, id)).at(-1)).toMatchObject({ situacaoNova: 'aprovado', observacoes: null });
  });

  it('pedido em que nada sobrou não é aprovado, e diz por quê', async () => {
    const id = await verificadoCom('indisponivel');

    await expect(tx((c) => confirmarPedido(c, id, chefia()))).rejects.toThrow(/não sobrou item disponível/i);
    // E a recusa não deixou o pedido pela metade: os itens continuam lá
    expect(await listItens(pool, id)).toHaveLength(3);
    expect((await findPedido(pool, id))!.situacao).toBe('verificado');
  });

  it('a pergunta da nota é respondida na aprovação, e antes dela a coluna é nula', async () => {
    const id = await verificadoCom('disponivel');
    const antes = await pool.query<{ precisa: boolean | null }>('SELECT precisa_nota AS precisa FROM pedidos WHERE id = $1', [id]);
    expect(antes.rows[0].precisa).toBeNull();

    await tx((c) => confirmarPedido(c, id, chefia(), { precisaNota: true }));

    const depois = await pool.query<{ precisa: boolean | null }>('SELECT precisa_nota AS precisa FROM pedidos WHERE id = $1', [id]);
    expect(depois.rows[0].precisa).toBe(true);
  });
});

describe('item genérico (T8.10)', () => {
  let outraEspecie: string;

  beforeAll(async () => {
    const { rows } = await pool.query<{ id: string }>(
      'INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id',
      [`${prefixo} Cedrela`],
    );
    outraEspecie = rows[0].id;
  });

  /** Um pedido com um item genérico só: 500 mudas nativas, no mínimo tubete. */
  async function comGenerico(especiesPermitidas: readonly string[] = []) {
    const { id } = await tx((client) =>
      criarPedido(client, {
        clienteId: cliente,
        canal: 'compensacao',
        dataEntrega: null,
        observacoes: null,
        criadoPor: usuario,
        itens: [
          {
            especieId: null,
            recipienteId: tubete,
            quantidade: 500,
            precoCentavos: 200,
            generico: true,
            especificacao: '500 mudas nativas, no mínimo tubete',
            especiesPermitidas,
          },
        ],
      }),
    );
    await tx((c) => iniciarVerificacao(c, id, gerencia()));
    const [pai] = await listItens(pool, id);
    return { id, pai };
  }

  it('nasce sem espécie, com a especificação do cliente', async () => {
    const { pai } = await comGenerico();
    expect(pai).toMatchObject({ generico: true, especieId: null, especie: null, itemPaiId: null });
    expect(pai.especificacao).toBe('500 mudas nativas, no mínimo tubete');
  });

  it('a composição fecha a quantidade do pai, e o pai fica respondido', async () => {
    const { id, pai } = await comGenerico();
    await tx((c) =>
      definirComposicaoGenerico(c, id, pai.id, [
        { especieId: especie, recipienteId: tubete, quantidade: 300 },
        { especieId: outraEspecie, recipienteId: saco, quantidade: 200 },
      ]),
    );

    const itens = await listItens(pool, id);
    expect(itens).toHaveLength(3);
    expect(itens.find((i) => i.id === pai.id)!.disponivel).toBe(true);
    const filhos = itens.filter((i) => i.itemPaiId === pai.id);
    expect(filhos.map((f) => f.quantidade).sort((a, b) => a - b)).toEqual([200, 300]);
    // O filho herda o preço do pai, e o total do pedido não dobra
    expect(filhos.every((f) => f.precoCentavos === 200)).toBe(true);
    expect(totalPedido(itens)).toBe(500 * 200);
  });

  it('a soma que não fecha é recusada, e nenhum filho é criado', async () => {
    const { id, pai } = await comGenerico();
    await expect(
      tx((c) => definirComposicaoGenerico(c, id, pai.id, [{ especieId: especie, recipienteId: tubete, quantidade: 300 }])),
    ).rejects.toThrow(/faltam 200/i);
    expect(await listItens(pool, id)).toHaveLength(1);
  });

  it('recompor troca os filhos, em vez de acrescentar aos anteriores', async () => {
    const { id, pai } = await comGenerico();
    await tx((c) =>
      definirComposicaoGenerico(c, id, pai.id, [{ especieId: especie, recipienteId: tubete, quantidade: 500 }]),
    );
    await tx((c) =>
      definirComposicaoGenerico(c, id, pai.id, [
        { especieId: especie, recipienteId: tubete, quantidade: 250 },
        { especieId: outraEspecie, recipienteId: tubete, quantidade: 250 },
      ]),
    );

    const filhos = (await listItens(pool, id)).filter((i) => i.itemPaiId === pai.id);
    expect(filhos).toHaveLength(2);
    expect(filhos.reduce((soma, f) => soma + f.quantidade, 0)).toBe(500);
  });

  it('o escopo do cliente é bloqueio no servidor, e não apenas filtro da busca', async () => {
    const { id, pai } = await comGenerico([especie]);
    expect(await listEspeciesPermitidas(pool, pai.id)).toEqual([especie]);

    await expect(
      tx((c) => definirComposicaoGenerico(c, id, pai.id, [{ especieId: outraEspecie, recipienteId: tubete, quantidade: 500 }])),
    ).rejects.toThrow(/aceita/i);

    // E a espécie de dentro do escopo passa
    await tx((c) => definirComposicaoGenerico(c, id, pai.id, [{ especieId: especie, recipienteId: tubete, quantidade: 500 }]));
    expect((await listItens(pool, id)).filter((i) => i.itemPaiId === pai.id)).toHaveLength(1);
  });

  it('o genérico não se marca por disponível ou indisponível', async () => {
    const { id, pai } = await comGenerico();
    await expect(tx((c) => marcarDisponibilidade(c, id, pai.id, 'disponivel'))).rejects.toThrow(/genérico/i);
  });

  it('o genérico sem composição segura o envio à chefia', async () => {
    const { id } = await comGenerico();
    await expect(tx((c) => concluirVerificacao(c, id, gerencia()))).rejects.toThrow(/sem resposta/i);
  });

  it('a composição sai logo abaixo do pai que ela compõe', async () => {
    const { id, pai } = await comGenerico();
    await tx((c) =>
      definirComposicaoGenerico(c, id, pai.id, [
        { especieId: especie, recipienteId: tubete, quantidade: 300 },
        { especieId: outraEspecie, recipienteId: saco, quantidade: 200 },
      ]),
    );
    const itens = await listItens(pool, id);
    expect(itens[0].id).toBe(pai.id);
    expect(itens.slice(1).every((i) => i.itemPaiId === pai.id)).toBe(true);
  });
});
