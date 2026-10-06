'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Toast } from '@/components/ui/Toast';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { mascaraDecimal3 } from '@/lib/recipientes';
import { createRecipiente } from './actions';

/** Volume ou peso na máscara de três casas, enquanto se digita. */
function CampoDecimal({ label, name, inicial, hint }: { label: string; name: string; inicial?: string; hint: string }) {
  const [valor, setValor] = useState(() => mascaraDecimal3(inicial ?? ''));
  return (
    <TextField
      label={label}
      name={name}
      inputMode="numeric"
      autoComplete="off"
      value={valor}
      onChange={(evento) => setValor(mascaraDecimal3(evento.target.value, valor))}
      hint={hint}
    />
  );
}

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
        <CampoDecimal label="Volume (L)" name="volume" inicial={fields?.volume} hint="Ex.: 2,800" />
        <CampoDecimal label="Peso cheio (kg)" name="peso" inicial={fields?.peso} hint="Com substrato e muda" />
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
