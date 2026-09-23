import { describe, expect, it } from 'vitest';
import type { Area } from '../areas';
import { type LoteNoMapa, contarSituacoes, montarMapa, pedemProvidencia, textoPendencia } from '../mapa';

const HOJE = '2026-09-21';

function lote(codigo: string, canteiroId: string, extra: Partial<LoteNoMapa> = {}): LoteNoMapa {
  return {
    id: `id-${codigo}`,
    codigo,
    canteiroId,
    posicao: 1,
    especie: 'Ipê-amarelo',
    recipiente: 'tubete',
    fase: 'crescimento',
    saldo: 500,
    situacao: 'saudavel',
    tarefaPendente: null,
    pendenteDesde: null,
    diasAtraso: 0,
    quantidadeInicial: 500,
    perdas: 0,
    taxa: 0,
    ...extra,
  };
}

const AREAS: Area[] = [
  {
    id: 'area-a',
    letra: 'A',
    nome: 'Pátio de cima',
    canteiros: [
      { id: 'a1', numero: 1, capacidade: null },
      { id: 'a2', numero: 2, capacidade: null },
    ],
  },
  { id: 'area-b', letra: 'B', nome: null, canteiros: [{ id: 'b1', numero: 1, capacidade: null }] },
];

describe('montarMapa (RF-44)', () => {
  it('põe cada lote no seu canteiro e marca livre o que não tem nenhum', () => {
    const mapa = montarMapa(AREAS, [
      lote('2026-0001', 'a1'),
      lote('2026-0002', 'a1', { situacao: 'critico' }),
      lote('2026-0003', 'b1', { situacao: 'atencao' }),
    ]);

    const [a, b] = mapa;
    expect(a.canteiros.map((c) => c.lotes.length)).toEqual([2, 0]);
    // Canteiro livre é canteiro sem nenhum lote aberto
    expect(a.canteiros[1].livre).toBe(true);
    expect(a.ocupados).toBe(1);
    expect(a.contagem).toEqual({ saudavel: 1, atencao: 0, critico: 1 });
    expect(b.contagem).toEqual({ saudavel: 0, atencao: 1, critico: 0 });
  });

  it('TA-47: o canteiro com seis lotes abertos apresenta os seis', () => {
    const seis = [1, 2, 3, 4, 5, 6].map((n) => lote(`2026-000${n}`, 'a1', { posicao: n }));
    const mapa = montarMapa(AREAS, seis);

    expect(mapa[0].canteiros[0].lotes.map((l) => l.posicao)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(mapa[0].canteiros[0].livre).toBe(false);
  });

  it('área sem canteiro nenhum não quebra a contagem', () => {
    expect(montarMapa([{ id: 'c', letra: 'C', nome: null, canteiros: [] }], [])).toEqual([
      { id: 'c', letra: 'C', nome: null, canteiros: [], ocupados: 0, contagem: { saudavel: 0, atencao: 0, critico: 0 } },
    ]);
  });
});

describe('contarSituacoes', () => {
  it('conta as três, e a que não aparece vale zero', () => {
    expect(contarSituacoes([{ situacao: 'critico' }, { situacao: 'critico' }, { situacao: 'saudavel' }])).toEqual({
      saudavel: 1,
      atencao: 0,
      critico: 2,
    });
  });
});

describe('pedemProvidencia (RF-45)', () => {
  it('deixa o saudável de fora, põe o crítico na frente e, dentro do mesmo, o que espera há mais tempo', () => {
    const lista = pedemProvidencia([
      lote('2026-0001', 'a1'),
      lote('2026-0002', 'a1', { situacao: 'atencao', pendenteDesde: '2026-09-21', tarefaPendente: 'Classificação' }),
      lote('2026-0003', 'a1', { situacao: 'critico', pendenteDesde: '2026-09-10', diasAtraso: 11, tarefaPendente: 'Repicagem' }),
      lote('2026-0004', 'a1', { situacao: 'critico', pendenteDesde: '2026-09-01', diasAtraso: 20, tarefaPendente: 'Adubação' }),
    ]);

    expect(lista.map((l) => l.codigo)).toEqual(['2026-0004', '2026-0003', '2026-0002']);
  });
});

describe('textoPendencia (T7.2)', () => {
  it('diz a tarefa e há quantos dias ela espera', () => {
    const atrasada = { tarefaPendente: 'Irrigação', pendenteDesde: '2026-09-18', diasAtraso: 3 };
    expect(textoPendencia(atrasada, HOJE)).toBe('Irrigação, atrasada 3 dias');
    expect(textoPendencia({ ...atrasada, diasAtraso: 1 }, HOJE)).toBe('Irrigação, atrasada 1 dia');
  });

  it('a etapa em atenção ainda não venceu, e não se diz atrasada de zero dia', () => {
    expect(textoPendencia({ tarefaPendente: 'Classificação', pendenteDesde: HOJE, diasAtraso: 0 }, HOJE)).toBe(
      'Classificação, vence hoje',
    );
    expect(textoPendencia({ tarefaPendente: 'Classificação', pendenteDesde: '2026-10-05', diasAtraso: 0 }, HOJE)).toBe(
      'Classificação, vence em 05/10/2026',
    );
  });

  it('lote saudável não tem o que dizer', () => {
    expect(textoPendencia({ tarefaPendente: null, pendenteDesde: null, diasAtraso: 0 }, HOJE)).toBeNull();
  });
});
