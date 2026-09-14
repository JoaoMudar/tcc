'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { abrirSemanaAction, copiarSemanaAction, publicarSemanaAction } from './actions';

const ACOES = {
  abrir: { action: abrirSemanaAction, label: 'Abrir semana', variant: 'outline' },
  copiar: { action: copiarSemanaAction, label: 'Copiar semana passada', variant: 'outline' },
  publicar: { action: publicarSemanaAction, label: 'Publicar', variant: 'primary' },
} as const;

/** Um botão da semana, com o aviso do que aconteceu logo abaixo (RNF-04). */
export function AcaoSemana({ acao, semana }: { acao: keyof typeof ACOES; semana: string }) {
  const { action, label, variant } = ACOES[acao];
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="semana" value={semana} />
      <Button type="submit" variant={variant} pending={pending} pendingLabel="Aguarde…">
        {label}
      </Button>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
    </form>
  );
}
