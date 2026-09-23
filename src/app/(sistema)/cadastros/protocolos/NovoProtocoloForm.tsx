'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { saveProtocolo } from './actions';

export function NovoProtocoloForm({ recipientes }: { recipientes: readonly SelectOption[] }) {
  const [state, formAction, pending] = useActionState(saveProtocolo, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <SelectField
        label="Recipiente"
        name="recipiente_id"
        options={recipientes}
        defaultValue={fields?.recipiente_id}
        required
      />
      <TextField
        label="Nome"
        name="nome"
        defaultValue={fields?.nome}
        hint="Exemplo: Protocolo do tubete"
        required
      />
      <TextField label="Observação" name="observacoes" maxLength={500} defaultValue={fields?.observacoes} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" variant="outline" pending={pending}>
        + Criar protocolo
      </Button>
    </form>
  );
}
