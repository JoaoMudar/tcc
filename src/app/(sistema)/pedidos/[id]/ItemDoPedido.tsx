'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Notice } from '@/components/ui/Notice';
import type { SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatAltura, normalizaCampoAltura } from '@/lib/pedidos-rotulos';
import { atualizarItemAction, removerItemAction } from '../actions';

interface ItemDoPedidoProps {
  pedidoId: string;
  itemId: string;
  /** Nula enquanto o cliente não disse quantas. */
  quantidade: number | null;
  alturaM: number | null;
  /** Nulo enquanto o cliente não disse o tamanho. */
  recipienteId: string | null;
  recipientes: readonly SelectOption[];
}

/**
 * RF-57: recipiente, quantidade e altura mudam enquanto o pedido é orçamento, e
 * a recusa depois é do servidor. É aqui que a chefia completa o que o cliente
 * disse depois. **O preço não está aqui**: ele é negociado depois da
 * conferência, na `PrecosForm`.
 */
export function ItemDoPedido({ pedidoId, itemId, quantidade, alturaM, recipienteId, recipientes }: ItemDoPedidoProps) {
  const [state, formAction, pending] = useActionState(atualizarItemAction, EMPTY_FORM_STATE);
  const [remocao, removerAction, removendo] = useActionState(removerItemAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;
  const [recipiente, setRecipiente] = useState(recipienteId ?? '');

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="pedido_id" value={pedidoId} />
        <input type="hidden" name="item_id" value={itemId} />
        <ComboboxField
          label="Recipiente (opcional)"
          name="recipiente"
          options={recipientes}
          value={recipiente}
          onChange={setRecipiente}
        />
        <TextField
          label="Quantidade (opcional)"
          name="quantidade"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={fields?.quantidade ?? (quantidade === null ? '' : String(quantidade))}
          hint="Em branco, a conferência diz quantas tem"
        />
        <TextField
          label="Altura em metros (opcional)"
          name="altura"
          inputMode="decimal"
          autoComplete="off"
          placeholder="1,20 ou 120"
          defaultValue={fields?.altura ?? formatAltura(alturaM)}
          onBlur={(evento) => {
            evento.currentTarget.value = normalizaCampoAltura(evento.currentTarget.value);
          }}
        />
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.success && <Notice tone="success">{state.success}</Notice>}
        <Button type="submit" variant="outline" pending={pending}>
          Salvar item
        </Button>
      </form>

      <form action={removerAction}>
        <input type="hidden" name="pedido_id" value={pedidoId} />
        <input type="hidden" name="item_id" value={itemId} />
        {remocao.error && <Notice tone="error">{remocao.error}</Notice>}
        <Button type="submit" variant="secondary" pending={removendo} pendingLabel="Removendo…">
          Remover item
        </Button>
      </form>
    </div>
  );
}
