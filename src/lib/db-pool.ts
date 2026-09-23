import { Pool as PgPool } from 'pg';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { isLocalHost, isNeonHost } from './db-host';

/**
 * Valores de `sslmode` que desligam o TLS ou a checagem do certificado. O `pg`
 * deixa o que vem na URL vencer o `ssl` passado no código (SEC-010).
 */
const SSL_INSEGURO = new Set(['disable', 'allow', 'prefer', 'no-verify']);

/** A URL de banco remoto pede conexão sem TLS ou sem conferir o certificado. */
export function desligaTls(connectionString: string): boolean {
  if (isLocalHost(connectionString)) return false;
  let params: URLSearchParams;
  try {
    params = new URL(connectionString).searchParams;
  } catch {
    return false;
  }
  return SSL_INSEGURO.has(params.get('sslmode') ?? '') || ['0', 'false'].includes(params.get('ssl') ?? '');
}

/**
 * Cria o pool conforme o host. Sem 'server-only' de propósito: é reusado por
 * scripts/migrate.ts, que roda fora do Next. A aplicação importa `@/lib/db`.
 */
export function createPool(connectionString: string | undefined): PgPool {
  if (!connectionString) {
    throw new Error('DATABASE_URL não está definida.');
  }
  if (desligaTls(connectionString)) {
    throw new Error('DATABASE_URL de banco remoto não pode desligar o TLS. Use sslmode=verify-full.');
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
