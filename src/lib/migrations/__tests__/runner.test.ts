// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_FILE,
  MigrationError,
  type MigrationPool,
  getMigrationStatus,
  pendingMigrations,
  runMigrations,
  sortMigrationFiles,
} from '../runner';

describe('sortMigrationFiles', () => {
  it('ordena pelo prefixo e ignora o que não é .sql', () => {
    expect(
      sortMigrationFiles([
        '20260901000002_b.sql',
        'README.md',
        BOOTSTRAP_FILE,
        '20260901000001_a.sql',
      ]),
    ).toEqual([BOOTSTRAP_FILE, '20260901000001_a.sql', '20260901000002_b.sql']);
  });

  it('recusa nome fora do padrão', () => {
    expect(() => sortMigrationFiles(['2026_sem_data.sql'])).toThrow('fora do padrão');
    expect(() => sortMigrationFiles(['20260901000001_Maiuscula.sql'])).toThrow('fora do padrão');
  });
});

describe('pendingMigrations', () => {
  it('devolve só o que não foi aplicado, na ordem dos arquivos', () => {
    expect(pendingMigrations(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
  });
});

/** Pool falso que entende as poucas consultas do runner. */
function fakePool(options: { tableExists: boolean; applied: string[]; failOn?: string }) {
  const executed: string[] = [];
  const recorded = [...options.applied];
  const query = async (sql: string, params?: unknown[]) => {
    if (sql.includes('to_regclass')) return { rows: [{ exists: options.tableExists }] };
    if (sql.startsWith('SELECT filename')) return { rows: recorded.map((filename) => ({ filename })) };
    if (sql.startsWith('INSERT INTO _migrations')) {
      recorded.push(String(params?.[0]));
      return { rows: [] };
    }
    if (options.failOn && sql.includes(options.failOn)) throw new Error('syntax error');
    executed.push(sql);
    return { rows: [] };
  };
  const pool = {
    query,
    connect: async () => ({ query, release: () => {} }),
  } as unknown as MigrationPool;
  return { pool, executed, recorded };
}

describe('runner contra diretório real', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'migr-'));
    await writeFile(path.join(dir, BOOTSTRAP_FILE), 'CREATE TABLE IF NOT EXISTS _migrations ();');
    await writeFile(path.join(dir, '20260901000001_um.sql'), 'CREATE TABLE um ();');
    await writeFile(path.join(dir, '20260901000002_dois.sql'), 'CREATE TABLE dois ();');
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('status sem _migrations: tudo pendente, nada criado', async () => {
    const { pool, executed } = fakePool({ tableExists: false, applied: [] });
    const status = await getMigrationStatus(pool, dir);
    expect(status.pending).toHaveLength(3);
    expect(executed).toEqual([]);
  });

  it('aplica só as pendentes, em ordem, e registra cada uma', async () => {
    const { pool, executed, recorded } = fakePool({
      tableExists: true,
      applied: [BOOTSTRAP_FILE, '20260901000001_um.sql'],
    });
    const applied = await runMigrations(pool, dir, () => {});
    expect(applied).toEqual(['20260901000002_dois.sql']);
    expect(executed).toEqual(['BEGIN', 'CREATE TABLE dois ();', 'COMMIT']);
    expect(recorded).toContain('20260901000002_dois.sql');
  });

  it('segunda execução não aplica nada', async () => {
    const { pool } = fakePool({ tableExists: true, applied: [] });
    await runMigrations(pool, dir, () => {});
    expect(await runMigrations(pool, dir, () => {})).toEqual([]);
  });

  it('falha ruidosa: para na primeira, não registra e nomeia o arquivo', async () => {
    const { pool, recorded } = fakePool({ tableExists: true, applied: [], failOn: 'um' });
    const error = await runMigrations(pool, dir, () => {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MigrationError);
    expect((error as MigrationError).file).toBe('20260901000001_um.sql');
    expect(recorded).toEqual([BOOTSTRAP_FILE]);
  });

  it('aponta migration registrada que não tem arquivo', async () => {
    const { pool } = fakePool({ tableExists: true, applied: ['20250101000000_sumiu.sql'] });
    expect((await getMigrationStatus(pool, dir)).unknown).toEqual(['20250101000000_sumiu.sql']);
  });
});
