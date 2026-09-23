'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { concluirVerificacaoAction } from './actions';

interface AcoesVerificacaoProps {
  pedidoId: string;
  /** Falta responder quantos itens de topo. Zero libera o envio. */
  pendentes: number;
}

/**
 * T8.12: o rodapé da conferência.
 *
 * **Não há botão de abrir.** Abrir a conferência continua sendo gesto de
 * pessoa, e não efeito de montar a tela, mas o gesto é a primeira resposta:
 * quem toca "Tem tudo" já começou a conferir, e o servidor abre junto com a
 * gravação (`abrirOuExigirVerificacao`).
 */
export function AcoesVerificacao({ pedidoId, pendentes }: AcoesVerificacaoProps) {
  const [conclusao, concluir, concluindo] = useActionState(concluirVerificacaoAction, EMPTY_FORM_STATE);

  return (
    <form action={concluir} className="flex flex-col gap-2">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      {conclusao.error && <Notice tone="error">{conclusao.error}</Notice>}
      {pendentes > 0 ? (
        <Notice tone="info">
          {pendentes === 1
            ? 'Falta um item para responder antes de enviar.'
            : `Faltam ${pendentes} itens para responder antes de enviar.`}
        </Notice>
      ) : (
        <Button type="submit" pending={concluindo} pendingLabel="Enviando…">
          Enviar
        </Button>
      )}
    </form>
  );
}
