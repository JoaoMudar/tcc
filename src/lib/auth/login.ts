import type { Pool } from 'pg';
import { LOCK_MINUTES, isLocked, minutesLeft, registerFailure } from './lockout';
import { dummyVerify, verifyPassword } from './password';
import { deleteExpiredSessions } from './session-store';
import { findUserForLogin, recordLoginEvent, resetFailures, saveFailure } from './user-store';

type Db = Pick<Pool, 'query'>;

export const INVALID_CREDENTIALS = 'Usuário ou senha incorretos.';

export type LoginResult =
  | { ok: true; usuarioId: string; deveTrocarSenha: boolean }
  | { ok: false; message: string };

export function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Regra do login (RF-01, RF-04, E4 A-01), sem cookie nem tela: recebe o banco
 * para ser testada contra Postgres real. Toda tentativa vira linha em eventos_login.
 */
export async function attemptLogin(
  db: Db,
  input: { login: string; senha: string; ip: string | null; agenteUsuario: string | null; now: Date },
): Promise<LoginResult> {
  const login = normalizeLogin(input.login);
  const record = (usuarioId: string | null, sucesso: boolean) =>
    recordLoginEvent(db, {
      usuarioId,
      loginTentado: login.slice(0, 100),
      sucesso,
      ip: input.ip,
      agenteUsuario: input.agenteUsuario,
    });

  const user = await findUserForLogin(db, login);
  if (!user) {
    await dummyVerify(input.senha);
    await record(null, false);
    return { ok: false, message: INVALID_CREDENTIALS };
  }

  if (isLocked(user.bloqueadoAte, input.now)) {
    await record(user.id, false);
    const minutes = minutesLeft(user.bloqueadoAte!, input.now);
    return { ok: false, message: `Muitas tentativas erradas. Tente de novo em ${minutes} minuto${minutes > 1 ? 's' : ''}.` };
  }

  const valid = await verifyPassword(input.senha, user.senhaHash);

  if (!user.ativo) {
    // Usuário desativado não entra, e a mensagem não diz se a senha estava certa
    await record(user.id, false);
    return { ok: false, message: INVALID_CREDENTIALS };
  }

  if (!valid) {
    const failure = registerFailure(user.tentativas, input.now);
    await saveFailure(db, user.id, failure.tentativas, failure.bloqueadoAte);
    await record(user.id, false);
    if (failure.bloqueadoAte) {
      return { ok: false, message: `Muitas tentativas erradas. O acesso ficou bloqueado por ${LOCK_MINUTES} minutos.` };
    }
    return { ok: false, message: INVALID_CREDENTIALS };
  }

  await resetFailures(db, user.id);
  await deleteExpiredSessions(db, user.id, input.now);
  await record(user.id, true);
  return { ok: true, usuarioId: user.id, deveTrocarSenha: user.deveTrocarSenha };
}
