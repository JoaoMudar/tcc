import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 'server-only' lança fora do bundler do Next; nos testes vira módulo vazio
      'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mjs}'],
    // Os testes contra Postgres real rodam só em `npm run test:db`
    exclude: ['**/node_modules/**', '**/*.db.test.ts'],
    // Com 3 ou mais workers o jsdom esgota a memória da máquina de dev e o
    // pre-commit cai sem nenhum teste ter falhado
    maxWorkers: 2,
  },
});
