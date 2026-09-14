import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseDeclaredSchema } from '../declared-schema';
import { sortMigrationFiles } from '../runner';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');
const SCHEMAS = ['public', 'cadastro'];

let client: Client;

beforeAll(async () => {
  client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
});
afterAll(async () => {
  await client?.end();
});

async function realSchema(): Promise<Map<string, Set<string>>> {
  const { rows } = await client.query<{ tabela: string; coluna: string }>(
    `SELECT c.table_schema || '.' || c.table_name AS tabela, c.column_name AS coluna
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE t.table_type = 'BASE TABLE' AND c.table_schema = ANY($1)`,
    [SCHEMAS],
  );
  const schema = new Map<string, Set<string>>();
  for (const { tabela, coluna } of rows) {
    if (!schema.has(tabela)) schema.set(tabela, new Set());
    schema.get(tabela)!.add(coluna);
  }
  return schema;
}

async function declaredSchema() {
  const files = sortMigrationFiles(await readdir(MIGRATIONS_DIR));
  return parseDeclaredSchema(
    await Promise.all(files.map((f) => readFile(path.join(MIGRATIONS_DIR, f), 'utf8'))),
  );
}

/** Diferenças nos dois sentidos, em linhas legíveis na falha do teste. */
function diff(declared: Map<string, Set<string>>, real: Map<string, Set<string>>): string[] {
  const problems: string[] = [];
  for (const [table, columns] of declared) {
    const actual = real.get(table);
    if (!actual) {
      problems.push(`tabela declarada e ausente no banco: ${table}`);
      continue;
    }
    for (const c of columns) if (!actual.has(c)) problems.push(`coluna declarada e ausente: ${table}.${c}`);
    for (const c of actual) if (!columns.has(c)) problems.push(`coluna no banco sem migration: ${table}.${c}`);
  }
  for (const table of real.keys()) {
    if (!declared.has(table)) problems.push(`tabela no banco sem migration: ${table}`);
  }
  return problems;
}

describe('schema declarado nas migrations x banco real', () => {
  it('todas as migrations foram registradas', async () => {
    const files = sortMigrationFiles(await readdir(MIGRATIONS_DIR));
    const { rows } = await client.query<{ filename: string }>(
      'SELECT filename FROM _migrations ORDER BY filename',
    );
    expect(rows.map((r) => r.filename)).toEqual(files);
  });

  it('tabelas e colunas coincidem nos dois sentidos', async () => {
    const declared = await declaredSchema();
    expect(declared.size).toBeGreaterThan(0);
    expect(diff(declared, await realSchema())).toEqual([]);
  });
});
