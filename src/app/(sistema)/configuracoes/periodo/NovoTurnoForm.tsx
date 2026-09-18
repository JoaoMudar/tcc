'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { createTurno } from '../actions';

export function NovoTurnoForm() {
  const [state, formAction, pending] = useActionState(createTurno, EMPTY_FORM_STATE);
  // Depois de criar, o formulário volta vazio; na recusa, mantém o que foi digitado
  const fields = state.error ? state.fields : undefined;

  return (
    <form
      key={state.success ?? 'novo'}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4"
    >
      <TextField label="Nome do turno" name="nome" defaultValue={fields?.nome} hint="Exemplo: noite" required />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Início" name="inicio" type="time" defaultValue={fields?.inicio} required />
        <TextField label="Fim" name="fim" type="time" defaultValue={fields?.fim} required />
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      <Button type="submit" variant="outline" pending={pending}>
        + Criar turno
      </Button>
    </form>
  );
}
