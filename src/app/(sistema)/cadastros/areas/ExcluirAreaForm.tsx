'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { deleteArea } from './actions';

/** Só aparece para área sem canteiro: a action recusa de novo se alguém criou um no meio tempo. */
export function ExcluirAreaForm({ areaId, letra }: { areaId: string; letra: string }) {
  const [state, formAction, pending] = useActionState(deleteArea, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="area_id" value={areaId} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" variant="secondary" pending={pending} pendingLabel="Excluindo…">
        Excluir área {letra}
      </Button>
    </form>
  );
}
