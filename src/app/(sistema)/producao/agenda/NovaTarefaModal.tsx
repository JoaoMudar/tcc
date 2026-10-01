'use client';

import { Modal } from '@/components/ui/Modal';
import { nomeDia } from '@/lib/semanas';
import { turnoLabel } from '@/lib/turnos';
import { type OpcoesAtribuicao, AtribuicaoForm } from './AtribuicaoForm';

/**
 * O ponto clicado: pessoa, dia e turno. Se o turno já tinha tarefa, o clique
 * traz também a hora do pedaço livre, que o formulário mostra e deixa mudar (RN-12).
 */
export interface PontoDaAgenda {
  dia: string;
  turnoId: string;
  turnoNome: string;
  /** A pessoa da linha; `null` na linha "Sem ninguém". */
  participanteId: string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
}

interface NovaTarefaModalProps {
  semana: string;
  opcoes: OpcoesAtribuicao;
  ponto: PontoDaAgenda;
  onFechar: () => void;
}

/**
 * O formulário por cima do Gantt, já apontando para o ponto clicado (RF-26): o
 * dia e o turno vêm do clique e não se perguntam; a pessoa vem marcada e pode
 * ganhar companhia. É o mesmo formulário de `/producao/agenda/nova`, que continua de pé
 * para o celular e para quem estiver sem JavaScript.
 */
export function NovaTarefaModal({ semana, opcoes, ponto, onFechar }: NovaTarefaModalProps) {
  const inicial: Record<string, string> = {};
  if (ponto.participanteId) inicial.participantes = ponto.participanteId;
  if (ponto.horaInicio) inicial.hora_inicio = ponto.horaInicio;
  if (ponto.horaFim) inicial.hora_fim = ponto.horaFim;
  const quando = ponto.horaInicio ? `${ponto.horaInicio}–${ponto.horaFim ?? ''}` : turnoLabel(ponto.turnoNome).toLowerCase();

  return (
    <Modal titulo={`Lançar tarefa · ${nomeDia(ponto.dia)}, ${quando}`} posicao="centro" onFechar={onFechar}>
      <AtribuicaoForm semana={semana} opcoes={opcoes} fixos={{ dia: ponto.dia, turnoId: ponto.turnoId }} inicial={inicial} />
    </Modal>
  );
}
