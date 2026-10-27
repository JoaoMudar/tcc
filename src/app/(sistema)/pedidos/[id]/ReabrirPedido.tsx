'use client';

import { useActionState } from 'react';
import { ConfirmacaoDupla } from '@/components/ui/ConfirmacaoDupla';
import { TextArea } from '@/components/ui/TextArea';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { reabrirPedidoAction } from '../actions';

/**
 * RN-52: o aprovado volta ao orçamento só por aqui, com motivo. Dois toques,
 * como o cancelamento: as cargas montadas são desfeitas.
 */
export function ReabrirPedido({ pedidoId }: { pedidoId: string }) {
  const [reabertura, reabrir, reabrindo] = useActionState(reabrirPedidoAction, EMPTY_FORM_STATE);
  return (
    <ConfirmacaoDupla
      rotuloBotao="Reabrir pedido"
      titulo="Reabrir o pedido? Ele volta ao orçamento, e as cargas montadas são desfeitas."
      rotuloConfirmar="Sim, reabrir o pedido"
      rotuloVoltar="Não, voltar ao pedido"
      action={reabrir}
      pendente={reabrindo}
      erro={reabertura.error}
    >
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <TextArea label="Motivo" name="motivo" rows={2} maxLength={500} required />
    </ConfirmacaoDupla>
  );
}
