import { describe, expect, it } from 'vitest';
import { formatData, hojeNoViveiro, isDataIso, somaDias } from '../datas';

describe('datas no fuso do viveiro', () => {
  it('às 22h de Brasília ainda é o mesmo dia, embora em UTC já seja o seguinte', () => {
    expect(hojeNoViveiro(new Date('2026-09-15T01:30:00Z'))).toBe('2026-09-14');
    expect(hojeNoViveiro(new Date('2026-09-15T03:30:00Z'))).toBe('2026-09-15');
  });

  it('isDataIso recusa formato e dia inexistente', () => {
    expect(isDataIso('2026-02-28')).toBe(true);
    expect(isDataIso('2026-02-30')).toBe(false);
    expect(isDataIso('14/09/2026')).toBe(false);
    expect(isDataIso('')).toBe(false);
  });

  it('somaDias atravessa mês e ano', () => {
    expect(somaDias('2026-12-20', 15)).toBe('2027-01-04');
    expect(somaDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('formatData', () => {
    expect(formatData('2026-09-04')).toBe('04/09/2026');
  });
});
