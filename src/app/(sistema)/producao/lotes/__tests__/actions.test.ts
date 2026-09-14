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

const LOTE = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';
const OUTRO = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e1f';

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

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

function expectNoDatabase() {
  expect(pool.query).not.toHaveBeenCalled();
  expect(pool.connect).not.toHaveBeenCalled();
}

/** Lote aberto com 200 mudas, respondido pela forma do SQL. */
function loteNoBanco(quantidadeAtual = 200) {
  client.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM lotes') && sql.includes('FOR UPDATE')) {
      return {
        rows: [{ id: LOTE, codigo: '2026-0001', especieId: 'e', recipienteId: 'r', canteiroId: OUTRO, quantidadeAtual, encerrado: false }],
      };
    }
    return { rows: [], rowCount: 1 };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  client.query.mockReset();
});

describe('permissões da produção (D4 §3.5)', () => {
  it('chefia só lê: não cria lote, não registra perda, contagem, transferência, repicagem nem fase', async () => {
    loggedAs('chefia');
    const lote = { lote_id: LOTE };
    await expect(actions.criarLoteAction({}, form({}))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.registrarPerdaAction({}, form({ ...lote, quantidade: '5', causa: 'seca' }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.registrarContagemAction({}, form({ ...lote, contado: '5' }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.transferirLoteAction({}, form({ ...lote, canteiro_id: OUTRO }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.repicarLoteAction({}, form({ ...lote, quantidade: '5' }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.alterarFaseAction({}, form({ ...lote, fase: 'pronto' }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    expectNoDatabase();
  });

  it('admin tem acesso irrestrito (D4 §1.1)', async () => {
    loggedAs('admin');
    loteNoBanco();
    const state = await actions.registrarPerdaAction({}, form({ lote_id: LOTE, quantidade: '5', causa: 'seca' }));
    expect(state.success).toContain('Perda de 5');
  });
});

describe('perda (T4.5)', () => {
  it('quantidade inválida e causa fora da lista são recusadas sem ir ao banco', async () => {
    loggedAs('gerencia');
    expect((await actions.registrarPerdaAction({}, form({ lote_id: LOTE, quantidade: '0', causa: 'seca' }))).error).toMatch(/maior que zero/);
    expect((await actions.registrarPerdaAction({}, form({ lote_id: LOTE, quantidade: '5', causa: 'fungo' }))).error).toBe(
      'Escolha a causa da perda.',
    );
    expect((await actions.registrarPerdaAction({}, form({ lote_id: 'x', quantidade: '5', causa: 'seca' }))).error).toBe('Lote inválido.');
    expectNoDatabase();
  });

  it('grava com o autor da sessão e diz o saldo que ficou', async () => {
    loggedAs('gerencia');
    loteNoBanco();
    const state = await actions.registrarPerdaAction({}, form({ lote_id: LOTE, quantidade: '50', causa: 'geada', observacoes: '' }));
    expect(state).toEqual({ success: 'Perda de 50 por geada registrada. O lote fica com 150 mudas.' });
    const insert = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO movimentos_lote'));
    expect(insert?.[1]).toEqual([LOTE, 'perda', -50, expect.any(String), 'geada', null, 'u1', null]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('TA-20: perda maior que o saldo volta como erro legível, com rollback', async () => {
    loggedAs('gerencia');
    loteNoBanco();
    const state = await actions.registrarPerdaAction({}, form({ lote_id: LOTE, quantidade: '250', causa: 'praga' }));
    expect(state.error).toContain('tem 200 mudas');
    expect(state.fields?.quantidade).toBe('250');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});

describe('contagem (T4.6)', () => {
  it('sem diferença não grava nada', async () => {
    loggedAs('gerencia');
    loteNoBanco();
    const state = await actions.registrarContagemAction({}, form({ lote_id: LOTE, contado: '200' }));
    expect(state.success).toBe('A contagem bate com o saldo. Nada a ajustar.');
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
  });

  it('com diferença grava o ajuste com sinal', async () => {
    loggedAs('gerencia');
    loteNoBanco();
    const state = await actions.registrarContagemAction({}, form({ lote_id: LOTE, contado: '185' }));
    expect(state.success).toBe('Contagem registrada: 15 a menos que o calculado. O lote fica com 185 mudas.');
    const insert = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO movimentos_lote'));
    expect(insert?.[1]).toEqual([LOTE, 'ajuste_contagem', -15, expect.any(String), null, null, 'u1', null]);
  });
});

describe('repicagem e fase', () => {
  it('perdidas sem causa é recusada antes do banco (RN-28)', async () => {
    loggedAs('gerencia');
    const state = await actions.repicarLoteAction(
      {},
      form({ lote_id: LOTE, quantidade: '100', perdidas: '20', causa: '', recipiente_id: OUTRO, canteiro_id: OUTRO }),
    );
    expect(state.error).toBe('Escolha a causa das mudas que morreram na repicagem.');
    expectNoDatabase();
  });

  it('fase encerrado não se escolhe à mão', async () => {
    loggedAs('gerencia');
    expect((await actions.alterarFaseAction({}, form({ lote_id: LOTE, fase: 'encerrado' }))).error).toBe('Escolha a fase na lista.');
    expectNoDatabase();
  });
});
