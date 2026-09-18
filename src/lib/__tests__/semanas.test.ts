import { describe, expect, it } from 'vitest';
import { diaMes, diasDaSemana, inicioDaSemana, isInicioDeSemana, lerSemana, nomeDia, rotuloSemana, siglaDia } from '../semanas';

describe('semana da agenda', () => {
  it('começa na segunda, e o domingo é da semana que termina nele', () => {
    expect(inicioDaSemana('2026-09-14')).toBe('2026-09-14');
    expect(inicioDaSemana('2026-09-19')).toBe('2026-09-14');
    expect(inicioDaSemana('2026-09-20')).toBe('2026-09-14');
    expect(inicioDaSemana('2026-01-01')).toBe('2025-12-29');
  });

  it('vai de segunda a sábado', () => {
    expect(diasDaSemana('2026-09-14')).toEqual(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19']);
  });

  it('lê a semana da URL, e cai na de hoje quando não vale', () => {
    expect(lerSemana(undefined, '2026-09-16')).toBe('2026-09-14');
    expect(lerSemana('lixo', '2026-09-16')).toBe('2026-09-14');
    expect(lerSemana('2026-09-23', '2026-09-16')).toBe('2026-09-21');
  });

  it('só a segunda é início de semana', () => {
    expect(isInicioDeSemana('2026-09-14')).toBe(true);
    expect(isInicioDeSemana('2026-09-15')).toBe(false);
    expect(isInicioDeSemana('2026-02-30')).toBe(false);
  });

  it('dá nome aos dias e à semana', () => {
    expect(nomeDia('2026-09-14')).toBe('Segunda');
    expect(siglaDia('2026-09-19')).toBe('SÁB');
    expect(diaMes('2026-09-14')).toBe('14/09');
    expect(rotuloSemana('2026-09-14')).toBe('14/09 a 19/09');
  });
});
