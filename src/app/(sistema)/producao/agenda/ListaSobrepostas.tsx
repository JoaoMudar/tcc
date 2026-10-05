'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { AtribuicaoResumo } from '@/lib/agenda';
import { formatHoraTarefa } from '@/lib/agenda-rotulos';
import { COR_CATEGORIA } from '@/lib/cores-categoria';
import { turnoLabel } from '@/lib/turnos';

interface ListaSobrepostasProps {
  tarefas: readonly AtribuicaoResumo[];
  promovivel: boolean;
  onPromover: (id: string) => void;
}

/**
 * O "+N" da faixa de baixo: a terceira tarefa cruzada em diante não cabe na
 * altura da linha (RF-26), e em vez de sumir vira uma lista que se abre aqui,
 * com o link da ficha e o "Tornar principal" de cada uma.
 */
export function ListaSobrepostas({ tarefas, promovivel, onPromover }: ListaSobrepostasProps) {
  const [aberta, setAberta] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!aberta) return;
    const fora = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberta(false);
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberta(false);
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberta]);

  return (
    <span ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberta((antes) => !antes)}
        aria-expanded={aberta}
        aria-label={`Mais ${tarefas.length} ${tarefas.length === 1 ? 'tarefa' : 'tarefas'} neste horário`}
        className="rounded bg-white/90 px-1 text-[11px] leading-4 font-semibold text-ink shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-brand-dark"
      >
        +{tarefas.length}
      </button>
      {aberta && (
        <span role="dialog" aria-label="Tarefas no mesmo horário" className="absolute top-full right-0 z-40 mt-1 flex w-56 flex-col gap-0.5 rounded-lg border border-line bg-white p-1 shadow-lg">
          {tarefas.map((t) => (
            <span key={t.id} className="flex items-center gap-1 rounded px-1 py-1 hover:bg-surface">
              <span aria-hidden className={`h-4 w-1 shrink-0 rounded ${COR_CATEGORIA[t.categoria]}`} />
              <Link href={`/producao/agenda/${t.id}`} className="min-w-0 flex-1 truncate text-xs text-ink hover:underline">
                {t.tipo}
                <span className="ml-1 text-muted tabular-nums">
                  {formatHoraTarefa(t.horaInicio, t.horaFim)?.replace(' às ', '–') ?? turnoLabel(t.turno)}
                </span>
              </Link>
              {promovivel && (
                <button
                  type="button"
                  onClick={() => {
                    onPromover(t.id);
                    setAberta(false);
                  }}
                  className="shrink-0 rounded px-1 text-[11px] font-semibold text-brand-dark hover:underline"
                >
                  Tornar principal
                </button>
              )}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
