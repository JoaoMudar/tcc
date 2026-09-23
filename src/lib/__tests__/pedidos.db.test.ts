import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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
  negociarItens,
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

/** Uma linha de negociação que só põe preço. */
const soPreco = (itemId: string, precoCentavos: number) => ({ itemId, precoCentavos, quantidade: null, recipienteId: null });

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
function porQuantidade(itens: readonly { id: string; quantidade: number | null }[]) {
  return [...itens].sort((a, b) => b.quantidade! - a.quantidade!);
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

  it('o pedido sem preço não vale zero na carteira: o total é indefinido', async () => {
    const { id } = await novoPedido({ itens: itens().map((item) => ({ ...item, precoCentavos: null })) });
    const naLista = (await listPedidos(pool, { de: hojeNoViveiro(), ate: hojeNoViveiro(), clienteId: null, canal: null })).find(
      (p) => p.id === id,
    )!;
    expect(naLista.totalCentavos).toBeNull();
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

  it('a altura pedida vai e volta em metros, e nula é o caso comum', async () => {
    const { id } = await novoPedido({
      itens: [
        { especieId: especie, recipienteId: tubete, quantidade: 10, precoCentavos: null, alturaM: 1.2 },
        { especieId: especie, recipienteId: saco, quantidade: 20, precoCentavos: null },
      ],
    });
    const lidos = await listItens(pool, id);
    expect(lidos.find((item) => item.quantidade === 10)!.alturaM).toBe(1.2);
    expect(lidos.find((item) => item.quantidade === 20)!.alturaM).toBeNull();
  });

  it('alterar o item muda a altura, e o campo apagado a torna nula de novo', async () => {
    const { id } = await novoPedido({
      itens: [{ especieId: especie, recipienteId: tubete, quantidade: 10, precoCentavos: null, alturaM: 1.2 }],
    });
    const [item] = await listItens(pool, id);

    await tx((c) => atualizarItem(c, id, item.id, { quantidade: 10, alturaM: 0.8 }));
    expect((await listItens(pool, id))[0].alturaM).toBe(0.8);

    await tx((c) => atualizarItem(c, id, item.id, { quantidade: 10, alturaM: null }));
    expect((await listItens(pool, id))[0].alturaM).toBeNull();
  });

  it('o banco recusa altura zerada e altura de árvore adulta', async () => {
    const comAltura = (alturaM: number) =>
      novoPedido({ itens: [{ especieId: especie, recipienteId: tubete, quantidade: 10, precoCentavos: null, alturaM }] });
    await expect(comAltura(0)).rejects.toThrow(/altura_positiva/);
    await expect(comAltura(25)).rejects.toThrow(/altura_positiva/);
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
    await expect(tx((c) => atualizarItem(c, id, item.id, { quantidade: 999, alturaM: null }))).rejects.toThrow(
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
    await tx((c) => atualizarItem(c, id, item.id, { quantidade: 300, alturaM: null }));
    await tx((c) => adicionarItem(c, id, { especieId: especie, recipienteId: saco, quantidade: 5, precoCentavos: 1500 }));
    const depois = await listItens(pool, id);
    expect(depois).toHaveLength(4);
    // A quantidade mudou, e o preço não: ele não passa mais por esta porta
    expect(depois.find((i) => i.id === item.id)).toMatchObject({ quantidade: 300, precoCentavos: 250 });

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

  it('item sem quantidade nem recipiente entra no cadastro, e não segura a conferência', async () => {
    const { id } = await novoPedido({
      itens: [{ especieId: especie, recipienteId: null, quantidade: null, precoCentavos: null }],
    });
    const [item] = await listItens(pool, id);
    expect(item).toMatchObject({ quantidade: null, recipienteId: null, recipiente: null });

    await tx((c) => mudarSituacao(c, id, 'verificando', gerencia()));
    expect((await findPedido(pool, id))!.situacao).toBe('verificando');
  });

  it('a chefia completa o item no orçamento, e a resposta dada sobre o item antigo cai', async () => {
    const { id } = await novoPedido({
      itens: [{ especieId: especie, recipienteId: null, quantidade: 100, precoCentavos: null }],
    });
    const [item] = await listItens(pool, id);
    await tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel', gerencia(), { recipienteId: saco }));
    // A chefia recebe, reenvia (volta ao orçamento) e completa o recipiente
    await tx((c) => concluirVerificacao(c, id, gerencia()));
    await tx((c) => mudarSituacao(c, id, 'cadastrado', chefia()));
    await tx((c) => atualizarItem(c, id, item.id, { quantidade: 100, alturaM: null, recipienteId: tubete }));

    const [depois] = await listItens(pool, id);
    expect(depois).toMatchObject({ recipienteId: tubete, disponivel: null, recipienteDisponivelId: null });
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
    await tx((c) => marcarDisponibilidade(c, id, medio.id, 'disponivel', gerencia()));
    await tx((c) => marcarDisponibilidade(c, id, grande.id, 'parcial', gerencia(), { quantidade: 30, recipienteId: saco }));
    await tx((c) => marcarDisponibilidade(c, id, pequeno.id, 'indisponivel', gerencia()));

    const depois = new Map((await listItens(pool, id)).map((item) => [item.id, item]));
    expect(depois.get(medio.id)).toMatchObject({ disponivel: true, quantidadeDisponivel: null });
    // O recipiente conferido pode ser outro: achou em saco o que foi pedido em tubete
    expect(depois.get(grande.id)).toMatchObject({ disponivel: false, quantidadeDisponivel: 30, recipienteDisponivelId: saco });
    expect(depois.get(pequeno.id)).toMatchObject({ disponivel: false, quantidadeDisponivel: 0, recipienteDisponivelId: null });
  });

  it('parcial igual ou maior que o pedido é recusada, e o CHECK do banco diria o mesmo', async () => {
    const { id, itens: doPedido } = await emVerificacao();
    const cheio = doPedido[0].quantidade;
    await expect(
      tx((c) => marcarDisponibilidade(c, id, doPedido[0].id, 'parcial', gerencia(), { quantidade: cheio, recipienteId: tubete })),
    ).rejects.toThrow(/tem tudo/i);
    expect((await listItens(pool, id))[0].disponivel).toBeNull();
  });

  it('a observação sozinha não marca o item como respondido', async () => {
    const { id, itens: doPedido } = await emVerificacao();
    await tx((c) => salvarObservacoesVerificacao(c, id, [{ itemId: doPedido[0].id, observacoes: 'ver com o Gilberto' }], gerencia()));

    const [item] = await listItens(pool, id);
    expect(item.observacoesDisponibilidade).toBe('ver com o Gilberto');
    expect(item.disponivel).toBeNull();
  });

  it('responder o primeiro item abre a conferência, e o histórico registra quem abriu', async () => {
    // O gesto de abrir é a resposta: quem toca "Tem tudo" já começou a conferir,
    // e exigir um toque antes disso só rendia um erro que não era de ninguém.
    const { id } = await novoPedido();
    const [item] = await listItens(pool, id);
    await tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel', gerencia()));

    expect((await findPedido(pool, id))!.situacao).toBe('verificando');
    expect((await listItens(pool, id)).find((i) => i.id === item.id)!.disponivel).toBe(true);
    const aberturas = (await listHistorico(pool, id)).filter((h) => h.situacaoNova === 'verificando');
    expect(aberturas).toHaveLength(1);
  });

  it('depois de aprovado não se marca item, porque a apuração já foi consumida', async () => {
    const { id } = await novoPedido();
    const [item] = await listItens(pool, id);
    await aprovar(id);

    await expect(tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel', gerencia()))).rejects.toThrow(
      /conferência/i,
    );
  });

  it('item de outro pedido não é marcado por aqui', async () => {
    const { id } = await emVerificacao();
    const alheio = await novoPedido();
    const [itemAlheio] = await listItens(pool, alheio.id);
    await expect(tx((c) => marcarDisponibilidade(c, id, itemAlheio.id, 'disponivel', gerencia()))).rejects.toThrow(/não encontrado/i);
  });

  it('não se envia à chefia pela metade', async () => {
    const { id, itens: doPedido } = await emVerificacao();
    await tx((c) => marcarDisponibilidade(c, id, doPedido[0].id, 'disponivel', gerencia()));

    await expect(tx((c) => concluirVerificacao(c, id, gerencia()))).rejects.toThrow(/sem resposta/i);
    expect((await findPedido(pool, id))!.situacao).toBe('verificando');
  });

  it('com tudo respondido, o resumo da conferência fica no histórico', async () => {
    const { id, itens: doPedido } = await emVerificacao();
    await tx((c) => marcarDisponibilidade(c, id, doPedido[0].id, 'disponivel', gerencia()));
    await tx((c) => marcarDisponibilidade(c, id, doPedido[1].id, 'disponivel', gerencia()));
    await tx((c) => marcarDisponibilidade(c, id, doPedido[2].id, 'indisponivel', gerencia()));

    const { resumo } = await tx((c) => concluirVerificacao(c, id, gerencia()));
    expect(resumo).toBe('2 de 3 disponíveis.');
    expect((await findPedido(pool, id))!.situacao).toBe('verificado');
    expect((await listHistorico(pool, id)).at(-1)).toMatchObject({ situacaoNova: 'verificado', observacoes: resumo });
  });
});

describe('negociação depois da conferência (RF-55, RN-50)', () => {
  /** Um pedido sem preço nenhum, como o cadastro passa a criá-lo. */
  function semPreco() {
    return novoPedido({
      itens: itens().map((item) => ({ ...item, precoCentavos: null })),
    });
  }

  /** Leva o pedido até `verificado`, respondendo tudo como disponível. */
  async function conferido(id: string) {
    await tx((c) => iniciarVerificacao(c, id, gerencia()));
    for (const item of await listItens(pool, id)) {
      await tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel', gerencia()));
    }
    await tx((c) => concluirVerificacao(c, id, gerencia()));
  }

  it('o item nasce sem preço, e o total do pedido fica indefinido', async () => {
    const { id } = await semPreco();
    const lidos = await listItens(pool, id);
    expect(lidos.every((item) => item.precoCentavos === null)).toBe(true);
    expect(totalPedido(lidos)).toBeNull();
  });

  it('antes da conferência não se negocia: o pedido ainda é orçamento', async () => {
    const { id } = await semPreco();
    const [item] = await listItens(pool, id);
    await expect(tx((c) => negociarItens(c, id, [soPreco(item.id, 250)], chefia()))).rejects.toThrow(
      /depois da conferência/i,
    );
  });

  it('a gerência não negocia: o valor da venda é da chefia', async () => {
    const { id } = await semPreco();
    await conferido(id);
    const [item] = await listItens(pool, id);
    await expect(tx((c) => negociarItens(c, id, [soPreco(item.id, 250)], gerencia()))).rejects.toThrow(/chefia/i);
  });

  it('aprovar sem preço é recusado, e o pedido continua verificado', async () => {
    const { id } = await semPreco();
    await conferido(id);
    await expect(tx((c) => confirmarPedido(c, id, chefia()))).rejects.toThrow(/3 itens sem preço/i);
    expect((await findPedido(pool, id))!.situacao).toBe('verificado');
  });

  it('com os preços salvos o pedido é aprovado, e o total fecha', async () => {
    const { id } = await semPreco();
    await conferido(id);
    const lidos = await listItens(pool, id);
    await tx((c) => negociarItens(c, id, lidos.map((item) => soPreco(item.id, 200)), chefia()));

    await tx((c) => confirmarPedido(c, id, chefia()));
    expect((await findPedido(pool, id))!.situacao).toBe('aprovado');
    const depois = await listItens(pool, id);
    expect(depois.every((item) => item.precoCentavos === 200)).toBe(true);
    expect(totalPedido(depois)).toBe(depois.reduce((soma, item) => soma + item.quantidade! * 200, 0));
  });

  it('baixar a quantidade e tirar item não devolvem o pedido à conferência', async () => {
    const { id } = await semPreco();
    await conferido(id);
    const [grande, medio, pequeno] = porQuantidade(await listItens(pool, id));
    const { removidos } = await tx((c) =>
      negociarItens(
        c,
        id,
        [
          { itemId: grande.id, precoCentavos: 200, quantidade: 150, recipienteId: null },
          { itemId: medio.id, precoCentavos: 300, quantidade: null, recipienteId: null },
          { itemId: pequeno.id, precoCentavos: null, quantidade: 0, recipienteId: null },
        ],
        chefia(),
      ),
    );
    expect(removidos).toBe(1);
    expect((await findPedido(pool, id))!.situacao).toBe('verificado');
    const depois = await listItens(pool, id);
    expect(depois.map((i) => i.quantidade).sort((a, b) => a! - b!)).toEqual([50, 150]);
  });

  it('pedir mais do que a conferência confirmou é recusado', async () => {
    const { id } = await semPreco();
    await conferido(id);
    const [grande] = porQuantidade(await listItens(pool, id));
    await expect(
      tx((c) => negociarItens(c, id, [{ itemId: grande.id, precoCentavos: 200, quantidade: 201, recipienteId: null }], chefia())),
    ).rejects.toThrow(/confirmou 200/i);
  });

  it('item de outro pedido não é negociado por aqui', async () => {
    const { id } = await semPreco();
    await conferido(id);
    const alheio = await semPreco();
    const [itemAlheio] = await listItens(pool, alheio.id);
    await expect(tx((c) => negociarItens(c, id, [soPreco(itemAlheio.id, 250)], chefia()))).rejects.toThrow(
      /não encontrado/i,
    );
  });
});

describe('os sete jeitos de o pedido chegar (pedidos-como-chegam.md)', () => {
  /** Cria o pedido com os itens dados e abre a conferência. */
  async function pedidoCom(itensDoPedido: Parameters<typeof criarPedido>[1]['itens']) {
    const { id } = await novoPedido({ itens: itensDoPedido });
    await tx((c) => iniciarVerificacao(c, id, gerencia()));
    return id;
  }

  /** Conclui a conferência, precifica tudo o que é vendido e aprova. */
  async function fecharCom(id: string, linhas: Parameters<typeof negociarItens>[2], concluir = true) {
    if (concluir) await tx((c) => concluirVerificacao(c, id, gerencia()));
    await tx((c) => negociarItens(c, id, linhas, chefia()));
    await tx((c) => confirmarPedido(c, id, chefia()));
    const ficha = (await findPedido(pool, id))!;
    expect(ficha.situacao).toBe('aprovado');
    // Todo item que sai para a carga tem recipiente e quantidade
    expect(ficha.itens.filter((i) => !i.generico).every((i) => i.recipienteId && i.quantidade)).toBe(true);
    return ficha;
  }

  it('1. só a lista: a gerência diz quantas tem e onde, a chefia propõe a quantidade', async () => {
    const id = await pedidoCom([{ especieId: especie, recipienteId: null, quantidade: null, precoCentavos: null }]);
    const [item] = await listItens(pool, id);
    await tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel', gerencia(), { quantidade: 350, recipienteId: saco }));
    expect((await listItens(pool, id))[0]).toMatchObject({ disponivel: true, quantidadeDisponivel: 350 });

    const ficha = await fecharCom(id, [{ itemId: item.id, precoCentavos: 500, quantidade: 300, recipienteId: saco }]);
    expect(ficha.itens[0]).toMatchObject({ quantidade: 300, recipienteId: saco, precoCentavos: 500 });
  });

  it('1. sem a chefia dizer a quantidade, a aprovação recusa e conta o que falta', async () => {
    const id = await pedidoCom([{ especieId: especie, recipienteId: null, quantidade: null, precoCentavos: null }]);
    const [item] = await listItens(pool, id);
    await tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel', gerencia(), { quantidade: 350, recipienteId: saco }));
    await tx((c) => concluirVerificacao(c, id, gerencia()));
    await expect(tx((c) => confirmarPedido(c, id, chefia()))).rejects.toThrow(
      /um item sem quantidade, um item sem preço/i,
    );
  });

  it('2. espécie e quantidade: a gerência diz em qual recipiente tem', async () => {
    const id = await pedidoCom([{ especieId: especie, recipienteId: null, quantidade: 200, precoCentavos: null }]);
    const [item] = await listItens(pool, id);
    await tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel', gerencia(), { recipienteId: saco }));
    const ficha = await fecharCom(id, [soPreco(item.id, 400)]);
    expect(ficha.itens[0]).toMatchObject({ quantidade: 200, recipienteId: saco });
  });

  it('3. espécie e tamanho: a gerência diz quantas tem', async () => {
    const id = await pedidoCom([
      { especieId: especie, recipienteId: saco, quantidade: null, precoCentavos: null, alturaM: 1.2 },
    ]);
    const [item] = await listItens(pool, id);
    await tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel', gerencia(), { quantidade: 80 }));
    const ficha = await fecharCom(id, [{ itemId: item.id, precoCentavos: 900, quantidade: 80, recipienteId: null }]);
    expect(ficha.itens[0]).toMatchObject({ quantidade: 80, recipienteId: saco, alturaM: 1.2 });
  });

  it('4. completo: só conferir e pôr preço', async () => {
    const id = await pedidoCom([{ especieId: especie, recipienteId: saco, quantidade: 200, precoCentavos: null }]);
    const [item] = await listItens(pool, id);
    await tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel', gerencia()));
    await fecharCom(id, [soPreco(item.id, 400)]);
  });

  it('5. genérico por tamanho: a composição fecha a quantidade e herda o preço', async () => {
    const id = await pedidoCom([
      { especieId: null, recipienteId: tubete, quantidade: 500, precoCentavos: null, generico: true, especificacao: 'nativas' },
    ]);
    const [pai] = await listItens(pool, id);
    await tx((c) =>
      definirComposicaoGenerico(c, id, pai.id, [{ especieId: especie, recipienteId: tubete, quantidade: 500 }], gerencia()),
    );
    const ficha = await fecharCom(id, [soPreco(pai.id, 200)]);
    expect(totalPedido(ficha.itens)).toBe(500 * 200);
  });

  it('6. genérico com filtro: só dentro do filtro', async () => {
    const id = await pedidoCom([
      {
        especieId: null,
        recipienteId: tubete,
        quantidade: 300,
        precoCentavos: null,
        generico: true,
        especificacao: 'frutíferas',
        especiesPermitidas: [especie],
      },
    ]);
    const [pai] = await listItens(pool, id);
    await tx((c) =>
      definirComposicaoGenerico(c, id, pai.id, [{ especieId: especie, recipienteId: saco, quantidade: 300 }], gerencia()),
    );
    await fecharCom(id, [soPreco(pai.id, 300)]);
  });

  it('7. projeto: a gerência monta a lista, e cada espécie é uma venda com preço próprio', async () => {
    const id = await pedidoCom([
      {
        especieId: null,
        recipienteId: null,
        quantidade: null,
        precoCentavos: null,
        generico: true,
        especificacao: 'Recompor 2 ha de mata ciliar',
      },
    ]);
    const [pai] = await listItens(pool, id);
    await tx((c) =>
      definirComposicaoGenerico(
        c,
        id,
        pai.id,
        [
          { especieId: especie, recipienteId: tubete, quantidade: 1200 },
          { especieId: especie, recipienteId: saco, quantidade: 300 },
        ],
        gerencia(),
      ),
    );
    const filhos = (await listItens(pool, id)).filter((i) => i.itemPaiId === pai.id);
    // Na lista montada o filho nasce sem preço: é a chefia quem o põe
    expect(filhos.every((f) => f.precoCentavos === null)).toBe(true);

    // O preço do genérico não existe: quem se negocia são os filhos
    await tx((c) => concluirVerificacao(c, id, gerencia()));
    await expect(tx((c) => negociarItens(c, id, [soPreco(pai.id, 100)], chefia()))).rejects.toThrow(/lista montada/i);

    const [grande, pequeno] = porQuantidade(filhos);
    const ficha = await fecharCom(id, [soPreco(grande.id, 250), soPreco(pequeno.id, 900)], false);
    expect(totalPedido(ficha.itens)).toBe(1200 * 250 + 300 * 900);
    const lista = await listPedidos(pool, { de: '2000-01-01', ate: '2999-12-31', clienteId: cliente, canal: null });
    expect(lista.find((p) => p.id === id)!.totalCentavos).toBe(1200 * 250 + 300 * 900);
  });

  it('o genérico precisa dizer o que foi pedido', async () => {
    await expect(
      novoPedido({
        itens: [{ especieId: null, recipienteId: null, quantidade: null, precoCentavos: null, generico: true, especificacao: ' ' }],
      }),
    ).rejects.toThrow(/descreva/i);
  });
});

describe('as restrições do banco para o item incompleto (20260924000001)', () => {
  async function umItem(colunas: string, valores: unknown[]) {
    const { id } = await novoPedido();
    const lista = valores.map((_, indice) => `$${indice + 2}`).join(', ');
    return pool.query(`INSERT INTO pedidos_itens (pedido_id, ${colunas}) VALUES ($1, ${lista})`, [id, ...valores]);
  }

  it('sem quantidade, a resposta é quantas tem, e "disponível" é só "tem alguma"', async () => {
    const cols = 'especie_id, disponivel, quantidade_disponivel';
    await expect(umItem(cols, [especie, true, 350])).resolves.toBeTruthy();
    await expect(umItem(cols, [especie, false, 0])).resolves.toBeTruthy();
    await expect(umItem(cols, [especie, true, null])).rejects.toThrow(/disponibilidade_coerente/);
    await expect(umItem(cols, [especie, false, 350])).rejects.toThrow(/disponibilidade_coerente/);
  });

  it('com quantidade, as regras de antes continuam', async () => {
    const cols = 'especie_id, quantidade, disponivel, quantidade_disponivel';
    await expect(umItem(cols, [especie, 100, true, null])).resolves.toBeTruthy();
    await expect(umItem(cols, [especie, 100, false, 30])).resolves.toBeTruthy();
    await expect(umItem(cols, [especie, 100, false, 100])).rejects.toThrow(/disponibilidade_coerente/);
  });

  it('"tem tudo, em 17x22" cabe; recipiente conferido sem muda não', async () => {
    const cols = 'especie_id, quantidade, disponivel, quantidade_disponivel, recipiente_disponivel_id';
    await expect(umItem(cols, [especie, 100, true, null, saco])).resolves.toBeTruthy();
    await expect(umItem(cols, [especie, 100, false, 0, saco])).rejects.toThrow(/recipiente_disponivel_com_muda/);
  });

  it('o genérico sem descrição é recusado', async () => {
    await expect(umItem('generico', [true])).rejects.toThrow(/generico_com_especificacao/);
  });

  it('a migration roda sobre linhas antigas: genérico sem texto e resposta sobre item sem quantidade', async () => {
    const sql = readFileSync(path.join(process.cwd(), 'migrations', '20260924000001_pedido_orcamento_incompleto.sql'), 'utf8');
    const { id } = await novoPedido();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // O banco como estava antes: as constraints antigas, e linhas que elas aceitavam.
      // NOT VALID porque os testes anteriores já gravaram linhas no formato novo
      await client.query(`ALTER TABLE pedidos_itens
        DROP CONSTRAINT pedidos_itens_disponibilidade_coerente,
        DROP CONSTRAINT pedidos_itens_recipiente_disponivel_com_muda,
        DROP CONSTRAINT pedidos_itens_generico_com_especificacao`);
      await client.query(`ALTER TABLE pedidos_itens
        ADD CONSTRAINT pedidos_itens_disponibilidade_coerente CHECK (
          (disponivel IS DISTINCT FROM false AND quantidade_disponivel IS NULL)
          OR (disponivel = false AND quantidade_disponivel BETWEEN 0 AND quantidade - 1)) NOT VALID,
        ADD CONSTRAINT pedidos_itens_recipiente_disponivel_com_muda CHECK (
          recipiente_disponivel_id IS NULL OR quantidade_disponivel > 0) NOT VALID`);
      const generico = await client.query<{ id: string }>(
        `INSERT INTO pedidos_itens (pedido_id, recipiente_id, quantidade, generico) VALUES ($1, $2, 10, true) RETURNING id`,
        [id, tubete],
      );
      const respondido = await client.query<{ id: string }>(
        `INSERT INTO pedidos_itens (pedido_id, especie_id, recipiente_id, disponivel) VALUES ($1, $2, $3, true) RETURNING id`,
        [id, especie, tubete],
      );

      await client.query(sql);

      const { rows } = await client.query<{ id: string; especificacao: string | null; disponivel: boolean | null }>(
        'SELECT id, especificacao, disponivel FROM pedidos_itens WHERE id = ANY($1)',
        [[generico.rows[0].id, respondido.rows[0].id]],
      );
      const porId = new Map(rows.map((row) => [row.id, row]));
      expect(porId.get(generico.rows[0].id)!.especificacao).toBe('Mudas nativas');
      expect(porId.get(respondido.rows[0].id)!.disponivel).toBeNull();
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

describe('aprovação consome a conferência (T8.11)', () => {
  /** Leva o pedido até `verificado`, com a mesma resposta para todos os itens. */
  async function verificadoCom(estado: 'disponivel' | 'indisponivel') {
    const { id } = await novoPedido();
    await tx((c) => iniciarVerificacao(c, id, gerencia()));
    for (const item of await listItens(pool, id)) await tx((c) => marcarDisponibilidade(c, id, item.id, estado, gerencia()));
    await tx((c) => concluirVerificacao(c, id, gerencia()));
    return id;
  }

  /** Um disponível, um parcial e um indisponível, e devolve quem é quem. */
  async function conferido(parcial: number) {
    const { id } = await novoPedido();
    await tx((c) => iniciarVerificacao(c, id, gerencia()));
    const [grande, medio, pequeno] = porQuantidade(await listItens(pool, id));
    await tx((c) => marcarDisponibilidade(c, id, medio.id, 'disponivel', gerencia()));
    await tx((c) => marcarDisponibilidade(c, id, grande.id, 'parcial', gerencia(), { quantidade: parcial, recipienteId: tubete }));
    await tx((c) => marcarDisponibilidade(c, id, pequeno.id, 'indisponivel', gerencia()));
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
            alturaM: 1.2,
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
      ], gerencia()),
    );

    const itens = await listItens(pool, id);
    expect(itens).toHaveLength(3);
    expect(itens.find((i) => i.id === pai.id)!.disponivel).toBe(true);
    const filhos = itens.filter((i) => i.itemPaiId === pai.id);
    expect(filhos.map((f) => f.quantidade).sort((a, b) => a! - b!)).toEqual([200, 300]);
    // O filho herda o preço do pai, e o total do pedido não dobra
    expect(filhos.every((f) => f.precoCentavos === 200)).toBe(true);
    expect(totalPedido(itens)).toBe(500 * 200);
  });

  it('o filho herda a altura pedida no genérico: ela é parte do que foi combinado', async () => {
    const { id, pai } = await comGenerico();
    await tx((c) =>
      definirComposicaoGenerico(c, id, pai.id, [{ especieId: especie, recipienteId: tubete, quantidade: 500 }], gerencia()),
    );
    const filho = (await listItens(pool, id)).find((item) => item.itemPaiId === pai.id)!;
    expect(filho.alturaM).toBe(1.2);
  });

  it('a soma que não fecha é recusada, e nenhum filho é criado', async () => {
    const { id, pai } = await comGenerico();
    await expect(
      tx((c) => definirComposicaoGenerico(c, id, pai.id, [{ especieId: especie, recipienteId: tubete, quantidade: 300 }], gerencia())),
    ).rejects.toThrow(/faltam 200/i);
    expect(await listItens(pool, id)).toHaveLength(1);
  });

  it('recompor troca os filhos, em vez de acrescentar aos anteriores', async () => {
    const { id, pai } = await comGenerico();
    await tx((c) =>
      definirComposicaoGenerico(c, id, pai.id, [{ especieId: especie, recipienteId: tubete, quantidade: 500 }], gerencia()),
    );
    await tx((c) =>
      definirComposicaoGenerico(c, id, pai.id, [
        { especieId: especie, recipienteId: tubete, quantidade: 250 },
        { especieId: outraEspecie, recipienteId: tubete, quantidade: 250 },
      ], gerencia()),
    );

    const filhos = (await listItens(pool, id)).filter((i) => i.itemPaiId === pai.id);
    expect(filhos).toHaveLength(2);
    expect(filhos.reduce((soma, f) => soma + f.quantidade!, 0)).toBe(500);
  });

  it('o escopo do cliente é bloqueio no servidor, e não apenas filtro da busca', async () => {
    const { id, pai } = await comGenerico([especie]);
    expect(await listEspeciesPermitidas(pool, pai.id)).toEqual([especie]);

    await expect(
      tx((c) => definirComposicaoGenerico(c, id, pai.id, [{ especieId: outraEspecie, recipienteId: tubete, quantidade: 500 }], gerencia())),
    ).rejects.toThrow(/aceita/i);

    // E a espécie de dentro do escopo passa
    await tx((c) => definirComposicaoGenerico(c, id, pai.id, [{ especieId: especie, recipienteId: tubete, quantidade: 500 }], gerencia()));
    expect((await listItens(pool, id)).filter((i) => i.itemPaiId === pai.id)).toHaveLength(1);
  });

  it('o genérico não se marca por disponível ou indisponível', async () => {
    const { id, pai } = await comGenerico();
    await expect(tx((c) => marcarDisponibilidade(c, id, pai.id, 'disponivel', gerencia()))).rejects.toThrow(/genérico/i);
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
      ], gerencia()),
    );
    const itens = await listItens(pool, id);
    expect(itens[0].id).toBe(pai.id);
    expect(itens.slice(1).every((i) => i.itemPaiId === pai.id)).toBe(true);
  });
});
