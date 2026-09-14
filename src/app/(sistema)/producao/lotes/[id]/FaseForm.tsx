'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { FASES, FASES_EDITAVEIS, type Fase } from '@/lib/lotes-rotulos';
import { alterarFaseAction } from '../actions';

const OPCOES = FASES_EDITAVEIS.map((fase) => ({ value: fase, label: FASES[fase] }));

/** T4.9: provisório. Quando o protocolo existir, a fase avança sozinha ao concluir a etapa (T6.7). */
export function FaseForm({ loteId, fase }: { loteId: string; fase: Fase }) {
  const [state, formAction, pending] = useActionState(alterarFaseAction, EMPTY_FORM_STATE);

  return (
    <form key={fase} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lote_id" value={loteId} />
      <SelectField label="Fase do lote" name="fase" options={OPCOES} defaultValue={fase} required />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      <Button type="submit" variant="outline" pending={pending}>
        Alterar fase
      </Button>
    </form>
  );
}
