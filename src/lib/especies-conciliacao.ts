import type { Origem, Situacao } from './ffb/dwca';
import { type CategoriaTaxonomica, separarAutoria } from './ffb/nomes';
import type { Db } from './sql';

/**
 * RF-69: cruza um nome científico digitado (da planilha antiga ou da tela) com
 * a cópia local da FFB. **Só sugere**: grafia e sinônimo viram linha de
 * relatório, e quem decide é a chefia (RN-67).
 */

export type SituacaoConciliacao = 'OK' | 'SINONIMO' | 'GRAFIA' | 'REVISAO_MANUAL' | 'NAO_ENCONTRADO';

export interface CandidatoFfb {
  taxonId: string;
  nomeCanonico: string;
  autoria: string | null;
  situacao: Situacao;
  aceitoTaxonId: string | null;
  similaridade: number;
}

export interface TaxonAceito {
  taxonId: string;
  nomeCanonico: string;
  autoria: string | null;
  familia: string | null;
  categoria: CategoriaTaxonomica;
  origem: Origem | null;
  nativaSc: boolean;
}

export interface ResultadoConciliacao {
  situacao: SituacaoConciliacao;
  canonico: string;
  autoria: string | null;
  /** O registro da FFB que bateu com o nome digitado (pode ser o sinônimo) */
  encontrado: CandidatoFfb | null;
  /** O nome aceito a que ele leva */
  aceito: TaxonAceito | null;
  alertas: string[];
}

/** Grafia: abaixo disso não é o mesmo nome; sem essa folga sobre o segundo, é dúvida. */
export const SIMILARIDADE_MINIMA = 0.6;
export const FOLGA_MINIMA = 0.1;

/** "(A.St.-Hil.) Spreng." e "(A. St.-Hil.) Spreng" são a mesma autoria. */
export function normalizaAutoria(autoria: string | null): string {
  return (autoria ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z&]/g, '');
}

/**
 * Entre registros com o mesmo nome (homônimos, como as três *Passiflora alata*),
 * desempata pela autoria e, sem ela, pelo único que tem situação na FFB.
 */
export function escolherHomonimo(candidatos: readonly CandidatoFfb[], autoria: string | null): CandidatoFfb | null {
  if (candidatos.length === 1) return candidatos[0];
  const alvo = normalizaAutoria(autoria);
  if (alvo) {
    const mesmaAutoria = candidatos.filter((c) => normalizaAutoria(c.autoria) === alvo);
    if (mesmaAutoria.length === 1) return mesmaAutoria[0];
  }
  const comSituacao = candidatos.filter((c) => c.situacao !== 'SEM_SITUACAO');
  if (comSituacao.length === 1) return comSituacao[0];
  // Homônimos que levam todos ao mesmo aceito não são dúvida (as duas *Cinnamomum zeylanicum*)
  const aceitos = new Set(candidatos.map((c) => (c.situacao === 'NOME_ACEITO' ? c.taxonId : c.aceitoTaxonId)));
  return aceitos.size === 1 && !aceitos.has(null) ? candidatos[0] : null;
}

/** O melhor aproximado, se ele for claramente melhor que o segundo. */
export function escolherAproximado(candidatos: readonly CandidatoFfb[]): CandidatoFfb | 'duvida' | null {
  const [melhor, segundo] = [...candidatos].sort((a, b) => b.similaridade - a.similaridade);
  if (!melhor || melhor.similaridade < SIMILARIDADE_MINIMA) return null;
  if (segundo && melhor.similaridade - segundo.similaridade < FOLGA_MINIMA) return 'duvida';
  return melhor;
}

export type OrigemDeclarada = 'nativa' | 'exotica' | null;

export function lerOrigemDeclarada(texto: string | null | undefined): OrigemDeclarada {
  const n = (texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
  if (n.startsWith('nativ')) return 'nativa';
  if (n.startsWith('exot')) return 'exotica';
  return null;
}

/** Divergência entre o que a planilha declarava e o que a FFB diz. Vira alerta, nunca correção. */
export function alertasDeOrigem(declarada: OrigemDeclarada, aceito: TaxonAceito | null): string[] {
  if (!aceito || !declarada) return [];
  const alertas: string[] = [];
  if (declarada === 'nativa' && aceito.origem === 'exotica') alertas.push('A planilha diz nativa; a FFB diz exótica no Brasil');
  if (declarada === 'exotica' && aceito.origem === 'nativa') alertas.push('A planilha diz exótica; a FFB diz nativa do Brasil');
  if (declarada === 'nativa' && aceito.origem === 'nativa' && !aceito.nativaSc) {
    alertas.push('Segundo a FFB, não ocorre nativa em SC');
  }
  return alertas;
}

const SELECT_CANDIDATO = `
  SELECT taxon_id AS "taxonId", nome_canonico AS "nomeCanonico", autoria, situacao,
         aceito_taxon_id AS "aceitoTaxonId"`;

export async function buscarTaxonAceito(db: Db, taxonId: string): Promise<TaxonAceito | null> {
  const { rows } = await db.query<TaxonAceito & { situacao: Situacao; aceitoTaxonId: string | null }>(
    `SELECT t.taxon_id AS "taxonId", t.nome_canonico AS "nomeCanonico", t.autoria, t.familia,
            t.categoria_taxonomica AS categoria, t.origem, t.nativa_sc AS "nativaSc", t.situacao,
            t.aceito_taxon_id AS "aceitoTaxonId"
       FROM ref_ffb_taxon t WHERE t.taxon_id = $1`,
    [taxonId],
  );
  const t = rows[0];
  if (!t) return null;
  // Escolher um sinônimo (ou uma variante de grafia sem situação) leva ao aceito
  if (t.situacao !== 'NOME_ACEITO' && t.aceitoTaxonId) return buscarTaxonAceito(db, t.aceitoTaxonId);
  if (t.situacao !== 'NOME_ACEITO') return null;
  return {
    taxonId: t.taxonId,
    nomeCanonico: t.nomeCanonico,
    autoria: t.autoria,
    familia: t.familia,
    categoria: t.categoria,
    origem: t.origem,
    nativaSc: t.nativaSc,
  };
}

export async function conciliarNome(db: Db, nome: string, origemDeclarada: OrigemDeclarada = null): Promise<ResultadoConciliacao> {
  const { canonico, autoria } = separarAutoria(nome);
  const base = { canonico, autoria, encontrado: null, aceito: null };

  const exatos = await db.query<CandidatoFfb>(
    `${SELECT_CANDIDATO}, 1::real AS similaridade FROM ref_ffb_taxon WHERE nome_normalizado = normaliza_nome($1)`,
    [canonico],
  );

  let encontrado: CandidatoFfb | null;
  let porGrafia = false;
  if (exatos.rows.length > 0) {
    encontrado = escolherHomonimo(exatos.rows, autoria);
    if (!encontrado) {
      const lista = exatos.rows.map((c) => `${c.nomeCanonico} ${c.autoria ?? ''}`.trim()).join(' | ');
      return { ...base, situacao: 'REVISAO_MANUAL', alertas: [`Mais de um registro com esse nome na FFB: ${lista}`] };
    }
  } else {
    const aproximados = await db.query<CandidatoFfb>(
      `${SELECT_CANDIDATO}, similarity(nome_normalizado, normaliza_nome($1)) AS similaridade
         FROM ref_ffb_taxon WHERE nome_normalizado % normaliza_nome($1)
        ORDER BY similaridade DESC LIMIT 3`,
      [canonico],
    );
    const escolha = escolherAproximado(aproximados.rows);
    if (escolha === null) return { ...base, situacao: 'NAO_ENCONTRADO', alertas: [] };
    if (escolha === 'duvida') {
      const lista = aproximados.rows.map((c) => c.nomeCanonico).join(' | ');
      return { ...base, situacao: 'REVISAO_MANUAL', alertas: [`Grafia parecida com mais de um nome: ${lista}`] };
    }
    encontrado = escolha;
    porGrafia = true;
  }

  const aceito =
    encontrado.situacao === 'NOME_ACEITO' || encontrado.aceitoTaxonId ? await buscarTaxonAceito(db, encontrado.taxonId) : null;
  if (!aceito) {
    return {
      ...base,
      situacao: 'REVISAO_MANUAL',
      encontrado,
      alertas: [`A FFB tem ${encontrado.nomeCanonico} (taxon ${encontrado.taxonId}), mas sem um nome aceito para ele`],
    };
  }

  const alertas = alertasDeOrigem(origemDeclarada, aceito);
  if (porGrafia && encontrado.situacao !== 'NOME_ACEITO') alertas.unshift(`Grafia corrigida para ${encontrado.nomeCanonico}, que também é nome antigo`);
  const situacao: SituacaoConciliacao = porGrafia ? 'GRAFIA' : encontrado.situacao === 'NOME_ACEITO' ? 'OK' : 'SINONIMO';
  return { ...base, situacao, encontrado, aceito, alertas };
}
