'use client';

import Link from 'next/link';
import { Pill } from '@/components/ui/Pill';
import type { Providencia } from '@/lib/providencia';
import { PainelProvidencia } from './PainelProvidencia';
import { ToastDesfazer } from './ToastDesfazer';
import { useProvidencia } from './useProvidencia';

export interface ItemProvidencia {
  loteId: string;
  titulo: string;
  /** Nula quando a pendência não tem ação (não deveria acontecer, mas o lote ainda se abre). */
  providencia: Providencia | null;
  critico: boolean;
  situacao: string;
  pendencia: string | null;
  saldo: string;
}

interface PedemProvidenciaProps {
  itens: readonly ItemProvidencia[];
  /** Quem monta a agenda age; quem só lê abre o lote, como no mapa. */
  podeAgir: boolean;
}

/**
 * RF-45, RF-66: abaixo da semana, os lotes com tarefa vencida ou a vencer, de
 * qualquer semana. A sugestão do protocolo mostra só a semana aberta; esta lista
 * mostra tudo o que espera alguém. Tocar no item abre as ações.
 */
export function PedemProvidencia({ itens, podeAgir }: PedemProvidenciaProps) {
  const { aberta, abrir, fechar, feito, aviso, fecharAviso } = useProvidencia();

  return (
    <section aria-labelledby="providencia-titulo" className="flex flex-col gap-2">
      <h2 id="providencia-titulo" className="mt-2 text-sm font-bold tracking-widest text-muted uppercase">
        Pedem providência
      </h2>
      {itens.length === 0 ? (
        <p className="text-base text-muted">Nenhum lote com tarefa vencida ou a vencer.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {itens.map((item) => {
            const conteudo = (
              <>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-semibold text-ink">{item.titulo}</span>
                  <Pill tone={item.critico ? 'red' : 'amber'}>{item.situacao}</Pill>
                </span>
                <span className={`text-sm font-semibold ${item.critico ? 'text-red-800' : 'text-amber-800'}`}>{item.pendencia}</span>
                <span className="text-sm text-muted">{item.saldo}</span>
              </>
            );
            const caixa = `flex min-h-touch w-full flex-col justify-center gap-0.5 rounded-xl border px-4 py-3 text-left ${
              item.critico ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
            }`;
            const providencia = item.providencia;
            return (
              <li key={item.loteId}>
                {podeAgir && providencia ? (
                  <button type="button" onClick={() => abrir(providencia)} className={caixa}>
                    {conteudo}
                  </button>
                ) : (
                  <Link href={`/producao/lotes/${item.loteId}`} className={caixa}>
                    {conteudo}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {aberta && <PainelProvidencia key={aberta.chave} providencia={aberta} onFechar={fechar} onFeito={feito} />}
      <ToastDesfazer aviso={aviso} onFechar={fecharAviso} />
    </section>
  );
}
