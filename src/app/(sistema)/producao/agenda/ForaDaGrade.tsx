'use client';

import Link from 'next/link';
import type { AtribuicaoResumo } from '@/lib/agenda';
import { useZoomAgenda } from './ZoomAgenda';

/**
 * As tarefas de sábado e domingo, que o zoom Semana não desenha. Nos zooms
 * 3 dias e Dia o fim de semana está na grade, e o aviso sai.
 */
export function ForaDaGrade({ atribuicoes }: { atribuicoes: Pick<AtribuicaoResumo, 'id' | 'tipo'>[] }) {
  const { zoom } = useZoomAgenda();
  if (zoom !== 'semana' || atribuicoes.length === 0) return null;
  return (
    <p className="hidden text-sm text-muted md:block">
      No fim de semana, fora da grade:{' '}
      {atribuicoes.map((a, indice) => (
        <span key={a.id}>
          {indice > 0 && ', '}
          <Link href={`/producao/agenda/${a.id}`} className="font-medium text-brand-dark underline-offset-2 hover:underline">
            {a.tipo}
          </Link>
        </span>
      ))}
      .
    </p>
  );
}
