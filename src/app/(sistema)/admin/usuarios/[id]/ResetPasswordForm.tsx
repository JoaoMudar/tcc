'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { resetPassword } from '../actions';

export function ResetPasswordForm({ usuarioId }: { usuarioId: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="usuario_id" value={usuarioId} />
      <TextField
        label="Nova senha provisória"
        name="senha_provisoria"
        type="text"
        autoComplete="off"
        hint="Para quem esqueceu a senha. A pessoa troca na próxima entrada e sai dos outros aparelhos."
        required
      />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      <Button type="submit" variant="secondary" pending={pending}>
        Definir senha provisória
      </Button>
    </form>
  );
}
