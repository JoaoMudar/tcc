'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { copiarSemanaAction } from './actions';

/** T5.4, RF-27: o botão, com o aviso do que aconteceu logo abaixo (RNF-04). A semana nasce aqui se ainda não existia. */
export function CopiarSemanaForm({ semana }: { semana: string }) {
  const [state, formAction, pending] = useActionState(copiarSemanaAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="semana" value={semana} />
      <Button type="submit" variant="outline" pending={pending} pendingLabel="Aguarde…">
        Copiar semana passada
      </Button>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
    </form>
  );
}
