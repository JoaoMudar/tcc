'use client';

import { useActionState } from 'react';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { copiarSemanaAction } from './actions';

interface CopiarSemanaFormProps {
  semana: string;
  /** `menu` é o item do ⋯; `vazio` é o botão do estado vazio da semana. */
  estilo?: 'menu' | 'vazio';
}

const BOTAO = {
  menu: 'flex min-h-11 w-full items-center px-3 text-left text-sm text-ink hover:bg-surface disabled:text-muted',
  vazio:
    'inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white active:bg-brand-dark disabled:opacity-60',
};

/** T5.4, RF-27: copiar a semana passada, com o aviso do que aconteceu logo abaixo (RNF-04). A semana nasce aqui se ainda não existia. */
export function CopiarSemanaForm({ semana, estilo = 'menu' }: CopiarSemanaFormProps) {
  const [state, formAction, pending] = useActionState(copiarSemanaAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="semana" value={semana} />
      <button type="submit" disabled={pending} className={BOTAO[estilo]}>
        {pending ? 'Copiando…' : 'Copiar semana passada'}
      </button>
      {state.error && (
        <p role="alert" className="px-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="px-3 text-sm text-green-800">
          {state.success}
        </p>
      )}
    </form>
  );
}
