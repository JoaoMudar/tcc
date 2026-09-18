'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { createInsumo } from './actions';

interface NovoInsumoFormProps {
  categorias: readonly SelectOption[];
  unidades: readonly SelectOption[];
}

export function NovoInsumoForm({ categorias, unidades }: NovoInsumoFormProps) {
  const [state, formAction, pending] = useActionState(createInsumo, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;

  return (
    <form
      key={state.success ?? 'novo'}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4"
    >
      <TextField label="Nome" name="nome" defaultValue={fields?.nome} hint="Exemplo: Substrato casca de pinus" required />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Categoria" name="categoria" options={categorias} defaultValue={fields?.categoria} required />
        <SelectField label="Unidade" name="unidade_medida" options={unidades} defaultValue={fields?.unidade_medida} required />
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      <Button type="submit" variant="outline" pending={pending}>
        + Criar insumo
      </Button>
    </form>
  );
}
