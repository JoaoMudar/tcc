'use client';

import { useLayoutEffect, useRef } from 'react';

type Onde = (valor: string) => number;

/**
 * Devolve o cursor ao lugar depois que o campo controlado recebe o valor
 * mascarado. O `onChange` diz onde o cursor deve ficar, em função do texto
 * novo; o efeito o põe lá assim que o React escreve o valor no campo.
 */
export function useCursorDaMascara() {
  const pendente = useRef<{ campo: HTMLInputElement; onde: Onde } | null>(null);

  useLayoutEffect(() => {
    const p = pendente.current;
    if (!p) return;
    pendente.current = null;
    if (p.campo.ownerDocument.activeElement !== p.campo) return;
    const pos = p.onde(p.campo.value);
    p.campo.setSelectionRange(pos, pos);
  });

  return (campo: HTMLInputElement, onde: Onde) => {
    pendente.current = { campo, onde };
  };
}
