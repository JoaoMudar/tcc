'use client';

import type { ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type Tone = 'success' | 'warning' | 'error' | 'info';

interface ToastProps {
  tone: Tone;
  children: ReactNode;
  /** Quanto tempo o aviso fica na tela. */
  duracaoMs?: number;
  /**
   * Parâmetros do endereço que trouxeram o aviso, e que saem junto com ele. O
   * resto fica: a agenda volta ao mesmo `?dia=`. Vazio não toca no endereço.
   */
  limpar?: readonly string[];
  /** A troca dele mostra o aviso de novo: o segundo envio do mesmo formulário também avisa. */
  gatilho?: unknown;
}

const TONES: Record<Tone, { className: string; mark: string }> = {
  success: { className: 'border-green-300 bg-green-50 text-green-800', mark: '✓' },
  warning: { className: 'border-amber-300 bg-amber-50 text-amber-800', mark: '!' },
  error: { className: 'border-red-300 bg-red-50 text-red-800', mark: '✕' },
  info: { className: 'border-blue-300 bg-blue-50 text-blue-800', mark: 'i' },
};

const DURACAO_PADRAO_MS = 4000;
const LIMPAR_PADRAO = ['feito'] as const;

/**
 * O aviso do que acabou de acontecer, que some sozinho.
 *
 * Serve ao que é **passageiro**: "pedido 12 registrado" depois de voltar para a
 * lista, "tarefa confirmada" na agenda. O que descreve um estado permanente da
 * tela (pedido cancelado, conferência por abrir) continua sendo `Notice`, que fica.
 *
 * **O endereço é limpo junto.** O aviso chega como `?feito=`, e sem tirá-lo dali
 * ele voltaria a cada recarregamento, anunciando de novo um cadastro de meia
 * hora atrás. A troca é da entrada do histórico, em vez de empilhar outra.
 */
export function Toast({ tone, children, duracaoMs = DURACAO_PADRAO_MS, limpar = LIMPAR_PADRAO, gatilho }: ToastProps) {
  // Guarda o gatilho cujo tempo acabou: um gatilho novo já nasce visível
  const [vencido, setVencido] = useState<{ gatilho: unknown } | null>(null);
  const visivel = !(vencido && Object.is(vencido.gatilho, gatilho));
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chavesLimpar = limpar.join(',');

  useEffect(() => {
    const relogio = setTimeout(() => setVencido({ gatilho }), duracaoMs);
    return () => clearTimeout(relogio);
  }, [duracaoMs, gatilho]);

  useEffect(() => {
    if (!chavesLimpar) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    const chaves = chavesLimpar.split(',');
    if (!chaves.some((chave) => params.has(chave))) return;
    for (const chave of chaves) params.delete(chave);
    const resto = params.toString();
    // `history.replaceState` em vez de `router.replace`: o Next acompanha a troca
    // sem buscar a página de novo no servidor, que voltaria sem o `?feito=` e tiraria
    // o aviso da tela antes da hora
    window.history.replaceState(window.history.state, '', resto ? `${pathname}?${resto}` : pathname);
  }, [pathname, searchParams, chavesLimpar]);

  if (!visivel) return null;

  const { className, mark } = TONES[tone];
  return (
    <div
      role="status"
      className={`fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] z-50 mx-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-base shadow-lg ${className}`}
    >
      <span aria-hidden="true" className="font-bold">
        {mark}
      </span>
      <div>{children}</div>
    </div>
  );
}
