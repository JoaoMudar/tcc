import { describe, expect, it } from 'vitest';
import { type LoteCandidato, opcoesDeLote, sugerirLote } from '../lote-da-venda';

const IPE = 'especie-ipe';
const TUBETE = 'rec-tubete';
const SACO = 'rec-saco';

function lote(over: Partial<LoteCandidato> & { id: string }): LoteCandidato {
  return { codigo: over.id.toUpperCase(), especieId: IPE, recipienteId: TUBETE, saldo: 500, alturaM: null, dataCriacao: '2026-01-01', ...over };
}

const item = { especieId: IPE, recipienteId: TUBETE, alturaM: null, quantidade: 300 };

describe('sugerirLote (RF-24)', () => {
  it('só lote da mesma espécie e recipiente, com saldo', () => {
    const lotes = [lote({ id: 'saco', recipienteId: SACO }), lote({ id: 'vazio', saldo: 0 }), lote({ id: 'certo' })];
    expect(sugerirLote(lotes, item)).toBe('certo');
    expect(sugerirLote([lote({ id: 'saco', recipienteId: SACO })], item)).toBeNull();
  });

  it('o item sem espécie não tem lote', () => {
    expect(sugerirLote([lote({ id: 'a' })], { ...item, especieId: null })).toBeNull();
  });

  it('prefere o lote que cobre a quantidade inteira', () => {
    const lotes = [lote({ id: 'pequeno', saldo: 100, dataCriacao: '2025-01-01' }), lote({ id: 'grande', saldo: 400 })];
    expect(sugerirLote(lotes, item)).toBe('grande');
  });

  it('entre os que cobrem, a altura mais próxima da pedida, e o medido antes do sem medida', () => {
    const lotes = [
      lote({ id: 'sem-medida' }),
      lote({ id: 'alto', alturaM: 1.5 }),
      lote({ id: 'perto', alturaM: 1.15 }),
    ];
    expect(sugerirLote(lotes, { ...item, alturaM: 1.2 })).toBe('perto');
  });

  it('à igualdade, o lote mais antigo sai primeiro', () => {
    const lotes = [lote({ id: 'novo', dataCriacao: '2026-05-01' }), lote({ id: 'velho', dataCriacao: '2025-09-01' })];
    expect(sugerirLote(lotes, item)).toBe('velho');
  });

  it('sem lote que cubra, sugere entre os que têm saldo, e a viagem é que recusa a baixa', () => {
    const lotes = [lote({ id: 'a', saldo: 50 }), lote({ id: 'b', saldo: 80, dataCriacao: '2025-01-01' })];
    expect(sugerirLote(lotes, item)).toBe('b');
  });
});

describe('opcoesDeLote', () => {
  it('mostra código, saldo e altura, só do par do item', () => {
    const opcoes = opcoesDeLote([lote({ id: 'l1', alturaM: 1.2, saldo: 1200 }), lote({ id: 'x', recipienteId: SACO })], item);
    expect(opcoes).toHaveLength(1);
    expect(opcoes[0].value).toBe('l1');
    expect(opcoes[0].label).toMatch(/^L1 · 1\.200 mudas · /);
  });
});
