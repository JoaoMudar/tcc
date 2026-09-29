'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import type { SituacaoPedido } from '@/lib/pedidos-rotulos';
import { confirmarPedidoAction, transicionarPedidoAction } from '../actions';

export interface ProximoPassoProps {
  pedidoId: string;
  situacao: SituacaoPedido;
  /** Conferir no viveiro: admin, chefia e gerência. */
  podeConferir: boolean;
  /** Aprovar e solicitar alteração: admin e chefia. */
  podeDecidir: boolean;
  /** Organizar as cargas: admin, chefia e gerência. */
  podeSeparar: boolean;
}

interface EstadoDaGrade {
  /** "Falta preço em 2 itens." enquanto a aprovação ainda seria recusada. */
  faltas: string | null;
  /** Gravação da grade em andamento: aprovar agora leria o preço de antes. */
  salvando: boolean;
}

const CLASSE_LINK =
  'min-h-touch flex items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white';

/**
 * RN-53: **só o passo seguinte do fluxo**, e para quem o executa. A verificação e
 * a separação têm tela própria, e é ela que muda a situação quando o trabalho
 * termina; daqui só se abre a tela. Aprovar e solicitar alteração são as duas
 * decisões da chefia sobre o pedido verificado.
 *
 * "Solicitar alteração" devolve o pedido ao orçamento: a chefia acerta os itens
 * com o cliente e a verificação recomeça.
 */
export function ProximoPasso({
  pedidoId,
  situacao,
  podeConferir,
  podeDecidir,
  podeSeparar,
  faltas,
  salvando,
}: ProximoPassoProps & EstadoDaGrade) {
  const [aprovacao, aprovar, aprovando] = useActionState(confirmarPedidoAction, EMPTY_FORM_STATE);
  const [alteracao, alterar, alterando] = useActionState(transicionarPedidoAction, EMPTY_FORM_STATE);

  if ((situacao === 'cadastrado' || situacao === 'verificando') && podeConferir) {
    return (
      <Link href={`/pedidos/${pedidoId}/verificar`} className={CLASSE_LINK}>
        {situacao === 'cadastrado' ? 'Começar verificação' : 'Continuar verificação'}
      </Link>
    );
  }

  if ((situacao === 'aprovado' || situacao === 'separando') && podeSeparar) {
    return (
      <Link href={`/pedidos/${pedidoId}/separar`} className={CLASSE_LINK}>
        {situacao === 'aprovado' ? 'Organizar cargas' : 'Continuar separação'}
      </Link>
    );
  }

  if ((situacao === 'verificado' || situacao === 'pendente_alteracao') && podeDecidir) {
    const erro = aprovacao.error ?? alteracao.error;
    return (
      <section className="flex flex-col gap-2">
        {situacao === 'verificado' && faltas && <p className="text-sm font-semibold text-red-700">{faltas}</p>}
        {erro && <Notice tone="error">{erro}</Notice>}
        <div className="grid gap-2 sm:grid-cols-2">
          {/* Pedido legado em "pendente de alteração" não aprova: a tabela de transições não deixa */}
          {situacao === 'verificado' && (
            <form action={aprovar}>
              <input type="hidden" name="pedido_id" value={pedidoId} />
              <Button type="submit" pending={aprovando} pendingLabel="Aprovando…" disabled={Boolean(faltas) || salvando}>
                Aprovar pedido
              </Button>
            </form>
          )}
          <form action={alterar}>
            <input type="hidden" name="pedido_id" value={pedidoId} />
            <input type="hidden" name="para" value="cadastrado" />
            <Button type="submit" variant="outline" pending={alterando} pendingLabel="Enviando…" disabled={salvando}>
              Solicitar alteração
            </Button>
          </form>
        </div>
      </section>
    );
  }

  return null;
}
