'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { updateInsumo } from './actions';

interface InsumoFormProps {
  insumo: { id: string; nome: string; categoria: string; unidadeMedida: string; ativo: boolean };
  categorias: readonly SelectOption[];
  unidades: readonly SelectOption[];
  podeEditar: boolean;
}

export function InsumoForm({ insumo, categorias, unidades, podeEditar }: InsumoFormProps) {
  const [state, formAction, pending] = useActionState(updateInsumo, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <input type="hidden" name="insumo_id" value={insumo.id} />
      {!insumo.ativo && (
        <span>
          <Pill tone="neutral">fora de uso</Pill>
        </span>
      )}
      <fieldset disabled={!podeEditar} className="flex flex-col gap-3">
        <TextField label="Nome" name="nome" defaultValue={insumo.nome} required />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Categoria" name="categoria" options={categorias} defaultValue={insumo.categoria} required />
          <SelectField label="Unidade" name="unidade_medida" options={unidades} defaultValue={insumo.unidadeMedida} required />
        </div>
      </fieldset>
      {podeEditar && (
        <>
          <label className="flex min-h-touch items-center gap-3 text-base font-semibold text-gray-700">
            <input type="checkbox" name="ativo" defaultChecked={insumo.ativo} className="size-6 accent-brand" />
            Em uso
          </label>
          {state.error && <Notice tone="error">{state.error}</Notice>}
          {state.success && <Notice tone="success">{state.success}</Notice>}
          <Button type="submit" variant="secondary" pending={pending}>
            Salvar
          </Button>
        </>
      )}
    </form>
  );
}
