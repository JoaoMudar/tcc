/**
 * npm run db:retencao   apaga o registro de acesso com mais de 12 meses e a sessão expirada (E5)
 * npm run db:conferir   contagens e conferência do saldo dos lotes contra os movimentos (E6 §4)
 *
 * O banco é o da DATABASE_URL. No GitHub Actions os dois rodam todo dia depois
 * da cópia (.github/workflows/backup.yml); o conferir sai com erro se algum
 * lote diverge, e a falha do workflow chega por e-mail.
 */
import { loadEnvConfig } from '@next/env';
import { createPool } from '../src/lib/db-pool';
import { aplicarRetencao, conferirIntegridade, relatorioIntegridade } from '../src/lib/manutencao';

loadEnvConfig(process.cwd());

async function main() {
  const comando = process.argv[2];
  const pool = createPool(process.env.DATABASE_URL);
  try {
    if (comando === 'retencao') {
      const r = await aplicarRetencao(pool);
      console.log(`Retenção aplicada: ${r.eventosLogin} registro(s) de acesso e ${r.sessoesVencidas} sessão(ões) expirada(s) apagados.`);
    } else if (comando === 'conferir') {
      const integridade = await conferirIntegridade(pool);
      // O log do Actions é público neste repositório: lá sai só se bate ou não, sem as contagens
      if (process.argv.includes('--so-saldo')) {
        console.log(
          integridade.divergentes.length === 0
            ? 'Saldo dos lotes: todos batem com a soma dos movimentos.'
            : `ATENÇÃO: ${integridade.divergentes.length} lote(s) com saldo diferente da soma dos movimentos. Rode npm run db:conferir para ver quais.`,
        );
      } else {
        console.log(relatorioIntegridade(integridade));
      }
      if (integridade.divergentes.length > 0) process.exitCode = 1;
    } else {
      throw new Error('Uso: manutencao.ts retencao|conferir');
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
