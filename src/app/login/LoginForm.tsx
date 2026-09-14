'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { login } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <TextField
        label="Usuário"
        name="login"
        defaultValue={state.fields?.login}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <TextField label="Senha" name="senha" type="password" autoComplete="current-password" required />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" pending={pending} pendingLabel="Entrando…">
        Entrar
      </Button>
    </form>
  );
}
