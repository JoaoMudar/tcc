import { describe, expect, it } from 'vitest';
import { opcoesDeLote } from '../lotes-rotulos';

const lote = (id: string, areaLetra: string, canteiroNumero: number, posicao: number | null = null) => ({
  id,
  codigo: `2026-${id}`,
  especie: 'Ipê',
  recipiente: 'Tubete',
  areaLetra,
  canteiroNumero,
  posicao,
});

describe('opcoesDeLote', () => {
  it('ordena por área, canteiro e posição, com o grupo "Área · Canteiro"', () => {
    const opcoes = opcoesDeLote([lote('4', 'B', 1), lote('3', 'A', 10), lote('2', 'A', 2, 2), lote('1', 'A', 2, 1)]);
    expect(opcoes.map((o) => o.value)).toEqual(['1', '2', '3', '4']);
    expect(opcoes[0]).toEqual({ value: '1', label: '2026-1 · Ipê · Tubete', grupo: 'Área A · Canteiro 2' });
    expect(opcoes[3].grupo).toBe('Área B · Canteiro 1');
  });

  it('o lote sem posição vem depois dos posicionados do mesmo canteiro', () => {
    const opcoes = opcoesDeLote([lote('b', 'A', 1), lote('a', 'A', 1, 3)]);
    expect(opcoes.map((o) => o.value)).toEqual(['a', 'b']);
  });
});
