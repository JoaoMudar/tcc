'use client';

import { useEffect } from 'react';

/** Cada aviso é um objeto novo, e é a troca dele que reinicia o relógio. */
export interface AvisoDesfazer {
  texto: string;
  tom: 'info' | 'erro';
  desfazer?: () => void;
}

interface ToastDesfazerProps {
  aviso: AvisoDesfazer | null;
  onFechar: () => void;
  duracaoMs?: number;
}

/**
 * O retorno do arrasto e do painel: discreto, embaixo, e some sozinho. O `Toast`
 * da casa limpa o `?feito=` do endereço, e aqui não há endereço a limpar.
 */
export function ToastDesfazer({ aviso, onFechar, duracaoMs = 6000 }: ToastDesfazerProps) {
  useEffect(() => {
    if (!aviso) return;
    const relogio = setTimeout(onFechar, duracaoMs);
    return () => clearTimeout(relogio);
  }, [aviso, onFechar, duracaoMs]);

  if (!aviso) return null;
  return (
    <div
      role={aviso.tom === 'erro' ? 'alert' : 'status'}
      className={`fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] z-50 mx-auto flex max-w-md items-center justify-between gap-4 rounded-lg px-4 py-2.5 text-sm shadow-lg ${
        aviso.tom === 'erro' ? 'bg-red-800 text-white' : 'bg-ink text-white'
      }`}
    >
      <span>{aviso.texto}</span>
      {aviso.desfazer && (
        <button
          type="button"
          onClick={() => {
            aviso.desfazer?.();
            onFechar();
          }}
          className="min-h-11 shrink-0 font-semibold text-brand-muted underline-offset-2 hover:underline"
        >
          Desfazer
        </button>
      )}
    </div>
  );
}
