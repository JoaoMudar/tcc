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

const TURNO_ID = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';

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

const PARAMETROS_DO_BANCO = [
  { chave: 'producao.atraso_atencao_dias', valor: '0', tipoValor: 'numero', descricao: 'a' },
  { chave: 'producao.atraso_critico_dias', valor: '3', tipoValor: 'numero', descricao: 'c' },
  { chave: 'producao.mortalidade_limite_pct', valor: '20', tipoValor: 'numero', descricao: 'm' },
];

const PARAMETROS_FORM = {
  'valor:producao.atraso_atencao_dias': '0',
  'valor:producao.atraso_critico_dias': '3',
  'valor:producao.mortalidade_limite_pct': '30',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('actions de Configurações', () => {
  it('só existem as três actions: nenhuma cria ou exclui parâmetro (TA-07, D4 §3.7)', () => {
    expect(Object.keys(actions).sort()).toEqual(['createTurno', 'updateParametros', 'updateTurno']);
  });

  it('TA-08: gerência não altera parâmetro, e o banco nem é consultado', async () => {
    loggedAs('gerencia');
    await expect(actions.updateParametros({}, form(PARAMETROS_FORM))).rejects.toThrow(FORBIDDEN_MESSAGE);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('gerência não altera nem cria turno', async () => {
    loggedAs('gerencia');
    await expect(
      actions.updateTurno({}, form({ turno_id: TURNO_ID, inicio: '07:30', fim: '12:00' })),
    ).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.createTurno({}, form({ nome: 'noite', inicio: '18:00', fim: '20:00' }))).rejects.toThrow(
      FORBIDDEN_MESSAGE,
    );
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('chefia com fim antes do início recebe a mensagem, sem gravar', async () => {
    loggedAs('chefia');
    const state = await actions.updateTurno({}, form({ turno_id: TURNO_ID, inicio: '12:00', fim: '07:30' }));
    expect(state).toEqual({ error: 'O fim do turno precisa ser depois do início.' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('chefia altera o turno', async () => {
    loggedAs('chefia');
    vi.mocked(pool.query).mockResolvedValue({ rowCount: 1, rows: [] } as never);
    const state = await actions.updateTurno({}, form({ turno_id: TURNO_ID, inicio: '07:30', fim: '12:00', ativo: 'on' }));
    expect(state).toEqual({ success: 'Horário salvo.' });
    expect(vi.mocked(pool.query).mock.calls[0][1]).toEqual([TURNO_ID, '07:30', '12:00', true]);
  });

  it('chefia altera parâmetro numa transação, registrando quem alterou', async () => {
    loggedAs('chefia');
    vi.mocked(pool.query).mockResolvedValue({ rows: PARAMETROS_DO_BANCO } as never);
    client.query.mockImplementation(async (sql: string) =>
      sql.startsWith('SELECT chave') ? { rows: PARAMETROS_DO_BANCO.map(({ chave }) => ({ chave })) } : { rows: [] },
    );

    const state = await actions.updateParametros({}, form(PARAMETROS_FORM));

    expect(state.success).toMatch(/Alterações salvas/);
    const sqls = client.query.mock.calls.map((call) => String(call[0]));
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls.at(-1)).toBe('COMMIT');
    expect(sqls.some((sql) => /INSERT|DELETE/i.test(sql))).toBe(false);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE parametros'), [
      'producao.mortalidade_limite_pct',
      '30',
      'u1',
    ]);
  });

  it('chefia com crítico abaixo de atenção recebe a mensagem e mantém o digitado', async () => {
    loggedAs('chefia');
    vi.mocked(pool.query).mockResolvedValue({ rows: PARAMETROS_DO_BANCO } as never);
    const valores = { ...PARAMETROS_FORM, 'valor:producao.atraso_atencao_dias': '5' };
    const state = await actions.updateParametros({}, form(valores));
    expect(state).toEqual({ error: 'O atraso crítico precisa ser maior que o atraso de atenção.', fields: valores });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
