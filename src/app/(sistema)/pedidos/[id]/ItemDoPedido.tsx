'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { precoParaCampo } from '@/lib/pedidos-rotulos';
import { atualizarItemAction, removerItemAction } from '../actions';

interface ItemDoPedidoProps {
  pedidoId: string;
  itemId: string;
  quantidade: number;
  precoCentavos: number;
}

/** RF-55, RF-57: quantidade e preço mudam enquanto o pedido é rascunho. A recusa depois é do servidor. */
export function ItemDoPedido({ pedidoId, itemId, quantidade, precoCentavos }: ItemDoPedidoProps) {
  const [state, formAction, pending] = useActionState(atualizarItemAction, EMPTY_FORM_STATE);
  const [remocao, removerAction, removendo] = useActionState(removerItemAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="pedido_id" value={pedidoId} />
        <input type="hidden" name="item_id" value={itemId} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Quantidade"
            name="quantidade"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={fields?.quantidade ?? String(quantidade)}
            required
          />
          <TextField
            label="Preço por muda"
            name="preco"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={fields?.preco ?? precoParaCampo(precoCentavos)}
            required
          />
        </div>
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
