/**
 * O ambiente é decidido pelo host da URL do banco, não pelo NODE_ENV (D3 §3).
 * Host *.neon.tech usa o driver serverless; qualquer outro usa `pg`.
 */
export function isNeonHost(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname.endsWith('.neon.tech');
  } catch {
    return false;
  }
}
