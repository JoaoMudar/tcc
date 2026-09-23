// @vitest-environment node
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoginUserRow } from '../user-store';

vi.mock('../user-store', () => ({
  countRecentFailuresByIp: vi.fn(),
  findUserForLogin: vi.fn(),
  recordLoginEvent: vi.fn(),
  saveFailure: vi.fn(),
  resetFailures: vi.fn(),
}));
vi.mock('../session-store', () => ({ deleteExpiredSessions: vi.fn() }));

const store = await import('../user-store');
const sessions = await import('../session-store');
const { MAX_VERIFICACOES_SIMULTANEAS, comVagaDeVerificacao, hashPassword } = await import('../password');
const { INVALID_CREDENTIALS, OCUPADO, attemptLogin } = await import('../login');

const db = {} as Pick<Pool, 'query'>;
const now = new Date('2026-09-14T10:00:00Z');
let senhaHash: string;

function user(overrides: Partial<LoginUserRow> = {}): LoginUserRow {
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

const input = (senha: string, login = 'debora') => ({ login, senha, ip: '10.0.0.1', agenteUsuario: 'Chrome', now });

beforeAll(async () => {
  senhaHash = await hashPassword('Canteiro-A3-tubete');
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(store.countRecentFailuresByIp).mockResolvedValue(0);
});

describe('attemptLogin', () => {
  it('entra com a senha certa, zera falhas e registra sucesso', async () => {
    vi.mocked(store.findUserForLogin).mockResolvedValue(user({ tentativas: 2, deveTrocarSenha: true }));
    const result = await attemptLogin(db, input('Canteiro-A3-tubete', '  Debora '));
    expect(result).toEqual({ ok: true, usuarioId: 'u1', deveTrocarSenha: true });
    expect(store.findUserForLogin).toHaveBeenCalledWith(db, 'debora');
    expect(store.resetFailures).toHaveBeenCalledWith(db, 'u1');
    expect(sessions.deleteExpiredSessions).toHaveBeenCalledWith(db, 'u1', now);
    expect(store.recordLoginEvent).toHaveBeenCalledWith(db, {
      usuarioId: 'u1',
      loginTentado: 'debora',
      sucesso: true,
      ip: '10.0.0.1',
      agenteUsuario: 'Chrome',
    });
  });

  it('login inexistente: mensagem genérica e evento sem usuário', async () => {
    vi.mocked(store.findUserForLogin).mockResolvedValue(null);
    expect(await attemptLogin(db, input('x', 'ninguem'))).toEqual({ ok: false, message: INVALID_CREDENTIALS });
    expect(store.recordLoginEvent).toHaveBeenCalledWith(db, expect.objectContaining({ usuarioId: null, sucesso: false }));
  });

  it('senha errada soma uma falha', async () => {
    vi.mocked(store.findUserForLogin).mockResolvedValue(user({ tentativas: 1 }));
    expect(await attemptLogin(db, input('errada'))).toEqual({ ok: false, message: INVALID_CREDENTIALS });
    expect(store.saveFailure).toHaveBeenCalledWith(db, 'u1', 2, null);
    expect(store.resetFailures).not.toHaveBeenCalled();
  });

  it('a quinta falha bloqueia e avisa', async () => {
    vi.mocked(store.findUserForLogin).mockResolvedValue(user({ tentativas: 4 }));
    const result = await attemptLogin(db, input('errada'));
    expect(result).toEqual({ ok: false, message: expect.stringContaining('bloqueado por 15 minutos') });
    expect(store.saveFailure).toHaveBeenCalledWith(db, 'u1', 0, new Date('2026-09-14T10:15:00Z'));
  });

  it('bloqueado recusa até a senha certa, sem somar falha', async () => {
    vi.mocked(store.findUserForLogin).mockResolvedValue(user({ bloqueadoAte: new Date('2026-09-14T10:07:30Z') }));
    const result = await attemptLogin(db, input('Canteiro-A3-tubete'));
    expect(result).toEqual({ ok: false, message: 'Muitas tentativas erradas. Tente de novo em 8 minutos.' });
    expect(store.saveFailure).not.toHaveBeenCalled();
    expect(store.recordLoginEvent).toHaveBeenCalledWith(db, expect.objectContaining({ sucesso: false }));
  });

  it('usuário desativado não entra nem com a senha certa', async () => {
    vi.mocked(store.findUserForLogin).mockResolvedValue(user({ ativo: false }));
    expect(await attemptLogin(db, input('Canteiro-A3-tubete'))).toEqual({ ok: false, message: INVALID_CREDENTIALS });
    expect(store.resetFailures).not.toHaveBeenCalled();
  });

  describe('limite por origem (SEC-003)', () => {
    it('a origem com 20 falhas recentes é recusada antes do scrypt e da busca do usuário', async () => {
      vi.mocked(store.countRecentFailuresByIp).mockResolvedValue(20);
      const result = await attemptLogin(db, input('Canteiro-A3-tubete'));
      expect(result).toEqual({ ok: false, message: 'Muitas tentativas deste aparelho. Tente de novo em 15 minutos.' });
      expect(store.countRecentFailuresByIp).toHaveBeenCalledWith(db, '10.0.0.1', new Date('2026-09-14T09:45:00Z'));
      expect(store.findUserForLogin).not.toHaveBeenCalled();
      expect(store.recordLoginEvent).toHaveBeenCalledWith(db, expect.objectContaining({ usuarioId: null, sucesso: false }));
    });

    it('abaixo do limite, segue o login normal', async () => {
      vi.mocked(store.countRecentFailuresByIp).mockResolvedValue(19);
      vi.mocked(store.findUserForLogin).mockResolvedValue(user());
      expect(await attemptLogin(db, input('Canteiro-A3-tubete'))).toEqual({ ok: true, usuarioId: 'u1', deveTrocarSenha: false });
    });

    it('sem IP conhecido, não há o que contar', async () => {
      vi.mocked(store.findUserForLogin).mockResolvedValue(user());
      await attemptLogin(db, { ...input('Canteiro-A3-tubete'), ip: null });
      expect(store.countRecentFailuresByIp).not.toHaveBeenCalled();
    });
  });

  describe('teto de verificações simultâneas (SEC-009)', () => {
    async function comServidorCheio(teste: () => Promise<void>) {
      let soltar!: () => void;
      const bloqueio = new Promise<boolean>((resolve) => {
        soltar = () => resolve(true);
      });
      const ocupadas = Array.from({ length: MAX_VERIFICACOES_SIMULTANEAS }, () => comVagaDeVerificacao(() => bloqueio));
      try {
        await teste();
      } finally {
        soltar();
        await Promise.all(ocupadas);
      }
    }

    it('sem vaga, recusa sem contar falha nem registrar evento', async () => {
      vi.mocked(store.findUserForLogin).mockResolvedValue(user());
      await comServidorCheio(async () => {
        expect(await attemptLogin(db, input('Canteiro-A3-tubete'))).toEqual({ ok: false, message: OCUPADO });
      });
      expect(store.saveFailure).not.toHaveBeenCalled();
      expect(store.recordLoginEvent).not.toHaveBeenCalled();
    });

    it('login inexistente também respeita o teto', async () => {
      vi.mocked(store.findUserForLogin).mockResolvedValue(null);
      await comServidorCheio(async () => {
        expect(await attemptLogin(db, input('qualquer', 'ninguem'))).toEqual({ ok: false, message: OCUPADO });
      });
    });
  });
});
