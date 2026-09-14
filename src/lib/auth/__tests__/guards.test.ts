// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Perfil } from '@/lib/permissions';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock('../dal', () => ({ requireUser: vi.fn() }));

const { requireUser } = await import('../dal');
const { UserError } = await import('@/lib/errors');
const { FORBIDDEN_MESSAGE, requirePageAccess, requirePermission } = await import('../guards');

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

describe('requirePermission', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TA-03: operação da chefia acionada pela gerência é recusada no servidor', async () => {
    loggedAs('gerencia');
    const error = await requirePermission('pedidos', 'C').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UserError);
    expect((error as Error).message).toBe(FORBIDDEN_MESSAGE);
  });

  it('TA-08: gerência não altera parâmetro, mas lê', async () => {
    loggedAs('gerencia');
    await expect(requirePermission('parametros', 'A')).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(requirePermission('parametros', 'L')).resolves.toMatchObject({ perfil: 'gerencia' });
  });

  it('sempre passa pela sessão antes de decidir', async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error('redirect:/login'));
    await expect(requirePermission('especies', 'L')).rejects.toThrow('redirect:/login');
  });
});

describe('requirePageAccess', () => {
  beforeEach(() => vi.clearAllMocks());

  it('página sem permissão manda para a explicação', async () => {
    loggedAs('gerencia');
    await expect(requirePageAccess('pedidos')).rejects.toThrow('redirect:/sem-permissao');
  });

  it('página permitida devolve o usuário', async () => {
    loggedAs('chefia');
    await expect(requirePageAccess('pedidos')).resolves.toMatchObject({ perfil: 'chefia' });
  });
});
