/**
 * npm run db:carga -- --pasta carga-inicial            ensaio: grava, mostra o relatório e DESFAZ
 * npm run db:carga -- --pasta carga-inicial --gravar   grava de verdade
 *
 * Lê recipientes.csv, canteiros.csv, especies.csv e funcionarios.csv da pasta
 * (os que existirem). Modelos em scripts/carga-inicial-modelo/. A pasta
 * `carga-inicial/` da raiz está no .gitignore: ela leva nome e telefone de
 * gente, e o repositório é público.
 *
 * Tudo numa transação só: com qualquer linha errada, nada é gravado.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadEnvConfig } from '@next/env';
import { ARQUIVOS, type Arquivo, type Linha, importarCarga, lerCsv } from '../src/lib/carga-inicial';
import { createPool } from '../src/lib/db-pool';

loadEnvConfig(process.cwd());

class Ensaio extends Error {}

async function main() {
  const { values } = parseArgs({ options: { pasta: { type: 'string' }, gravar: { type: 'boolean' } } });
  const pasta = values.pasta ?? 'carga-inicial';
  if (!existsSync(pasta)) throw new Error(`Pasta ${pasta} não encontrada.`);

  const carga: Partial<Record<Arquivo, Linha[]>> = {};
  for (const arquivo of ARQUIVOS) {
    const caminho = path.join(pasta, `${arquivo}.csv`);
    if (!existsSync(caminho)) continue;
    const lido = lerCsv(await readFile(caminho, 'utf8'), arquivo);
    if ('error' in lido) throw new Error(lido.error);
    carga[arquivo] = lido.value;
  }
  if (Object.keys(carga).length === 0) throw new Error(`Nenhuma planilha em ${pasta}: esperava ${ARQUIVOS.map((a) => `${a}.csv`).join(', ')}.`);

  const pool = createPool(process.env.DATABASE_URL);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const relatorio = await importarCarga(client, carga);

    for (const arquivo of ARQUIVOS) {
      if (!carga[arquivo]) continue;
      console.log(`${arquivo.padEnd(13)} ${relatorio.criados[arquivo]} novo(s), ${relatorio.pulados[arquivo]} já existia(m)`);
    }
    if (relatorio.erros.length > 0) {
      console.log(`\n${relatorio.erros.length} erro(s). Nada foi gravado:`);
      for (const e of relatorio.erros) console.log(`  ${e}`);
      process.exitCode = 1;
      throw new Ensaio();
    }
    if (!values.gravar) {
      console.log('\nEnsaio: nada foi gravado. Rode de novo com --gravar para valer.');
      throw new Ensaio();
    }
    await client.query('COMMIT');
    console.log('\nGravado.');
  } catch (error) {
    await client.query('ROLLBACK');
    if (!(error instanceof Ensaio)) throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
