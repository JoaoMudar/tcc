import { beforeEach, describe, expect, it, vi } from 'vitest';

const pgPool = vi.fn();
const neonPool = vi.fn();
const neonConfig: { webSocketConstructor?: unknown } = {};

vi.mock('pg', () => ({
  Pool: class {
    constructor(opts: unknown) {
      pgPool(opts);
    }
  },
}));
vi.mock('@neondatabase/serverless', () => ({
  Pool: class {
    constructor(opts: unknown) {
      neonPool(opts);
    }
  },
  neonConfig,
}));
vi.mock('ws', () => ({ default: class FakeWebSocket {} }));

const { createPool } = await import('../db-pool');

describe('createPool', () => {
  beforeEach(() => {
    pgPool.mockClear();
    neonPool.mockClear();
    delete neonConfig.webSocketConstructor;
  });

  it('usa pg para banco local', () => {
    const url = 'postgresql://postgres:x@localhost:5432/tcc';
    createPool(url);
    expect(pgPool).toHaveBeenCalledWith({ connectionString: url });
    expect(neonPool).not.toHaveBeenCalled();
  });

  it('exige TLS verificado para Postgres fora da máquina', () => {
    const url = 'postgresql://viveiro:x@10.0.0.5:5432/viveiro';
    createPool(url);
    expect(pgPool).toHaveBeenCalledWith({ connectionString: url, ssl: { rejectUnauthorized: true } });
  });

  it('usa o driver serverless para o Neon', () => {
    const url = 'postgresql://u:p@ep-x-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require';
    createPool(url);
    expect(neonPool).toHaveBeenCalledWith({ connectionString: url });
    expect(pgPool).not.toHaveBeenCalled();
    expect(neonConfig.webSocketConstructor).toBeDefined();
  });

  it.each([
    'postgresql://u:p@db.exemplo.com/v?sslmode=disable',
    'postgresql://u:p@db.exemplo.com/v?sslmode=no-verify',
    'postgresql://u:p@db.exemplo.com/v?sslmode=prefer',
    'postgresql://u:p@db.exemplo.com/v?ssl=false',
    'postgresql://u:p@ep-x-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=disable',
  ])('recusa URL remota que desliga o TLS: %s (SEC-010)', (url) => {
    expect(() => createPool(url)).toThrow('não pode desligar o TLS');
    expect(pgPool).not.toHaveBeenCalled();
    expect(neonPool).not.toHaveBeenCalled();
  });

  it('aceita sslmode=disable no banco local', () => {
    const url = 'postgresql://postgres:x@localhost:5432/tcc?sslmode=disable';
    createPool(url);
    expect(pgPool).toHaveBeenCalledWith({ connectionString: url });
  });

  it('aceita sslmode=verify-full no banco remoto', () => {
    const url = 'postgresql://u:p@db.exemplo.com/v?sslmode=verify-full';
    createPool(url);
    expect(pgPool).toHaveBeenCalledWith({ connectionString: url, ssl: { rejectUnauthorized: true } });
  });

  it('falha ruidosamente sem DATABASE_URL', () => {
    expect(() => createPool(undefined)).toThrow('DATABASE_URL');
    expect(() => createPool('')).toThrow('DATABASE_URL');
  });
});
