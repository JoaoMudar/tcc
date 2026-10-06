'use client';

import Link from 'next/link';
import { passoDoZoom } from '@/lib/agenda-zoom';
import { useZoomAgenda } from './ZoomAgenda';

// Sem `display` aqui: cada seta declara o seu, senão o `inline-flex` vence o `hidden` e o celular mostra as quatro
const LINK_NAV = 'h-11 min-w-11 items-center justify-center rounded-lg px-2 text-base text-muted hover:bg-surface hover:text-ink';

const ROTULO = {
  semana: ['Semana anterior', 'Próxima semana'],
  '3dias': ['3 dias antes', '3 dias depois'],
  dia: ['Dia anterior', 'Próximo dia'],
} as const;

/**
 * As setas e o "Hoje". Em tela larga andam no passo do zoom (o Gantt); no
 * celular, a visão é a lista do dia, e as setas seguem pulando a semana.
 */
export function NavegacaoAgenda({ dia, hoje }: { dia: string; hoje: string }) {
  const { zoom } = useZoomAgenda();
  const [antes, depois] = ROTULO[zoom];
  const seta = (destino: string, rotulo: string, tecla: string, simbolo: string, className: string) => (
    <Link href={`/producao?dia=${destino}`} aria-label={rotulo} title={`${rotulo} (${tecla})`} className={`${LINK_NAV} ${className}`}>
      {simbolo}
    </Link>
  );
  return (
    <nav aria-label="Trocar de dia ou semana" className="flex items-center">
      {seta(passoDoZoom('semana', dia, -1), 'Semana anterior', '←', '‹', 'inline-flex md:hidden')}
      {seta(passoDoZoom('semana', dia, 1), 'Próxima semana', '→', '›', 'inline-flex md:hidden')}
      {seta(passoDoZoom(zoom, dia, -1), antes, '←', '‹', 'hidden md:inline-flex')}
      {seta(passoDoZoom(zoom, dia, 1), depois, '→', '›', 'hidden md:inline-flex')}
      {dia !== hoje && (
        <Link href="/producao" title="Voltar para hoje (T)" className={`${LINK_NAV} inline-flex text-sm font-semibold`}>
          Hoje
        </Link>
      )}
    </nav>
  );
}
