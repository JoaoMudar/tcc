import { describe, expect, it } from 'vitest';
import { corCheia } from '../BarraTarefa';

describe('corCheia: a cor do card no Gantt', () => {
  it('fora da semana a fechar, só a confirmada ganha cor cheia, a da categoria', () => {
    expect(corCheia('planejada', 'terra', false)).toBeNull();
    expect(corCheia('feita', 'terra', false)).not.toMatch(/bg-feito|bg-atencao/);
    expect(corCheia('feita', 'terra', false)).not.toBeNull();
  });

  it('na semana a fechar, a não confirmada fica âmbar e a confirmada verde', () => {
    expect(corCheia('presumida', 'terra', true)).toBe('bg-atencao');
    expect(corCheia('feita', 'terra', true)).toBe('bg-feito');
    expect(corCheia('parcial', 'terra', true)).toBe('bg-feito');
    // A sem ninguém escalado segue pendente, sem cor cheia
    expect(corCheia('planejada', 'terra', true)).toBeNull();
  });
});
