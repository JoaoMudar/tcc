import 'server-only';
import type { Pool } from 'pg';
import { createPool } from './db-pool';

// Singleton guardado em globalThis para sobreviver ao hot reload do `next dev`
const globalForDb = globalThis as unknown as { viveiroPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.viveiroPool) {
    globalForDb.viveiroPool = createPool(process.env.DATABASE_URL);
  }
  return globalForDb.viveiroPool;
}

/**
 * Pool do banco, criado na primeira consulta (e não no import, para o build
 * não exigir DATABASE_URL). Só em Server Components e Server Actions.
 */
const pool = {
  query: ((...args: Parameters<Pool['query']>) =>
    (getPool().query as (...a: unknown[]) => unknown)(...args)) as Pool['query'],
  connect: (() => getPool().connect()) as () => ReturnType<Pool['connect']>,
};

export type DbPool = typeof pool;
export default pool;
