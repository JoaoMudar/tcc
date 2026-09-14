/**
 * npm run db:migrate          aplica as migrations pendentes
 * npm run db:migrate:status   mostra aplicadas e pendentes, sem escrever
 *
 * O banco é o da DATABASE_URL (.env.local em dev, painel da Vercel em produção),
 * e o driver sai do host, com o mesmo critério de src/lib/db.ts.
 */
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { isNeonHost } from '../src/lib/db-host';
import { createPool } from '../src/lib/db-pool';
import { getMigrationStatus, runMigrations } from '../src/lib/migrations/runner';

loadEnvConfig(process.cwd());

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

function describeTarget(url: string): string {
  const { hostname, pathname } = new URL(url);
  return `${isNeonHost(url) ? 'Neon' : 'Postgres local'} (${hostname}${pathname})`;
}

async function main() {
  const command = process.argv[2] ?? 'up';

  // Publicação de preview na Vercel não tem banco próprio: não migra o de produção
  if (command === 'up' && process.env.VERCEL === '1' && process.env.VERCEL_ENV !== 'production') {
    console.log(`Migrations puladas: publicação ${process.env.VERCEL_ENV ?? 'desconhecida'}.`);
    return;
  }

  const url = process.env.DATABASE_URL;
  const pool = createPool(url);
  console.log(`Banco: ${describeTarget(url!)}`);

  try {
    if (command === 'status') {
      const status = await getMigrationStatus(pool, MIGRATIONS_DIR);
      for (const file of status.files) {
        console.log(`${status.pending.includes(file) ? 'PENDENTE ' : 'aplicada '} ${file}`);
      }
      for (const file of status.unknown) console.log(`SEM ARQUIVO ${file}`);
      console.log(`${status.pending.length} pendente(s).`);
      if (status.unknown.length > 0) process.exitCode = 1;
    } else if (command === 'up') {
      const applied = await runMigrations(pool, MIGRATIONS_DIR);
      console.log(applied.length ? `${applied.length} migration(s) aplicada(s).` : 'Nada pendente.');
    } else {
      throw new Error(`Comando desconhecido: ${command}. Use "status" ou nenhum.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
