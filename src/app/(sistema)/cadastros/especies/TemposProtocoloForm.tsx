'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import type { TipoAgendamento } from '@/lib/protocolo-rotulos';
import { saveTempoEspecie } from '../protocolos/actions';

interface TempoProps {
  especieId: string;
  tempo: {
    protocoloEtapaId: string;
    protocolo: string;
    recipiente: string;
    rotulo: string;
    tipoAgendamento: TipoAgendamento;
    diasPadrao: number;
    intervaloPadrao: number | null;
    dias: number | null;
    intervaloDias: number | null;
    observacoes: string | null;
  };
  podeEditar: boolean;
}

/** UC-18: uma etapa, com o tempo do protocolo ao lado do que a espécie sobrescreve. */
export function TempoProtocoloForm({ especieId, tempo, podeEditar }: TempoProps) {
  const [state, formAction, pending] = useActionState(saveTempoEspecie, EMPTY_FORM_STATE);
  const proprio = tempo.dias !== null || tempo.intervaloDias !== null;
  const recorrente = tempo.tipoAgendamento === 'recorrente';

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <input type="hidden" name="especie_id" value={especieId} />
      <input type="hidden" name="protocolo_etapa_id" value={tempo.protocoloEtapaId} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{tempo.rotulo}</p>
          <p className="text-sm text-muted">{tempo.recipiente}</p>
        </div>
        {proprio && <Pill tone="blue">tempo próprio</Pill>}
      </div>

      <fieldset disabled={!podeEditar} className="grid grid-cols-2 gap-3">
        <TextField
          label="Prazo (dias)"
          name="dias"
          inputMode="numeric"
          defaultValue={tempo.dias === null ? '' : String(tempo.dias)}
          hint={`Protocolo: ${tempo.diasPadrao}`}
        />
        {recorrente && (
          <TextField
            label="Repete a cada"
            name="intervalo_dias"
            inputMode="numeric"
            defaultValue={tempo.intervaloDias === null ? '' : String(tempo.intervaloDias)}
            hint={`Protocolo: ${tempo.intervaloPadrao}`}
          />
        )}
      </fieldset>

      {podeEditar && (
        <>
          <TextField
            label="Por que difere"
            name="observacoes"
            maxLength={500}
            defaultValue={tempo.observacoes ?? ''}
          />
          {state.error && <Notice tone="error">{state.error}</Notice>}
          {state.success && <Notice tone="success">{state.success}</Notice>}
          <Button type="submit" variant="secondary" pending={pending}>
            {proprio ? 'Salvar tempo' : 'Usar tempo próprio'}
          </Button>
          <p className="text-sm text-muted">Em branco nos dois campos, volta a valer o tempo do protocolo.</p>
        </>
      )}
    </form>
  );
}
