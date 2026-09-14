const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * A suíte test:db apaga e recria o banco. Só aceita banco local cujo nome
 * termina em _test, para nunca derrubar o de desenvolvimento nem o Neon.
 */
export function assertSafeTestDatabase(connectionString: string | undefined): {
  url: URL;
  database: string;
} {
  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL não está definida (ver .env.example).');
  }
  const url = new URL(connectionString);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`test:db só roda contra banco local, e o host é ${url.hostname}.`);
  }
  if (!/^[a-z0-9_]+_test$/.test(database)) {
    throw new Error(`test:db recria o banco: o nome precisa terminar em _test, e é "${database}".`);
  }
  return { url, database };
}
