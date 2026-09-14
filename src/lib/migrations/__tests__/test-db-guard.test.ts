// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { assertSafeTestDatabase } from '../test-db-guard';

describe('assertSafeTestDatabase', () => {
  it('aceita banco local terminado em _test', () => {
    expect(assertSafeTestDatabase('postgresql://postgres:a%25b@localhost:5432/tcc_test').database).toBe(
      'tcc_test',
    );
    expect(assertSafeTestDatabase('postgresql://p:x@127.0.0.1/viveiro_test').database).toBe(
      'viveiro_test',
    );
  });

  it('recusa o banco de desenvolvimento', () => {
    expect(() => assertSafeTestDatabase('postgresql://p:x@localhost:5432/tcc')).toThrow('_test');
  });

  it('recusa o Neon mesmo com nome de teste', () => {
    expect(() =>
      assertSafeTestDatabase('postgresql://u:p@ep-x.sa-east-1.aws.neon.tech/neondb_test'),
    ).toThrow('banco local');
  });

  it('recusa sem variável', () => {
    expect(() => assertSafeTestDatabase(undefined)).toThrow('TEST_DATABASE_URL');
  });
});
