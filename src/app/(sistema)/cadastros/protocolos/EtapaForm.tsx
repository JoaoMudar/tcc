'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { TIPOS_AGENDAMENTO, TIPOS_ANCORA, type TipoAgendamento, type TipoAncora } from '@/lib/protocolo-rotulos';
import { saveEtapa } from './actions';

interface EtapaFormProps {
  protocoloId: string;
  etapa?: {
    id: string;
    tipoTarefaId: string;
    rotulo: string;
    tipoAgendamento: TipoAgendamento;
    tipoAncora: TipoAncora;
    etapaAncoraId: string | null;
    dias: number;
    intervaloDias: number | null;
    turnoId: string;
    alertaLigado: boolean;
    janelaAvisoPct: number | null;
    faseResultante: string | null;
    ativo: boolean;
  };
  opcoes: {
    tipos: readonly SelectOption[];
    turnos: readonly SelectOption[];
    ancoras: readonly SelectOption[];
    fases: readonly SelectOption[];
  };
  podeEditar: boolean;
}

const AGENDAMENTOS = Object.entries(TIPOS_AGENDAMENTO).map(([value, label]) => ({ value, label }));
const ANCORAS = Object.entries(TIPOS_ANCORA).map(([value, label]) => ({ value, label }));

export function EtapaForm({ protocoloId, etapa, opcoes, podeEditar }: EtapaFormProps) {
  const [state, formAction, pending] = useActionState(saveEtapa, EMPTY_FORM_STATE);
  const [agendamento, setAgendamento] = useState<string>(etapa?.tipoAgendamento ?? 'sequencial');
  const [ancora, setAncora] = useState<string>(etapa?.tipoAncora ?? 'criacao_do_lote');
  const fields = state.error ? state.fields : undefined;

  const recorrente = agendamento === 'recorrente';
  const ancoraEmEtapa = ancora === 'conclusao_de_etapa';
  // A etapa não pode ancorar em si mesma: a lista já não a oferece (FE-1)
  const ancorasPossiveis = opcoes.ancoras.filter((opcao) => opcao.value !== etapa?.id);

  return (
    <form
      key={state.success ?? (etapa?.id ?? 'nova')}
      action={formAction}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="protocolo_id" value={protocoloId} />
      {etapa && <input type="hidden" name="etapa_id" value={etapa.id} />}

      <fieldset disabled={!podeEditar} className="flex flex-col gap-3">
        <SelectField
          label="Tarefa do catálogo"
          name="tipo_tarefa_id"
          options={opcoes.tipos}
          defaultValue={fields?.tipo_tarefa_id ?? etapa?.tipoTarefaId}
          required
        />
        <TextField
          label="Rótulo"
          name="rotulo"
          defaultValue={fields?.rotulo ?? etapa?.rotulo}
          hint="Como esta etapa aparece na ficha do lote"
          required
        />

        <SelectField
          label="Acontece"
          name="tipo_agendamento"
          options={AGENDAMENTOS}
          value={agendamento}
          onChange={(event) => setAgendamento(event.currentTarget.value)}
          required
        />

        <SelectField
          label="Conta a partir de"
          name="tipo_ancora"
          options={ANCORAS}
          value={ancora}
          onChange={(event) => setAncora(event.currentTarget.value)}
          required
        />
        {ancoraEmEtapa &&
          (ancorasPossiveis.length === 0 ? (
            <Notice tone="warning">
              Não há outra etapa para ancorar. A primeira etapa do protocolo conta da criação do lote.
            </Notice>
          ) : (
            <SelectField
              label="Etapa que inicia a contagem"
              name="etapa_ancora_id"
              options={ancorasPossiveis}
              defaultValue={fields?.etapa_ancora_id ?? etapa?.etapaAncoraId ?? undefined}
              required
            />
          ))}

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Prazo (dias)"
            name="dias"
            inputMode="numeric"
            defaultValue={fields?.dias ?? (etapa ? String(etapa.dias) : '')}
            hint="Depois da âncora"
            required
          />
          {recorrente && (
            <TextField
              label="Repete a cada (dias)"
              name="intervalo_dias"
              inputMode="numeric"
              defaultValue={fields?.intervalo_dias ?? (etapa?.intervaloDias ? String(etapa.intervaloDias) : '')}
              hint="Da execução real"
              required
            />
          )}
        </div>

        <SelectField
          label="Turno"
          name="turno_id"
          options={opcoes.turnos}
          defaultValue={fields?.turno_id ?? etapa?.turnoId}
          required
        />

        {!recorrente && (
          <SelectField
            label="Fase que a conclusão grava"
            name="fase_resultante"
            options={opcoes.fases}
            placeholder="Não altera a fase"
            defaultValue={fields?.fase_resultante ?? etapa?.faseResultante ?? undefined}
          />
        )}

        <label className="flex min-h-touch items-center justify-between gap-3 rounded-xl border border-line px-4 text-base text-ink">
          Avisa quando atrasa
          <input
            type="checkbox"
            name="alerta_ligado"
            defaultChecked={etapa?.alertaLigado ?? true}
            className="size-6 accent-brand"
          />
        </label>
        <TextField
          label="Janela de aviso (%)"
          name="janela_aviso_pct"
          inputMode="decimal"
          defaultValue={fields?.janela_aviso_pct ?? (etapa?.janelaAvisoPct !== null && etapa !== undefined ? String(etapa.janelaAvisoPct) : '')}
          hint="Vazio usa o padrão de Configurações"
        />

        {etapa && podeEditar && (
          <label className="flex min-h-touch items-center gap-3 text-base font-semibold text-gray-700">
            <input type="checkbox" name="ativo" defaultChecked={etapa.ativo} className="size-6 accent-brand" />
            Em uso
          </label>
        )}
      </fieldset>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      {podeEditar && (
        <Button type="submit" variant={etapa ? 'secondary' : 'outline'} pending={pending}>
          {etapa ? 'Salvar etapa' : '+ Acrescentar etapa'}
        </Button>
      )}
    </form>
  );
}
