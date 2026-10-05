import type { DadosFfb } from './dwca';
import type { Db } from '../sql';

export interface ResumoImportacao {
  versao: string;
  taxons: number;
  aceitos: number;
  sinonimos: number;
  distribuicao: number;
  nomesPopulares: number;
}

const LOTE = 5000;

async function emLotes<T>(itens: readonly T[], gravar: (lote: readonly T[]) => Promise<unknown>) {
  for (let i = 0; i < itens.length; i += LOTE) await gravar(itens.slice(i, i + LOTE));
}

/**
 * Troca a referência inteira, na transação do chamador: com erro no meio, o
 * ROLLBACK devolve a versão anterior intacta, e o aplicativo nunca vê a cópia
 * pela metade (o TRUNCATE segura a leitura até o COMMIT).
 */
export async function importarReferenciaFfb(db: Db, dados: DadosFfb, fonte: 'ipt' | 'gbif' = 'ipt'): Promise<ResumoImportacao> {
  await db.query('TRUNCATE ref_ffb_nome_popular, ref_ffb_distribuicao, ref_ffb_taxon');

  await emLotes(dados.taxons, (lote) =>
    db.query(
      `INSERT INTO ref_ffb_taxon (taxon_id, nome_cientifico, nome_canonico, autoria, categoria_taxonomica, situacao,
                                  aceito_taxon_id, familia, genero, origem, nativa_sc)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
                            $7::text[], $8::text[], $9::text[], $10::text[], $11::boolean[])`,
      [
        lote.map((t) => t.taxonId),
        lote.map((t) => t.nomeCientifico),
        lote.map((t) => t.nomeCanonico),
        lote.map((t) => t.autoria),
        lote.map((t) => t.categoria),
        lote.map((t) => t.situacao),
        lote.map((t) => t.aceitoTaxonId),
        lote.map((t) => t.familia),
        lote.map((t) => t.genero),
        lote.map((t) => t.origem),
        lote.map((t) => t.nativaSc),
      ],
    ),
  );

  // Os domínios vão como texto separado por "|": unnest de array de array achata tudo
  await emLotes(dados.distribuicao, (lote) =>
    db.query(
      `INSERT INTO ref_ffb_distribuicao (taxon_id, uf, estabelecimento, endemica, dominios)
       SELECT t, u, e, en, CASE WHEN d = '' THEN '{}' ELSE string_to_array(d, '|') END
         FROM unnest($1::text[], $2::text[], $3::text[], $4::boolean[], $5::text[]) AS x(t, u, e, en, d)`,
      [
        lote.map((d) => d.taxonId),
        lote.map((d) => d.uf),
        lote.map((d) => d.estabelecimento),
        lote.map((d) => d.endemica),
        lote.map((d) => d.dominios.join('|')),
      ],
    ),
  );

  await emLotes(dados.nomesPopulares, (lote) =>
    db.query(
      `INSERT INTO ref_ffb_nome_popular (taxon_id, nome)
       SELECT * FROM unnest($1::text[], $2::text[]) ON CONFLICT DO NOTHING`,
      [lote.map((n) => n.taxonId), lote.map((n) => n.nome)],
    ),
  );

  await db.query(
    `INSERT INTO ref_ffb_importacao (versao_ipt, publicada_em, fonte, total_taxons) VALUES ($1, $2, $3, $4)`,
    [dados.versao, dados.publicadaEm, fonte, dados.taxons.length],
  );

  return {
    versao: dados.versao,
    taxons: dados.taxons.length,
    aceitos: dados.taxons.filter((t) => t.situacao === 'NOME_ACEITO').length,
    sinonimos: dados.taxons.filter((t) => t.situacao === 'SINONIMO').length,
    distribuicao: dados.distribuicao.length,
    nomesPopulares: dados.nomesPopulares.length,
  };
}

/** A versão em uso, para a atribuição CC-BY e para carimbar a validação. */
export async function versaoFfbAtual(db: Db): Promise<{ versao: string; publicadaEm: string | null } | null> {
  const { rows } = await db.query<{ versao: string; publicadaEm: string | null }>(
    `SELECT versao_ipt AS versao, to_char(publicada_em, 'YYYY-MM-DD') AS "publicadaEm"
       FROM ref_ffb_importacao ORDER BY importada_em DESC LIMIT 1`,
  );
  return rows[0] ?? null;
}
