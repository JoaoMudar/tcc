import { somaDias } from './datas';
import type { LoteNoMapa } from './mapa';
import type { Sugestao } from './protocolos';

/**
 * RF-66: o que se pode fazer com o que pede providência, venha da lista do lote
 * ou da sugestão do protocolo. Sem SQL: o painel que oferece as ações roda no
 * navegador, e só os tipos atravessam.
 *
 * As saídas são sempre três: postergar, marcar na agenda e confirmar a tarefa.
 * O destino depende da origem. A **etapa** que ninguém lançou se marca no
 * lançamento já preenchido, e se confirma registrando a tarefa já feita. A
 * **tarefa** lançada e não confirmada já está na agenda: marca-se remarcando-a
 * para a semana de lançar (a de hoje, quando a da tela já passou), e confirma-se
 * pela ficha, que pede a contagem e a perda.
 */
export type OrigemProvidencia =
  | { tipo: 'etapa'; loteId: string; etapaId: string; lancarHref: string; registrarHref: string }
  | { tipo: 'tarefa'; atribuicaoId: string; marcarHref: string };

interface EtapaPendente {
  etapaId: string;
  loteId: string;
  tipoTarefaId: string;
  turnoId: string | null;
}

function parametrosDaEtapa(etapa: EtapaPendente): string {
  return `etapa=${etapa.etapaId}&lote=${etapa.loteId}&tipo=${etapa.tipoTarefaId}` + (etapa.turnoId ? `&turno=${etapa.turnoId}` : '');
}

export interface Providencia {
  chave: string;
  titulo: string;
  detalhe: string;
  /** O prazo atual: o adiamento conta dele, ou de hoje quando ele já passou. */
  prazo: string | null;
  origem: OrigemProvidencia;
}

/** O lançamento já com a etapa, o lote e o tipo (RF-47); o dia e quem faz continuam com quem lança. */
export function lancarDaEtapa(semana: string, etapa: EtapaPendente): string {
  return `/producao/agenda/nova?semana=${semana}&${parametrosDaEtapa(etapa)}`;
}

/** A etapa feita fora da agenda: registra a tarefa já confirmada. O dia sai do formulário, não da semana aberta. */
export function registrarDaEtapa(etapa: EtapaPendente): string {
  return `/producao/agenda/registrar?${parametrosDaEtapa(etapa)}`;
}

function origemDaEtapa(semana: string, etapa: EtapaPendente): OrigemProvidencia {
  return {
    tipo: 'etapa',
    loteId: etapa.loteId,
    etapaId: etapa.etapaId,
    lancarHref: lancarDaEtapa(semana, etapa),
    registrarHref: registrarDaEtapa(etapa),
  };
}

export function providenciaDaSugestao(s: Sugestao, semana: string): Providencia {
  return {
    chave: `sugestao-${s.loteId}-${s.loteEtapaId}`,
    titulo: `${s.rotulo} · ${s.loteCodigo}`,
    detalhe: [s.especie, s.canteiro].filter(Boolean).join(' · '),
    prazo: s.vencimento,
    origem: origemDaEtapa(semana, { etapaId: s.loteEtapaId, loteId: s.loteId, tipoTarefaId: s.tipoTarefaId, turnoId: s.turnoId }),
  };
}

/**
 * O lote da lista "Pedem providência", com o texto da pendência já montado por
 * quem tem `textoPendencia`. Nulo no lote sem pendência, que não tem ação nenhuma.
 */
export function providenciaDoLote(lote: LoteNoMapa, pendencia: string | null, semana: string): Providencia | null {
  const base = {
    chave: `lote-${lote.id}`,
    titulo: `${lote.codigo} · ${lote.especie}`,
    detalhe: pendencia ?? '',
    prazo: lote.pendenteDesde,
  };
  if (lote.atribuicaoPendenteId) {
    const id = lote.atribuicaoPendenteId;
    return { ...base, origem: { tipo: 'tarefa', atribuicaoId: id, marcarHref: `/producao/agenda/${id}/editar?semana=${semana}` } };
  }
  if (lote.protocoloEtapaPendenteId && lote.tipoTarefaPendenteId) {
    const etapa = { etapaId: lote.protocoloEtapaPendenteId, loteId: lote.id, tipoTarefaId: lote.tipoTarefaPendenteId, turnoId: lote.turnoPendenteId };
    return { ...base, origem: origemDaEtapa(semana, etapa) };
  }
  return null;
}

/**
 * O prazo depois de adiar; nulo enquanto os dias digitados não formam um número.
 * Conta do prazo, ou de hoje quando ele já passou: adiar para um dia que já foi
 * não tira nada do atraso.
 */
export function prazoAdiado(prazo: string | null, dias: number, hoje: string): string | null {
  return prazo && Number.isInteger(dias) && dias > 0 ? somaDias(baseDoAdiamento(prazo, hoje), dias) : null;
}

/** De onde o adiamento conta: o prazo, ou hoje se o prazo já passou. */
export function baseDoAdiamento(prazo: string, hoje: string): string {
  return prazo < hoje ? hoje : prazo;
}
