import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Carrega TEST_DATABASE_URL do .env.local antes de subir os workers. Não uso
// @next/env: com NODE_ENV=test ele ignora o .env.local de propósito. Variável
// já definida (a do CI) não é sobrescrita.
try {
  process.loadEnvFile('.env.local');
} catch {
  // Sem .env.local (CI): vale o ambiente
}

/** Suíte contra Postgres real: `npm run test:db`. */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.db.test.ts'],
    globalSetup: ['./src/test/db-global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
