'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Toast } from '@/components/ui/Toast';
import { Pill } from '@/components/ui/Pill';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { updateRecipiente } from './actions';

interface RecipienteFormProps {
  recipiente: { id: string; nome: string; volumeLitros: number | null; pesoKg: number | null; ativo: boolean };
  podeEditar: boolean;
}

export function RecipienteForm({ recipiente, podeEditar }: RecipienteFormProps) {
  const [state, formAction, pending] = useActionState(updateRecipiente, EMPTY_FORM_STATE);
  const volume = recipiente.volumeLitros === null ? '' : String(recipiente.volumeLitros).replace('.', ',');
  const peso = recipiente.pesoKg === null ? '' : String(recipiente.pesoKg).replace('.', ',');

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <input type="hidden" name="recipiente_id" value={recipiente.id} />
      {!recipiente.ativo && (
        <span>
          <Pill tone="neutral">fora de uso</Pill>
        </span>
      )}
      <fieldset disabled={!podeEditar} className="grid grid-cols-2 gap-3">
        <TextField label="Nome" name="nome" defaultValue={recipiente.nome} required className="col-span-2" />
        <TextField label="Volume (L)" name="volume" inputMode="decimal" defaultValue={volume} />
        <TextField label="Peso cheio (kg)" name="peso" inputMode="decimal" defaultValue={peso} />
      </fieldset>
      {podeEditar && (
        <>
          <label className="flex min-h-touch items-center gap-3 text-base font-semibold text-gray-700">
            <input type="checkbox" name="ativo" defaultChecked={recipiente.ativo} className="size-6 accent-brand" />
            Em uso
          </label>
          {state.error && <Notice tone="error">{state.error}</Notice>}
          {state.success && (
            <Toast tone="success" limpar={[]} gatilho={state}>
              {state.success}
            </Toast>
          )}
          <Button type="submit" variant="secondary" pending={pending}>
            Salvar
          </Button>
        </>
      )}
    </form>
  );
}
