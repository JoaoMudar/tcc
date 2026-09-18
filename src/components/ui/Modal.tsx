'use client';

import { type ReactNode, useEffect, useId } from 'react';

interface ModalProps {
  titulo: string;
  onFechar: () => void;
  /** `folha` sobe de baixo, que é o gesto do celular; `centro` é o da tela larga. */
  posicao?: 'folha' | 'centro';
  children: ReactNode;
}

const CAIXA: Record<'folha' | 'centro', string> = {
  folha: 'max-w-md rounded-t-2xl p-4 pb-6',
  centro: 'max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl p-5',
};

/**
 * A folha por cima da tela, sem sair dela. Escape fecha, clicar fora fecha, e o
 * clique de dentro não vaza para o fundo.
 */
export function Modal({ titulo, onFechar, posicao = 'folha', children }: ModalProps) {
  const tituloId = useId();

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-black/40 ${posicao === 'folha' ? 'justify-end' : 'justify-center p-4'}`}
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`mx-auto flex w-full flex-col gap-3 bg-white shadow-xl ${CAIXA[posicao]}`}
        onClick={(event) => event.stopPropagation()}
      >
        {posicao === 'folha' && <div aria-hidden="true" className="mx-auto h-1 w-9 rounded bg-gray-300" />}
        <h2 id={tituloId} className="text-lg font-bold text-ink">
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  );
}
