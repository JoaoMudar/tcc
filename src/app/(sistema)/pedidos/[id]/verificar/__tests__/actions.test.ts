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
  respondeCom({ id: PEDIDO, numero: 1, situacao: 'verificando', quantidade: 500, recipienteId: RECIPIENTE, alturaM: null, generico: false, preco: '2.00' });
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
    respondeCom({ id: PEDIDO, numero: 1, situacao: 'cadastrado', quantidade: 500, recipienteId: RECIPIENTE, alturaM: null, generico: false, preco: '2.00' });
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
    respondeCom({ id: PEDIDO, numero: 1, situacao: 'aprovado', quantidade: 500, recipienteId: null, alturaM: null, generico: false, preco: '2.00' });
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

  it('recipiente que não é identificador é recusado antes do banco', async () => {
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'parcial', quantidade: '300', recipiente_id: 'saco' });
    const state = await actions.marcarDisponibilidadeAction({}, dados);
    expect(state.error).toMatch(/recipiente/i);
    expectNoDatabase();
  });

  it('parcial sem quantidade é recusada, e o item não é gravado', async () => {
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'parcial', recipiente_id: RECIPIENTE });
    const state = await actions.marcarDisponibilidadeAction({}, dados);
    expect(state.error).toMatch(/quantas mudas/i);
    expect(gravouEm('UPDATE pedidos_itens')).toEqual([]);
  });

  it('parcial no recipiente pedido não precisa repeti-lo', async () => {
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'parcial', quantidade: '300' });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toBeUndefined();
    const [[, valores]] = gravouEm('UPDATE pedidos_itens');
    expect(valores).toEqual([PEDIDO, ITEM, false, 300, null, null, null]);
  });

  it('o item que veio sem quantidade responde "tem 350 em 17x22"', async () => {
    const SACO = '4f7b3a5c-2d9e-4a6f-9b4c-6d0e1f2a3b4c';
    respondeCom({ id: PEDIDO, numero: 1, situacao: 'verificando', quantidade: null, recipienteId: null, alturaM: null, generico: false });
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'disponivel', quantidade: '350', recipiente_id: SACO });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toBeUndefined();
    const [[, valores]] = gravouEm('UPDATE pedidos_itens');
    expect(valores).toEqual([PEDIDO, ITEM, true, 350, SACO, null, null]);
  });

  it('o item que veio sem recipiente não aceita "tem" sem dizer em qual', async () => {
    respondeCom({ id: PEDIDO, numero: 1, situacao: 'verificando', quantidade: 200, recipienteId: null, alturaM: null, generico: false });
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'disponivel' });
    const state = await actions.marcarDisponibilidadeAction({}, dados);
    expect(state.error).toMatch(/em que a muda está/i);
    expect(gravouEm('UPDATE pedidos_itens')).toEqual([]);
  });

  it('parcial completa chega ao banco', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      item_id: ITEM,
      estado: 'parcial',
      quantidade: '300',
      recipiente_id: ESPECIE,
    });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toBeUndefined();
    const [, valores] = gravouEm('UPDATE pedidos_itens')[0];
    // Achou em outro recipiente: o conferido vai junto
    expect(valores).toContain(300);
    expect(valores).toContain(ESPECIE);
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
    respondeCom({ id: PEDIDO, numero: 1, situacao: 'verificando', quantidade: 500, recipienteId: null, alturaM: null, generico: true, preco: '2.00' });
    const dados = form({
      pedido_id: PEDIDO,
      item_pai_id: ITEM,
      estado: 'disponivel',
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
      estado: 'disponivel',
      composicao_especie: '',
      composicao_recipiente: RECIPIENTE,
      composicao_quantidade: '500',
    });
    const state = await actions.definirComposicaoAction({}, dados);
    expect(state.error).toMatch(/linha 1/i);
    expectNoDatabase();
  });
});

describe('altura conferida (P12)', () => {
  it('"tem parte" com outra altura grava a altura, em metros', async () => {
    respondeCom({ id: PEDIDO, numero: 1, situacao: 'verificando', quantidade: 500, recipienteId: RECIPIENTE, alturaM: 1.2, generico: false });
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'parcial', quantidade: '500', altura: '80 cm' });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toBeUndefined();
    const [[, valores]] = gravouEm('UPDATE pedidos_itens');
    expect(valores).toEqual([PEDIDO, ITEM, true, null, null, 0.8, null]);
  });

  it('altura que não se entende é recusada antes do banco', async () => {
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'parcial', quantidade: '300', altura: 'alta' });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toMatch(/altura/i);
    expectNoDatabase();
  });
});

describe('genérico: "Não tem" e "Tem parte" (P12)', () => {
  beforeEach(() => {
    respondeCom({ id: PEDIDO, numero: 1, situacao: 'verificando', quantidade: 500, recipienteId: RECIPIENTE, alturaM: null, generico: true, preco: '2.00' });
  });

  it('"Não tem" apaga a composição e grava falso com zero', async () => {
    const state = await actions.marcarGenericoIndisponivelAction({}, form({ pedido_id: PEDIDO, item_pai_id: ITEM }));
    expect(state.error).toBeUndefined();
    expect(gravouEm('DELETE FROM pedidos_itens WHERE item_pai_id')).toHaveLength(1);
    expect(String(gravouEm('UPDATE pedidos_itens')[0][0])).toMatch(/disponivel = false, quantidade_disponivel = 0/);
  });

  it('"Tem parte" com soma menor grava o pai com quantas somou', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      item_pai_id: ITEM,
      estado: 'parcial',
      composicao_especie: ESPECIE,
      composicao_recipiente: RECIPIENTE,
      composicao_quantidade: '300',
      composicao_altura: '',
    });
    expect((await actions.definirComposicaoAction({}, dados)).error).toBeUndefined();
    const atualizacao = gravouEm('UPDATE pedidos_itens').at(-1)!;
    expect(atualizacao[1]).toEqual([PEDIDO, ITEM, false, 300, null]);
  });

  it('resposta que não é "Tem tudo" nem "Tem parte" é recusada antes do banco', async () => {
    const dados = form({ pedido_id: PEDIDO, item_pai_id: ITEM, estado: 'indisponivel', composicao_especie: ESPECIE });
    expect((await actions.definirComposicaoAction({}, dados)).error).toMatch(/resposta inválida/i);
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

describe('o complemento em outro recipiente (P13)', () => {
  const SACO = '4f7b3a5c-2d9e-4a6f-9b4c-6d0e1f2a3b4c';

  it('"Tem parte" com o "+" cria o item que completa, sem preço', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      item_id: ITEM,
      estado: 'parcial',
      quantidade: '300',
      complemento_quantidade: '200',
      complemento_recipiente_id: SACO,
    });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toBeUndefined();
    const [[sql, valores]] = gravouEm('INSERT INTO pedidos_itens');
    expect(String(sql)).toContain('complementa_item_id');
    expect(String(sql)).not.toContain('preco_unitario');
    expect(valores).toEqual([PEDIDO, ITEM, SACO, 200, null]);
  });

  it('responder de novo apaga o complemento anterior', async () => {
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, estado: 'parcial', quantidade: '300' });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toBeUndefined();
    expect(gravouEm('DELETE FROM pedidos_itens WHERE complementa_item_id')).toHaveLength(1);
    expect(gravouEm('INSERT INTO pedidos_itens')).toEqual([]);
  });

  it('as duas linhas não passam do pedido, e nada é gravado', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      item_id: ITEM,
      estado: 'parcial',
      quantidade: '300',
      complemento_quantidade: '300',
      complemento_recipiente_id: SACO,
    });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toMatch(/passam do pedido/);
    expect(gravouEm('INSERT INTO pedidos_itens')).toEqual([]);
    expect(gravouEm('UPDATE pedidos_itens')).toEqual([]);
  });

  it('só "Tem parte" se completa', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      item_id: ITEM,
      estado: 'disponivel',
      complemento_quantidade: '200',
      complemento_recipiente_id: SACO,
    });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toMatch(/Tem parte/);
  });

  it('recipiente do complemento que não é identificador é recusado antes do banco', async () => {
    const dados = form({
      pedido_id: PEDIDO,
      item_id: ITEM,
      estado: 'parcial',
      quantidade: '300',
      complemento_quantidade: '200',
      complemento_recipiente_id: 'saco',
    });
    expect((await actions.marcarDisponibilidadeAction({}, dados)).error).toMatch(/recipiente do complemento/);
    expectNoDatabase();
  });
});
