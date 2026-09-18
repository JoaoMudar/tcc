/**
 * Rótulos e listas fechadas do protocolo que o navegador pode receber: sem SQL e
 * sem `pg` (RNF-11, TA-60). O servidor usa os mesmos, por `protocolos.ts`.
 */

/** RN-34: a sequencial acontece uma vez e pode avançar a fase; a recorrente repete e nunca avança. */
export const TIPOS_AGENDAMENTO = {
  sequencial: 'Uma vez',
  recorrente: 'Repete',
} as const;

export type TipoAgendamento = keyof typeof TIPOS_AGENDAMENTO;

export function isTipoAgendamento(value: string): value is TipoAgendamento {
  return Object.hasOwn(TIPOS_AGENDAMENTO, value);
}

/** RN-31: o evento de referência é declarado, e nunca inferido da ordem das etapas. */
export const TIPOS_ANCORA = {
  criacao_do_lote: 'A criação do lote',
  conclusao_de_etapa: 'A conclusão de outra etapa',
} as const;

export type TipoAncora = keyof typeof TIPOS_ANCORA;

export function isTipoAncora(value: string): value is TipoAncora {
  return Object.hasOwn(TIPOS_ANCORA, value);
}

/** Situação que a visão `lotes_etapas_vencimento` devolve por etapa (RF-52). */
export const SITUACOES_ETAPA = {
  sem_alerta: 'Rotina',
  em_dia: 'Em dia',
  atencao: 'Atenção',
  atraso: 'Em atraso',
} as const;

export type SituacaoEtapa = keyof typeof SITUACOES_ETAPA;

/** Tom da cor, no vocabulário das outras telas. `sem_alerta` não recebe cor nenhuma (RN-35). */
export const TOM_SITUACAO_ETAPA: Record<SituacaoEtapa, 'neutral' | 'success' | 'warning' | 'danger'> = {
  sem_alerta: 'neutral',
  em_dia: 'success',
  atencao: 'warning',
  atraso: 'danger',
};

/** "90 dias, repete a cada 90" e "40 dias depois do plantio", como a lista de etapas fala. */
export function resumoAgendamento(etapa: {
  tipoAgendamento: TipoAgendamento;
  dias: number;
  intervaloDias: number | null;
}): string {
  const primeira = etapa.dias === 0 ? 'no mesmo dia' : `${etapa.dias} dias depois`;
  if (etapa.tipoAgendamento === 'sequencial') return `Uma vez, ${primeira}`;
  return `${primeira}, e repete a cada ${etapa.intervaloDias} dias`;
}
