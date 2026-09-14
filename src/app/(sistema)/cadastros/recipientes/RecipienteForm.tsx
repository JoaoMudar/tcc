'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { updateRecipiente } from './actions';

interface RecipienteFormProps {
  recipiente: { id: string; nome: string; volumeLitros: number | null; ativo: boolean };
  podeEditar: boolean;
}

export function RecipienteForm({ recipiente, podeEditar }: RecipienteFormProps) {
  const [state, formAction, pending] = useActionState(updateRecipiente, EMPTY_FORM_STATE);
  const volume = recipiente.volumeLitros === null ? '' : String(recipiente.volumeLitros).replace('.', ',');

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <input type="hidden" name="recipiente_id" value={recipiente.id} />
      {!recipiente.ativo && (
        <span>
          <Pill tone="neutral">fora de uso</Pill>
        </span>
      )}
      <fieldset disabled={!podeEditar} className="grid grid-cols-[2fr_1fr] gap-3">
        <TextField label="Nome" name="nome" defaultValue={recipiente.nome} required />
        <TextField label="Volume (L)" name="volume" inputMode="decimal" defaultValue={volume} />
      </fieldset>
      {podeEditar && (
        <>
          <label className="flex min-h-touch items-center gap-3 text-base font-semibold text-gray-700">
            <input type="checkbox" name="ativo" defaultChecked={recipiente.ativo} className="size-6 accent-brand" />
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
