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
const { FORBIDDEN_MESSAGE } = await import('@/lib/auth/guards');
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

/** Um pedido válido, com um item só. */
function pedidoValido(extra: Record<string, string | string[]> = {}) {
  return form({
    cliente_id: PEDIDO,
    canal: 'atacado',
    item_especie: ESPECIE,
    item_recipiente: RECIPIENTE,
    item_quantidade: '200',
    ...extra,
  });
}

/** O pedido que o mock devolve. `n` é a contagem de itens que `confirmarPedido` lê antes de aprovar. */
function emSituacao(situacao: string) {
  client.query.mockResolvedValue({ rows: [{ id: PEDIDO, numero: 1, situacao, n: 1 }], rowCount: 1 });
}

beforeEach(() => {
  vi.clearAllMocks();
  client.query.mockResolvedValue({ rows: [{ id: PEDIDO, numero: 1 }], rowCount: 1 });
  loggedAs('chefia');
});

describe('permissão (RF-06, D4 §3.2)', () => {
  it('a gerência não registra pedido, e o banco nem é consultado', async () => {
    loggedAs('gerencia');
    await expect(actions.criarPedidoAction({}, pedidoValido())).rejects.toThrow(FORBIDDEN_MESSAGE);
    expectNoDatabase();
  });

  it('a gerência inicia a verificação, que é fase dela (RN-53)', async () => {
    loggedAs('gerencia');
    emSituacao('cadastrado');
    const state = await actions.transicionarPedidoAction({}, form({ pedido_id: PEDIDO, para: 'verificando' }));
    expect(state.error).toBeUndefined();
    const gravou = client.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE pedidos SET situacao'));
    expect(gravou).toHaveLength(1);
  });

  it('aprovar não é da gerência, e a recusa vem antes de gravar', async () => {
    loggedAs('gerencia');
    emSituacao('verificado');
    const state = await actions.transicionarPedidoAction({}, form({ pedido_id: PEDIDO, para: 'aprovado' }));
    expect(state.error).toMatch(/não pode passar/i);
    const gravou = client.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE pedidos SET situacao'));
    expect(gravou).toEqual([]);
  });

  it('a chefia executa também as fases da gerência', async () => {
    emSituacao('aprovado');
    const state = await actions.transicionarPedidoAction({}, form({ pedido_id: PEDIDO, para: 'separando' }));
    expect(state.error).toBeUndefined();
  });

  it('fase que não existe é recusada antes do banco', async () => {
    const state = await actions.transicionarPedidoAction({}, form({ pedido_id: PEDIDO, para: 'entregue' }));
    expect(state.error).toMatch(/fase inválida/i);
    expectNoDatabase();
  });

  it('a gerência não altera item', async () => {
    loggedAs('gerencia');
    const dados = form({ pedido_id: PEDIDO, item_id: ITEM, quantidade: '1', preco: '1,00' });
    await expect(actions.atualizarItemAction({}, dados)).rejects.toThrow(FORBIDDEN_MESSAGE);
    expectNoDatabase();
  });

  it('a chefia registra, e o pedido criado devolve a pessoa à carteira', async () => {
    await expect(actions.criarPedidoAction({}, pedidoValido())).rejects.toThrow('redirect:/pedidos?feito=criado&numero=1');
    expect(pool.connect).toHaveBeenCalled();
  });
});

describe('validação antes do banco (UC-31 FE-1)', () => {
  it('pedido sem item nenhum é recusado', async () => {
    const state = await actions.criarPedidoAction({}, form({ cliente_id: PEDIDO, canal: 'atacado' }));
    expect(state.error).toMatch(/ao menos um item/i);
    expectNoDatabase();
  });

  it('a linha em branco que ninguém usou não vira erro nem item', async () => {
    await expect(
      actions.criarPedidoAction(
        {},
        pedidoValido({ item_especie: [ESPECIE, ''], item_recipiente: [RECIPIENTE, ''], item_quantidade: ['200', ''] }),
      ),
    ).rejects.toThrow(/^redirect:/);
    const inseridos = client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO pedidos_itens'));
    expect(inseridos).toHaveLength(1);
  });

  it('o cadastro não pede preço, e o item nasce sem valor nenhum', async () => {
    // RN-50: o preço se digita depois da conferência, e nulo é "ainda não precificado"
    await expect(actions.criarPedidoAction({}, pedidoValido())).rejects.toThrow(/^redirect:/);
    const [, valores] = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO pedidos_itens'))!;
    expect(valores).toContain(null);
  });

  it('a altura vazia entra como nula: ela é opcional', async () => {
    await expect(actions.criarPedidoAction({}, pedidoValido({ item_altura: '' }))).rejects.toThrow(/^redirect:/);
    const [, valores] = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO pedidos_itens'))!;
    expect(valores).toContain(null);
  });

  it('a altura digitada com vírgula chega ao banco em metros', async () => {
    await expect(actions.criarPedidoAction({}, pedidoValido({ item_altura: '1,20' }))).rejects.toThrow(/^redirect:/);
    const [, valores] = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO pedidos_itens'))!;
    expect(valores).toContain(1.2);
  });

  it('SEC-006: mais de 200 itens num envio é recusado antes do banco', async () => {
    const muitos = (valor: string) => Array.from({ length: 201 }, () => valor);
    const state = await actions.criarPedidoAction(
      {},
      pedidoValido({ item_especie: muitos(ESPECIE), item_recipiente: muitos(RECIPIENTE), item_quantidade: muitos('10') }),
    );
    expect(state.error).toMatch(/até 200 itens/);
    expectNoDatabase();
  });

  it('altura que não é medida é recusada antes do banco, dizendo de que item se trata', async () => {
    const state = await actions.criarPedidoAction({}, pedidoValido({ item_altura: 'grande' }));
    expect(state.error).toMatch(/item 1/i);
    expectNoDatabase();
  });

  it('a linha com altura e mais nada não é linha em branco, e cobra o resto', async () => {
    const state = await actions.criarPedidoAction(
      {},
      pedidoValido({
        item_especie: [ESPECIE, ''],
        item_recipiente: [RECIPIENTE, ''],
        item_quantidade: ['200', ''],
        item_altura: ['', '1,20'],
      }),
    );
    expect(state.error).toMatch(/item 2/i);
    expectNoDatabase();
  });

  it('alterar o item leva a altura junto da quantidade', async () => {
    emSituacao('cadastrado');
    const state = await actions.atualizarItemAction({}, form({ pedido_id: PEDIDO, item_id: ITEM, quantidade: '300', altura: '0,80' }));
    expect(state.error).toBeUndefined();
    const [, valores] = client.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE pedidos_itens SET quantidade'))!;
    expect(valores).toEqual([PEDIDO, ITEM, 300, 0.8]);
  });

  it('altura inválida na alteração é recusada, e o campo digitado volta para a tela', async () => {
    const state = await actions.atualizarItemAction({}, form({ pedido_id: PEDIDO, item_id: ITEM, quantidade: '300', altura: 'x' }));
    expect(state.error).toMatch(/altura/i);
    expect(state.fields?.altura).toBe('x');
    expectNoDatabase();
  });

  it('quantidade zerada é recusada', async () => {
    const state = await actions.criarPedidoAction({}, pedidoValido({ item_quantidade: '0' }));
    expect(state.error).toMatch(/item 1/i);
    expectNoDatabase();
  });

  it('canal fora da lista fechada é recusado (RN-42)', async () => {
    const state = await actions.criarPedidoAction({}, pedidoValido({ canal: 'escambo' }));
    expect(state.error).toMatch(/canal de venda/i);
    expectNoDatabase();
  });

  it('cliente que não é identificador é recusado antes do SQL', async () => {
    const state = await actions.criarPedidoAction({}, pedidoValido({ cliente_id: 'x' }));
    expect(state.error).toMatch(/cliente/i);
    expectNoDatabase();
  });

  it('o que foi digitado volta para a tela quando a action recusa', async () => {
    const state = await actions.criarPedidoAction({}, pedidoValido({ canal: 'escambo', observacoes: 'entregar na sexta' }));
    expect(state.fields?.observacoes).toBe('entregar na sexta');
  });

  it('a linha genérica entra sem espécie, para a gerência escolher na conferência', async () => {
    await expect(
      actions.criarPedidoAction({}, pedidoValido({ item_especie: '', item_generico: '1', item_especificacao: '500 nativas' })),
    ).rejects.toThrow(/^redirect:/);
    const [, valores] = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO pedidos_itens'))!;
    expect(valores).toContain(null);
    expect(valores).toContain('500 nativas');
  });
});

describe('preço depois da conferência (RF-55, RN-50)', () => {
  it('chega ao SQL em reais, com duas casas, e não em centavos', async () => {
    emSituacao('verificado');
    const state = await actions.definirPrecosAction({}, form({ pedido_id: PEDIDO, preco_item_id: ITEM, preco_valor: '2,50' }));
    expect(state.error).toBeUndefined();
    const [, valores] = client.query.mock.calls.find(([sql]) => String(sql).includes('SET preco_unitario'))!;
    expect(valores).toContain('2.50');
  });

  it('preço inválido é recusado dizendo qual item é, e nada é gravado', async () => {
    emSituacao('verificado');
    const state = await actions.definirPrecosAction({}, form({ pedido_id: PEDIDO, preco_item_id: ITEM, preco_valor: 'combinar' }));
    expect(state.error).toMatch(/item 1/i);
    const gravou = client.query.mock.calls.filter(([sql]) => String(sql).includes('SET preco_unitario'));
    expect(gravou).toEqual([]);
  });

  it('campo em branco é item que a chefia ainda não precificou, e não erro', async () => {
    emSituacao('verificado');
    const state = await actions.definirPrecosAction(
      {},
      form({ pedido_id: PEDIDO, preco_item_id: [ITEM, ESPECIE], preco_valor: ['2,50', ''] }),
    );
    expect(state.error).toBeUndefined();
    const gravou = client.query.mock.calls.filter(([sql]) => String(sql).includes('SET preco_unitario'));
    expect(gravou).toHaveLength(1);
  });

  it('a gerência não precifica: o valor da venda é da chefia', async () => {
    loggedAs('gerencia');
    emSituacao('verificado');
    const state = await actions.definirPrecosAction({}, form({ pedido_id: PEDIDO, preco_item_id: ITEM, preco_valor: '2,50' }));
    expect(state.error).toMatch(/chefia/i);
  });
});

/** A observação do histórico é o 5º valor do INSERT: pedido, de, para, autor, observações. */
function motivoGravado(): unknown {
  const [, valores] = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO pedidos_historico'))!;
  return (valores as unknown[])[4];
}

describe('cancelamento (T8.5)', () => {
  it('o motivo digitado fica no histórico', async () => {
    emSituacao('aprovado');
    const state = await actions.cancelarPedidoAction({}, form({ pedido_id: PEDIDO, motivo: 'cliente desistiu' }));
    expect(state.error).toBeUndefined();
    expect(motivoGravado()).toBe('cliente desistiu');
  });

  it('sem motivo o pedido cancela do mesmo jeito, e o histórico fica sem observação', async () => {
    emSituacao('aprovado');
    const state = await actions.cancelarPedidoAction({}, form({ pedido_id: PEDIDO }));
    expect(state.error).toBeUndefined();
    expect(motivoGravado()).toBeNull();
  });

  it('motivo comprido demais é recusado antes do banco', async () => {
    const state = await actions.cancelarPedidoAction({}, form({ pedido_id: PEDIDO, motivo: 'x'.repeat(501) }));
    expect(state.error).toMatch(/500 caracteres/i);
    expectNoDatabase();
  });

  it('a gerência não cancela pedido (D4 §3.2)', async () => {
    loggedAs('gerencia');
    emSituacao('aprovado');
    const state = await actions.cancelarPedidoAction({}, form({ pedido_id: PEDIDO, motivo: 'não' }));
    expect(state.error).toMatch(/não pode passar/i);
    const gravou = client.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE pedidos SET situacao'));
    expect(gravou).toEqual([]);
  });
});
