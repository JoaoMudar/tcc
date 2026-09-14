import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';
import { withTransaction } from '../transaction';

export type MigrationPool = Pick<Pool, 'connect' | 'query'>;

export const BOOTSTRAP_FILE = '00000000000000_create_migrations_table.sql';
const MIGRATION_NAME = /^\d{14}_[a-z0-9_]+\.sql$/;

export class MigrationError extends Error {
  constructor(
    readonly file: string,
    cause: unknown,
  ) {
    super(`A migration ${file} falhou: ${cause instanceof Error ? cause.message : String(cause)}`, {
      cause,
    });
    this.name = 'MigrationError';
  }
}

/** Ordena pelo prefixo de data e recusa nome fora do padrão, em vez de ignorá-lo. */
export function sortMigrationFiles(names: string[]): string[] {
  const sql = names.filter((n) => n.endsWith('.sql'));
  const invalid = sql.filter((n) => !MIGRATION_NAME.test(n));
  if (invalid.length > 0) {
    throw new Error(
      `Nome de migration fora do padrão AAAAMMDDhhmmss_nome.sql: ${invalid.join(', ')}`,
    );
  }
  return [...sql].sort();
}

export function pendingMigrations(files: string[], applied: Iterable<string>): string[] {
  const done = new Set(applied);
  return files.filter((f) => !done.has(f));
}

export interface MigrationStatus {
  files: string[];
  applied: string[];
  pending: string[];
  /** Registradas em _migrations sem arquivo correspondente: ambiente divergente. */
  unknown: string[];
}

/** Só lê: não cria _migrations se ela ainda não existe. */
export async function getMigrationStatus(pool: MigrationPool, dir: string): Promise<MigrationStatus> {
  const files = sortMigrationFiles(await readdir(dir));
  const exists = await pool.query<{ exists: boolean }>(
    "SELECT to_regclass('public._migrations') IS NOT NULL AS exists",
  );
  const applied = exists.rows[0]?.exists
    ? (
        await pool.query<{ filename: string }>('SELECT filename FROM _migrations ORDER BY filename')
      ).rows.map((r) => r.filename)
    : [];
  const known = new Set(files);
  return {
    files,
    applied,
    pending: pendingMigrations(files, applied),
    unknown: applied.filter((a) => !known.has(a)),
  };
}

/**
 * Aplica as pendentes em ordem, cada arquivo numa transação junto com o seu
 * registro em _migrations. A primeira falha interrompe tudo (D3 §4).
 */
export async function runMigrations(
  pool: MigrationPool,
  dir: string,
  log: (message: string) => void = console.log,
): Promise<string[]> {
  const { pending } = await getMigrationStatus(pool, dir);
  for (const file of pending) {
    const sql = await readFile(path.join(dir, file), 'utf8');
    try {
      await withTransaction(pool, async (client) => {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      });
    } catch (error) {
      throw new MigrationError(file, error);
    }
    log(`aplicada: ${file}`);
  }
  return pending;
}
