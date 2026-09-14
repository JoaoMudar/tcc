import path from 'node:path';
import { Client } from 'pg';
import { createPool } from '../lib/db-pool';
import { runMigrations } from '../lib/migrations/runner';
import { assertSafeTestDatabase } from '../lib/migrations/test-db-guard';

/** Recria o banco de teste do zero e aplica todas as migrations. */
export default async function setup() {
  const { url, database } = assertSafeTestDatabase(process.env.TEST_DATABASE_URL);

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    // O nome já foi validado por assertSafeTestDatabase: só [a-z0-9_]
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${database}`);
  } finally {
    await admin.end();
  }

  const pool = createPool(url.toString());
  try {
    await runMigrations(pool, path.join(process.cwd(), 'migrations'), () => {});
  } finally {
    await pool.end();
  }
}
