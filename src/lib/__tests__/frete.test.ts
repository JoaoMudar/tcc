import { describe, expect, it } from 'vitest';
import { formatPesoCarga, freteParaCampo, isOrigemFrete, pesoDoPedido, sugerirFrete } from '../frete';

describe('sugerirFrete (RN-64)', () => {
  it('ida e volta, pelo consumo e pelo preço do litro, em centavos', () => {
    // 85 km de ida: 170 km ÷ 17 km/L = 10 L × R$ 7 = R$ 70,00
    expect(sugerirFrete(85, 17, 7)).toBe(7000);
    expect(sugerirFrete(42.3, 17, 7)).toBe(3484);
  });

  it('conta sem sentido não sugere nada', () => {
    expect(sugerirFrete(0, 17, 7)).toBe(0);
    expect(sugerirFrete(85, 0, 7)).toBe(0);
  });
});

describe('pesoDoPedido (RN-65)', () => {
  it('soma quantidade × peso do recipiente cheio', () => {
    expect(pesoDoPedido([
      { quantidade: 100, pesoKg: 0.35 },
      { quantidade: 20, pesoKg: 4.5 },
    ])).toEqual({ kg: 125, semPeso: 0 });
  });

  it('item sem peso ou sem quantidade fica de fora, e é contado', () => {
    expect(pesoDoPedido([
      { quantidade: 100, pesoKg: 0.35 },
      { quantidade: 20, pesoKg: null },
      { quantidade: null, pesoKg: 4.5 },
    ])).toEqual({ kg: 35, semPeso: 2 });
  });
});

describe('textos do fechamento', () => {
  it('peso em kg, e em toneladas acima de 10 t', () => {
    expect(formatPesoCarga(1240.5)).toBe('≈ 1.241 kg');
    expect(formatPesoCarga(12500)).toBe('≈ 12,5 t');
  });

  it('frete no campo, como o preço', () => {
    expect(freteParaCampo(8400)).toBe('84,00');
    expect(freteParaCampo(null)).toBe('');
  });

  it('só as duas saídas valem como origem', () => {
    expect(isOrigemFrete('agrolandia')).toBe(true);
    expect(isOrigemFrete('itapema')).toBe(true);
    expect(isOrigemFrete('outro')).toBe(true);
    expect(isOrigemFrete('toString')).toBe(false);
  });
});
