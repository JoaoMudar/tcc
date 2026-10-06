/**
 * npm run db:ffb                               ensaio: baixa, grava, mostra as contagens e DESFAZ
 * npm run db:ffb -- --gravar                   troca a referência de verdade
 * npm run db:ffb -- --arquivo ffb.zip          usa um zip já baixado (sem rede)
 *
 * Copia a Lista da Flora e Funga do Brasil (IPT do JBRJ, CC-BY 4.0) para as
 * tabelas `ref_ffb_*`. Rode a cada versão nova no IPT, ou duas vezes por ano.
 * O aplicativo nunca consulta o JBRJ: só esta cópia.
 *
 * Tudo numa transação só: se falhar no meio, a versão anterior continua valendo.
 */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadEnvConfig } from '@next/env';
import { createPool } from '../src/lib/db-pool';
import { montarDadosFfb } from '../src/lib/ffb/dwca';
import { importarReferenciaFfb } from '../src/lib/ffb/importar';
import { lerZip } from '../src/lib/ffb/zip';

loadEnvConfig(process.cwd());

const RECURSO = 'https://ipt.jbrj.gov.br/jbrj/resource?r=lista_especies_flora_brasil';
const ARQUIVO = 'https://ipt.jbrj.gov.br/jbrj/archive.do?r=lista_especies_flora_brasil';
// O IPT recusa (403) o pedido sem cara de navegador
const CABECALHOS = { 'User-Agent': 'Mozilla/5.0 (viveiro-mudar; importador da FFB)', Referer: RECURSO };

class Ensaio extends Error {}

async function baixar(): Promise<Buffer> {
  // A página do recurso diz qual é a versão atual; sem ela, vale o link sem versão
  const pagina = await fetch(RECURSO, { headers: CABECALHOS }).then((r) => (r.ok ? r.text() : ''));
  const link = pagina.match(/href="(https:\/\/ipt\.jbrj\.gov\.br\/jbrj\/archive\.do\?r=lista_especies_flora_brasil&(?:amp;)?v=[\d.]+)"/)?.[1];
  const url = (link ?? ARQUIVO).replace('&amp;', '&');
  console.log(`Baixando ${url}`);
  const resposta = await fetch(url, { headers: CABECALHOS });
  if (!resposta.ok) throw new Error(`O IPT respondeu ${resposta.status}.`);
  return Buffer.from(await resposta.arrayBuffer());
}

async function main() {
  const { values } = parseArgs({ options: { arquivo: { type: 'string' }, gravar: { type: 'boolean' } } });
  const zip = lerZip(values.arquivo ? await readFile(values.arquivo) : await baixar());
  const dados = montarDadosFfb((location) => {
    const entrada = zip.get(location);
    if (!entrada) throw new Error(`O arquivo não tem ${location}.`);
    return entrada().toString('utf8');
  });
  if (dados.extensoesIgnoradas.length > 0) console.log(`Presentes e não usados: ${dados.extensoesIgnoradas.join(', ')}`);

  const pool = createPool(process.env.DATABASE_URL);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await importarReferenciaFfb(client, dados);
    console.log(`Versão ${r.versao} (publicada em ${dados.publicadaEm ?? '?'})`);
    console.log(`táxons         ${r.taxons} (${r.aceitos} aceitos, ${r.sinonimos} sinônimos)`);
    console.log(`distribuição   ${r.distribuicao}`);
    console.log(`nomes populares ${r.nomesPopulares}`);
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
