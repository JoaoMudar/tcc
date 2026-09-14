// @vitest-environment node
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { listLoginEvents } from '../access-log';

function fakeDb() {
  const query = vi.fn(async () => ({ rows: [] }));
  return { db: { query } as unknown as Pick<Pool, 'query'>, query };
}

describe('listLoginEvents', () => {
  it('sem filtro: só o limite, parametrizado', async () => {
    const { db, query } = fakeDb();
    await listLoginEvents(db);
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).not.toContain('WHERE');
    expect(sql).toContain('LIMIT $1');
    expect(params).toEqual([100]);
  });

  it('combina os filtros em parâmetros, nunca no texto do SQL', async () => {
    const { db, query } = fakeDb();
    await listLoginEvents(db, { login: "x' OR 1=1", sucesso: false, limit: 10 });
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('e.login_tentado = $1 AND e.sucesso = $2');
    expect(sql).toContain('LIMIT $3');
    expect(sql).not.toContain('OR 1=1');
    expect(params).toEqual(["x' OR 1=1", false, 10]);
  });

  it('limita a consulta a 500 linhas', async () => {
    const { db, query } = fakeDb();
    await listLoginEvents(db, { limit: 100000 });
    expect((query.mock.calls[0] as unknown as [string, unknown[]])[1]).toEqual([500]);
  });
});
