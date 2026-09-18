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

const ID = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';
const PESSOA = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e1f';
const SEMANA = '2026-09-14';

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

describe('permissões da agenda (D4 §3.3)', () => {
  it('chefia só lê: não lança, altera, exclui, confirma, abre, copia, publica nem fecha', async () => {
    loggedAs('chefia');
    const semana = form({ semana: SEMANA });
    const tarefa = form({ id: ID });
    await expect(actions.criarAtribuicaoAction({}, form({}))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.atualizarAtribuicaoAction({}, tarefa)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.excluirAtribuicaoAction({}, tarefa)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.reagendarAtribuicaoAction({}, tarefa)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.confirmarAtribuicaoAction({}, tarefa)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.abrirSemanaAction({}, semana)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.copiarSemanaAction({}, semana)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.publicarSemanaAction({}, semana)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.fecharSemanaAction({}, semana)).rejects.toThrow(FORBIDDEN_MESSAGE);
    expectNoDatabase();
  });

  it('gerência passa pelo guard, e o que é inválido volta antes do banco', async () => {
    loggedAs('gerencia');
    expect(await actions.criarAtribuicaoAction({}, form({ semana: '2026-09-15' }))).toMatchObject({ error: 'Semana inválida.' });
    expect(await actions.criarAtribuicaoAction({}, form({ semana: SEMANA, tipo_tarefa_id: 'x' }))).toMatchObject({
      error: 'Escolha o tipo de tarefa.',
    });
    expect(await actions.atualizarAtribuicaoAction({}, form({ id: 'x' }))).toEqual({ error: 'Tarefa inválida.' });
    expect(await actions.excluirAtribuicaoAction({}, form({ id: 'x' }))).toEqual({ error: 'Tarefa inválida.' });
    expect(await actions.reagendarAtribuicaoAction({}, form({ id: 'x' }))).toEqual({ error: 'Tarefa inválida.' });
    expect(await actions.reagendarAtribuicaoAction({}, form({ id: ID, data: '2026-13-40' }))).toEqual({ error: 'Dia inválido.' });
    expect(await actions.reagendarAtribuicaoAction({}, form({ id: ID, data: SEMANA, turno_id: 'x' }))).toMatchObject({
      error: expect.stringContaining('Escolha o turno'),
    });
    expect(await actions.confirmarAtribuicaoAction({}, form({ id: 'x' }))).toEqual({ error: 'Tarefa inválida.' });
    expect(await actions.abrirSemanaAction({}, form({ semana: 'x' }))).toEqual({ error: 'Semana inválida.' });
    expect(await actions.copiarSemanaAction({}, form({ semana: '2026-09-16' }))).toEqual({ error: 'Semana inválida.' });
    expect(await actions.publicarSemanaAction({}, form({ semana: '' }))).toEqual({ error: 'Semana inválida.' });
    expect(await actions.fecharSemanaAction({}, form({ semana: 'x' }))).toEqual({ error: 'Semana inválida.' });
    expectNoDatabase();
  });

  it('TA-32: sem o lote exigido a confirmação não abre transação, e mantém o digitado', async () => {
    loggedAs('gerencia');
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: ID, exigeLote: true, exigeArea: false, eQuantitativa: true, unidadeMedida: 'un', participantes: [{ id: PESSOA, nome: 'Rogério', quantidade: null }] }],
    } as never);
    const state = await actions.confirmarAtribuicaoAction({}, form({ id: ID, [`quantidade_${PESSOA}`]: '120' }));
    expect(state.error).toMatch(/exige o lote/);
    expect(state.fields).toMatchObject({ [`quantidade_${PESSOA}`]: '120' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('fechar a semana publicada volta para a agenda', async () => {
    loggedAs('gerencia');
    client.query.mockImplementation(async (sql: string) =>
      sql.includes('FROM semanas')
        ? { rows: [{ id: 's1', inicio: SEMANA, situacao: 'publicada', fechadaEm: null }] }
        : { rows: [], rowCount: 2 },
    );
    await expect(actions.fecharSemanaAction({}, form({ semana: SEMANA }))).rejects.toThrow(
      `redirect:/producao/agenda?semana=${SEMANA}&feito=fechada`,
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('arrastar em semana fechada recusa, e nada é gravado', async () => {
    loggedAs('gerencia');
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM atribuicoes WHERE id')) return { rows: [{ semanaId: 's1' }] };
      if (sql.includes('FROM semanas')) return { rows: [{ id: 's1', inicio: SEMANA, situacao: 'fechada', fechadaEm: new Date() }] };
      if (sql.includes('FOR UPDATE OF a')) return { rows: [{ id: ID, situacao: 'planejada', loteId: null, exigeLote: false }] };
      return { rows: [] };
    });
    const state = await actions.reagendarAtribuicaoAction(
      {},
      form({ id: ID, data: SEMANA, turno_id: PESSOA, hora_inicio: '07:00', hora_fim: '08:00' }),
    );
    expect(state).toEqual({ error: expect.stringContaining('está fechada e não se altera') });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE atribuicoes SET data_trabalho'), expect.anything());
  });

  it('semana fechada recusa com o motivo (TA-30)', async () => {
    loggedAs('gerencia');
    client.query.mockImplementation(async (sql: string) =>
      sql.includes('FROM semanas') ? { rows: [{ id: 's1', inicio: SEMANA, situacao: 'fechada', fechadaEm: new Date() }] } : { rows: [] },
    );
    expect(await actions.publicarSemanaAction({}, form({ semana: SEMANA }))).toEqual({
      error: expect.stringContaining('está fechada e não se altera'),
    });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
