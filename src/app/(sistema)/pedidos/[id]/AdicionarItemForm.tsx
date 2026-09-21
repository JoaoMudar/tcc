'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Notice } from '@/components/ui/Notice';
import type { SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { adicionarItemAction } from '../actions';

interface AdicionarItemFormProps {
  pedidoId: string;
  especies: readonly SelectOption[];
  recipientes: readonly SelectOption[];
}

/**
 * RF-54: um item a mais no pedido em rascunho. Os campos têm os mesmos nomes da
 * tela de pedido novo (`item_*`), e é por isso que a mesma leitura no servidor
 * atende as duas.
 */
export function AdicionarItemForm({ pedidoId, especies, recipientes }: AdicionarItemFormProps) {
  const [state, formAction, pending] = useActionState(adicionarItemAction, EMPTY_FORM_STATE);
  const [especieId, setEspecieId] = useState('');
  const [recipienteId, setRecipienteId] = useState('');

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Acrescentar item</h2>
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <ComboboxField label="Espécie" name="item_especie" options={especies} value={especieId} onChange={setEspecieId} />
      <ComboboxField
        label="Recipiente"
        name="item_recipiente"
        options={recipientes}
        value={recipienteId}
        onChange={setRecipienteId}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Quantidade" name="item_quantidade" inputMode="numeric" autoComplete="off" required />
        <TextField label="Preço por muda" name="item_preco" inputMode="decimal" autoComplete="off" placeholder="12,50" required />
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      <Button type="submit" variant="outline" pending={pending}>
        Acrescentar
      </Button>
    </form>
  );
}
