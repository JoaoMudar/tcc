'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { type SituacaoViagem, formatDiaDaViagem } from '@/lib/rotas';
import { voltarParaCargaAction } from './actions';

interface CabecalhoViagemProps {
  data: string;
  viagemId: string | null;
  etapa: SituacaoViagem;
}

const PASSOS: { etapa: SituacaoViagem; nome: string }[] = [
  { etapa: 'montando', nome: '1 · Carga' },
  { etapa: 'roteirizando', nome: '2 · Rota' },
  { etapa: 'carregando', nome: '3 · Carregamento' },
];

const INDICE: Record<SituacaoViagem, number> = { montando: 0, roteirizando: 1, carregando: 2, pronta: 2 };

const BOTAO_QUADRADO =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink active:bg-brand-light';

function SetaVoltar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * O cabeçalho das três telas. "Sair" volta ao calendário em qualquer etapa sem
 * perder nada, porque tudo já foi gravado. A seta anda uma etapa para trás, e
 * some no carregamento: as cargas já foram criadas, e dali só se sai.
 */
export function CabecalhoViagem({ data, viagemId, etapa }: CabecalhoViagemProps) {
  const [volta, voltar, voltando] = useActionState(voltarParaCargaAction, EMPTY_FORM_STATE);
  const atual = INDICE[etapa];

  return (
    <header className="flex flex-col gap-3 border-b border-line bg-white px-4 pt-4 pb-3">
      <div className="flex items-center gap-2">
        {etapa === 'montando' && (
          <Link href="/pedidos" aria-label="Voltar" className={BOTAO_QUADRADO}>
            <SetaVoltar />
          </Link>
        )}
        {etapa === 'roteirizando' && viagemId && (
          <form action={voltar}>
            <input type="hidden" name="data" value={data} />
            <input type="hidden" name="viagem_id" value={viagemId} />
            <button type="submit" aria-label="Voltar" disabled={voltando} className={BOTAO_QUADRADO}>
              <SetaVoltar />
            </button>
          </form>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-bold tracking-widest text-muted uppercase">Planejar pedido</span>
          <h1 className="text-lg leading-tight font-bold text-ink">Entrega de {formatDiaDaViagem(data)}</h1>
        </div>
        <Link
          href="/pedidos"
          className="flex min-h-11 shrink-0 items-center rounded-lg border border-line bg-white px-4 text-base font-bold text-ink active:bg-brand-light"
        >
          Sair
        </Link>
      </div>

      <ol className="grid grid-cols-3 gap-1.5">
        {PASSOS.map((passo, indice) => (
          <li key={passo.etapa} className="flex flex-col gap-1" aria-current={indice === atual ? 'step' : undefined}>
            <span className={`h-1.5 rounded ${indice <= atual ? 'bg-brand' : 'bg-gray-200'}`} />
            <span className={`text-sm ${indice === atual ? 'font-bold text-ink' : 'font-semibold text-muted'}`}>
              {passo.nome}
            </span>
          </li>
        ))}
      </ol>

      {volta.error && <Notice tone="error">{volta.error}</Notice>}
    </header>
  );
}
