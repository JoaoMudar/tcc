/** Tentativas erradas seguidas que bloqueiam o login (E4 A-01). Decidido em 14/09/2026. */
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

/**
 * Falhas vindas da mesma origem, somadas entre todos os logins (SEC-003). Barra
 * quem testa uma senha contra vários usuários sem errar cinco vezes em nenhum, e
 * poupa o scrypt de cada tentativa.
 */
export const MAX_FAILURES_POR_IP = 20;
export const JANELA_IP_MINUTOS = 15;

export function isLocked(bloqueadoAte: Date | null, now: Date): boolean {
  return bloqueadoAte !== null && bloqueadoAte.getTime() > now.getTime();
}

export function minutesLeft(bloqueadoAte: Date, now: Date): number {
  return Math.max(1, Math.ceil((bloqueadoAte.getTime() - now.getTime()) / 60_000));
}

/**
 * Soma uma falha. Na quinta, bloqueia e zera a contagem: vencido o bloqueio,
 * a pessoa tem de novo cinco tentativas.
 */
export function registerFailure(
  tentativas: number,
  now: Date,
): { tentativas: number; bloqueadoAte: Date | null } {
  const total = tentativas + 1;
  if (total >= MAX_FAILURES) {
    return { tentativas: 0, bloqueadoAte: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
  }
  return { tentativas: total, bloqueadoAte: null };
}
