/**
 * npm run db:conciliar                                  lê carga-inicial/arvores.csv
 * npm run db:conciliar -- --entrada outra.csv           outra planilha (arvores.csv ou a semente)
 *
 * Cruza a planilha antiga de espécies com a cópia local da FFB (rode antes
 * `npm run db:ffb -- --gravar`) e escreve carga-inicial/relatorio_conciliacao.csv
 * com a coluna `decisao` em branco. Só lê o banco: não grava nada.
 *
 * Se carga-inicial/conciliacao_inicial_ffb.csv existir, cada linha diz se
 * confere com ela (a conciliação feita antes pelo espelho do GBIF).
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadEnvConfig } from '@next/env';
import { lerPlanilha } from '../src/lib/carga-inicial';
import { conciliarNome, lerOrigemDeclarada } from '../src/lib/especies-conciliacao';
import {
  COLUNAS_LEGADO,
  COLUNAS_RELATORIO,
  INSTRUCOES_DECISAO,
  type LinhaRelatorio,
  type Semente,
  alertasDaPlanilha,
  escreverCsv,
  lerEntradasLegadas,
  montarLinhaRelatorio,
} from '../src/lib/especies-legado';
import { createPool } from '../src/lib/db-pool';

loadEnvConfig(process.cwd());

async function lerCsv(caminho: string, obrigatorias: readonly string[]) {
  const lido = lerPlanilha(await readFile(caminho, 'utf8'), path.basename(caminho, '.csv'), obrigatorias);
  if ('error' in lido) throw new Error(lido.error);
  return lido.value;
}

async function main() {
  const { values } = parseArgs({
    options: {
      entrada: { type: 'string' },
      semente: { type: 'string' },
      saida: { type: 'string' },
    },
  });
  const entrada = values.entrada ?? 'carga-inicial/arvores.csv';
  const caminhoSemente = values.semente ?? 'carga-inicial/conciliacao_inicial_ffb.csv';
  const saida = values.saida ?? 'carga-inicial/relatorio_conciliacao.csv';
  if (!existsSync(entrada)) throw new Error(`Planilha ${entrada} não encontrada.`);

  const linhas = await lerCsv(entrada, COLUNAS_LEGADO);
  const entradas = lerEntradasLegadas(linhas);
  if ('error' in entradas) throw new Error(entradas.error);
  const slugs = new Map(linhas.map((l) => [Number(l.id ?? l.id_legado), l.slug]));

  const sementes = new Map<number, Semente>();
  if (existsSync(caminhoSemente)) {
    for (const l of await lerCsv(caminhoSemente, ['id_legado', 'situacao', 'taxon_id_ffb'])) {
      sementes.set(Number(l.id_legado), { situacao: l.situacao, taxonId: l.taxon_id_ffb });
    }
  }

  const pool = createPool(process.env.DATABASE_URL);
  try {
    const versao = await pool.query<{ versao_ipt: string }>('SELECT versao_ipt FROM ref_ffb_importacao ORDER BY importada_em DESC LIMIT 1');
    if (!versao.rows[0]) throw new Error('A cópia da FFB está vazia. Rode antes: npm run db:ffb -- --gravar');

    const relatorio: LinhaRelatorio[] = [];
    for (const e of entradas.value) {
      const resultado = await conciliarNome(pool, e.nomeCsv, lerOrigemDeclarada(e.origemCsv));
      relatorio.push(montarLinhaRelatorio(e, resultado, sementes.get(e.idLegado), alertasDaPlanilha(e, slugs.get(e.idLegado))));
    }

    await writeFile(
      saida,
      escreverCsv(COLUNAS_RELATORIO, relatorio, [`FFB versão ${versao.rows[0].versao_ipt}.`, ...INSTRUCOES_DECISAO]),
      'utf8',
    );

    const contagem = new Map<string, number>();
    for (const l of relatorio) contagem.set(l.situacao, (contagem.get(l.situacao) ?? 0) + 1);
    console.log(`FFB ${versao.rows[0].versao_ipt}, ${relatorio.length} espécies:`);
    for (const situacao of ['OK', 'SINONIMO', 'GRAFIA', 'REVISAO_MANUAL', 'NAO_ENCONTRADO']) {
      console.log(`  ${situacao.padEnd(15)} ${contagem.get(situacao) ?? 0}`);
    }
    const divergentes = relatorio.filter((l) => l.confere_semente === 'NAO');
    if (sementes.size > 0) {
      console.log(`\n${divergentes.length} linha(s) diferente(s) da conciliação semente:`);
      for (const l of divergentes) {
        console.log(`  ${l.id_legado} ${l.nome_csv}: ${l.semente_situacao} ${l.semente_taxon} -> ${l.situacao} ${l.taxon_id_ffb}`);
      }
    }
    console.log(`\nRelatório em ${saida}. Preencha a coluna "decisao".`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
