import { describe, expect, it } from 'vitest';
import type { Area } from '../areas';
import {
  type CanteiroResumo,
  type LoteAberto,
  avisoCapacidade,
  montarOcupacao,
  nextCodigo,
  parseDataCriacao,
  parseFase,
  parseObservacoes,
  parseQuantidade,
  saldoDosMovimentos,
} from '../lotes';

describe('parseQuantidade', () => {
  it('aceita número inteiro com ou sem separador de milhar', () => {
    expect(parseQuantidade('500')).toEqual({ value: 500 });
    expect(parseQuantidade(' 6.000 ')).toEqual({ value: 6000 });
    expect(parseQuantidade('1.240.000')).toEqual({ value: 1_240_000 });
  });

  it('recusa zero, negativo, decimal e texto (UC-25 FE-1)', () => {
    for (const texto of ['0', '-5', '1,5', '1.5', '12.00', 'mil', '']) {
      expect(parseQuantidade(texto), texto).toHaveProperty('error');
    }
  });

  it('na contagem, zero é resposta válida', () => {
    expect(parseQuantidade('0', { zero: true })).toEqual({ value: 0 });
    expect(parseQuantidade('', { zero: true })).toHaveProperty('error');
  });
});

describe('parseFase', () => {
  it('aceita a lista fechada, menos encerrado', () => {
    expect(parseFase('pronto')).toEqual({ value: 'pronto' });
    expect(parseFase('encerrado')).toHaveProperty('error');
    expect(parseFase('vendido')).toHaveProperty('error');
  });
});

describe('parseDataCriacao', () => {
  const hoje = '2026-09-14';
  it('vazia vale hoje; passada vale; futura e inválida não', () => {
    expect(parseDataCriacao('', hoje)).toEqual({ value: hoje });
    expect(parseDataCriacao('2026-08-01', hoje)).toEqual({ value: '2026-08-01' });
    expect(parseDataCriacao('2026-09-15', hoje)).toEqual({ error: 'A data de criação não pode ser depois de hoje.' });
    expect(parseDataCriacao('2026-02-30', hoje)).toHaveProperty('error');
  });
});

describe('parseObservacoes', () => {
  it('vazia vira nulo; longa demais é recusada', () => {
    expect(parseObservacoes('  ')).toEqual({ value: null });
    expect(parseObservacoes('x'.repeat(501))).toHaveProperty('error');
  });
});

describe('nextCodigo (C8: AAAA-NNNN)', () => {
  it('começa em 0001 e segue a sequência do ano', () => {
    expect(nextCodigo(2026, null)).toBe('2026-0001');
    expect(nextCodigo(2026, '2026-0147')).toBe('2026-0148');
    expect(nextCodigo(2027, null)).toBe('2027-0001');
  });
});

describe('avisoCapacidade (RN-28: avisa, não recusa)', () => {
  const canteiro: CanteiroResumo = { id: 'c', areaId: 'a', letra: 'B', numero: 3, capacidade: 8000, lotes: 2, mudas: 4100 };

  it('cabe: sem aviso', () => {
    expect(avisoCapacidade(canteiro, 3900)).toBeNull();
  });

  it('passa da capacidade: diz quanto já tem e quanto fica', () => {
    expect(avisoCapacidade(canteiro, 6000)).toBe(
      'O canteiro B-3 já tem 2 lotes e 4.100 mudas, para uma capacidade de 8.000. Com este lote passa a 10.100. O aviso não impede criar.',
    );
  });

  it('canteiro sem capacidade nunca avisa', () => {
    expect(avisoCapacidade({ ...canteiro, capacidade: null }, 1_000_000)).toBeNull();
  });
});

describe('montarOcupacao (RF-33)', () => {
  const areas: Area[] = [
    {
      id: 'a',
      letra: 'A',
      nome: null,
      canteiros: [
        { id: 'c1', numero: 1, capacidade: null },
        { id: 'c2', numero: 2, capacidade: 500 },
      ],
    },
    { id: 'b', letra: 'B', nome: 'Sombrite', canteiros: [] },
  ];
  const lote = (id: string, canteiroId: string, saldo: number): LoteAberto => ({
    id,
    codigo: `2026-${id}`,
    canteiroId,
    posicao: null,
    especie: 'Ipê',
    recipiente: 'Tubete',
    fase: 'semeado',
    saldo,
  });

  it('o canteiro com lote mostra os lotes e o total; o sem lote aparece livre', () => {
    const [a, b] = montarOcupacao(areas, [lote('1', 'c1', 300), lote('2', 'c1', 200)]);
    expect(a.canteiros[0]).toMatchObject({ livre: false, mudas: 500 });
    expect(a.canteiros[0].lotes.map((l) => l.id)).toEqual(['1', '2']);
    expect(a.canteiros[1]).toMatchObject({ livre: true, mudas: 0, lotes: [] });
    expect(a.livres).toBe(1);
    expect(b).toMatchObject({ letra: 'B', canteiros: [], livres: 0 });
  });
});

describe('saldoDosMovimentos (RF-35)', () => {
  it('entrada, perda, repicagem e ajuste somados reproduzem o saldo', () => {
    expect(saldoDosMovimentos([{ quantidade: 500 }, { quantidade: -20 }, { quantidade: -300 }, { quantidade: 5 }, { quantidade: 0 }])).toBe(185);
  });
});
