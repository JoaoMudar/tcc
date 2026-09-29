'use client';

import { useActionState } from 'react';
import { ConfirmacaoDupla } from '@/components/ui/ConfirmacaoDupla';
import { TextArea } from '@/components/ui/TextArea';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { cancelarPedidoAction } from '../actions';

/** T8.5: cancelar não volta atrás, e por isso pede dois toques. Fica no fim da ficha. */
export function CancelarPedido({ pedidoId }: { pedidoId: string }) {
  const [cancelamento, cancelar, cancelando] = useActionState(cancelarPedidoAction, EMPTY_FORM_STATE);
  return (
    <ConfirmacaoDupla
      rotuloBotao="Cancelar pedido"
      titulo="Cancelar o pedido?"
      rotuloConfirmar="Sim, cancelar o pedido"
      rotuloVoltar="Não, voltar ao pedido"
      action={cancelar}
      pendente={cancelando}
      erro={cancelamento.error}
    >
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <TextArea label="Motivo" name="motivo" rows={2} maxLength={500} />
    </ConfirmacaoDupla>
  );
}
