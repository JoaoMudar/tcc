import { describe, expect, it } from 'vitest';
import {
  DURACAO_MINIMA,
  type Faixa,
  arredondaPasso,
  faixaDaBarra,
  formatMinuto,
  opcoesDeHora,
  janelaDoDia,
  limitaNaJanela,
  marcasDeHora,
  minutoNaPosicao,
  percentualDoMinuto,
  moverFaixa,
  posicaoPercentual,
  redimensionarFaixa,
  sobrepor,
  ancoraProxima,
  ancorasDaJornada,
  comparaPrecedencia,
  duracaoUtil,
  ocupacaoDoDia,
  turnoDoMinuto,
  turnoParaMinuto,
  vaoParaLancar,
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
    expect(janelaDoDia(TURNOS)).toEqual({ ...JANELA, vaos: [{ inicio: 11 * 60, fim: 13 * 60 }] });
  });

  it('ignora o turno desativado, que não desenha coluna', () => {
    expect(janelaDoDia([MANHA, { ...TARDE, ativo: false }])).toEqual({ inicio: 7 * 60, fim: 11 * 60, vaos: [] });
  });

  it('cai no padrão quando não há turno em uso', () => {
    expect(janelaDoDia([])).toEqual({ ...JANELA, vaos: [] });
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

describe('marcas de hora', () => {
  it('dá cada hora cheia da janela, das sete às cinco', () => {
    expect(marcasDeHora(JANELA)).toEqual([420, 480, 540, 600, 660, 720, 780, 840, 900, 960, 1020]);
  });

  it('começa na primeira hora cheia e para na última, quando a janela quebra', () => {
    const marcas = marcasDeHora({ inicio: 7 * 60 + 30, fim: 16 * 60 + 45 });
    expect(marcas[0]).toBe(8 * 60);
    expect(marcas[marcas.length - 1]).toBe(16 * 60);
  });

  it('janela mais curta que uma hora pode não ter marca nenhuma', () => {
    expect(marcasDeHora({ inicio: 7 * 60 + 10, fim: 7 * 60 + 50 })).toEqual([]);
  });

  it('o percentual do minuto vai de zero a cem dentro da janela', () => {
    expect(percentualDoMinuto(JANELA.inicio, JANELA)).toBe(0);
    expect(percentualDoMinuto(JANELA.fim, JANELA)).toBe(100);
    expect(percentualDoMinuto(12 * 60, JANELA)).toBe(50);
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

describe('eixo comprimido: o almoço vira divisor', () => {
  const EIXO = janelaDoDia(TURNOS);

  it('o vão não ocupa largura: a manhã é a primeira metade e a tarde a segunda', () => {
    expect(percentualDoMinuto(11 * 60, EIXO)).toBe(50);
    expect(percentualDoMinuto(12 * 60, EIXO)).toBe(50);
    expect(percentualDoMinuto(13 * 60, EIXO)).toBe(50);
    expect(percentualDoMinuto(15 * 60, EIXO)).toBe(75);
  });

  it('a tarefa que atravessa o almoço segue contínua, com a largura só do tempo útil', () => {
    expect(posicaoPercentual(faixa(10 * 60, 14 * 60), EIXO)).toEqual({ left: 37.5, width: 25 });
    expect(duracaoUtil(faixa(10 * 60, 14 * 60), EIXO)).toBe(120);
  });

  it('a fração vira minuto saltando o vão: no divisor fica o fim da manhã, logo depois já é a tarde', () => {
    expect(minutoNaPosicao(0.25, EIXO)).toBe(9 * 60);
    expect(minutoNaPosicao(0.5, EIXO)).toBe(11 * 60);
    expect(minutoNaPosicao(0.75, EIXO)).toBe(15 * 60);
  });

  it('a hora dentro do vão não tem marca; a régua fora de foco fica só com as pares', () => {
    expect(marcasDeHora(EIXO)).toEqual([420, 480, 540, 600, 660, 780, 840, 900, 960, 1020]);
    expect(marcasDeHora(EIXO, { pares: true })).toEqual([480, 600, 840, 960]);
  });

  it('a ocupação soma as tarefas no tempo útil, e a cruzada conta duas vezes', () => {
    expect(ocupacaoDoDia([faixa(7 * 60, 11 * 60), faixa(8 * 60, 9 * 60)], EIXO)).toBe(300);
    expect(ocupacaoDoDia([], EIXO)).toBe(0);
  });
});

describe('ímã nas bordas da jornada', () => {
  const ANCORAS = ancorasDaJornada(TURNOS);

  it('as bordas são o começo e o fim de cada turno em uso', () => {
    expect(ANCORAS).toEqual([7 * 60, 11 * 60, 13 * 60, 17 * 60]);
  });

  it('encaixa só a menos de dez minutos', () => {
    expect(ancoraProxima(11 * 60 - 9, ANCORAS)).toBe(11 * 60);
    expect(ancoraProxima(11 * 60 - 10, ANCORAS)).toBeNull();
  });

  it('mover: o fim que passa perto do fim da manhã encaixa nele, fora do passo', () => {
    // 08:00–09:00 andando 118 min: o fim bruto é 10:58
    expect(moverFaixa(faixa(8 * 60, 9 * 60), 118, JANELA, ANCORAS)).toEqual(faixa(10 * 60, 11 * 60));
    // O começo bruto 13:07 encaixa nas 13:00
    expect(moverFaixa(faixa(8 * 60, 9 * 60), 307, JANELA, ANCORAS)).toEqual(faixa(13 * 60, 14 * 60));
  });

  it('redimensionar: a borda puxada encaixa na âncora; longe dela, no passo', () => {
    expect(redimensionarFaixa(faixa(8 * 60, 9 * 60), 'fim', 125, JANELA, ANCORAS)).toEqual(faixa(8 * 60, 11 * 60));
    expect(redimensionarFaixa(faixa(8 * 60, 9 * 60), 'fim', 95, JANELA, ANCORAS)).toEqual(faixa(8 * 60, 10 * 60 + 30));
  });
});

describe('comparaPrecedencia (RF-26)', () => {
  const p = (id: string, inicio: number, fim: number, prioridadeEm: string | null = null) => ({ id, prioridadeEm, faixa: { inicio, fim } });

  it('sem escolha, a mais longa vem antes', () => {
    expect([p('curta', 480, 540), p('longa', 420, 660)].sort(comparaPrecedencia).map((x) => x.id)).toEqual(['longa', 'curta']);
  });

  it('no empate de duração, a que começa primeiro', () => {
    expect([p('depois', 540, 600), p('antes', 480, 540)].sort(comparaPrecedencia).map((x) => x.id)).toEqual(['antes', 'depois']);
  });

  it('a escolhida à mão vence a duração, e a escolha mais recente vence a anterior', () => {
    const lista = [p('longa', 420, 660), p('antiga', 480, 540, '2026-09-20T12:00:00.000000Z'), p('nova', 500, 520, '2026-09-21T12:00:00.000000Z')];
    expect(lista.sort(comparaPrecedencia).map((x) => x.id)).toEqual(['nova', 'antiga', 'longa']);
  });
});

describe('sobrepor (RF-26)', () => {
  interface T {
    id: string;
    faixa: Faixa;
    prioridadeEm: string | null;
  }
  const t = (id: string, inicio: number, fim: number, prioridadeEm: string | null = null): T => ({ id, faixa: faixa(inicio, fim), prioridadeEm });
  const compara = comparaPrecedencia;
  const resumo = (itens: T[], max = 2) =>
    sobrepor(itens, (i) => i.faixa, compara, max).map((tr) => [tr.item.id, tr.camada, tr.camadas, formatMinuto(tr.faixa.inicio), formatMinuto(tr.faixa.fim)]);

  it('quem não se cruza fica inteira, sozinha na altura toda', () => {
    expect(resumo([t('a', 7 * 60, 8 * 60), t('b', 9 * 60, 10 * 60)])).toEqual([
      ['a', 0, 1, '07:00', '08:00'],
      ['b', 0, 1, '09:00', '10:00'],
    ]);
  });

  it('a mais longa fica em cima, e a curta embaixo dela no trecho cruzado', () => {
    expect(resumo([t('manha', 7 * 60 + 30, 12 * 60), t('oito', 8 * 60, 9 * 60)])).toEqual([
      ['manha', 0, 1, '07:30', '08:00'],
      ['manha', 0, 2, '08:00', '09:00'],
      ['oito', 1, 2, '08:00', '09:00'],
      ['manha', 0, 1, '09:00', '12:00'],
    ]);
  });

  it('tornar a curta principal inverte as faixas', () => {
    expect(resumo([t('manha', 7 * 60 + 30, 12 * 60), t('oito', 8 * 60, 9 * 60, '2026-09-21T12:00:00.000000Z')])).toEqual([
      ['manha', 0, 1, '07:30', '08:00'],
      ['oito', 0, 2, '08:00', '09:00'],
      ['manha', 1, 2, '08:00', '09:00'],
      ['manha', 0, 1, '09:00', '12:00'],
    ]);
  });

  it('marca só as bordas reais, que é onde a alça de duração fica', () => {
    const trechos = sobrepor([t('manha', 450, 720), t('oito', 480, 540)], (i) => i.faixa, compara);
    const daManha = trechos.filter((tr) => tr.item.id === 'manha');
    expect(daManha.map((tr) => [tr.bordaInicio, tr.bordaFim])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
    expect(daManha[0].completa).toEqual(faixa(450, 720));
  });

  it('a terceira não cabe: fica nas ocultas da última camada', () => {
    const trechos = sobrepor([t('a', 420, 660), t('b', 420, 600), t('c', 420, 540)], (i) => i.faixa, compara);
    const cruzado = trechos.filter((tr) => tr.faixa.inicio === 420);
    expect(cruzado.map((tr) => [tr.item.id, tr.camada, tr.ocultas.map((o) => o.id)])).toEqual([
      ['a', 0, []],
      ['b', 1, ['c']],
    ]);
  });

  it('com mais camadas permitidas, as três aparecem', () => {
    expect(resumo([t('a', 420, 660), t('b', 420, 660), t('c', 420, 660)], 3).map((r) => [r[0], r[1], r[2]])).toEqual([
      ['a', 0, 3],
      ['b', 1, 3],
      ['c', 2, 3],
    ]);
  });

  it('sem tarefa, sem trecho', () => {
    expect(resumo([])).toEqual([]);
  });
});

describe('vaoParaLancar (clique no vazio)', () => {
  it('turno livre: sem hora, a tarefa vale pelo turno inteiro', () => {
    expect(vaoParaLancar(9 * 60, TURNOS, [])).toEqual({ turno: MANHA, horaInicio: null, horaFim: null });
  });

  it('à direita de uma tarefa das 8 às 9: das 9 ao fim do turno', () => {
    expect(vaoParaLancar(10 * 60, TURNOS, [faixa(8 * 60, 9 * 60)])).toEqual({ turno: MANHA, horaInicio: '09:00', horaFim: '11:00' });
  });

  it('à esquerda: do começo do turno até as 8', () => {
    expect(vaoParaLancar(7 * 60 + 15, TURNOS, [faixa(8 * 60, 9 * 60)])).toEqual({ turno: MANHA, horaInicio: '07:00', horaFim: '08:00' });
  });

  it('no vão entre turnos, vale o turno seguinte', () => {
    expect(vaoParaLancar(12 * 60, TURNOS, [faixa(8 * 60, 9 * 60)])?.turno).toBe(TARDE);
  });

  it('tarefa de outro turno não ocupa este', () => {
    expect(vaoParaLancar(14 * 60, TURNOS, [faixa(8 * 60, 9 * 60)])).toEqual({ turno: TARDE, horaInicio: null, horaFim: null });
  });

  it('turno lotado: sem hora, como o turno inteiro', () => {
    expect(vaoParaLancar(9 * 60, TURNOS, [faixa(7 * 60, 11 * 60)])).toEqual({ turno: MANHA, horaInicio: null, horaFim: null });
  });

  it('clique em cima de uma tarefa cai no vão mais próximo', () => {
    expect(vaoParaLancar(8 * 60 + 50, TURNOS, [faixa(8 * 60, 9 * 60)])?.horaInicio).toBe('09:00');
  });
});

describe('opcoesDeHora (painel do celular, de quinze em quinze)', () => {
  const MANHA_MEIA = { ...MANHA, inicio: '07:30', fim: '11:30' };
  const TARDE_MEIA = { ...TARDE, inicio: '13:30', fim: '17:30' };

  it('vai de uma hora antes do primeiro turno a uma depois do último', () => {
    const horas = opcoesDeHora([MANHA_MEIA, TARDE_MEIA]);
    expect(horas[0]).toBe('06:30');
    expect(horas.at(-1)).toBe('18:30');
    expect(horas).toContain('07:15');
    expect(horas.every((hora) => Number(hora.slice(3)) % 15 === 0)).toBe(true);
  });

  it('ignora o turno desativado', () => {
    expect(opcoesDeHora([MANHA_MEIA, { ...TARDE_MEIA, ativo: false }]).at(-1)).toBe('12:30');
  });
});
