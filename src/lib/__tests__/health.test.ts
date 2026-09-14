// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('../db', () => ({ default: { query } }));

const { isDatabaseReachable } = await import('../health');

describe('isDatabaseReachable', () => {
  beforeEach(() => {
    query.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('true quando SELECT 1 responde', async () => {
    query.mockResolvedValue({ rows: [{ ok: 1 }] });
    expect(await isDatabaseReachable()).toBe(true);
    expect(query).toHaveBeenCalledWith('SELECT 1 AS ok');
  });

  it('false, sem lançar, quando o banco está fora', async () => {
    query.mockRejectedValue(new Error('connect ECONNREFUSED'));
    expect(await isDatabaseReachable()).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});
