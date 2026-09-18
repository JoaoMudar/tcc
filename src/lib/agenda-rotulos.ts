/**
 * Rótulos da agenda que o navegador pode receber: sem SQL e sem `pg` (RNF-11,
 * TA-60). O servidor usa os mesmos.
 */

import type { PillTone } from '@/components/ui/Pill';
import { lerQuantidade } from './lotes-rotulos';

/** Lista fechada do CHECK `tipos_tarefa_unidade_valida` (RNF-02). */
export const UNIDADES_TAREFA = ['un', 'kg', 'g', 'L', 'mL'] as const;

export type UnidadeTarefa = (typeof UNIDADES_TAREFA)[number];

export function isUnidadeTarefa(value: string): value is UnidadeTarefa {
  return (UNIDADES_TAREFA as readonly string[]).includes(value);
}

/** Teto de NUMERIC(10,2). */
const MAXIMO = 1e8;

const DECIMAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** "2,5 kg", "1.200 un". */
export function formatQuantidadeMedida(quantidade: number, unidade: UnidadeTarefa): string {
  return `${DECIMAL.format(quantidade)} ${unidade}`;
}

/**
 * `un` só aceita inteiro, como o lote. As outras aceitam vírgula com até duas
 * casas, e o ponto segue separando o milhar: "2,5", "1.500,25".
 */
export function lerQuantidadeMedida(text: string, unidade: UnidadeTarefa): number | null {
  if (unidade === 'un') {
    const inteiro = lerQuantidade(text);
    return inteiro !== null && inteiro < MAXIMO ? inteiro : null;
  }
  const partes = /^(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/.exec(text.trim().replace(/\s/g, ''));
  if (!partes) return null;
  const numero = Number(`${partes[1].replace(/\./g, '')}.${partes[2] ?? '0'}`);
  return numero < MAXIMO ? numero : null;
}

export const SITUACOES_SEMANA = {
  rascunho: 'Rascunho',
  publicada: 'Publicada',
  fechada: 'Fechada',
} as const;

export type SituacaoSemana = keyof typeof SITUACOES_SEMANA;

export const TOM_SEMANA: Record<SituacaoSemana, PillTone> = {
  rascunho: 'amber',
  publicada: 'blue',
  fechada: 'neutral',
};

/** RN-14: `nao_confirmada` é a assumida como realizada no fechamento, e a marca fica à vista. */
export const SITUACOES_ATRIBUICAO = {
  planejada: 'Planejada',
  confirmada: 'Confirmada',
  nao_confirmada: 'Não confirmada',
  cancelada: 'Cancelada',
} as const;

export type SituacaoAtribuicao = keyof typeof SITUACOES_ATRIBUICAO;

export const TOM_ATRIBUICAO: Record<SituacaoAtribuicao, PillTone> = {
  planejada: 'neutral',
  confirmada: 'green',
  nao_confirmada: 'amber',
  cancelada: 'red',
};

/**
 * O estado que a agenda pinta, **derivado e não gravado**: o banco só guarda as
 * quatro situações de `atribuicoes_situacao_valida`, e a quantidade é por
 * participante. "Parcial" e "não feita" saem da conta, não de uma coluna.
 */
export const ESTADOS_TAREFA = {
  planejada: 'Planejada',
  feita: 'Feita',
  parcial: 'Parcial',
  presumida: 'Presumida',
  nao_feita: 'Não feita',
  cancelada: 'Cancelada',
} as const;

export type EstadoTarefa = keyof typeof ESTADOS_TAREFA;

/** A cor nunca decide sozinha (RNF-04): o glifo acompanha todo estado. */
export const GLIFO_ESTADO: Record<EstadoTarefa, string> = {
  planejada: '·',
  feita: '✓',
  parcial: '◐',
  presumida: '?',
  nao_feita: '✕',
  cancelada: '—',
};

export const TOM_ESTADO: Record<EstadoTarefa, PillTone> = {
  planejada: 'neutral',
  feita: 'green',
  parcial: 'amber',
  presumida: 'amber',
  nao_feita: 'red',
  cancelada: 'neutral',
};

/**
 * A forma é declarada aqui, e não importada de `agenda.ts`, porque é `agenda.ts`
 * que importa deste arquivo: o caminho contrário fecharia um ciclo.
 */
export interface EstadoTarefaInput {
  situacao: SituacaoAtribuicao;
  eQuantitativa: boolean;
  quantidadePlanejada: number | null;
  participantes: readonly { quantidade: number | null }[];
}

/**
 * RF-31 e RN-14: a não confirmada entra como realizada, mas fica `presumida`, e
 * é isso que a mantém distinguível da confirmada. Quantidade em branco é "sem
 * contagem" (FA-4 de `parseConfirmacao`), e não zero: a tarefa contada por
 * ninguém está feita, não vazia.
 */
export function estadoTarefa(a: EstadoTarefaInput): EstadoTarefa {
  if (a.situacao === 'cancelada') return 'cancelada';
  if (a.situacao === 'planejada') return 'planejada';
  if (a.situacao === 'nao_confirmada') return 'presumida';
  if (!a.eQuantitativa || a.quantidadePlanejada === null) return 'feita';

  const contados = a.participantes.filter((p) => p.quantidade !== null);
  if (contados.length === 0) return 'feita';

  const total = contados.reduce((soma, p) => soma + (p.quantidade ?? 0), 0);
  if (total === 0) return 'nao_feita';
  return total < a.quantidadePlanejada ? 'parcial' : 'feita';
}

/** Valor da opção "nenhum" nas listas opcionais: o servidor lê qualquer coisa que não seja UUID como vazio. */
export const NENHUM = 'nenhum';

/** RN-12: a hora só aparece na tarefa que a tem. "07:00", ou "07:00 às 08:00". */
export function formatHoraTarefa(inicio: string | null, fim: string | null): string | null {
  if (!inicio) return null;
  return fim ? `${inicio} às ${fim}` : inicio;
}

/** A letra do turno na grade: "manha" → "M". */
export function siglaTurno(nome: string): string {
  return nome.charAt(0).toUpperCase();
}

export interface DetalhesAtribuicao {
  loteCodigo: string | null;
  especie: string | null;
  recipiente: string | null;
  area: string | null;
  canteiro: string | null;
  quantidadePlanejada: number | null;
  unidadeMedida: UnidadeTarefa;
}

/** O que a tarefa leva além do tipo, em pedaços curtos. Canteiro, quando há, já diz a área. */
export function detalhesAtribuicao(a: DetalhesAtribuicao): string[] {
  return [
    a.loteCodigo && `Lote ${a.loteCodigo}`,
    a.especie,
    a.recipiente,
    a.canteiro ? `Canteiro ${a.canteiro}` : a.area && `Área ${a.area}`,
    a.quantidadePlanejada !== null && `Previsto ${formatQuantidadeMedida(a.quantidadePlanejada, a.unidadeMedida)}`,
  ].filter((parte): parte is string => typeof parte === 'string' && parte !== '');
}
