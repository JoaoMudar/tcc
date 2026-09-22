import { Pool as PgPool } from 'pg';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { isLocalHost, isNeonHost } from './db-host';

/**
 * Cria o pool conforme o host. Sem 'server-only' de propósito: é reusado por
 * scripts/migrate.ts, que roda fora do Next. A aplicação importa `@/lib/db`.
 */
export function createPool(connectionString: string | undefined): PgPool {
  if (!connectionString) {
    throw new Error('DATABASE_URL não está definida.');
  }
  if (isNeonHost(connectionString)) {
    neonConfig.webSocketConstructor = ws;
    // O Pool do Neon implementa a mesma interface do pg.Pool
    return new NeonPool({ connectionString }) as unknown as PgPool;
  }
  // Banco fora da máquina exige TLS: a senha e o CPF do cadastro não andam em texto claro (SEC-002)
  return new PgPool(
    isLocalHost(connectionString) ? { connectionString } : { connectionString, ssl: { rejectUnauthorized: true } },
  );
}
