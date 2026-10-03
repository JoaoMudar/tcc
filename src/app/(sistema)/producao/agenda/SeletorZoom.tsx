'use client';

import { ROTULO_ZOOM, ZOOMS } from '@/lib/agenda-zoom';
import { useZoomAgenda } from './ZoomAgenda';

/** Semana · 3 dias · Dia, discreto ao lado do "Hoje". Só em tela larga: no celular a agenda é a lista do dia. */
export function SeletorZoom({ className = '' }: { className?: string }) {
  const { zoom, setZoom } = useZoomAgenda();
  return (
    <div role="group" aria-label="Zoom da grade" title="Ctrl + roda do mouse sobre a grade" className={`items-center text-xs ${className}`}>
      {ZOOMS.map((opcao, indice) => (
        <span key={opcao} className="flex items-center">
          {indice > 0 && (
            <span aria-hidden className="text-line">
              ·
            </span>
          )}
          <button
            type="button"
            aria-pressed={zoom === opcao}
            onClick={() => setZoom(opcao)}
            className={`min-h-11 rounded px-1.5 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-dark ${
              zoom === opcao ? 'font-semibold text-ink' : 'text-muted'
            }`}
          >
            {ROTULO_ZOOM[opcao]}
          </button>
        </span>
      ))}
    </div>
  );
}
