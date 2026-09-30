import { describe, expect, it } from 'vitest';
import { ENTIDADES_CRITICAS, relatorioIntegridade, type Integridade } from '../manutencao';

const contagens = Object.fromEntries(ENTIDADES_CRITICAS.map((t) => [t, 1])) as Integridade['contagens'];

describe('relatorioIntegridade', () => {
  it('diz que o saldo bate quando não há lote divergente', () => {
    const texto = relatorioIntegridade({ contagens, lotesAbertos: 3, divergentes: [] });
    expect(texto).toContain('movimentos_lote');
    expect(texto).toContain('lotes abertos');
    expect(texto).toContain('todos batem');
  });

  it('lista cada lote divergente com o saldo e a soma', () => {
    const texto = relatorioIntegridade({ contagens, lotesAbertos: 1, divergentes: [{ codigo: '2026-0007', saldo: 290, somaMovimentos: 300 }] });
    expect(texto).toContain('ATENÇÃO: 1 lote(s)');
    expect(texto).toContain('2026-0007: saldo 290, movimentos somam 300');
  });
});
