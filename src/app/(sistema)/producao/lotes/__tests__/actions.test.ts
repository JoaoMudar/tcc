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

beforeEach(() => {
  vi.clearAllMocks();
  client.query.mockReset();
});

describe('permissões da produção (D4 §3.5)', () => {
  // Perda e contagem saíram daqui para a fila do aparelho: o teste delas é o de `registros-campo`
  it('chefia só lê: não cria lote, não transfere, não repica nem muda fase ou altura', async () => {
    loggedAs('chefia');
    const lote = { lote_id: LOTE };
    await expect(actions.criarLoteAction({}, form({}))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.transferirLoteAction({}, form({ ...lote, canteiro_id: OUTRO }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.repicarLoteAction({}, form({ ...lote, quantidade: '5' }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.alterarFaseAction({}, form({ ...lote, fase: 'pronto' }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.alterarAlturaAction({}, form({ ...lote, altura: '1,20 m' }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    expectNoDatabase();
  });
});

describe('repicagem e fase', () => {
  it('perdidas sem causa é recusada antes do banco (RN-27)', async () => {
    loggedAs('gerencia');
    const state = await actions.repicarLoteAction(
      {},
      form({ lote_id: LOTE, quantidade: '100', perdidas: '20', causa: '', recipiente_id: OUTRO, canteiro_id: OUTRO }),
    );
    expect(state.error).toBe('Escolha a causa das mudas que morreram na repicagem.');
    expectNoDatabase();
  });

  it('T6.10: a divisão pede os dois canteiros, e a quantidade é conferida antes de ir ao banco', async () => {
    loggedAs('gerencia');
    const base = { lote_id: LOTE, quantidade: '100', canteiro_a_id: OUTRO, canteiro_b_id: OUTRO };

    expect((await actions.dividirLoteAction({}, form({ ...base, quantidade: '0' }))).error).toMatch(/maior que zero/);
    expect((await actions.dividirLoteAction({}, form({ ...base, canteiro_a_id: '' }))).error).toBe(
      'Escolha a área e o canteiro do primeiro lote.',
    );
    expect((await actions.dividirLoteAction({}, form({ ...base, canteiro_b_id: 'x' }))).error).toBe(
      'Escolha a área e o canteiro do segundo lote.',
    );
    expect((await actions.dividirLoteAction({}, form({ ...base, lote_id: 'x' }))).error).toBe('Lote inválido.');
    expectNoDatabase();
  });

  it('fase encerrado não se escolhe à mão', async () => {
    loggedAs('gerencia');
    expect((await actions.alterarFaseAction({}, form({ lote_id: LOTE, fase: 'encerrado' }))).error).toBe('Escolha a fase na lista.');
    expectNoDatabase();
  });

  it('RF-65: altura que não se entende é recusada antes do banco', async () => {
    loggedAs('gerencia');
    const state = await actions.alterarAlturaAction({}, form({ lote_id: LOTE, altura: 'alta' }));
    expect(state.error).toMatch(/A altura precisa ser/);
    expect((await actions.alterarAlturaAction({}, form({ lote_id: 'x', altura: '1,20 m' }))).error).toBe('Lote inválido.');
    expectNoDatabase();
  });

  it('RF-65: a altura medida vai ao banco em metros, e o vazio apaga', async () => {
    loggedAs('gerencia');
    vi.mocked(pool.query).mockResolvedValue({ rowCount: 1, rows: [] } as never);
    expect((await actions.alterarAlturaAction({}, form({ lote_id: LOTE, altura: '120' }))).success).toBe('Altura registrada: 1,20 m.');
    expect(vi.mocked(pool.query).mock.calls[0][1]).toEqual([LOTE, 1.2]);
    expect((await actions.alterarAlturaAction({}, form({ lote_id: LOTE, altura: '' }))).success).toBe('Altura apagada.');
    expect(vi.mocked(pool.query).mock.calls[1][1]).toEqual([LOTE, null]);
  });
});
