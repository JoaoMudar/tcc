'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import type { SituacaoPedido } from '@/lib/pedidos-rotulos';
import { cancelarPedidoAction, confirmarPedidoAction } from '../actions';

interface SituacaoFormsProps {
  pedidoId: string;
  situacao: SituacaoPedido;
}

/**
 * T8.3, RF-57: confirmar e cancelar. Quem confirma é avisado do que o ato faz,
 * porque depois dele o item não muda mais, e a tela não tem como desfazer.
 */
export function SituacaoForms({ pedidoId, situacao }: SituacaoFormsProps) {
  const [confirmacao, confirmarAction, confirmando] = useActionState(confirmarPedidoAction, EMPTY_FORM_STATE);
  const [cancelamento, cancelarAction, cancelando] = useActionState(cancelarPedidoAction, EMPTY_FORM_STATE);

  return (
    <div className="flex flex-col gap-3">
      {situacao === 'rascunho' && (
        <form action={confirmarAction} className="flex flex-col gap-2">
          <input type="hidden" name="pedido_id" value={pedidoId} />
          <p className="text-sm text-muted">Depois de confirmado, o item do pedido não muda mais.</p>
          {confirmacao.error && <Notice tone="error">{confirmacao.error}</Notice>}
          {confirmacao.success && <Notice tone="success">{confirmacao.success}</Notice>}
          <Button type="submit" pending={confirmando} pendingLabel="Confirmando…">
            Confirmar pedido
          </Button>
        </form>
      )}

      <form action={cancelarAction} className="flex flex-col gap-2">
        <input type="hidden" name="pedido_id" value={pedidoId} />
        {cancelamento.error && <Notice tone="error">{cancelamento.error}</Notice>}
        {cancelamento.success && <Notice tone="success">{cancelamento.success}</Notice>}
        <Button type="submit" variant="secondary" pending={cancelando} pendingLabel="Cancelando…">
          Cancelar pedido
        </Button>
      </form>
    </div>
  );
}
