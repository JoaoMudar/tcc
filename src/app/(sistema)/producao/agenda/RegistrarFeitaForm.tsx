'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import type { SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import type { UnidadeTarefa } from '@/lib/agenda-rotulos';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { EscolhaMultipla } from './EscolhaMultipla';
import { PerdaNaConfirmacao } from './PerdaNaConfirmacao';
import { registrarTarefaFeitaAction } from './actions';

interface RegistrarFeitaFormProps {
  etapaId: string;
  loteId: string;
  tipoTarefaId: string;
  eQuantitativa: boolean;
  unidadeMedida: UnidadeTarefa;
  funcionarios: readonly SelectOption[];
  turnos: readonly SelectOption[];
  /** O turno que a etapa costuma usar; o resto começa em branco. */
  turnoId: string;
  hoje: string;
}

/**
 * RF-66: a etapa feita fora da agenda, registrada como tarefa já confirmada.
 * Dia, turno e quem fez são do lançamento; a quantidade de cada um e as mudas
 * que morreram são da confirmação (UC-20). A etapa, o lote e o tipo vêm prontos.
 */
export function RegistrarFeitaForm({
  etapaId,
  loteId,
  tipoTarefaId,
  eQuantitativa,
  unidadeMedida,
  funcionarios,
  turnos,
  turnoId,
  hoje,
}: RegistrarFeitaFormProps) {
  const [state, formAction, pending] = useActionState(registrarTarefaFeitaAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;
  const [quem, setQuem] = useState<string[]>((fields?.participantes ?? '').split(',').filter(Boolean));
  const marcados = new Set(quem);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="lote_etapa_id" value={etapaId} />
      <input type="hidden" name="lote_id" value={loteId} />
      <input type="hidden" name="tipo_tarefa_id" value={tipoTarefaId} />

      <TextField label="Dia em que foi feita" name="dias" type="date" max={hoje} defaultValue={fields?.dias || hoje} required />
      <EscolhaMultipla
        legenda="Turno"
        obrigatorio
        name="turno_id"
        tipo="radio"
        opcoes={turnos}
        marcados={new Set([fields?.turno_id ?? turnoId])}
      />
      <EscolhaMultipla legenda="Quem fez" obrigatorio name="participantes" opcoes={funcionarios} marcados={marcados} onChange={setQuem} />

      {eQuantitativa && quem.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold text-gray-700">Quanto cada um fez ({unidadeMedida})</legend>
          {funcionarios
            .filter((f) => marcados.has(f.value))
            .map((f) => (
              <TextField
                key={f.value}
                label={f.label}
                name={`quantidade_${f.value}`}
                inputMode={unidadeMedida === 'un' ? 'numeric' : 'decimal'}
                autoComplete="off"
                hint="Em branco se ninguém contou."
                defaultValue={fields?.[`quantidade_${f.value}`]}
              />
            ))}
        </fieldset>
      )}

      <PerdaNaConfirmacao perdidas={fields?.perdidas} causa={fields?.causa} />

      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" pending={pending}>
        Confirmar tarefa
      </Button>
    </form>
  );
}
