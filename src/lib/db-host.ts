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

/** Banco na própria máquina: é o único caso em que a conexão sem TLS não expõe nada na rede. */
export function isLocalHost(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}
