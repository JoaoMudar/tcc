import { describe, expect, it } from 'vitest';
import { dimensoesReduzidas } from '../reduz-foto';

describe('dimensoesReduzidas', () => {
  it('reduz o lado maior a 1024 mantendo a proporção', () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1024, altura: 768 });
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 768, altura: 1024 });
  });

  it('não amplia foto pequena', () => {
    expect(dimensoesReduzidas(640, 480)).toEqual({ largura: 640, altura: 480 });
  });
});
