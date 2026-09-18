import { describe, expect, it } from 'vitest';
import { acimaDoLimite, formatPercentual, mortalidade, parseFiltroPerdas, totaisPorCausa } from '../perdas';

const ID = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';

describe('mortalidade (RF-42)', () => {
  it('é a soma das perdas dividida pela quantidade inicial', () => {
    expect(mortalidade(120, 500)).toBe(0.24);
    expect(mortalidade(0, 500)).toBe(0);
    expect(mortalidade(10, 0)).toBeNull();
  });

  it('destaca só acima do limite, e o limite é o parâmetro (TA-24, TA-25)', () => {
    expect(acimaDoLimite(0.24, 20)).toBe(true);
    expect(acimaDoLimite(0.24, 30)).toBe(false);
    expect(acimaDoLimite(0.2, 20)).toBe(false);
    expect(acimaDoLimite(null, 0)).toBe(false);
  });

  it('formatPercentual', () => {
    expect(formatPercentual(0.24)).toBe('24%');
    expect(formatPercentual(0.0813)).toBe('8,1%');
  });
});

describe('parseFiltroPerdas', () => {
  const hoje = '2026-09-14';

  it('sem filtro: os últimos 90 dias, qualquer espécie e causa', () => {
    expect(parseFiltroPerdas({}, hoje)).toEqual({ de: '2026-06-16', ate: hoje, especieId: null, causa: null });
  });

  it('usa o que é válido, descarta o resto e desinverte o período', () => {
    expect(parseFiltroPerdas({ de: '2026-09-01', ate: '2026-08-01', especie: ID, causa: 'geada' }, hoje)).toEqual({
      de: '2026-08-01',
      ate: '2026-09-01',
      especieId: ID,
      causa: 'geada',
    });
    expect(parseFiltroPerdas({ de: 'ontem', especie: "1' OR 1=1", causa: 'fungo' }, hoje)).toMatchObject({
      especieId: null,
      causa: null,
      de: '2026-06-16',
    });
  });
});

describe('totaisPorCausa', () => {
  it('soma por causa, da maior para a menor', () => {
    expect(
      totaisPorCausa([
        { causa: 'seca', quantidade: 10 },
        { causa: 'geada', quantidade: 40 },
        { causa: 'seca', quantidade: 35 },
      ]),
    ).toEqual([
      { causa: 'seca', quantidade: 45 },
      { causa: 'geada', quantidade: 40 },
    ]);
  });
});
