'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { createArea } from './actions';

export function NovaAreaForm() {
  const [state, formAction, pending] = useActionState(createArea, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;

  return (
    <form
      key={state.success ?? 'nova'}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4"
    >
      <div className="grid grid-cols-[1fr_3fr] gap-3">
        <TextField label="Letra" name="letra" maxLength={1} autoCapitalize="characters" defaultValue={fields?.letra} required />
        <TextField label="Nome (opcional)" name="nome" defaultValue={fields?.nome} hint="Exemplo: Sombrite" />
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      <Button type="submit" variant="outline" pending={pending}>
        + Criar área
      </Button>
    </form>
  );
}
