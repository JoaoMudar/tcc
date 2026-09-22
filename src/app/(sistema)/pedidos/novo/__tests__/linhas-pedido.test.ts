import { describe, expect, it } from 'vitest';
import type { EspecieParaColagem, RecipienteParaColagem } from '@/lib/pedidos-colagem';
import { type Linha, aplicarColagemTabular, estaVazia, linhaVazia, proximaChave } from '../linhas-pedido';

const ESPECIES: EspecieParaColagem[] = [
  { id: 'ipe', nome: 'Ipê-amarelo', nomeCientifico: 'Handroanthus albus', nomesPopulares: ['Ipê-amarelo'] },
  { id: 'pit', nome: 'Pitanga', nomeCientifico: 'Eugenia uniflora', nomesPopulares: ['Pitanga'] },
];

const RECIPIENTES: RecipienteParaColagem[] = [
  { id: 'tub', nome: 'Tubete · 0,05 L' },
  { id: 's1722', nome: 'Saco 17x22 · 3 L' },
];

const DO_ZERO = { linha: 0, coluna: 0 };

function colar(linhas: readonly Linha[], celulas: string[][], inicio = DO_ZERO) {
  return aplicarColagemTabular(linhas, inicio, celulas, ESPECIES, RECIPIENTES);
}

describe('linhas da planilha de itens (T8.1)', () => {
  it('a linha nova nasce vazia, e a chave nunca repete', () => {
    const linhas = [linhaVazia(1), linhaVazia(2)];
    expect(estaVazia(linhas[0])).toBe(true);
    expect(proximaChave(linhas)).toBe(3);
  });

  it('a linha com altura e mais nada já não está vazia', () => {
    expect(estaVazia({ ...linhaVazia(1), altura: '1,20' })).toBe(false);
  });
});

describe('colagem de planilha nas células (T8.16)', () => {
  it('as quatro colunas caem na ordem da tela, a partir da primeira célula', () => {
    const [linha] = colar([linhaVazia(1)], [['Ipê-amarelo', 'Tubete', '1,20', '500']]);
    expect(linha).toMatchObject({ especieId: 'ipe', recipienteId: 'tub', altura: '1,20', quantidade: '500' });
  });

  it('o que passa do fim da tabela vira linha nova', () => {
    const linhas = colar([linhaVazia(1)], [['Ipê-amarelo'], ['Pitanga'], ['Ipê-amarelo']]);
    expect(linhas).toHaveLength(3);
    expect(linhas.map((linha) => linha.chave)).toEqual([1, 2, 3]);
  });

  it('colando no meio da tabela, as colunas andam com o foco', () => {
    const [linha] = colar([{ ...linhaVazia(1), especieId: 'pit' }], [['0,80', '300']], { linha: 0, coluna: 2 });
    // A espécie que já estava não é apagada: a colagem começou na altura
    expect(linha).toMatchObject({ especieId: 'pit', altura: '0,80', quantidade: '300' });
  });

  it('a espécie que o catálogo não reconhece fica em branco, e não é chutada', () => {
    const [linha] = colar([linhaVazia(1)], [['Espécie que não existe', 'Tubete', '', '10']]);
    expect(linha.especieId).toBe('');
    expect(linha.recipienteId).toBe('tub');
  });

  it('o milhar da planilha vira número limpo, e a altura vira "1,20"', () => {
    const [linha] = colar([linhaVazia(1)], [['Pitanga', 'Saco 17x22 · 3 L', '1.2', '1.000']]);
    expect(linha).toMatchObject({ altura: '1,20', quantidade: '1000' });
  });

  it('o que não dá para entender fica na célula como veio, para a pessoa corrigir', () => {
    const [linha] = colar([linhaVazia(1)], [['Pitanga', 'Tubete', 'grande', 'meia dúzia']]);
    expect(linha).toMatchObject({ altura: 'grande', quantidade: 'meia dúzia' });
  });

  it('célula vazia não apaga o que já estava na linha', () => {
    const antes: Linha = { chave: 1, generico: false, especieId: 'ipe', recipienteId: 'tub', altura: '1,20', quantidade: '50' };
    const [linha] = colar([antes], [['', '', '', '80']]);
    expect(linha).toMatchObject({ especieId: 'ipe', recipienteId: 'tub', altura: '1,20', quantidade: '80' });
  });

  it('colar espécie no item genérico o torna específico, porque agora ele tem espécie', () => {
    const [linha] = colar([{ ...linhaVazia(1), generico: true }], [['Pitanga']]);
    expect(linha).toMatchObject({ generico: false, especieId: 'pit' });
  });
});
