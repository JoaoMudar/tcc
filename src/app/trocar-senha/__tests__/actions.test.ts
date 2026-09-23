// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoginUserRow } from '@/lib/auth/user-store';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock('@/lib/db', () => ({ default: { query: vi.fn() } }));
vi.mock('@/lib/auth/dal', () => ({ requireUser: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({
  endCurrentSession: vi.fn(),
  requestOrigin: vi.fn(async () => ({ ip: '10.0.0.1', agenteUsuario: 'Chrome' })),
}));
vi.mock('@/lib/auth/session-store', () => ({ deleteOtherSessions: vi.fn() }));
vi.mock('@/lib/auth/user-store', () => ({
  findUserForLogin: vi.fn(),
  recordLoginEvent: vi.fn(),
  saveFailure: vi.fn(),
  updatePassword: vi.fn(),
}));

const { requireUser } = await import('@/lib/auth/dal');
const { default: pool } = await import('@/lib/db');
const session = await import('@/lib/auth/session');
const sessionStore = await import('@/lib/auth/session-store');
const store = await import('@/lib/auth/user-store');
const { hashPassword } = await import('@/lib/auth/password');
const { changePassword } = await import('../actions');

const SENHA_ATUAL = 'Canteiro-A3-tubete';
const NOVA = 'Bracatinga-Sul-77';
let senhaHash: string;

function conta(overrides: Partial<LoginUserRow> = {}): LoginUserRow {
  return {
    id: 'u1',
    login: 'debora',
    senhaHash,
    ativo: true,
    tentativas: 0,
    bloqueadoAte: null,
    deveTrocarSenha: false,
    ...overrides,
  };
}

function form(atual: string, nova = NOVA): FormData {
  const data = new FormData();
  data.set('senha_atual', atual);
  data.set('nova_senha', nova);
  data.set('repetir_senha', nova);
  return data;
}

beforeAll(async () => {
  senhaHash = await hashPassword(SENHA_ATUAL);
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({
    sessaoId: 's1',
    usuarioId: 'u1',
    login: 'debora',
    nomeExibicao: 'Débora Schmitt',
    perfil: 'gerencia',
    deveTrocarSenha: false,
    expiraEm: new Date(),
    ultimoUsoEm: new Date(),
  });
});

describe('changePassword', () => {
  it('com a senha atual certa, troca e encerra as outras sessões', async () => {
    vi.mocked(store.findUserForLogin).mockResolvedValue(conta());
    await expect(changePassword({}, form(SENHA_ATUAL))).rejects.toThrow('redirect:/');
    expect(store.findUserForLogin).toHaveBeenCalledWith(pool, 'debora');
    expect(store.updatePassword).toHaveBeenCalledWith(pool, 'u1', expect.stringMatching(/^scrypt\$/), false);
    expect(sessionStore.deleteOtherSessions).toHaveBeenCalledWith(pool, 'u1', 's1');
    expect(store.saveFailure).not.toHaveBeenCalled();
  });

  it('senha atual errada soma falha e registra a tentativa (SEC-011)', async () => {
    vi.mocked(store.findUserForLogin).mockResolvedValue(conta({ tentativas: 1 }));
    expect(await changePassword({}, form('Chute-errado-1'))).toEqual({ error: 'A senha atual não confere.' });
    expect(store.saveFailure).toHaveBeenCalledWith(pool, 'u1', 2, null);
    expect(store.recordLoginEvent).toHaveBeenCalledWith(pool, {
      usuarioId: 'u1',
      loginTentado: 'debora',
      sucesso: false,
      ip: '10.0.0.1',
      agenteUsuario: 'Chrome',
    });
    expect(store.updatePassword).not.toHaveBeenCalled();
    expect(session.endCurrentSession).not.toHaveBeenCalled();
  });

  it('a quinta falha bloqueia, encerra a sessão e manda para o login (SEC-011)', async () => {
    vi.mocked(store.findUserForLogin).mockResolvedValue(conta({ tentativas: 4 }));
    await expect(changePassword({}, form('Chute-errado-5'))).rejects.toThrow('redirect:/login');
    expect(store.saveFailure).toHaveBeenCalledWith(pool, 'u1', 0, expect.any(Date));
    expect(session.endCurrentSession).toHaveBeenCalled();
    expect(store.updatePassword).not.toHaveBeenCalled();
  });

  it('conta já bloqueada não testa a senha e encerra a sessão', async () => {
    vi.mocked(store.findUserForLogin).mockResolvedValue(conta({ bloqueadoAte: new Date(Date.now() + 60_000) }));
    await expect(changePassword({}, form(SENHA_ATUAL))).rejects.toThrow('redirect:/login');
    expect(store.saveFailure).not.toHaveBeenCalled();
    expect(store.updatePassword).not.toHaveBeenCalled();
    expect(session.endCurrentSession).toHaveBeenCalled();
  });

  it('valida os campos antes de tocar no banco', async () => {
    expect(await changePassword({}, form(SENHA_ATUAL, SENHA_ATUAL))).toEqual({
      error: 'A nova senha precisa ser diferente da atual.',
    });
    expect(store.findUserForLogin).not.toHaveBeenCalled();
  });
});
