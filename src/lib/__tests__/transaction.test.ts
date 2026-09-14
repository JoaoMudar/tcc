import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { withTransaction } from '../transaction';

function fakePool(failOn?: string) {
  const calls: string[] = [];
  const client = {
    query: vi.fn(async (sql: string) => {
      calls.push(sql);
      if (sql === failOn) throw new Error(`falhou em ${sql}`);
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client as unknown as PoolClient) };
  return { pool, client, calls };
}

describe('withTransaction', () => {
  it('faz BEGIN, executa e faz COMMIT', async () => {
    const { pool, client, calls } = fakePool();
    const result = await withTransaction(pool, async (c) => {
      await c.query('INSERT 1');
      return 42;
    });
    expect(result).toBe(42);
    expect(calls).toEqual(['BEGIN', 'INSERT 1', 'COMMIT']);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('faz ROLLBACK e relança o erro original', async () => {
    const { pool, client, calls } = fakePool('INSERT 1');
    await expect(
      withTransaction(pool, async (c) => {
        await c.query('INSERT 1');
      }),
    ).rejects.toThrow('falhou em INSERT 1');
    expect(calls).toEqual(['BEGIN', 'INSERT 1', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('preserva o erro original mesmo se o ROLLBACK falhar', async () => {
    const { pool, client } = fakePool('ROLLBACK');
    await expect(
      withTransaction(pool, async () => {
        throw new Error('regra violada');
      }),
    ).rejects.toThrow('regra violada');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
