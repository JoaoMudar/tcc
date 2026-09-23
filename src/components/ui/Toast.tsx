'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Tone = 'success' | 'warning' | 'error' | 'info';

interface ToastProps {
  tone: Tone;
  children: ReactNode;
  /** Quanto tempo o aviso fica na tela. */
  duracaoMs?: number;
}

const TONES: Record<Tone, { className: string; mark: string }> = {
  success: { className: 'border-green-300 bg-green-50 text-green-800', mark: '✓' },
  warning: { className: 'border-amber-300 bg-amber-50 text-amber-800', mark: '!' },
  error: { className: 'border-red-300 bg-red-50 text-red-800', mark: '✕' },
  info: { className: 'border-blue-300 bg-blue-50 text-blue-800', mark: 'i' },
};

const DURACAO_PADRAO_MS = 4000;

/**
 * O aviso do que acabou de acontecer, que some sozinho.
 *
 * Serve ao que é **passageiro**: "pedido 12 registrado" depois de voltar para a
 * lista. O que descreve um estado permanente da tela (pedido cancelado,
 * conferência por abrir) continua sendo `Notice`, que fica.
 *
 * **O endereço é limpo junto.** O aviso chega como `?feito=`, e sem tirá-lo dali
 * ele voltaria a cada recarregamento, anunciando de novo um cadastro de meia
 * hora atrás. `replace` troca a entrada do histórico em vez de empilhar outra.
 */
export function Toast({ tone, children, duracaoMs = DURACAO_PADRAO_MS }: ToastProps) {
  const [visivel, setVisivel] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const relogio = setTimeout(() => setVisivel(false), duracaoMs);
    return () => clearTimeout(relogio);
  }, [duracaoMs]);

  useEffect(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

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
