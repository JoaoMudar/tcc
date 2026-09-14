import { createHash, randomBytes } from 'node:crypto';

/** Token de sessão: 32 bytes aleatórios. Vai só no cookie, nunca no banco. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** O banco guarda apenas o resumo do token (RNF-09). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
