import { isDataIso, somaDias } from './datas';
import { nomeEspecieSql } from './lotes';
import { type CausaPerda, isCausaPerda } from './movimentos';
import { MORTALIDADE } from './parametros';
import type { Db } from './sql';
import { isUuid } from './uuid';

/** RF-42: perdas do lote divididas pela quantidade inicial. `null` sem base para dividir. */
export function mortalidade(perdas: number, quantidadeInicial: number): number | null {
  if (quantidadeInicial <= 0) return null;
  return perdas / quantidadeInicial;
}

/** "Ultrapasse o limite": igual ao limite ainda não destaca. O limite vem em percentual. */
export function acimaDoLimite(taxa: number | null, limitePct: number): boolean {
  return taxa !== null && taxa * 100 > limitePct;
}

const PERCENTUAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatPercentual(taxa: number): string {
  return `${PERCENTUAL.format(taxa * 100)}%`;
}

/** O limite é parâmetro, não constante (RN-11, TA-25). A migration garante a linha. */
export async function limiteMortalidade(db: Db): Promise<number> {
  const { rows } = await db.query<{ valor: string }>('SELECT valor FROM parametros WHERE chave = $1', [MORTALIDADE]);
  if (!rows[0]) throw new Error(`Parâmetro ${MORTALIDADE} ausente`);
  return Number(rows[0].valor);
}

export interface FiltroPerdas {
  de: string;
  ate: string;
  especieId: string | null;
  causa: CausaPerda | null;
}

export const PERIODO_PADRAO_DIAS = 90;

/** Filtro vindo do endereço: o que não for válido cai no padrão, os últimos 90 dias. */
export function parseFiltroPerdas(
  params: { de?: string; ate?: string; especie?: string; causa?: string },
  hoje: string,
): FiltroPerdas {
  const ate = params.ate && isDataIso(params.ate) ? params.ate : hoje;
  const de = params.de && isDataIso(params.de) ? params.de : somaDias(ate, -PERIODO_PADRAO_DIAS);
  return {
    de: de <= ate ? de : ate,
    ate: de <= ate ? ate : de,
    especieId: isUuid(params.especie) ? params.especie : null,
    causa: params.causa && isCausaPerda(params.causa) ? params.causa : null,
  };
}

export interface Perda {
  id: string;
  data: string;
  loteId: string;
  codigo: string;
  especie: string;
  recipiente: string;
  causa: CausaPerda;
  quantidade: number;
  observacoes: string | null;
}

/** T4.11, RF-41: perdas do período, com espécie e causa opcionais. */
export async function listPerdas(db: Db, filtro: FiltroPerdas): Promise<Perda[]> {
  const { rows } = await db.query<Perda>(
    `SELECT m.id, to_char(m.data_movimento, 'YYYY-MM-DD') AS data, l.id AS "loteId", l.codigo,
            ${nomeEspecieSql('e')} AS especie, r.nome AS recipiente, m.causa_perda AS causa,
            -m.quantidade AS quantidade, m.observacoes
       FROM movimentos_lote m
       JOIN lotes l ON l.id = m.lote_id
       JOIN especies e ON e.id = l.especie_id
       JOIN recipientes r ON r.id = l.recipiente_id
      WHERE m.tipo_movimento = 'perda'
        AND m.data_movimento BETWEEN $1 AND $2
        AND ($3::uuid IS NULL OR l.especie_id = $3)
        AND ($4::text IS NULL OR m.causa_perda = $4)
      ORDER BY m.data_movimento DESC, m.criado_em DESC
      LIMIT 500`,
    [filtro.de, filtro.ate, filtro.especieId, filtro.causa],
  );
  return rows;
}

export function totaisPorCausa(perdas: readonly Pick<Perda, 'causa' | 'quantidade'>[]): { causa: CausaPerda; quantidade: number }[] {
  const totais = new Map<CausaPerda, number>();
  for (const perda of perdas) totais.set(perda.causa, (totais.get(perda.causa) ?? 0) + perda.quantidade);
  return [...totais].map(([causa, quantidade]) => ({ causa, quantidade })).sort((a, b) => b.quantidade - a.quantidade);
}

export interface MortalidadeLote {
  id: string;
  codigo: string;
  especie: string;
  recipiente: string;
  quantidadeInicial: number;
  /** Todas as perdas do lote, e não só as do período: a taxa é do lote. */
  perdas: number;
  encerrado: boolean;
  taxa: number | null;
}

/** Lotes que tiveram perda no filtro, com a taxa de cada um, da maior para a menor. */
export async function listMortalidadeLotes(db: Db, filtro: FiltroPerdas): Promise<MortalidadeLote[]> {
  const { rows } = await db.query<Omit<MortalidadeLote, 'taxa'>>(
    `SELECT l.id, l.codigo, ${nomeEspecieSql('e')} AS especie, r.nome AS recipiente,
            l.quantidade_inicial AS "quantidadeInicial",
            (SELECT COALESCE(-SUM(t.quantidade), 0)::int FROM movimentos_lote t
              WHERE t.lote_id = l.id AND t.tipo_movimento = 'perda') AS perdas,
            l.encerrado_em IS NOT NULL AS encerrado
       FROM lotes l
       JOIN especies e ON e.id = l.especie_id
       JOIN recipientes r ON r.id = l.recipiente_id
      WHERE ($3::uuid IS NULL OR l.especie_id = $3)
        AND EXISTS (SELECT 1 FROM movimentos_lote m
                     WHERE m.lote_id = l.id AND m.tipo_movimento = 'perda'
                       AND m.data_movimento BETWEEN $1 AND $2
                       AND ($4::text IS NULL OR m.causa_perda = $4))
      LIMIT 300`,
    [filtro.de, filtro.ate, filtro.especieId, filtro.causa],
  );
  return rows
    .map((lote) => ({ ...lote, taxa: mortalidade(lote.perdas, lote.quantidadeInicial) }))
    .sort((a, b) => (b.taxa ?? 0) - (a.taxa ?? 0) || a.codigo.localeCompare(b.codigo));
}
