'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { PERFIL_OPTIONS, type Perfil } from '@/lib/perfis';
import { PessoaSelect } from '../PessoaSelect';
import { updateUser } from '../actions';

interface EditUserFormProps {
  usuario: { id: string; nomeExibicao: string; perfil: Perfil; ativo: boolean; pessoaId: string | null };
  pessoas: readonly { id: string; nome: string }[];
}

export function EditUserForm({ usuario, pessoas }: EditUserFormProps) {
  const [state, formAction, pending] = useActionState(updateUser, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="usuario_id" value={usuario.id} />
      <TextField label="Nome" name="nome_exibicao" defaultValue={usuario.nomeExibicao} required />
      <SelectField label="Perfil" name="perfil" options={PERFIL_OPTIONS} defaultValue={usuario.perfil} required />
      <PessoaSelect pessoas={pessoas} defaultValue={usuario.pessoaId} />
      <label className="flex min-h-touch items-center gap-3 text-base font-semibold text-gray-700">
        <input type="checkbox" name="ativo" defaultChecked={usuario.ativo} className="size-6 accent-brand" />
        Ativo (pode entrar no sistema)
      </label>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      <Button type="submit" pending={pending}>
        Salvar alterações
      </Button>
    </form>
  );
}
