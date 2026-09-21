import type { Area } from './areas';
import { formatData } from './datas';
import type { Fase } from './lotes-rotulos';
import { nomeEspecieSql } from './lotes';
import { mortalidade } from './perdas';
import type { Db } from './sql';

/**
 * T7.1 a T7.3, RF-44, RF-45, RF-42: o mapa do viveiro.
 *
 * **A situação não é lida daqui, e sim da visão `situacao_lote`.** Ela deriva a
 * cor do que já foi registrado, a cada leitura (RF-45): nenhuma coluna guarda
 * situação, porque situação gravada envelhece sozinha e o lote verde de ontem
 * continuaria verde hoje, que é o contrário do que esta tela existe para
 * mostrar.
 *
 * **A cor mede uma coisa só: tarefa que não foi feita.** A mortalidade acima do
 * limite tem destaque próprio (RF-42), e de propósito não entra na cor: somar as
 * duas produziria um vermelho que não diz o que fazer.
 */

export type SituacaoLote = 'saudavel' | 'atencao' | 'critico';

export const SITUACOES_LOTE = {
  saudavel: 'Saudável',
  atencao: 'Atenção',
  critico: 'Crítico',
} as const;

/** Tom do selo, no vocabulário do `Pill`. */
export const TOM_SITUACAO: Record<SituacaoLote, 'green' | 'amber' | 'red'> = {
  saudavel: 'green',
  atencao: 'amber',
  critico: 'red',
};

/** A gravidade manda na ordem de leitura: quem pede providência aparece primeiro. */
const GRAVIDADE: Record<SituacaoLote, number> = { critico: 0, atencao: 1, saudavel: 2 };

export interface LoteNoMapa {
  id: string;
  codigo: string;
  canteiroId: string;
  /** O lugar dentro do canteiro: é por ele que se reconhece o lote antes de ler o rótulo. */
  posicao: number | null;
  especie: string;
  recipiente: string;
  fase: Fase;
  saldo: number;
  situacao: SituacaoLote;
  /** A pendência mais antiga do lote, venha da agenda ou do protocolo. Nula no saudável. */
  tarefaPendente: string | null;
  pendenteDesde: string | null;
  diasAtraso: number;
  quantidadeInicial: number;
  perdas: number;
  /** RF-42: perdas sobre a quantidade inicial. Nula sem base para dividir. */
  taxa: number | null;
}

/**
 * RF-44: os lotes abertos com a situação de cada um. A visão já exclui o lote
 * encerrado, e é ela que faz o canteiro do lote zerado voltar a aparecer livre.
 */
export async function listLotesDoMapa(db: Db): Promise<LoteNoMapa[]> {
  const { rows } = await db.query<Omit<LoteNoMapa, 'taxa'>>(
    `SELECT s.lote_id AS id, s.codigo_lote AS codigo, s.canteiro_id AS "canteiroId", s.posicao,
            ${nomeEspecieSql('e')} AS especie, r.nome AS recipiente, l.fase,
            l.quantidade_atual AS saldo, l.quantidade_inicial AS "quantidadeInicial",
            COALESCE((SELECT -SUM(m.quantidade) FROM movimentos_lote m
                       WHERE m.lote_id = l.id AND m.tipo_movimento = 'perda'), 0)::int AS perdas,
            s.situacao, s.tarefa_pendente AS "tarefaPendente",
            to_char(s.pendente_desde, 'YYYY-MM-DD') AS "pendenteDesde",
            s.dias_atraso AS "diasAtraso"
       FROM situacao_lote s
       JOIN lotes l ON l.id = s.lote_id
       JOIN especies e ON e.id = l.especie_id
       JOIN recipientes r ON r.id = l.recipiente_id
      ORDER BY s.posicao NULLS LAST, s.codigo_lote`,
  );
  return rows.map((lote) => ({ ...lote, taxa: mortalidade(lote.perdas, lote.quantidadeInicial) }));
}

export type Contagem = Record<SituacaoLote, number>;

export function contarSituacoes(lotes: readonly { situacao: SituacaoLote }[]): Contagem {
  const contagem: Contagem = { saudavel: 0, atencao: 0, critico: 0 };
  for (const lote of lotes) contagem[lote.situacao] += 1;
  return contagem;
}

export interface CanteiroNoMapa {
  id: string;
  numero: number;
  lotes: LoteNoMapa[];
  /** Canteiro livre é canteiro sem nenhum lote aberto. */
  livre: boolean;
}

export interface AreaNoMapa {
  id: string;
  letra: string;
  nome: string | null;
  canteiros: CanteiroNoMapa[];
  ocupados: number;
  contagem: Contagem;
}

/**
 * A área é o quadro, o canteiro é a faixa dentro dela e o lote é o quadrado
 * dentro do canteiro (UC-27).
 *
 * **Não é `montarOcupacao`**, de `lotes.ts`, e a separação é deliberada: aquela
 * responde quanto cabe e quanto há em cada canteiro, e esta responde o que pede
 * providência. Fundir as duas faria cada tela carregar a pergunta da outra.
 */
export function montarMapa(areas: readonly Area[], lotes: readonly LoteNoMapa[]): AreaNoMapa[] {
  const porCanteiro = new Map<string, LoteNoMapa[]>();
  for (const lote of lotes) porCanteiro.set(lote.canteiroId, [...(porCanteiro.get(lote.canteiroId) ?? []), lote]);

  return areas.map((area) => {
    const canteiros = area.canteiros.map((canteiro) => {
      const doCanteiro = porCanteiro.get(canteiro.id) ?? [];
      return { id: canteiro.id, numero: canteiro.numero, lotes: doCanteiro, livre: doCanteiro.length === 0 };
    });
    return {
      id: area.id,
      letra: area.letra,
      nome: area.nome,
      canteiros,
      ocupados: canteiros.filter((canteiro) => !canteiro.livre).length,
      contagem: contarSituacoes(canteiros.flatMap((canteiro) => canteiro.lotes)),
    };
  });
}

/**
 * RF-45: o que pede providência hoje, do mais grave para o menos, e dentro da
 * mesma gravidade do que espera há mais tempo. É esta lista que dá a
 * providência no celular, onde o desenho não cabe (RNF-14).
 */
export function pedemProvidencia(lotes: readonly LoteNoMapa[]): LoteNoMapa[] {
  return lotes
    .filter((lote) => lote.situacao !== 'saudavel')
    .sort(
      (a, b) =>
        GRAVIDADE[a.situacao] - GRAVIDADE[b.situacao] ||
        (a.pendenteDesde ?? '').localeCompare(b.pendenteDesde ?? '') ||
        a.codigo.localeCompare(b.codigo),
    );
}

/**
 * "Irrigação, atrasada 3 dias": a cor sozinha diz que algo está errado, e o que
 * se quer é a providência (RF-45, T7.2).
 *
 * A etapa em atenção ainda não venceu, e por isso tem zero dia de atraso: dizer
 * "atrasada 0 dias" seria falso, e é por isso que os três casos são diferentes.
 */
export function textoPendencia(
  lote: Pick<LoteNoMapa, 'tarefaPendente' | 'pendenteDesde' | 'diasAtraso'>,
  hoje: string,
): string | null {
  if (!lote.tarefaPendente) return null;
  if (lote.diasAtraso > 0) {
    return `${lote.tarefaPendente}, atrasada ${lote.diasAtraso} ${lote.diasAtraso === 1 ? 'dia' : 'dias'}`;
  }
  if (lote.pendenteDesde && lote.pendenteDesde > hoje) return `${lote.tarefaPendente}, vence em ${formatData(lote.pendenteDesde)}`;
  return `${lote.tarefaPendente}, vence hoje`;
}
