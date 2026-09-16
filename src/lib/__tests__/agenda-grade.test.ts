import { describe, expect, it } from 'vitest';
import {
  DURACAO_MINIMA,
  type Faixa,
  arredondaPasso,
  contarLinhas,
  empilhar,
  faixaDaBarra,
  formatMinuto,
  janelaDoDia,
  limitaNaJanela,
  minutoNaPosicao,
  moverFaixa,
  posicaoPercentual,
  redimensionarFaixa,
  turnoDoMinuto,
  turnoParaMinuto,
} from '../agenda-grade';
import type { Turno } from '../turnos';

const MANHA: Turno = { id: 'turno-manha', nome: 'manha', inicio: '07:00', fim: '11:00', ativo: true };
const TARDE: Turno = { id: 'turno-tarde', nome: 'tarde', inicio: '13:00', fim: '17:00', ativo: true };
const TURNOS = [MANHA, TARDE];

/** 07:00 às 17:00, os dois turnos e o vão entre eles. */
const JANELA = { inicio: 7 * 60, fim: 17 * 60 };

function faixa(inicio: number, fim: number, derivada = false): Faixa {
  return { inicio, fim, derivada };
}

describe('janelaDoDia', () => {
  it('vai do começo do primeiro turno ao fim do último', () => {
    expect(janelaDoDia(TURNOS)).toEqual(JANELA);
  });

  it('ignora o turno desativado, que não desenha coluna', () => {
    expect(janelaDoDia([MANHA, { ...TARDE, ativo: false }])).toEqual({ inicio: 7 * 60, fim: 11 * 60 });
  });

  it('cai no padrão quando não há turno em uso', () => {
    expect(janelaDoDia([])).toEqual(JANELA);
  });
});

describe('faixaDaBarra (RN-12)', () => {
  it('sem hora, ocupa a janela do turno e sai marcada de derivada', () => {
    expect(faixaDaBarra({ turnoId: TARDE.id, horaInicio: null, horaFim: null }, TURNOS)).toEqual(faixa(13 * 60, 17 * 60, true));
  });

  it('com início e fim, é exatamente o que foi declarado', () => {
    expect(faixaDaBarra({ turnoId: MANHA.id, horaInicio: '07:00', horaFim: '08:00' }, TURNOS)).toEqual(faixa(420, 480));
  });

  it('só com início, dura a duração padrão e segue derivada', () => {
    expect(faixaDaBarra({ turnoId: MANHA.id, horaInicio: '07:30', horaFim: null }, TURNOS)).toEqual(faixa(450, 510, true));
  });

  it('cai na janela do dia quando o turno da tarefa saiu de uso', () => {
    expect(faixaDaBarra({ turnoId: 'turno-que-nao-existe', horaInicio: null, horaFim: null }, TURNOS)).toEqual(
      faixa(JANELA.inicio, JANELA.fim, true),
    );
  });
});

describe('posição e minuto', () => {
  it('a barra do turno da manhã ocupa os primeiros 40% do eixo', () => {
    expect(posicaoPercentual(faixa(7 * 60, 11 * 60), JANELA)).toEqual({ left: 0, width: 40 });
  });

  it('ida e volta entre minuto e fração', () => {
    const meio = minutoNaPosicao(0.5, JANELA);
    expect(meio).toBe(12 * 60);
    expect(posicaoPercentual(faixa(meio, meio + 60), JANELA).left).toBeCloseTo(50);
  });

  it('recorta no limite do eixo em vez de transbordar', () => {
    expect(limitaNaJanela(faixa(6 * 60, 20 * 60), JANELA)).toEqual(faixa(JANELA.inicio, JANELA.fim));
  });

  it('arredonda para o passo de quinze minutos', () => {
    expect(arredondaPasso(487)).toBe(480);
    expect(arredondaPasso(488)).toBe(495);
  });

  it('formata o minuto como o Postgres espera', () => {
    expect(formatMinuto(450)).toBe('07:30');
    expect(formatMinuto(0)).toBe('00:00');
  });
});

describe('turnoDoMinuto', () => {
  it('acha o turno que contém a hora', () => {
    expect(turnoDoMinuto(8 * 60, TURNOS)).toBe(MANHA);
    expect(turnoDoMinuto(14 * 60, TURNOS)).toBe(TARDE);
  });

  it('devolve nulo no vão das 13h, onde não há turno nenhum', () => {
    expect(turnoDoMinuto(12 * 60, TURNOS)).toBeNull();
  });

  it('o fim do turno já é de fora dele', () => {
    expect(turnoDoMinuto(11 * 60, TURNOS)).toBeNull();
  });
});

describe('turnoParaMinuto (RN-12)', () => {
  it('dentro do turno, é o próprio turno', () => {
    expect(turnoParaMinuto(8 * 60, TURNOS)).toBe(MANHA);
  });

  it('no vão das 12h30, mira o turno seguinte', () => {
    expect(turnoParaMinuto(12 * 60 + 30, TURNOS)).toBe(TARDE);
  });

  it('depois do último turno, fica no último: o turno nunca fica vazio', () => {
    expect(turnoParaMinuto(23 * 60, TURNOS)).toBe(TARDE);
  });

  it('sem turno nenhum, não há o que escolher', () => {
    expect(turnoParaMinuto(8 * 60, [])).toBeNull();
  });
});

describe('arrastar', () => {
  it('mover preserva a duração e torna a hora explícita', () => {
    expect(moverFaixa(faixa(8 * 60, 9 * 60, true), 60, JANELA)).toEqual(faixa(9 * 60, 10 * 60));
  });

  it('mover não deixa a barra sair pela direita do eixo', () => {
    expect(moverFaixa(faixa(16 * 60, 17 * 60), 120, JANELA)).toEqual(faixa(16 * 60, 17 * 60));
  });

  it('mover não deixa a barra sair pela esquerda do eixo', () => {
    expect(moverFaixa(faixa(7 * 60, 8 * 60), -120, JANELA)).toEqual(faixa(7 * 60, 8 * 60));
  });

  it('redimensionar pelo fim move só o fim', () => {
    expect(redimensionarFaixa(faixa(8 * 60, 9 * 60), 'fim', 30, JANELA)).toEqual(faixa(8 * 60, 9 * 60 + 30));
  });

  it('redimensionar pelo início move só o início', () => {
    expect(redimensionarFaixa(faixa(8 * 60, 9 * 60), 'inicio', -30, JANELA)).toEqual(faixa(7 * 60 + 30, 9 * 60));
  });

  it('não encolhe abaixo da duração mínima', () => {
    expect(redimensionarFaixa(faixa(8 * 60, 9 * 60), 'fim', -120, JANELA)).toEqual(faixa(8 * 60, 8 * 60 + DURACAO_MINIMA));
    expect(redimensionarFaixa(faixa(8 * 60, 9 * 60), 'inicio', 120, JANELA)).toEqual(faixa(9 * 60 - DURACAO_MINIMA, 9 * 60));
  });
});

describe('empilhar (RF-26)', () => {
  const comFaixa = (f: Faixa) => f;

  it('quem não se cruza divide a mesma sub-linha', () => {
    const barras = empilhar([faixa(7 * 60, 8 * 60), faixa(9 * 60, 10 * 60)], comFaixa);
    expect(barras.map((b) => b.linha)).toEqual([0, 0]);
    expect(contarLinhas(barras)).toBe(1);
  });

  it('quem se cruza desce uma sub-linha, e nenhuma some', () => {
    const barras = empilhar([faixa(7 * 60, 9 * 60), faixa(8 * 60, 10 * 60)], comFaixa);
    expect(barras.map((b) => b.linha)).toEqual([0, 1]);
    expect(contarLinhas(barras)).toBe(2);
  });

  it('a barra que termina onde a outra começa cabe na mesma sub-linha', () => {
    const barras = empilhar([faixa(7 * 60, 8 * 60), faixa(8 * 60, 9 * 60)], comFaixa);
    expect(contarLinhas(barras)).toBe(1);
  });

  it('sem barra nenhuma, ainda há uma sub-linha para desenhar a faixa da pessoa', () => {
    expect(contarLinhas([])).toBe(1);
  });
});
