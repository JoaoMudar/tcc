/**
 * Sessão longa, renovada no uso (D4 §5): quem registra em campo não digita
 * senha no meio do trabalho. Decidido em 14/09/2026. Sem 'server-only':
 * o proxy também lê estas constantes.
 */
export const SESSION_COOKIE = 'viveiro_sessao';
export const SESSION_DAYS = 30;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;
/** O banco só é regravado se o último uso tem mais de uma hora. */
export const SESSION_RENEW_AFTER_MS = 60 * 60 * 1000;

/** RNF-10: só HTTPS, invisível para o JavaScript da página, sem envio entre sites. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
}
