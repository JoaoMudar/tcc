'use client';

import { type ReactNode, useRef, useState } from 'react';
import { Button } from './Button';

interface DoisPassosProps {
  /** Divide só quando passa de cinco campos (RNF-07); com menos, mostra tudo de uma vez. */
  dividir: boolean;
  primeiro: ReactNode;
  /** O fim do formulário, com o botão que grava: só aparece no segundo passo. */
  segundo: ReactNode;
  /** O que o segundo passo pergunta, no botão que leva a ele. */
  rotuloContinuar?: string;
}

/**
 * RNF-07: o formulário de campo com mais de cinco campos vira dois passos.
 *
 * **Os campos dos dois passos ficam no mesmo `<form>`**, e o passo que não está
 * na tela fica só escondido (`hidden`): o envio leva tudo, e a fila offline e a
 * action não mudam. "Continuar" confere os campos do primeiro passo antes de
 * avançar, porque o navegador não consegue apontar o erro de um campo escondido.
 */
export function DoisPassos({ dividir, primeiro, segundo, rotuloContinuar = 'Continuar' }: DoisPassosProps) {
  const [passo, setPasso] = useState<1 | 2>(1);
  const primeiroRef = useRef<HTMLDivElement>(null);

  if (!dividir) {
    return (
      <>
        {primeiro}
        {segundo}
      </>
    );
  }

  function continuar() {
    const campos = primeiroRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input, select, textarea',
    );
    for (const campo of campos ?? []) {
      if (!campo.reportValidity()) return;
    }
    setPasso(2);
  }

  return (
    <>
      <p className="text-sm font-semibold text-muted">Passo {passo} de 2</p>
      <div ref={primeiroRef} hidden={passo !== 1} className="flex flex-col gap-4">
        {primeiro}
        <Button type="button" onClick={continuar}>
          {rotuloContinuar}
        </Button>
      </div>
      <div hidden={passo !== 2} className="flex flex-col gap-4">
        {segundo}
        <Button type="button" variant="outline" onClick={() => setPasso(1)}>
          Voltar
        </Button>
      </div>
    </>
  );
}
