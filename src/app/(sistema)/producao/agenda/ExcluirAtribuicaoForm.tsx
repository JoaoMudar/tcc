'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { excluirAtribuicaoAction } from './actions';

/** Só a tarefa ainda planejada sai da agenda; a confirmada é registro. */
export function ExcluirAtribuicaoForm({ atribuicaoId }: { atribuicaoId: string }) {
  const [state, formAction, pending] = useActionState(excluirAtribuicaoAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={atribuicaoId} />
      <Button type="submit" variant="secondary" pending={pending} pendingLabel="Excluindo…">
        Excluir tarefa
      </Button>
      {state.error && <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}
