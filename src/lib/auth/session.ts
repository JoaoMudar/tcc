import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import pool from '@/lib/db';
import { clientIp } from './client-ip';
import { SESSION_COOKIE, SESSION_RENEW_AFTER_MS, sessionCookieOptions, sessionExpiry } from './session-config';
import {
  type SessionUser,
  deleteSessionByTokenHash,
  findSessionByTokenHash,
  insertSession,
  touchSession,
} from './session-store';
import { generateSessionToken, hashToken } from './tokens';

/** Origem e aparelho da requisição, para a sessão e o registro de acesso (RF-04). */
export async function requestOrigin(): Promise<{ ip: string | null; agenteUsuario: string | null }> {
  const h = await headers();
  return {
    ip: clientIp(h.get('x-forwarded-for'), h.get('x-real-ip')),
    agenteUsuario: h.get('user-agent')?.slice(0, 300) ?? null,
  };
}

/** Cria a sessão e grava o cookie. Só em Server Action. */
export async function startSession(usuarioId: string): Promise<void> {
  const token = generateSessionToken();
  const origin = await requestOrigin();
  await insertSession(pool, {
    usuarioId,
    tokenHash: hashToken(token),
    expiraEm: sessionExpiry(new Date()),
    ...origin,
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

/** Hash do cookie da requisição atual, para marcar "este aparelho". */
export async function currentTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/**
 * A sessão da requisição, lida do banco uma vez por renderização. Renova a
 * validade no uso, sem regravar a cada clique.
 */
export const getCurrentSession = cache(async (): Promise<SessionUser | null> => {
  const tokenHash = await currentTokenHash();
  if (!tokenHash) return null;
  const now = new Date();
  const session = await findSessionByTokenHash(pool, tokenHash, now);
  if (session && now.getTime() - session.ultimoUsoEm.getTime() > SESSION_RENEW_AFTER_MS) {
    await touchSession(pool, session.sessaoId, sessionExpiry(now), now);
  }
  return session;
});

/** RF-03: apaga a sessão no banco e o cookie. Só em Server Action. */
export async function endCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSessionByTokenHash(pool, hashToken(token));
  store.delete(SESSION_COOKIE);
}
