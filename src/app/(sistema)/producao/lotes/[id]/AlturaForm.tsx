'use client';

import { useState } from 'react';
import { useRegistroCampo } from '@/components/useRegistroCampo';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { Toast } from '@/components/ui/Toast';
import { formatAltura, mascaraAltura, normalizaCampoAltura } from '@/lib/pedidos-rotulos';

/**
 * RF-31: a altura da muda do lote, medida na trena. É ela que o item de pedido
 * compara com a altura pedida (RN-10, RN-11). Guarda só a última medida, e o
 * campo vazio apaga. Sem rede, fica no aparelho e vai depois (RNF-04).
 */
export function AlturaForm({ loteId, alturaM }: { loteId: string; alturaM: number | null }) {
  const [state, formAction, pending] = useRegistroCampo('altura', { rotulo: (campos) => `Altura ${campos.altura ?? ''}` });
  const [altura, setAltura] = useState(formatAltura(alturaM));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lote_id" value={loteId} />
      <TextField
        label="Altura em metros"
        name="altura"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00 m"
        value={altura}
        onChange={(evento) => setAltura(mascaraAltura(evento.target.value))}
        onBlur={() => setAltura(normalizaCampoAltura(altura))}
      />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.guardado && <Notice tone="warning">{state.guardado}</Notice>}
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
