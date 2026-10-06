import { describe, expect, it } from 'vitest';
import { diasDaJanela, lerZoom, passoDoZoom, zoomVizinho } from '../agenda-zoom';
import { diasDaSemana } from '../semanas';

const SEMANA = diasDaSemana('2026-09-28');
const [SEG, TER, QUA, QUI, SEX, SAB, DOM] = SEMANA;

describe('zoom da agenda', () => {
  it('lerZoom aceita os três e volta para a semana com qualquer outra coisa', () => {
    expect(lerZoom('dia')).toBe('dia');
    expect(lerZoom('3dias')).toBe('3dias');
    expect(lerZoom('mes')).toBe('semana');
    expect(lerZoom(undefined)).toBe('semana');
  });

  it('a semana mostra os cinco dias úteis, mesmo vindo do fim de semana', () => {
    expect(diasDaJanela('semana', QUA, SEMANA)).toEqual([SEG, TER, QUA, QUI, SEX]);
    expect(diasDaJanela('semana', DOM, SEMANA)).toEqual([SEG, TER, QUA, QUI, SEX]);
  });

  it('o dia mostra só ele, sábado e domingo inclusive', () => {
    expect(diasDaJanela('dia', TER, SEMANA)).toEqual([TER]);
    expect(diasDaJanela('dia', SAB, SEMANA)).toEqual([SAB]);
    expect(diasDaJanela('dia', DOM, SEMANA)).toEqual([DOM]);
  });

  it('os 3 dias começam no dia e encostam no domingo', () => {
    expect(diasDaJanela('3dias', SEG, SEMANA)).toEqual([SEG, TER, QUA]);
    expect(diasDaJanela('3dias', QUA, SEMANA)).toEqual([QUA, QUI, SEX]);
    expect(diasDaJanela('3dias', SEX, SEMANA)).toEqual([SEX, SAB, DOM]);
    expect(diasDaJanela('3dias', SAB, SEMANA)).toEqual([SEX, SAB, DOM]);
    expect(diasDaJanela('3dias', DOM, SEMANA)).toEqual([SEX, SAB, DOM]);
  });

  it('com menos dias que o zoom pede, mostra os que há', () => {
    expect(diasDaJanela('3dias', SEG, [SEG, TER])).toEqual([SEG, TER]);
  });

  it('a seta anda 7 dias na semana e um dia corrido no Dia', () => {
    expect(passoDoZoom('semana', QUA, 1)).toBe('2026-10-07');
    expect(passoDoZoom('semana', QUA, -1)).toBe('2026-09-23');
    expect(passoDoZoom('dia', SEX, 1)).toBe(SAB);
    expect(passoDoZoom('dia', DOM, 1)).toBe('2026-10-05');
    expect(passoDoZoom('dia', SEG, -1)).toBe('2026-09-27');
  });

  it('no 3 dias a seta anda de janela em janela, sem pular dia', () => {
    expect(passoDoZoom('3dias', SEG, 1)).toBe(QUI);
    expect(passoDoZoom('3dias', QUI, 1)).toBe(SEX);
    expect(passoDoZoom('3dias', SEX, 1)).toBe('2026-10-05');
    expect(passoDoZoom('3dias', DOM, 1)).toBe('2026-10-05');
    expect(passoDoZoom('3dias', SEX, -1)).toBe(TER);
    expect(passoDoZoom('3dias', TER, -1)).toBe(SEG);
    expect(passoDoZoom('3dias', SEG, -1)).toBe('2026-09-25');
  });

  it('aproximar e afastar param nas pontas', () => {
    expect(zoomVizinho('semana', 1)).toBe('3dias');
    expect(zoomVizinho('3dias', 1)).toBe('dia');
    expect(zoomVizinho('dia', 1)).toBe('dia');
    expect(zoomVizinho('semana', -1)).toBe('semana');
  });
});
