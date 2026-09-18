'use client';

import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useEffect, useState } from 'react';
import {
  type Borda,
  type Faixa,
  type Janela,
  PASSO_MINUTOS,
  minutoNaPosicao,
  moverFaixa,
  redimensionarFaixa,
} from '@/lib/agenda-grade';

/** Arrastar o corpo remarca; arrastar a borda muda a duração. */
export type ModoArrasto = 'mover' | Borda;

export interface AlvoArrasto {
  id: string;
  dia: string;
  faixa: Faixa;
}

export interface Reagendamento extends AlvoArrasto {
  /** O dia pode mudar no `mover`, e nunca no redimensionar. */
  diaOriginal: string;
}

interface Sessao extends AlvoArrasto {
  modo: ModoArrasto;
  diaOriginal: string;
  faixaOriginal: Faixa;
  /** Onde, dentro da barra, o ponteiro a pegou: sem isto a barra pula para o cursor. */
  offsetMinutos: number;
}

interface Opcoes {
  dias: readonly string[];
  janela: Janela;
  /** O contêiner das colunas de dia, todas da mesma largura. */
  areaRef: RefObject<HTMLElement | null>;
  onSoltar: (resultado: Reagendamento) => void;
}

interface Medida {
  indice: number;
  dia: string;
  minuto: number;
}

/** Converte a posição do ponteiro em dia e minuto do eixo. */
function medir(area: HTMLElement, dias: readonly string[], janela: Janela, clientX: number): Medida {
  const rect = area.getBoundingClientRect();
  const largura = Math.max(1, rect.width / Math.max(1, dias.length));
  const bruto = (clientX - rect.left) / largura;
  const indice = Math.min(Math.max(Math.floor(bruto), 0), dias.length - 1);
  return { indice, dia: dias[indice], minuto: minutoNaPosicao(Math.min(Math.max(bruto - indice, 0), 1), janela) };
}

/** No redimensionar o dia é fixo: a hora se mede sempre na coluna de origem. */
function minutoNaColunaDe(area: HTMLElement, dias: readonly string[], janela: Janela, clientX: number, indice: number): number {
  const rect = area.getBoundingClientRect();
  const largura = Math.max(1, rect.width / Math.max(1, dias.length));
  const fracao = (clientX - rect.left - indice * largura) / largura;
  return minutoNaPosicao(Math.min(Math.max(fracao, 0), 1), janela);
}

/**
 * O arrasto da barra na agenda da semana, com Pointer Events puros: o projeto
 * não tem biblioteca de arrasto, e o gesto cabe num punhado de contas sobre a
 * geometria, que é testada em `agenda-grade`.
 *
 * Só a tela larga chama isto (RNF-14). O teclado faz o mesmo caminho por
 * `aoTeclar`, para o gesto não ser a única porta (RNF-03).
 */
export function useArrasteBarra({ dias, janela, areaRef, onSoltar }: Opcoes) {
  const [sessao, setSessao] = useState<Sessao | null>(null);

  const iniciar = useCallback(
    (evento: ReactPointerEvent<HTMLElement>, alvo: AlvoArrasto, modo: ModoArrasto) => {
      const area = areaRef.current;
      if (!area || evento.button !== 0) return;
      evento.preventDefault();
      evento.currentTarget.setPointerCapture?.(evento.pointerId);
      const { minuto } = medir(area, dias, janela, evento.clientX);
      setSessao({ ...alvo, modo, diaOriginal: alvo.dia, faixaOriginal: alvo.faixa, offsetMinutos: minuto - alvo.faixa.inicio });
    },
    [areaRef, dias, janela],
  );

  useEffect(() => {
    if (!sessao) return;

    const aoMover = (evento: PointerEvent) => {
      const area = areaRef.current;
      if (!area) return;
      const indiceOriginal = Math.max(0, dias.indexOf(sessao.diaOriginal));

      if (sessao.modo === 'mover') {
        const { dia, minuto } = medir(area, dias, janela, evento.clientX);
        const desejado = minuto - sessao.offsetMinutos;
        setSessao((atual) =>
          atual && { ...atual, dia, faixa: moverFaixa(atual.faixaOriginal, desejado - atual.faixaOriginal.inicio, janela) },
        );
        return;
      }

      const minuto = minutoNaColunaDe(area, dias, janela, evento.clientX, indiceOriginal);
      setSessao((atual) => {
        if (!atual) return atual;
        const borda = atual.modo as Borda;
        const delta = minuto - (borda === 'inicio' ? atual.faixaOriginal.inicio : atual.faixaOriginal.fim);
        return { ...atual, faixa: redimensionarFaixa(atual.faixaOriginal, borda, delta, janela) };
      });
    };

    const aoSoltar = () => {
      setSessao((atual) => {
        if (atual && (atual.dia !== atual.diaOriginal || atual.faixa.inicio !== atual.faixaOriginal.inicio || atual.faixa.fim !== atual.faixaOriginal.fim)) {
          onSoltar({ id: atual.id, dia: atual.dia, faixa: atual.faixa, diaOriginal: atual.diaOriginal });
        }
        return null;
      });
    };

    /** Escape desiste, e a barra volta para onde estava. */
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setSessao(null);
    };

    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoSoltar);
    window.addEventListener('pointercancel', () => setSessao(null));
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('pointerup', aoSoltar);
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [sessao, dias, janela, areaRef, onSoltar]);

  /**
   * RNF-03: o mesmo resultado sem ponteiro. Shift com as setas remarca, Alt com
   * as setas muda a duração, e um passo é o passo do arrasto.
   */
  const aoTeclar = useCallback(
    (evento: React.KeyboardEvent<HTMLElement>, alvo: AlvoArrasto) => {
      const horizontal = evento.key === 'ArrowLeft' ? -1 : evento.key === 'ArrowRight' ? 1 : 0;
      if (horizontal === 0 || (!evento.shiftKey && !evento.altKey)) return;
      evento.preventDefault();

      if (evento.altKey) {
        const faixa = redimensionarFaixa(alvo.faixa, 'fim', horizontal * PASSO_MINUTOS, janela);
        onSoltar({ id: alvo.id, dia: alvo.dia, faixa, diaOriginal: alvo.dia });
        return;
      }
      const faixa = moverFaixa(alvo.faixa, horizontal * PASSO_MINUTOS, janela);
      onSoltar({ id: alvo.id, dia: alvo.dia, faixa, diaOriginal: alvo.dia });
    },
    [janela, onSoltar],
  );

  return { sessao, iniciar, aoTeclar };
}
