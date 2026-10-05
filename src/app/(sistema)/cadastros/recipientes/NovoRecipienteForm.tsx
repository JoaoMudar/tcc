'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Toast } from '@/components/ui/Toast';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { createRecipiente } from './actions';

export function NovoRecipienteForm() {
  const [state, formAction, pending] = useActionState(createRecipiente, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;

  return (
    <form
      key={state.success ?? 'novo'}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Nome" name="nome" defaultValue={fields?.nome} hint="Exemplo: Saco 17x22" required className="col-span-2" />
        <TextField label="Volume (L)" name="volume" inputMode="decimal" defaultValue={fields?.volume} hint="Ex.: 2,8" />
        <TextField
          label="Peso cheio (kg)"
          name="peso"
          inputMode="decimal"
          defaultValue={fields?.peso}
          hint="Com substrato e muda"
        />
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && (
        <Toast tone="success" limpar={[]} gatilho={state}>
          {state.success}
        </Toast>
      )}
      <Button type="submit" variant="outline" pending={pending}>
        + Criar recipiente
      </Button>
    </form>
  );
}
