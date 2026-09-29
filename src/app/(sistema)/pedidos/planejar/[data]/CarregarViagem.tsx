'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { formatAltura } from '@/lib/pedidos-rotulos';
import { ordemDeCarregamento } from '@/lib/rotas';
import { concluirViagemAction, marcarItemAction } from './actions';

export interface GrupoParaCarregar {
  pedidoId: string;
  cliente: string;
  cidade: string | null;
  /** Posição na rota: 1 é a primeira entrega. */
  entrega: number;
  itens: readonly {
    id: string;
    especie: string;
    recipiente: string;
    alturaM: number | null;
    quantidade: number;
    separado: boolean;
    cargaPronta: boolean;
  }[];
}

interface CarregarViagemProps {
  data: string;
  viagemId: string;
  pronta: boolean;
  grupos: readonly GrupoParaCarregar[];
}

/** Do escuro (fundo) ao claro (porta): a faixa diz de relance onde cada entrega fica. */
const TONS = ['bg-green-900 text-white', 'bg-green-700 text-white', 'bg-green-600 text-white', 'bg-green-400 text-green-950', 'bg-green-300 text-green-950'];

function passoDoGrupo(indice: number, total: number): string {
  if (total === 1) return 'Carregue';
  if (indice === 0) return 'Carregue primeiro · fundo';
  if (indice === total - 1) return 'Carregue por último · porta';
  return `Carregue em ${indice + 1}º`;
}

/**
 * Tela 3: o carregamento. É a contagem do "Organizar cargas", agrupada por
 * pedido na **ordem inversa da rota**: primeiro os itens da última entrega, que
 * vão para o fundo, e por último os da primeira, que ficam perto da porta.
 */
export function CarregarViagem({ data, viagemId, pronta, grupos }: CarregarViagemProps) {
  const [marcacao, marcar, marcando] = useActionState(marcarItemAction, EMPTY_FORM_STATE);
  const [conclusao, concluir, concluindo] = useActionState(concluirViagemAction, EMPTY_FORM_STATE);

  const naOrdem = ordemDeCarregamento(grupos);
  const total = naOrdem.length;
  const faltam = grupos.reduce((soma, grupo) => soma + grupo.itens.filter((item) => !item.separado).length, 0);

  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        <section className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-3">
          <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Como fica no caminhão</h2>
          <div className="flex justify-between text-xs font-bold text-muted">
            <span>Fundo (cabine)</span>
            <span>Porta traseira</span>
          </div>
          <div className="flex h-10 gap-1">
            {naOrdem.map((grupo, indice) => (
              <span
                key={grupo.pedidoId}
                style={{ flexGrow: Math.max(1, grupo.itens.reduce((soma, item) => soma + item.quantidade, 0)) }}
                className={`flex min-w-8 items-center justify-center rounded-md text-sm font-extrabold ${TONS[indice % TONS.length]}`}
              >
                {grupo.entrega}ª
              </span>
            ))}
          </div>
        </section>

        {marcacao.error && <Notice tone="error">{marcacao.error}</Notice>}

        {naOrdem.map((grupo, indice) => {
          const feitos = grupo.itens.filter((item) => item.separado).length;
          return (
            <section key={grupo.pedidoId} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold tracking-wider text-brand-dark uppercase">
                    {passoDoGrupo(indice, total)}
                  </span>
                  <span className="text-lg font-extrabold text-ink">{grupo.cliente}</span>
                  <span className="text-sm text-muted">
                    {[`${grupo.entrega}ª entrega de ${total}`, grupo.cidade].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-bold text-muted">
                  {feitos}/{grupo.itens.length}
                </span>
              </div>

              <ul className="flex flex-col gap-2">
                {grupo.itens.map((item) => (
                  <li key={item.id}>
                    <form action={marcar}>
                      <input type="hidden" name="data" value={data} />
                      <input type="hidden" name="carga_item_id" value={item.id} />
                      {/* Grava o valor final, e não inverte o atual: o toque repetido
                          pela conexão ruim do galpão chega ao mesmo resultado */}
                      <input type="hidden" name="separado" value={item.separado ? 'nao' : 'sim'} />
                      <button
                        type="submit"
                        aria-pressed={item.separado}
                        disabled={marcando || item.cargaPronta}
                        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-ink ${item.separado ? 'border-green-300 bg-green-50' : 'border-line bg-white'}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${item.separado ? 'border-brand bg-brand' : 'border-gray-400 bg-white'}`}
                        >
                          {item.separado && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                              <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className="flex flex-1 flex-col gap-0.5">
                          <span className="text-base font-bold">{item.especie}</span>
                          <span className="text-sm text-muted">
                            {[`${formatQuantidade(item.quantidade)} mudas`, item.recipiente, formatAltura(item.alturaM)]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {conclusao.error && <Notice tone="error">{conclusao.error}</Notice>}
        {(conclusao.success || pronta) && (
          <Notice tone="success">{conclusao.success ?? 'Carga pronta. Os pedidos estão prontos para envio.'}</Notice>
        )}
        {pronta && (
          <Link href={`/pedidos/planejar/${data}?nova=1`} className="text-center text-base font-semibold text-brand-dark">
            Planejar outra viagem neste dia
          </Link>
        )}
      </div>

      {!pronta && (
        <div className="flex flex-col gap-1.5 border-t border-line bg-white px-4 pt-3 pb-5">
          {faltam > 0 && (
            <span className="text-center text-sm text-muted">{faltam === 1 ? 'Falta 1 item' : `Faltam ${faltam} itens`}</span>
          )}
          <form action={concluir}>
            <input type="hidden" name="data" value={data} />
            <input type="hidden" name="viagem_id" value={viagemId} />
            <Button type="submit" disabled={faltam > 0} pending={concluindo} pendingLabel="Fechando…">
              Carga pronta
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
