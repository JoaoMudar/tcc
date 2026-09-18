'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { updateTurno } from '../actions';

interface TurnoFormProps {
  turno: { id: string; label: string; inicio: string; fim: string; ativo: boolean };
  podeEditar: boolean;
}

export function TurnoForm({ turno, podeEditar }: TurnoFormProps) {
  const [state, formAction, pending] = useActionState(updateTurno, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <input type="hidden" name="turno_id" value={turno.id} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">Turno da {turno.label.toLowerCase()}</h2>
        {!turno.ativo && <Pill tone="neutral">fora de uso</Pill>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Início" name="inicio" type="time" defaultValue={turno.inicio} disabled={!podeEditar} required />
        <TextField label="Fim" name="fim" type="time" defaultValue={turno.fim} disabled={!podeEditar} required />
      </div>
      {podeEditar && (
        <>
          <label className="flex min-h-touch items-center gap-3 text-base font-semibold text-gray-700">
            <input type="checkbox" name="ativo" defaultChecked={turno.ativo} className="size-6 accent-brand" />
            Em uso na agenda
          </label>
          {state.error && <Notice tone="error">{state.error}</Notice>}
          {state.success && <Notice tone="success">{state.success}</Notice>}
          <Button type="submit" pending={pending}>
            Salvar
          </Button>
        </>
      )}
    </form>
  );
}
