'use client';

import { useEffect, useState } from 'react';
import { type Eixo, percentualDoMinuto } from '@/lib/agenda-grade';

/** Minutos desde a meia-noite no relógio do navegador. */
function minutoAgora(): number {
  const agora = new Date();
  return agora.getHours() * 60 + agora.getMinutes();
}

/**
 * O minuto corrente, atualizado a cada minuto. Nasce nulo e só se preenche
 * depois de montar: o servidor não sabe a hora de quem olha, e o primeiro
 * desenho tem de ser igual nos dois lados.
 */
function useMinutoAgora(): number | null {
  const [minuto, setMinuto] = useState<number | null>(null);
  useEffect(() => {
    const atualizar = () => setMinuto(minutoAgora());
    atualizar();
    const relogio = setInterval(atualizar, 60_000);
    return () => clearInterval(relogio);
  }, []);
  return minuto;
}

/**
 * O "agora" na coluna de hoje: a linha de 2px na hora corrente, nas células, e o
 * ponto que a encabeça, no cabeçalho (`ponto`). Fora da jornada não desenha,
 * porque não haveria onde.
 */
export function LinhaAgora({ janela, ponto = false }: { janela: Eixo; ponto?: boolean }) {
  const minuto = useMinutoAgora();
  if (minuto === null || minuto < janela.inicio || minuto > janela.fim) return null;
  const left = `${percentualDoMinuto(minuto, janela)}%`;
  if (ponto) {
    return (
      <span
        aria-hidden
        data-agora
        style={{ left }}
        className="pointer-events-none absolute bottom-0 z-[15] h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-red-600"
      />
    );
  }
  return <span aria-hidden data-agora style={{ left }} className="pointer-events-none absolute inset-y-0 z-[15] w-0.5 -translate-x-1/2 bg-red-600" />;
}
