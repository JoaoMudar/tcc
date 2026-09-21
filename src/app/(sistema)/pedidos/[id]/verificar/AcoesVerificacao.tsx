'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { concluirVerificacaoAction, iniciarVerificacaoAction } from './actions';

interface AcoesVerificacaoProps {
  pedidoId: string;
  /** Falta responder quantos itens de topo. Zero libera o envio. */
  pendentes: number;
  /** A conferência ainda não foi aberta: o pedido está em cadastrado. */
  porAbrir: boolean;
}

/**
 * T8.12: o rodapé da conferência.
 *
 * **Abrir a conferência é um toque, e não um efeito de abrir a tela.** Gravar
 * durante a montagem da página faria o pedido mudar de situação porque alguém
 * espiou a tela, e o histórico registraria uma conferência que ninguém começou.
 */
export function AcoesVerificacao({ pedidoId, pendentes, porAbrir }: AcoesVerificacaoProps) {
  const [abertura, abrir, abrindo] = useActionState(iniciarVerificacaoAction, EMPTY_FORM_STATE);
  const [conclusao, concluir, concluindo] = useActionState(concluirVerificacaoAction, EMPTY_FORM_STATE);

  if (porAbrir) {
    return (
      <form action={abrir} className="flex flex-col gap-2">
        <input type="hidden" name="pedido_id" value={pedidoId} />
        {abertura.error && <Notice tone="error">{abertura.error}</Notice>}
        <Button type="submit" pending={abrindo} pendingLabel="Abrindo…">
          Começar a conferência
        </Button>
      </form>
    );
  }

  return (
    <form action={concluir} className="flex flex-col gap-2">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      {conclusao.error && <Notice tone="error">{conclusao.error}</Notice>}
      {pendentes > 0 ? (
        <Notice tone="info">
          {pendentes === 1
            ? 'Falta um item para responder antes de enviar à chefia.'
            : `Faltam ${pendentes} itens para responder antes de enviar à chefia.`}
        </Notice>
      ) : (
        <Button type="submit" pending={concluindo} pendingLabel="Enviando…">
          Enviar para a chefia
        </Button>
      )}
    </form>
  );
}
