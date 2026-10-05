'use client';

import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  type Borda,
  type Eixo,
  type Faixa,
  PASSO_MINUTOS,
  minutoNaPosicao,
  moverFaixa,
  redimensionarFaixa,
} from '@/lib/agenda-grade';

/** Arrastar o corpo remarca; arrastar a borda muda a duração. */
export type ModoArrasto = 'mover' | Borda;

/** O atributo que marca a área de dias de cada linha; o valor é o id da pessoa, vazio em "Sem ninguém". */
export const ATRIBUTO_LINHA = 'data-pessoa';

/** O atributo que marca a célula de cada dia dentro da linha; o valor é a data. */
export const ATRIBUTO_DIA = 'data-dia';

export interface AlvoArrasto {
  id: string;
  dia: string;
  faixa: Faixa;
  /** A pessoa da linha; `null` é a linha "Sem ninguém". */
  pessoa: string | null;
}

export interface Reagendamento extends AlvoArrasto {
  diaOriginal: string;
  pessoaOriginal: string | null;
  /** A faixa saiu do lugar: só então a hora vira declarada. */
  mudouHora: boolean;
}

export interface Sessao extends AlvoArrasto {
  modo: ModoArrasto;
  diaOriginal: string;
  pessoaOriginal: string | null;
  faixaOriginal: Faixa;
  /** Onde, dentro da barra, o ponteiro a pegou: sem isto a barra pula para o cursor. */
  offsetMinutos: number;
  /** A área de dias da linha de origem: todas as linhas têm a mesma geometria horizontal. */
  area: HTMLElement;
}

interface Opcoes {
  dias: readonly string[];
  janela: Eixo;
  /** As bordas da jornada, onde o arrasto se imanta. Estável entre renders, ou os ouvintes se religam. */
  ancoras?: readonly number[];
  onSoltar: (resultado: Reagendamento) => void;
}

/**
 * As faixas horizontais de cada dia na linha. O dia sob o mouse é mais largo que
 * os outros, então a conta não pode supor colunas iguais: vale o que a célula
 * mede. Sem medida (célula ainda sem caixa), divide a área por igual.
 */
function colunas(area: HTMLElement, dias: readonly string[]): { left: number; width: number }[] {
  const celulas = Array.from(area.children).filter((filho): filho is HTMLElement => filho instanceof HTMLElement && filho.hasAttribute(ATRIBUTO_DIA));
  const medidas = celulas.map((celula) => celula.getBoundingClientRect());
  if (medidas.length === dias.length && medidas.every((m) => m.width > 0)) return medidas.map(({ left, width }) => ({ left, width }));
  const rect = area.getBoundingClientRect();
  const largura = Math.max(1, rect.width / Math.max(1, dias.length));
  return dias.map((_, indice) => ({ left: rect.left + indice * largura, width: largura }));
}

/** A coluna e o minuto sob o ponteiro, medidos na área da linha. */
function medir(area: HTMLElement, dias: readonly string[], janela: Eixo, clientX: number, indiceFixo?: number) {
  const faixas = colunas(area, dias);
  const achado = faixas.findIndex(({ left, width }) => clientX < left + width);
  const indice = indiceFixo ?? (clientX < faixas[0].left ? 0 : achado === -1 ? dias.length - 1 : achado);
  const { left, width } = faixas[indice];
  return { dia: dias[indice], minuto: minutoNaPosicao((clientX - left) / Math.max(1, width), janela) };
}

const SEM_ANCORAS: readonly number[] = [];

/**
 * A linha sob o ponteiro. `undefined` é "fora da grade", e a barra fica na linha
 * em que estava. A linha "Sem ninguém" só recebe a barra que saiu dela: soltar
 * ali seria tirar alguém sem pôr ninguém, e isso é do formulário.
 */
function linhaSobPonteiro(clientX: number, clientY: number, origem: string | null): string | null | undefined {
  const linha = document.elementFromPoint?.(clientX, clientY)?.closest(`[${ATRIBUTO_LINHA}]`);
  if (!linha) return undefined;
  const pessoa = linha.getAttribute(ATRIBUTO_LINHA) || null;
  if (pessoa === null && origem !== null) return undefined;
  return pessoa;
}

/**
 * O arrasto da barra no Gantt da semana, com Pointer Events puros: o projeto não
 * tem biblioteca de arrasto, e o gesto cabe num punhado de contas sobre a
 * geometria, que é testada em `agenda-grade`. Uma sessão só para a grade toda,
 * porque o corpo da barra pode mudar de linha (RN-61).
 *
 * O teclado faz o mesmo caminho por `aoTeclar`, para o gesto não ser a única porta (RNF-03).
 */
export function useArrasteBarra({ dias, janela, ancoras = SEM_ANCORAS, onSoltar }: Opcoes) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  // Espelho do estado: o soltar lê o arrasto corrente sem esperar render
  const sessaoRef = useRef<Sessao | null>(null);
  const guardar = useCallback((proxima: Sessao | null) => {
    sessaoRef.current = proxima;
    setSessao(proxima);
  }, []);

  const iniciar = useCallback(
    (evento: ReactPointerEvent<HTMLElement>, alvo: AlvoArrasto, modo: ModoArrasto) => {
      const area = evento.currentTarget.closest<HTMLElement>(`[${ATRIBUTO_LINHA}]`);
      if (!area || evento.button !== 0) return;
      evento.preventDefault();
      evento.currentTarget.setPointerCapture?.(evento.pointerId);
      const { minuto } = medir(area, dias, janela, evento.clientX, dias.indexOf(alvo.dia));
      guardar({
        ...alvo,
        modo,
        area,
        diaOriginal: alvo.dia,
        pessoaOriginal: alvo.pessoa,
        faixaOriginal: alvo.faixa,
        offsetMinutos: minuto - alvo.faixa.inicio,
      });
    },
    [dias, janela, guardar],
  );

  // A sessão só liga e desliga os ouvintes; o valor corrente vem do ref
  const ativa = sessao !== null;
  useEffect(() => {
    if (!ativa) return;

    const aoMover = (evento: PointerEvent) => {
      const atual = sessaoRef.current;
      if (!atual) return;
      if (atual.modo === 'mover') {
        const { dia, minuto } = medir(atual.area, dias, janela, evento.clientX);
        const pessoa = linhaSobPonteiro(evento.clientX, evento.clientY, atual.pessoaOriginal);
        const delta = minuto - atual.offsetMinutos - atual.faixaOriginal.inicio;
        guardar({
          ...atual,
          dia,
          pessoa: pessoa === undefined ? atual.pessoa : pessoa,
          faixa: moverFaixa(atual.faixaOriginal, delta, janela, ancoras),
        });
        return;
      }
      const { minuto } = medir(atual.area, dias, janela, evento.clientX, dias.indexOf(atual.diaOriginal));
      const borda = atual.modo;
      const delta = minuto - (borda === 'inicio' ? atual.faixaOriginal.inicio : atual.faixaOriginal.fim);
      guardar({ ...atual, faixa: redimensionarFaixa(atual.faixaOriginal, borda, delta, janela, ancoras) });
    };

    const aoSoltar = () => {
      const atual = sessaoRef.current;
      guardar(null);
      if (!atual) return;
      const mudouHora = atual.faixa.inicio !== atual.faixaOriginal.inicio || atual.faixa.fim !== atual.faixaOriginal.fim;
      if (mudouHora || atual.dia !== atual.diaOriginal || atual.pessoa !== atual.pessoaOriginal) {
        onSoltar({
          id: atual.id,
          dia: atual.dia,
          faixa: atual.faixa,
          pessoa: atual.pessoa,
          diaOriginal: atual.diaOriginal,
          pessoaOriginal: atual.pessoaOriginal,
          mudouHora,
        });
      }
    };

    const desistir = () => guardar(null);
    // Escape desiste, e a barra volta para onde estava
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') desistir();
    };

    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoSoltar);
    window.addEventListener('pointercancel', desistir);
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('pointerup', aoSoltar);
      window.removeEventListener('pointercancel', desistir);
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [ativa, dias, janela, ancoras, onSoltar, guardar]);

  /**
   * RNF-03: o mesmo resultado sem ponteiro. Shift com as setas remarca, Alt com
   * as setas muda a duração, e um passo é o passo do arrasto.
   */
  const aoTeclar = useCallback(
    (evento: React.KeyboardEvent<HTMLElement>, alvo: AlvoArrasto) => {
      const sentido = evento.key === 'ArrowLeft' ? -1 : evento.key === 'ArrowRight' ? 1 : 0;
      if (sentido === 0 || (!evento.shiftKey && !evento.altKey)) return;
      // Sem isto, a seta também trocaria de semana
      evento.preventDefault();
      const faixa = evento.altKey
        ? redimensionarFaixa(alvo.faixa, 'fim', sentido * PASSO_MINUTOS, janela)
        : moverFaixa(alvo.faixa, sentido * PASSO_MINUTOS, janela);
      onSoltar({ ...alvo, faixa, diaOriginal: alvo.dia, pessoaOriginal: alvo.pessoa, mudouHora: true });
    },
    [janela, onSoltar],
  );

  return { sessao, iniciar, aoTeclar };
}
