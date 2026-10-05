'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { Toast } from '@/components/ui/Toast';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatAltura, mascaraAltura } from '@/lib/pedidos-rotulos';
import { alterarAlturaAction } from '../actions';

/**
 * RF-65: a altura da muda do lote, medida na trena. É ela que o item de pedido
 * compara com a altura pedida (RN-06, RN-62). Guarda só a última medida, e o
 * campo vazio apaga.
 */
export function AlturaForm({ loteId, alturaM }: { loteId: string; alturaM: number | null }) {
  const [state, formAction, pending] = useActionState(alterarAlturaAction, EMPTY_FORM_STATE);
  const [altura, setAltura] = useState(formatAltura(alturaM));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lote_id" value={loteId} />
      <TextField
        label="Altura em metros"
        name="altura"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0,00 m"
        value={altura}
        onChange={(evento) => setAltura(mascaraAltura(evento.target.value, altura))}
      />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && (
        <Toast tone="success" limpar={[]} gatilho={state}>
          {state.success}
        </Toast>
      )}
      <Button type="submit" variant="outline" pending={pending}>
        Registrar altura
      </Button>
    </form>
  );
}
