// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Perfil } from '@/lib/permissions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock('@/lib/auth/dal', () => ({ requireUser: vi.fn() }));

const client = { query: vi.fn(), release: vi.fn() };
vi.mock('@/lib/db', () => ({ default: { query: vi.fn(), connect: vi.fn(async () => client) } }));

const { requireUser } = await import('@/lib/auth/dal');
const { default: pool } = await import('@/lib/db');
const actions = await import('../actions');

const PEDIDO = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';
const ITEM = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e1f';
const ESPECIE = '2d7f1e5a-0b7c-4e3d-9f2a-4b8c9d0e1f2a';
const RECIPIENTE = '3e6a2f4b-1c8d-4f5e-8a3b-5c9d0e1f2a3b';

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

/**
 * Uma linha para toda consulta, **menos a do escopo do genérico**.
 *
 * O escopo é a única consulta cuja resposta vazia muda a regra: sem nenhuma
 * linha, qualquer espécie serve. Um mock que devolvesse a mesma linha para tudo
 * faria o escopo parecer preenchido, e o teste do caso comum recusaria a
 * espécie por estar "fora da lista do cliente".
 */
function respondeCom(linha: Record<string, unknown>) {
  client.query.mockImplementation(async (sql: unknown) =>
    String(sql).includes('pedidos_itens_especies_permitidas')
      ? { rows: [], rowCount: 0 }
      : { rows: [linha], rowCount: 1 },
  );
}

/** O pedido em conferência, com um item de 500 que não é genérico. */
function emConferencia() {
  respondeCom({ id: PEDIDO, numero: 1, situacao: 'verificando', quantidade: 500, generico: false, preco: '2.00' });
}

function gravouEm(tabela: string) {
  return client.query.mock.calls.filter(([sql]) => String(sql).includes(tabela));
}

beforeEach(() => {
  vi.clearAllMocks();
  emConferencia();
  loggedAs('gerencia');
});

describe('permissão (D4 §3.2)', () => {
  it('a gerência confere, que é fase dela', async () => {
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'disponivel' });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toBeUndefined();
    expect(gravouEm('UPDATE pedidos_itens')).toHaveLength(1);
  });

  it('a chefia também confere, quando é ela quem faz o trabalho', async () => {
    loggedAs('chefia');
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'disponivel' });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toBeUndefined();
  });
});

describe('a resposta abre a conferência (T8.12)', () => {
  it('responder o primeiro item do pedido cadastrado abre a conferência e grava junto', async () => {
    respondeCom({ id: PEDIDO, numero: 1, situacao: 'cadastrado', quantidade: 500, generico: false, preco: '2.00' });
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'disponivel' });

    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toBeUndefined();
    // A abertura e a resposta saem na mesma transação
    expect(gravouEm('UPDATE pedidos SET situacao')).toHaveLength(1);
    expect(gravouEm('INSERT INTO pedidos_historico')).toHaveLength(1);
    expect(gravouEm('UPDATE pedidos_itens')).toHaveLength(1);
  });

  it('com a conferência já aberta a situação não é reescrita', async () => {
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'disponivel' });
    await actions.marcarDisponibilidadeAction({}, dados);
    expect(gravouEm('UPDATE pedidos SET situacao')).toEqual([]);
  });

  it('depois de aprovado a resposta é recusada, e nada é gravado', async () => {
    respondeCom({ id: PEDIDO, numero: 1, situacao: 'aprovado', quantidade: 500, generico: false, preco: '2.00' });
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'disponivel' });

    const state = await actions.marcarDisponibilidadeAction({}, dados);
    expect(state.error).toMatch(/conferência não está aberta/i);
    expect(gravouEm('UPDATE pedidos_itens')).toEqual([]);
  });
});

describe('validação antes do banco', () => {
  it('resposta fora das três é recusada', async () => {
    const state = await actions.marcarDisponibilidadeAction({}, form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'talvez' }));
    expect(state.error).toMatch(/resposta inválida/i);
    expectNoDatabase();
  });

  it('parcial sem recipiente é recusada', async () => {
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'parcial', quantidade: '300' });
    const state = await actions.marcarDisponibilidadeAction({}, dados);
    expect(state.error).toMatch(/recipiente/i);
    expectNoDatabase();
  });

  it('parcial sem quantidade é recusada', async () => {
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'parcial', recipiente_id: RECIPIENTE });
    const state = await actions.marcarDisponibilidadeAction({}, dados);
    expect(state.error).toMatch(/quantidade/i);
    expectNoDatabase();
  });

  it('parcial completa chega ao banco', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      item_id: ITEM,
      estado: 'parcial',
      quantidade: '300',
      recipiente_id: RECIPIENTE,
    });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toBeUndefined();
    const [, valores] = gravouEm('UPDATE pedidos_itens')[0];
    expect(valores).toContain(300);
    expect(valores).toContain(RECIPIENTE);
  });

  it('item que não é identificador não chega ao SQL', async () => {
    const state = await actions.marcarDisponibilidadeAction({}, form({ pedido_id: PEDIDO, item_id: 'x', estado: 'disponivel' }));
    expect(state.error).toMatch(/item inválido/i);
    expectNoDatabase();
  });

  it('observação longa demais é recusada', async () => {
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'disponivel', observacoes: 'x'.repeat(501) });
    const state = await actions.marcarDisponibilidadeAction({}, dados);
    expect(state.error).toMatch(/500 caracteres/i);
    expectNoDatabase();
  });
});

describe('composição do genérico', () => {
  it('a linha em branco que ninguém usou não vira erro nem espécie', async () => {
    respondeCom({ id: PEDIDO, numero: 1, situacao: 'verificando', quantidade: 500, generico: true, preco: '2.00' });
    const dados = form({
      pedido_id: PEDIDO,
      item_pai_id: ITEM,
      composicao_especie: [ESPECIE, ''],
      composicao_recipiente: [RECIPIENTE, ''],
      composicao_quantidade: ['500', ''],
    });
    expect((await actions.definirComposicaoAction({}, dados)).error).toBeUndefined();
    expect(gravouEm('INSERT INTO pedidos_itens')).toHaveLength(1);
  });

  it('linha sem espécie diz qual linha é, e não chega ao banco', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      item_pai_id: ITEM,
      composicao_especie: '',
      composicao_recipiente: RECIPIENTE,
      composicao_quantidade: '500',
    });
    const state = await actions.definirComposicaoAction({}, dados);
    expect(state.error).toMatch(/linha 1/i);
    expectNoDatabase();
  });
});

describe('conclusão', () => {
  it('concluída, a tela volta para a ficha do pedido', async () => {
    client.query.mockResolvedValue({
      rows: [{ id: PEDIDO, numero: 1, situacao: 'verificando', pendentes: 0, total: 3, disponiveis: 3, genericos: 0 }],
      rowCount: 1,
    });
    await expect(actions.concluirVerificacaoAction({}, form({ pedido_id: PEDIDO }))).rejects.toThrow(
      `redirect:/pedidos/${PEDIDO}?feito=verificado`,
    );
  });

  it('com item sem resposta, recusa e não muda a situação', async () => {
    client.query.mockResolvedValue({
      rows: [{ id: PEDIDO, numero: 1, situacao: 'verificando', pendentes: 2, total: 3, disponiveis: 1, genericos: 0 }],
      rowCount: 1,
    });
    const state = await actions.concluirVerificacaoAction({}, form({ pedido_id: PEDIDO }));
    expect(state.error).toMatch(/sem resposta/i);
    expect(gravouEm('UPDATE pedidos SET situacao')).toEqual([]);
  });
});
