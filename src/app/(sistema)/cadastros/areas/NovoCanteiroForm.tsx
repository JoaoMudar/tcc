'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { createCanteiro } from './actions';

export function NovoCanteiroForm({ areaId, letra }: { areaId: string; letra: string }) {
  const [state, formAction, pending] = useActionState(createCanteiro, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;

  return (
    <form key={state.success ?? 'novo'} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="area_id" value={areaId} />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={`Novo canteiro na área ${letra}`}
          name="numero"
          inputMode="numeric"
          defaultValue={fields?.numero}
          error={state.error}
          required
        />
        <TextField label="Capacidade (mudas)" name="capacidade" inputMode="numeric" defaultValue={fields?.capacidade} />
      </div>
      {state.success && <Notice tone="success">{state.success}</Notice>}
      <Button type="submit" variant="outline" pending={pending}>
        Adicionar canteiro
      </Button>
    </form>
  );
}
