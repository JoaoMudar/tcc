// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Perfil } from '@/lib/permissions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/dal', () => ({ requireUser: vi.fn() }));

const client = { query: vi.fn(), release: vi.fn() };
vi.mock('@/lib/db', () => ({ default: { query: vi.fn(), connect: vi.fn(async () => client) } }));

const { requireUser } = await import('@/lib/auth/dal');
const { default: pool } = await import('@/lib/db');
const actions = await import('../actions');

const PEDIDO = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';
const ITEM_A = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e1f';
const ITEM_B = '2d7f1e5a-0b7c-4e3d-9f2a-4b8c9d0e1f2a';
const CARGA = '3e6a2f4b-1c8d-4f5e-8a3b-5c9d0e1f2a3b';

function loggedAs(perfil: Perfil) {
  vi.mocked(requireUser).mockResolvedValue({
    sessaoId: 's1',
    usuarioId: 'u1',
    login: 'x',
    nomeExibicao: 'X',
    perfil,
    deveTrocarSenha: false,
    expiraEm: new Date(),
    ultimoUsoEm: new Date(),
  });
}

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(name, item);
  }
  return data;
}

function expectNoDatabase() {
  expect(pool.query).not.toHaveBeenCalled();
  expect(pool.connect).not.toHaveBeenCalled();
}

function gravouEm(tabela: string) {
  return client.query.mock.calls.filter(([sql]) => String(sql).includes(tabela));
}

/** Pedido aprovado, com dois itens reais de 500 e 200. */
function aprovadoComDoisItens() {
  client.query.mockImplementation(async (sql: unknown) => {
    const texto = String(sql);
    if (texto.includes('FROM pedidos_itens i')) {
      return {
        rows: [
          { id: ITEM_A, quantidade: 500, especie: 'Araucária' },
          { id: ITEM_B, quantidade: 200, especie: 'Cedro' },
        ],
        rowCount: 2,
      };
    }
    return { rows: [{ id: PEDIDO, numero: 7, situacao: 'aprovado' }], rowCount: 1 };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  aprovadoComDoisItens();
  loggedAs('gerencia');
});

describe('organizar cargas (T8.14)', () => {
  it('cabe em uma viagem: uma carga com todos os itens reais', async () => {
    const state = await actions.criarCargaUnicaAction({}, form({ pedido_id: PEDIDO }));
    expect(state.error).toBeUndefined();
    expect(gravouEm('INSERT INTO pedidos_cargas ')).toHaveLength(1);
    expect(gravouEm('INSERT INTO pedidos_cargas_itens')).toHaveLength(2);
  });

  it('a divisão que fecha vira duas cargas', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      carga_indice: ['0', '0', '1', '1'],
      item_id: [ITEM_A, ITEM_B, ITEM_A, ITEM_B],
      quantidade: ['300', '200', '200', '0'],
    });
    const state = await actions.criarCargasAction({}, dados);
    expect(state.error).toBeUndefined();
    expect(gravouEm('INSERT INTO pedidos_cargas ')).toHaveLength(2);
    // A célula zerada não vira linha: são 2 na primeira carga e 1 na segunda
    expect(gravouEm('INSERT INTO pedidos_cargas_itens')).toHaveLength(3);
  });

  it('a soma que não bate é recusada, e diz qual item é', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      carga_indice: ['0', '0'],
      item_id: [ITEM_A, ITEM_B],
      quantidade: ['450', '200'],
    });
    const state = await actions.criarCargasAction({}, dados);
    expect(state.error).toMatch(/Araucária/);
    expect(gravouEm('INSERT INTO pedidos_cargas ')).toEqual([]);
  });

  it('célula em branco vale zero, e não erro', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      carga_indice: ['0', '0', '1', '1'],
      item_id: [ITEM_A, ITEM_B, ITEM_A, ITEM_B],
      quantidade: ['500', '200', '', ''],
    });
    expect((await actions.criarCargasAction({}, dados)).error).toBeUndefined();
  });

  it('quantidade negativa é recusada antes do banco', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      carga_indice: ['0'],
      item_id: [ITEM_A],
      quantidade: ['-5'],
    });
    const state = await actions.criarCargasAction({}, dados);
    expect(state.error).toMatch(/zero ou mais/i);
    expectNoDatabase();
  });

  it('pedido que não é identificador não chega ao SQL', async () => {
    const state = await actions.criarCargaUnicaAction({}, form({ pedido_id: 'x' }));
    expect(state.error).toMatch(/pedido inválido/i);
    expectNoDatabase();
  });
});

describe('contar (T8.14)', () => {
  it('marcar grava o valor que a tela mandou', async () => {
    client.query.mockResolvedValue({ rows: [{ id: PEDIDO }], rowCount: 1 });
    const dados = form({ pedido_id: PEDIDO, carga_item_id: ITEM_A, separado: 'sim' });
    expect((await actions.marcarItemSeparadoAction({}, dados)).success).toMatch(/separado/i);
    const [, valores] = gravouEm('UPDATE pedidos_cargas_itens')[0];
    expect(valores).toEqual([ITEM_A, true]);
  });

  it('desmarcar manda false, e não inverte no servidor', async () => {
    client.query.mockResolvedValue({ rows: [{ id: PEDIDO }], rowCount: 1 });
    const dados = form({ pedido_id: PEDIDO, carga_item_id: ITEM_A, separado: 'nao' });
    await actions.marcarItemSeparadoAction({}, dados);
    const [, valores] = gravouEm('UPDATE pedidos_cargas_itens')[0];
    expect(valores).toEqual([ITEM_A, false]);
  });

  it('item marcado numa carga já pronta é recusado', async () => {
    // Zero linhas afetadas é a trava do WHERE, e vira erro em vez de silêncio
    client.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const dados = form({ pedido_id: PEDIDO, carga_item_id: ITEM_A, separado: 'sim' });
    const state = await actions.marcarItemSeparadoAction({}, dados);
    expect(state.error).toMatch(/não pode mais ser marcado/i);
  });

  it('carga com item por separar não fecha', async () => {
    client.query.mockImplementation(async (sql: unknown) => {
      const texto = String(sql);
      if (texto.includes('separado = false')) return { rows: [{ n: 2 }], rowCount: 1 };
      return { rows: [{ pedidoId: PEDIDO, numero: 1, situacao: 'pendente', situacaoPedido: 'separando' }], rowCount: 1 };
    });
    const state = await actions.concluirCargaAction({}, form({ pedido_id: PEDIDO, carga_id: CARGA }));
    expect(state.error).toMatch(/por separar/i);
    expect(gravouEm("UPDATE pedidos_cargas SET situacao = 'pronto'")).toEqual([]);
  });
});
