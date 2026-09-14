'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { PERFIL_OPTIONS } from '@/lib/perfis';
import { PessoaSelect } from '../PessoaSelect';
import { createUser } from '../actions';

export function CreateUserForm({ pessoas }: { pessoas: readonly { id: string; nome: string }[] }) {
  const [state, formAction, pending] = useActionState(createUser, EMPTY_FORM_STATE);
  const fields = state.fields ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField label="Nome" name="nome_exibicao" defaultValue={fields.nome_exibicao} required />
      <TextField
        label="Usuário para entrar"
        name="login"
        defaultValue={fields.login}
        hint="Letras minúsculas, sem espaço nem acento. Ex.: debora"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <SelectField label="Perfil" name="perfil" options={PERFIL_OPTIONS} defaultValue={fields.perfil} required />
      <TextField
        label="Senha provisória"
        name="senha_provisoria"
        type="text"
        autoComplete="off"
        hint="Passe para a pessoa. Ela troca no primeiro acesso."
        required
      />
      <PessoaSelect pessoas={pessoas} defaultValue={fields.pessoa_id} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" pending={pending}>
        Criar usuário
      </Button>
    </form>
  );
}
