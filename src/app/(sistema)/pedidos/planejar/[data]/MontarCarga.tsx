'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { resumoDoItem } from '@/lib/rotas';
import { adicionarPedidoAction, confirmarCargaAction, tirarPedidoAction } from './actions';

export interface ItemDaLista {
  especie: string;
  quantidade: number | null;
  alturaM: number | null;
}

export interface PedidoNaCarga {
  id: string;
  numero: number;
  cliente: string;
  /** Cidade e logradouro, quando houver. */
  local: string | null;
  itens: readonly ItemDaLista[];
}

export interface PedidoParaEscolher extends PedidoNaCarga {
  /** `entrega 05/10` ou `sem data`; vazio na lista do próprio dia. */
  entrega: string;
  /** "Separando" ou "Pronto para envio": o pedido que já tem carga. `null` no aprovado. */
  situacao: string | null;
}

interface MontarCargaProps {
  data: string;
  viagemId: string | null;
  carga: readonly PedidoNaCarga[];
  marcados: readonly PedidoParaEscolher[];
  abertos: readonly PedidoParaEscolher[];
}

function totalDeMudas(itens: readonly ItemDaLista[]): number {
  return itens.reduce((soma, item) => soma + (item.quantidade ?? 0), 0);
}

function Mais({ cheio }: { cheio: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${cheio ? 'bg-brand text-white' : 'border-2 border-brand text-brand'}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** O "tirar da carga": o X vermelho, a antítese do "+" verde que põe. */
function Menos() {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-red-600 bg-white text-red-600"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * Tela 1: montar a carga. No topo, o que já vai no caminhão; abaixo, o que pode
 * ir. Tocar num pedido o põe na carga e marca a entrega para o dia da viagem.
 */
export function MontarCarga({ data, viagemId, carga, marcados, abertos }: MontarCargaProps) {
  const [adicao, adicionar, adicionando] = useActionState(adicionarPedidoAction, EMPTY_FORM_STATE);
  const [retirada, tirar, tirando] = useActionState(tirarPedidoAction, EMPTY_FORM_STATE);
  const [confirmacao, confirmar, confirmando] = useActionState(confirmarCargaAction, EMPTY_FORM_STATE);

  const mudas = carga.reduce((soma, pedido) => soma + totalDeMudas(pedido.itens), 0);
  const erro = adicao.error ?? retirada.error ?? confirmacao.error;

  const lista = (titulo: string, pedidos: readonly PedidoParaEscolher[], cheio: boolean) => (
    <section className="flex flex-col gap-2.5">
      <h2 className="mt-1 text-sm font-bold tracking-widest text-muted uppercase">{titulo}</h2>
      {pedidos.length === 0 && <p className="text-base text-muted">Nenhum.</p>}
      {pedidos.map((pedido) => (
        <form key={pedido.id} action={adicionar}>
          <input type="hidden" name="data" value={data} />
          <input type="hidden" name="pedido_id" value={pedido.id} />
          <button
            type="submit"
            disabled={adicionando}
            className="flex w-full items-center gap-3 rounded-lg border border-line bg-white p-3 text-left text-ink active:bg-brand-light disabled:opacity-60"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold">{pedido.cliente}</span>
                {pedido.situacao && (
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800">
                    {pedido.situacao}
                  </span>
                )}
              </span>
              <span className="text-sm text-muted">
                {[`Pedido ${pedido.numero}`, pedido.local, pedido.entrega].filter(Boolean).join(' · ')}
              </span>
              <span className="text-sm text-muted">
                {pedido.itens.length} {pedido.itens.length === 1 ? 'item' : 'itens'} ·{' '}
                {formatQuantidade(totalDeMudas(pedido.itens))} mudas
              </span>
            </span>
            <Mais cheio={cheio} />
          </button>
        </form>
      ))}
    </section>
  );

  return (
    <>
      <section className="sticky top-0 z-10 flex max-h-[45vh] flex-col gap-2 overflow-y-auto border-b-2 border-brand bg-brand-light px-4 py-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold text-brand-dark">Na carga</h2>
          <span className="text-sm font-semibold text-brand-dark">
            {carga.length} {carga.length === 1 ? 'pedido' : 'pedidos'} · {formatQuantidade(mudas)} mudas
          </span>
        </div>
        {carga.length === 0 && (
          <p className="rounded-lg border-2 border-dashed border-brand/40 p-3 text-center text-base text-ink">
            Carga vazia.
          </p>
        )}
        {carga.map((pedido) => (
          <article key={pedido.id} className="flex flex-col gap-1.5 rounded-lg border border-green-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-base font-bold text-ink">
                  Pedido {pedido.numero} · {pedido.cliente}
                </span>
                <span className="text-sm text-muted">{pedido.local ?? 'Sem endereço de entrega'}</span>
              </div>
              {viagemId && (
                <form action={tirar}>
                  <input type="hidden" name="data" value={data} />
                  <input type="hidden" name="viagem_id" value={viagemId} />
                  <input type="hidden" name="pedido_id" value={pedido.id} />
                  <button
                    type="submit"
                    disabled={tirando}
                    aria-label={`Tirar o pedido ${pedido.numero} da carga`}
                    title="Tirar da carga"
                    className="shrink-0 rounded-lg active:opacity-70 disabled:opacity-60"
                  >
                    <Menos />
                  </button>
                </form>
              )}
            </div>
            <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-ink">
              {pedido.itens.map((item, indice) => (
                <li key={indice}>{resumoDoItem(item)}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <div className="flex flex-col gap-4 p-4">
        {erro && <Notice tone="error">{erro}</Notice>}
        {lista('Marcados para este dia', marcados, true)}
        {lista('Em aberto', abertos, false)}
      </div>

      <div className="border-t border-line bg-white px-4 pt-3 pb-5">
        <form action={confirmar}>
          <input type="hidden" name="data" value={data} />
          <input type="hidden" name="viagem_id" value={viagemId ?? ''} />
          <Button type="submit" disabled={carga.length === 0 || !viagemId} pending={confirmando} pendingLabel="Abrindo a rota…">
            Confirmar carga
          </Button>
        </form>
      </div>
    </>
  );
}
