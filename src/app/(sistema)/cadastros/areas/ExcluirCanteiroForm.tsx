'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { deleteCanteiro } from './actions';

/** Escolher na lista e confirmar no botão: um × em cada número seria alvo de toque pequeno demais (RNF-03). */
export function ExcluirCanteiroForm({ canteiros }: { canteiros: readonly { id: string; numero: number }[] }) {
  const [state, formAction, pending] = useActionState(deleteCanteiro, EMPTY_FORM_STATE);

  return (
    <details className="rounded-lg border border-line px-3">
      <summary className="flex min-h-touch cursor-pointer items-center text-base font-semibold text-gray-700">
        Excluir canteiro
      </summary>
      <form action={formAction} className="flex flex-col gap-3 pb-3">
        <SelectField
          label="Canteiro"
          name="canteiro_id"
          options={canteiros.map((c) => ({ value: c.id, label: `Canteiro ${c.numero}` }))}
          required
        />
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.success && <Notice tone="success">{state.success}</Notice>}
        <Button type="submit" variant="secondary" pending={pending} pendingLabel="Excluindo…">
          Excluir
        </Button>
      </form>
    </details>
  );
}
