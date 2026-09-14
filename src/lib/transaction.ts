import type { PoolClient } from 'pg';

type Connectable = { connect(): Promise<PoolClient> };

/**
 * Executa `fn` numa transação: COMMIT se terminar, ROLLBACK se lançar.
 * A conexão volta ao pool sempre, e o erro original é relançado.
 */
export async function withTransaction<T>(
  pool: Connectable,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Conexão já quebrada: o erro que importa é o original
    }
    throw error;
  } finally {
    client.release();
  }
}
