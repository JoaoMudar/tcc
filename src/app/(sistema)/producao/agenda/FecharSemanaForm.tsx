'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { fecharSemanaAction } from './actions';

export function FecharSemanaForm({ semana }: { semana: string }) {
  const [state, formAction, pending] = useActionState(fecharSemanaAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="semana" value={semana} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" pending={pending} pendingLabel="Fechando…">
        Fechar a semana
      </Button>
    </form>
  );
}
