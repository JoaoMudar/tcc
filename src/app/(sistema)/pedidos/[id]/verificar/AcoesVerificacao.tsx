'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { concluirVerificacaoAction, salvarParaDepoisAction } from './actions';
import { useItensEmAberto } from './ItensEmAberto';

interface AcoesVerificacaoProps {
  pedidoId: string;
  /** Falta responder quantos itens de topo, segundo o banco. */
  pendentes: number;
}

/**
 * T8.12: o rodapé da conferência.
 *
 * **Não há botão de abrir.** Abrir a conferência continua sendo gesto de
 * pessoa, e não efeito de montar a tela, mas o gesto é a primeira resposta:
 * quem toca "Tem tudo" já começou a conferir, e o servidor abre junto com a
 * gravação (`abrirOuExigirVerificacao`).
 *
 * **"Enviar" só com tudo completo.** Conta o que o banco não respondeu e o que
 * está em aberto na tela (`ItensEmAberto`): "Tem" sem o recipiente pinta o
 * cartão e não grava, e enviar assim fechava o item com a resposta anterior.
 * Enquanto falta algo, o botão é "Salvar", que sai e deixa continuar depois.
 */
export function AcoesVerificacao({ pedidoId, pendentes }: AcoesVerificacaoProps) {
  const [conclusao, concluir, concluindo] = useActionState(concluirVerificacaoAction, EMPTY_FORM_STATE);
  const [salvamento, salvar, salvando] = useActionState(salvarParaDepoisAction, EMPTY_FORM_STATE);
  const faltam = pendentes + useItensEmAberto();
  const erro = faltam > 0 ? salvamento.error : conclusao.error;

  return (
    <form action={faltam > 0 ? salvar : concluir} className="flex flex-col gap-2">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      {erro && <Notice tone="error">{erro}</Notice>}
      {faltam > 0 ? (
        <>
          <p className="text-sm text-muted">
            {faltam === 1 ? 'Falta completar 1 item.' : `Falta completar ${faltam} itens.`} O que já foi respondido fica
            salvo, e você continua depois.
          </p>
          <Button type="submit" variant="outline" pending={salvando} pendingLabel="Salvando…">
            Salvar
          </Button>
        </>
      ) : (
        <Button type="submit" pending={concluindo} pendingLabel="Enviando…">
          Enviar
        </Button>
      )}
    </form>
  );
}
