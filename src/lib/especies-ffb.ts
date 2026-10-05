import type { PoolClient } from 'pg';
import { buscarTaxonAceito } from './especies-conciliacao';
import { versaoFfbAtual } from './ffb/importar';
import type { Db } from './sql';

/**
 * RF-68: a busca do cadastro de espécie olha primeiro o que o viveiro já tem
 * (para não duplicar) e depois a cópia local da Flora e Funga do Brasil (para
 * preencher o nome certo). Nenhuma chamada sai para a rede.
 */

export const MIN_BUSCA = 3;
export const MAX_RESULTADOS = 10;

export interface ResultadoViveiro {
  id: string;
  nome: string;
  nomeCientifico: string;
  /** O nome por onde a espécie foi achada, quando não é o principal (um sinônimo, outro popular) */
  achadaPor: string | null;
}

export interface ResultadoFlora {
  taxonId: string;
  nomeCientifico: string;
  familia: string | null;
  nomePopular: string | null;
  nativaSc: boolean;
  /** Quando o nome achado é antigo: o nome de hoje */
  aceito: { taxonId: string; nomeCientifico: string } | null;
}

export interface ResultadoBusca {
  doViveiro: ResultadoViveiro[];
  daFlora: ResultadoFlora[];
}

/**
 * Espelho de `normaliza_nome()`, e com o hífen virando espaço: "ipe roxo" acha
 * "ipê-roxo". No nome científico da FFB o hífen fica, porque o índice é por ele.
 */
const termoDeBusca = (texto: string) =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

/** Nome popular e nome do viveiro, comparados sem hífen: tabelas pequenas, dispensam índice. */
const semHifen = (expr: string) => `replace(normaliza_nome(${expr}), '-', ' ')`;

/**
 * 1 para o nome com uma palavra começando pelo termo, 0,9 para o que só o
 * contém ("caripé-roxo" contém "ipe roxo") e a semelhança para o resto.
 * Parâmetros: $1 termo, $2 "%termo%", $4 "% termo%".
 */
const pontua = (expr: string) =>
  `CASE WHEN (' ' || ${expr}) LIKE $4 THEN 1 WHEN ${expr} LIKE $2 THEN 0.9 ELSE similarity(${expr}, $1) END`;

export async function buscarNomes(db: Db, texto: string): Promise<ResultadoBusca> {
  const termo = termoDeBusca(texto);
  if (termo.length < MIN_BUSCA) return { doViveiro: [], daFlora: [] };
  const escapado = termo.replace(/[\\%_]/g, (c) => `\\${c}`);
  const contem = `%${escapado}%`;
  const comecaPalavra = `% ${escapado}%`;

  // Todos os nomes por onde a espécie do viveiro é chamada: o científico, os
  // populares, os sinônimos guardados e os sinônimos da FFB do táxon dela
  const viveiro = await db.query<ResultadoViveiro & { score: number }>(
    `WITH nomes AS (
       SELECT e.id, e.nome_cientifico AS nome FROM especies e WHERE e.substituida_por_id IS NULL
       UNION ALL
       SELECT n.especie_id, n.nome FROM especies_nomes_populares n
       UNION ALL
       SELECT s.especie_id, s.nome FROM especies_sinonimos s
       UNION ALL
       SELECT e.id, t.nome_canonico FROM especies e JOIN ref_ffb_taxon t ON t.aceito_taxon_id = e.taxon_id_ffb
        WHERE e.substituida_por_id IS NULL
     ), achados AS (
       SELECT DISTINCT ON (id) id, nome,
              ${pontua(semHifen('nome'))} AS score
         FROM nomes
        WHERE ${semHifen('nome')} LIKE $2 OR ${semHifen('nome')} % $1
        ORDER BY id, score DESC
     )
     SELECT e.id, a.score,
            COALESCE((SELECT p.nome FROM especies_nomes_populares p WHERE p.especie_id = e.id
                       ORDER BY p.e_principal DESC, p.criado_em LIMIT 1), e.nome_cientifico) AS nome,
            e.nome_cientifico AS "nomeCientifico",
            a.nome AS "achadaPor"
       FROM achados a JOIN especies e ON e.id = a.id
      WHERE e.substituida_por_id IS NULL
      ORDER BY a.score DESC, e.ativa DESC
      LIMIT $3`,
    [termo, contem, MAX_RESULTADOS / 2, comecaPalavra],
  );
  const doViveiro = viveiro.rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    nomeCientifico: r.nomeCientifico,
    achadaPor: r.achadaPor === r.nome || r.achadaPor === r.nomeCientifico ? null : r.achadaPor,
  }));

  // A FFB: pelo nome científico ou pelo popular. Fora o que o viveiro já tem.
  const flora = await db.query<ResultadoFlora & { aceitoId: string | null; aceitoNome: string | null }>(
    `WITH achados AS (
       SELECT taxon_id, ${pontua('nome_normalizado')} AS score
         FROM ref_ffb_taxon WHERE nome_normalizado LIKE $2 OR nome_normalizado % $1
       UNION ALL
       SELECT taxon_id, ${pontua(semHifen('nome'))}
         FROM ref_ffb_nome_popular WHERE ${semHifen('nome')} LIKE $2 OR ${semHifen('nome')} % $1
     ), melhores AS (
       SELECT taxon_id, MAX(score) AS score FROM achados GROUP BY taxon_id
     )
     SELECT t.taxon_id AS "taxonId", t.nome_canonico AS "nomeCientifico", t.familia, t.nativa_sc AS "nativaSc",
            (SELECT p.nome FROM ref_ffb_nome_popular p WHERE p.taxon_id IN (t.taxon_id, a.taxon_id)
              ORDER BY (${semHifen('p.nome')} LIKE $2) DESC, (p.taxon_id = a.taxon_id) DESC, p.nome LIMIT 1) AS "nomePopular",
            a.taxon_id AS "aceitoId", a.nome_canonico AS "aceitoNome"
       FROM melhores m
       JOIN ref_ffb_taxon t ON t.taxon_id = m.taxon_id
       LEFT JOIN ref_ffb_taxon a ON a.taxon_id = t.aceito_taxon_id AND t.situacao <> 'NOME_ACEITO'
      WHERE (t.situacao = 'NOME_ACEITO' OR a.taxon_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM especies e WHERE e.taxon_id_ffb = COALESCE(a.taxon_id, t.taxon_id)
                                                   AND e.substituida_por_id IS NULL)
      -- A palavra que começa pelo termo, depois o que o contém, depois o parecido. Em cada grupo, a nativa de SC primeiro
      ORDER BY (m.score >= 1) DESC, (m.score >= 0.9) DESC, t.nativa_sc DESC, m.score DESC,
               (t.situacao = 'NOME_ACEITO') DESC, t.nome_canonico
      LIMIT $3`,
    [termo, contem, MAX_RESULTADOS * 3, comecaPalavra],
  );
  // O nome antigo e o de hoje levam à mesma planta: ela aparece uma vez, na melhor posição
  const vistos = new Set<string>();
  const daFlora: ResultadoFlora[] = [];
  for (const { aceitoId, aceitoNome, ...r } of flora.rows) {
    const chave = aceitoId ?? r.taxonId;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    daFlora.push({ ...r, aceito: aceitoId && aceitoNome ? { taxonId: aceitoId, nomeCientifico: aceitoNome } : null });
    if (daFlora.length >= MAX_RESULTADOS - doViveiro.length) break;
  }

  return { doViveiro, daFlora };
}

export interface ValidacaoFfb {
  status: 'validado' | 'pendente' | 'a_identificar' | 'fora_da_ffb';
  familia: string | null;
}

/**
 * Confere o nome da espécie com a FFB depois de gravar, na mesma transação. É
 * invisível para quem cadastra (RN-68): bateu com um nome aceito, a espécie
 * fica validada; não bateu, fica pendente para a chefia revisar, sem bloquear.
 *
 * `taxonEscolhido` é o que a pessoa tocou na busca; `sinonimoEscolhido`, o
 * nome antigo que ela tocou, guardado como sinônimo.
 */
export async function conferirNomeNaFfb(
  client: PoolClient,
  especieId: string,
  escolha: { taxonId: string | null; sinonimoTaxonId: string | null } = { taxonId: null, sinonimoTaxonId: null },
): Promise<ValidacaoFfb> {
  const { rows } = await client.query<{ nome: string; status: ValidacaoFfb['status']; taxon: string | null }>(
    'SELECT nome_cientifico AS nome, status_validacao AS status, taxon_id_ffb AS taxon FROM especies WHERE id = $1',
    [especieId],
  );
  const especie = rows[0];
  if (!especie) throw new Error('Espécie recém-gravada não encontrada.');

  // O escolhido na busca vale se o nome não foi mexido depois; sem escolha, só o aceito de nome idêntico
  let taxonId = escolha.taxonId;
  if (!taxonId) {
    const exato = await client.query<{ taxon_id: string }>(
      `SELECT taxon_id FROM ref_ffb_taxon WHERE nome_normalizado = normaliza_nome($1) AND situacao = 'NOME_ACEITO'`,
      [especie.nome],
    );
    taxonId = exato.rows.length === 1 ? exato.rows[0].taxon_id : null;
  }
  const aceito = taxonId ? await buscarTaxonAceito(client, taxonId) : null;
  const confere = aceito && (await client.query('SELECT normaliza_nome($1) = normaliza_nome($2) AS igual', [aceito.nomeCanonico, especie.nome])).rows[0].igual;

  if (!aceito || !confere) {
    // Validada e renomeada para fora da FFB: volta para a revisão. As outras situações ficam
    if (especie.status === 'validado') {
      await client.query(
        `UPDATE especies SET status_validacao = 'pendente', taxon_id_ffb = NULL, validado_em = NULL, validado_versao_ipt = NULL
          WHERE id = $1`,
        [especieId],
      );
      return { status: 'pendente', familia: null };
    }
    return { status: especie.status, familia: null };
  }

  if (especie.status !== 'validado' || especie.taxon !== aceito.taxonId) {
    const versao = await versaoFfbAtual(client);
    await client.query(
      `UPDATE especies
          SET taxon_id_ffb = $2, autoria = $3, familia = $4, categoria_taxonomica = $5, origem = $6, nativa_sc = $7,
              status_validacao = 'validado', validado_em = NOW(), validado_versao_ipt = $8,
              origem_registro = CASE WHEN $9 AND origem_registro = 'manual' THEN 'ffb' ELSE origem_registro END
        WHERE id = $1`,
      [especieId, aceito.taxonId, aceito.autoria, aceito.familia, aceito.categoria, aceito.origem, aceito.nativaSc,
        versao?.versao ?? null, escolha.taxonId !== null],
    );
  }

  if (escolha.sinonimoTaxonId) {
    await client.query(
      `INSERT INTO especies_sinonimos (especie_id, nome, autoria, taxon_id_ffb, fonte)
       SELECT $1, nome_canonico, autoria, taxon_id, 'ffb' FROM ref_ffb_taxon
        WHERE taxon_id = $2 AND aceito_taxon_id = $3
       ON CONFLICT (nome_normalizado) DO NOTHING`,
      [especieId, escolha.sinonimoTaxonId, aceito.taxonId],
    );
  }
  return { status: 'validado', familia: aceito.familia };
}

/** A atribuição que a licença CC-BY 4.0 da FFB pede, com a versão importada. */
export async function atribuicaoFfb(db: Db): Promise<string | null> {
  const versao = await versaoFfbAtual(db);
  if (!versao) return null;
  return `Fonte da nomenclatura: Flora e Funga do Brasil, Jardim Botânico do Rio de Janeiro (versão ${versao.versao}), licença CC-BY 4.0.`;
}
