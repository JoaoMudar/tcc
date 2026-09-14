'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { changePassword } from './actions';

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField label="Senha atual" name="senha_atual" type="password" autoComplete="current-password" required />
      <TextField
        label="Nova senha"
        name="nova_senha"
        type="password"
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres. Não use a data de nascimento."
        required
      />
      <TextField label="Repetir nova senha" name="repetir_senha" type="password" autoComplete="new-password" required />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" pending={pending}>
        Salvar e entrar
      </Button>
    </form>
  );
}
