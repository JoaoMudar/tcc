import { describe, expect, it } from 'vitest';
import { diasDaJanela, lerZoom, passoDoZoom, zoomVizinho } from '../agenda-zoom';
import { diasUteisDaSemana } from '../semanas';

const UTEIS = diasUteisDaSemana('2026-09-28');
const [SEG, TER, QUA, QUI, SEX] = UTEIS;

describe('zoom da agenda', () => {
  it('lerZoom aceita os três e volta para a semana com qualquer outra coisa', () => {
    expect(lerZoom('dia')).toBe('dia');
    expect(lerZoom('3dias')).toBe('3dias');
    expect(lerZoom('mes')).toBe('semana');
    expect(lerZoom(undefined)).toBe('semana');
  });

  it('a semana mostra os cinco dias úteis', () => {
    expect(diasDaJanela('semana', QUA, UTEIS)).toEqual(UTEIS);
  });

  it('o dia mostra só ele, e o fim de semana cai na sexta', () => {
    expect(diasDaJanela('dia', TER, UTEIS)).toEqual([TER]);
    expect(diasDaJanela('dia', '2026-10-03', UTEIS)).toEqual([SEX]);
    expect(diasDaJanela('dia', '2026-10-04', UTEIS)).toEqual([SEX]);
  });

  it('os 3 dias ficam centrados no dia, presos dentro da semana', () => {
    expect(diasDaJanela('3dias', SEG, UTEIS)).toEqual([SEG, TER, QUA]);
    expect(diasDaJanela('3dias', TER, UTEIS)).toEqual([SEG, TER, QUA]);
    expect(diasDaJanela('3dias', QUA, UTEIS)).toEqual([TER, QUA, QUI]);
    expect(diasDaJanela('3dias', SEX, UTEIS)).toEqual([QUA, QUI, SEX]);
  });

  it('com menos dias que o zoom pede, mostra os que há', () => {
    expect(diasDaJanela('3dias', SEG, [SEG, TER])).toEqual([SEG, TER]);
  });

  it('a seta anda 7 dias na semana, e dias úteis nos zooms menores', () => {
    expect(passoDoZoom('semana', QUA, 1)).toBe('2026-10-07');
    expect(passoDoZoom('semana', QUA, -1)).toBe('2026-09-23');
    expect(passoDoZoom('dia', SEX, 1)).toBe('2026-10-05');
    expect(passoDoZoom('dia', SEG, -1)).toBe('2026-09-25');
    expect(passoDoZoom('3dias', QUI, 1)).toBe('2026-10-06');
    expect(passoDoZoom('3dias', TER, -1)).toBe('2026-09-24');
  });

  it('aproximar e afastar param nas pontas', () => {
    expect(zoomVizinho('semana', 1)).toBe('3dias');
    expect(zoomVizinho('3dias', 1)).toBe('dia');
    expect(zoomVizinho('dia', 1)).toBe('dia');
    expect(zoomVizinho('semana', -1)).toBe('semana');
  });
});
