'use client';

import { Fragment, useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmacaoDupla } from '@/components/ui/ConfirmacaoDupla';
import { Notice } from '@/components/ui/Notice';
import { TextArea } from '@/components/ui/TextArea';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { type SituacaoPedido, transicoesDe } from '@/lib/pedidos-rotulos';
import type { Perfil } from '@/lib/perfis';
import { cancelarPedidoAction, confirmarPedidoAction, transicionarPedidoAction } from '../actions';

interface SituacaoFormsProps {
  pedidoId: string;
  situacao: SituacaoPedido;
  perfil: Perfil;
}

/**
 * T8.6, RN-53: os botões são o que `transicoesDe` devolve para este perfil nesta
 * situação, e nada mais. A gerência vê iniciar verificação e separar; aprovar e
 * cancelar só aparecem para a chefia.
 *
 * **Esconder o botão é usabilidade, não é a trava** (D4 §4): o servidor confere
 * a mesma tabela a cada envio, e é lá que o formulário reenviado para.
 */
export function SituacaoForms({ pedidoId, situacao, perfil }: SituacaoFormsProps) {
  const [transicao, transicionar, transicionando] = useActionState(transicionarPedidoAction, EMPTY_FORM_STATE);
  const [confirmacao, confirmar, confirmando] = useActionState(confirmarPedidoAction, EMPTY_FORM_STATE);
  const [cancelamento, cancelar, cancelando] = useActionState(cancelarPedidoAction, EMPTY_FORM_STATE);

  const disponiveis = transicoesDe(situacao, perfil);
  if (disponiveis.length === 0) return null;

  // Aprovar tem porta própria, que confere se há item antes de travar o pedido
  const porta = (para: SituacaoPedido) =>
    para === 'aprovado'
      ? { acao: confirmar, pendente: confirmando, variant: 'primary' as const }
      : { acao: transicionar, pendente: transicionando, variant: 'outline' as const };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Andamento</h2>
      {[transicao, confirmacao].map((estado, indice) => (
        <Fragment key={indice}>
          {estado.error && <Notice tone="error">{estado.error}</Notice>}
          {estado.success && <Notice tone="success">{estado.success}</Notice>}
        </Fragment>
      ))}
      {/* O erro do cancelamento fica dentro da folha, junto do botão que o causou */}
      {cancelamento.success && <Notice tone="success">{cancelamento.success}</Notice>}

      {disponiveis.map(({ para, rotulo }) => {
        // T8.5: cancelar não volta atrás, e por isso pede dois toques
        if (para === 'cancelado') {
          return (
            <ConfirmacaoDupla
              key={para}
              rotuloBotao={rotulo}
              titulo="Cancelar o pedido?"
              aviso="O pedido para aqui e não volta atrás. Ele continua na lista, com os itens como estavam, para consulta."
              rotuloConfirmar="Sim, cancelar o pedido"
              rotuloVoltar="Não, voltar ao pedido"
              action={cancelar}
              pendente={cancelando}
              erro={cancelamento.error}
            >
              <input type="hidden" name="pedido_id" value={pedidoId} />
              <input type="hidden" name="para" value={para} />
              <TextArea
                label="Motivo (opcional)"
                name="motivo"
                rows={2}
                maxLength={500}
                hint="Fica no histórico do pedido."
              />
            </ConfirmacaoDupla>
          );
        }

        const { acao, pendente, variant } = porta(para);
        return (
          <form key={para} action={acao} className="flex flex-col gap-2">
            <input type="hidden" name="pedido_id" value={pedidoId} />
            <input type="hidden" name="para" value={para} />
            {para === 'aprovado' && <p className="text-sm text-muted">Depois de aprovado, o item do pedido não muda mais.</p>}
            <Button type="submit" variant={variant} pending={pendente}>
              {rotulo}
            </Button>
          </form>
        );
      })}
    </section>
  );
}
