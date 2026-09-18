'use client';

import { Modal } from '@/components/ui/Modal';
import { nomeDia } from '@/lib/semanas';
import { type OpcoesAtribuicao, AtribuicaoForm } from './AtribuicaoForm';

export interface PontoDaAgenda {
  dia: string;
  turnoId: string;
  horaInicio: string;
  horaFim: string;
}

interface NovaTarefaModalProps {
  semana: string;
  opcoes: OpcoesAtribuicao;
  ponto: PontoDaAgenda;
  onFechar: () => void;
}

/**
 * O formulário inteiro por cima da grade, já apontando para o lugar clicado
 * (RF-26). É o mesmo formulário de `/producao/agenda/nova`, que continua de pé
 * para o celular e para quem estiver sem JavaScript.
 */
export function NovaTarefaModal({ semana, opcoes, ponto, onFechar }: NovaTarefaModalProps) {
  return (
    <Modal titulo={`Lançar tarefa · ${nomeDia(ponto.dia)}, ${ponto.horaInicio}`} posicao="centro" onFechar={onFechar}>
      <AtribuicaoForm
        semana={semana}
        opcoes={opcoes}
        inicial={{
          dias: ponto.dia,
          turno_id: ponto.turnoId,
          hora_inicio: ponto.horaInicio,
          hora_fim: ponto.horaFim,
        }}
      />
    </Modal>
  );
}
