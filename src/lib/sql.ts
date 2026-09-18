import type { Pool } from 'pg';

/** O que as funções de consulta precisam do pool: só `query`, para aceitar pool, cliente de transação ou mock. */
export type Db = Pick<Pool, 'query'>;

export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Nome da constraint violada, quando o erro do Postgres tem o SQLSTATE pedido. */
export function violatedConstraint(error: unknown, code: string): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code: actual, constraint } = error as { code?: string; constraint?: string };
  return actual === code ? (constraint ?? '') : null;
}

/** 23503: o registro tem quem aponte para ele (lote, pedido, agenda). */
export function isForeignKeyViolation(error: unknown): boolean {
  return violatedConstraint(error, '23503') !== null;
}
