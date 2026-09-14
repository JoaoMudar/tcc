/**
 * Rótulos da agenda que o navegador pode receber: sem SQL e sem `pg` (RNF-11,
 * TA-60). O servidor usa os mesmos.
 */

import type { PillTone } from '@/components/ui/Pill';
import { formatQuantidade } from './lotes-rotulos';

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
}

/** O que a tarefa leva além do tipo, em pedaços curtos. Canteiro, quando há, já diz a área. */
export function detalhesAtribuicao(a: DetalhesAtribuicao): string[] {
  return [
    a.loteCodigo && `Lote ${a.loteCodigo}`,
    a.especie,
    a.recipiente,
    a.canteiro ? `Canteiro ${a.canteiro}` : a.area && `Área ${a.area}`,
    a.quantidadePlanejada !== null && `${formatQuantidade(a.quantidadePlanejada)} previstas`,
  ].filter((parte): parte is string => typeof parte === 'string' && parte !== '');
}
