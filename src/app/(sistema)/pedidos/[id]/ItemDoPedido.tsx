'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { alturaParaCampo } from '@/lib/pedidos-rotulos';
import { atualizarItemAction, removerItemAction } from '../actions';

interface ItemDoPedidoProps {
  pedidoId: string;
  itemId: string;
  quantidade: number;
  alturaM: number | null;
}

/**
 * RF-57: a quantidade e a altura mudam enquanto o pedido é rascunho, e a recusa
 * depois é do servidor. **O preço não está aqui**: ele é digitado depois da
 * conferência, na `PrecosForm`.
 */
export function ItemDoPedido({ pedidoId, itemId, quantidade, alturaM }: ItemDoPedidoProps) {
  const [state, formAction, pending] = useActionState(atualizarItemAction, EMPTY_FORM_STATE);
  const [remocao, removerAction, removendo] = useActionState(removerItemAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="pedido_id" value={pedidoId} />
        <input type="hidden" name="item_id" value={itemId} />
        <TextField
          label="Quantidade"
          name="quantidade"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={fields?.quantidade ?? String(quantidade)}
          required
        />
        <TextField
          label="Altura em metros (opcional)"
          name="altura"
          inputMode="decimal"
          autoComplete="off"
          placeholder="1,20"
          defaultValue={fields?.altura ?? alturaParaCampo(alturaM)}
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
