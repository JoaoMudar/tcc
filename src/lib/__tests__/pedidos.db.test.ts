import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertArea, insertCanteiro } from '../areas';
import { hojeNoViveiro, somaDias } from '../datas';
import { saldoPronto } from '../estoque';
import { alterarFase, criarLote } from '../lotes';
import { registrarMovimento } from '../movimentos';
import {
  adicionarItem,
  atualizarItem,
  cancelarPedido,
  confirmarPedido,
  criarPedido,
  findPedido,
  listClientes,
  listItens,
  listPedidos,
  removerItem,
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
  it('nasce em rascunho, com número sequencial e os três itens (TA-51)', async () => {
    const primeiro = await novoPedido();
    const segundo = await novoPedido();
    expect(segundo.numero).toBe(primeiro.numero + 1);

    const ficha = (await findPedido(pool, primeiro.id))!;
    expect(ficha.situacao).toBe('rascunho');
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

describe('situação do pedido (T8.3, RF-57, RN-48)', () => {
  it('confirmado recusa alterar, acrescentar e remover item (TA-53)', async () => {
    const { id } = await novoPedido();
    const [item] = await listItens(pool, id);
    await tx((client) => confirmarPedido(client, id));
    expect((await findPedido(pool, id))!.situacao).toBe('confirmado');

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

  it('o rascunho aceita alterar, acrescentar e remover', async () => {
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

  it('confirmar duas vezes é recusado, e o pedido sem item não confirma', async () => {
    const { id } = await novoPedido();
    await tx((c) => confirmarPedido(c, id));
    await expect(tx((c) => confirmarPedido(c, id))).rejects.toThrow(/não muda/i);

    const vazio = await novoPedido();
    for (const item of await listItens(pool, vazio.id)) await tx((c) => removerItem(c, vazio.id, item.id));
    await expect(tx((c) => confirmarPedido(c, vazio.id))).rejects.toThrow(/ao menos um item/i);
  });

  it('o confirmado cancela, e o cancelado não cancela de novo', async () => {
    const { id } = await novoPedido();
    await tx((c) => confirmarPedido(c, id));
    await tx((c) => cancelarPedido(c, id));
    expect((await findPedido(pool, id))!.situacao).toBe('cancelado');
    // Os itens ficam para consulta: cancelar não apaga
    expect(await listItens(pool, id)).toHaveLength(3);
    await expect(tx((c) => cancelarPedido(c, id))).rejects.toThrow(/já está cancelado/i);
  });

  it('o cancelado também não aceita item novo', async () => {
    const { id } = await novoPedido();
    await tx((c) => cancelarPedido(c, id));
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

describe('clientes oferecidos ao pedido', () => {
  it('traz quem tem o papel de cliente ativo (RN-45)', async () => {
    const lista = await listClientes(pool);
    expect(lista.map((c) => c.id)).toContain(cliente);
  });
});
