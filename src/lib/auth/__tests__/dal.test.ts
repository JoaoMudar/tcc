// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '../session-store';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock('../session', () => ({ getCurrentSession: vi.fn() }));

const { getCurrentSession } = await import('../session');
const { requireUser } = await import('../dal');

const session = (overrides: Partial<SessionUser> = {}): SessionUser => ({
  sessaoId: 's1',
  usuarioId: 'u1',
  login: 'debora',
  nomeExibicao: 'Débora',
  perfil: 'gerencia',
  deveTrocarSenha: false,
  expiraEm: new Date(),
  ultimoUsoEm: new Date(),
  ...overrides,
});

describe('requireUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem sessão vai para o login (RF-01)', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow('redirect:/login');
  });

  it('senha provisória vai para a troca antes de qualquer tela (RF-02)', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(session({ deveTrocarSenha: true }));
    await expect(requireUser()).rejects.toThrow('redirect:/trocar-senha');
  });

  it('a própria tela de troca aceita a senha provisória', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(session({ deveTrocarSenha: true }));
    await expect(requireUser({ allowPasswordChange: true })).resolves.toMatchObject({ usuarioId: 'u1' });
  });

  it('sessão válida passa', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(session());
    await expect(requireUser()).resolves.toMatchObject({ perfil: 'gerencia' });
  });
});
