import 'server-only';
import pool from './db';

/** Confere se o banco responde. Falha vira `false` e vai para o log do servidor. */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  } catch (error) {
    console.error(error);
    return false;
  }
}
