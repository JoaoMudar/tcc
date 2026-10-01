'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface Atalhos {
  anterior: string;
  proxima: string;
  hoje: string;
  /** Esc, quando há painel aberto. */
  onEsc?: () => void;
}

/** Tecla digitada num campo é texto, e não atalho. */
function digitando(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  return alvo.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(alvo.tagName);
}

/**
 * Os atalhos da semana em tela larga: ← e → trocam de semana, T volta para hoje,
 * Esc fecha o painel. Com o foco num card, as setas são do card (ele mesmo para
 * a propagação), e com modificador nada acontece, para não roubar o do navegador.
 */
export function useAtalhosSemana({ anterior, proxima, hoje, onEsc }: Atalhos) {
  const router = useRouter();

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.defaultPrevented || evento.altKey || evento.ctrlKey || evento.metaKey || digitando(evento.target)) return;
      if (evento.key === 'Escape' && onEsc) onEsc();
      else if (evento.key === 'ArrowLeft') router.push(anterior, { scroll: false });
      else if (evento.key === 'ArrowRight') router.push(proxima, { scroll: false });
      else if (evento.key === 't' || evento.key === 'T') router.push(hoje, { scroll: false });
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [router, anterior, proxima, hoje, onEsc]);
}
