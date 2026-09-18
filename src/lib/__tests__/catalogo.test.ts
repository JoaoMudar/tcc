import { describe, expect, it } from 'vitest';
import {
  duplicateAreaMessage,
  duplicateCanteiroMessage,
  emUsoMessage,
  parseCapacidade,
  parseLetra,
  parseNumeroCanteiro,
} from '../areas';
import { parseInsumoFields } from '../insumos';
import { duplicateMessage as recipienteDuplicado, formatVolume, parseRecipienteFields } from '../recipientes';
import { parseTipoTarefaFields, resumoDeclaracoes } from '../tipos-tarefa';

describe('áreas e canteiros (RF-13)', () => {
  it('a área é uma letra, e minúscula vira maiúscula', () => {
    expect(parseLetra(' a ')).toEqual({ value: 'A' });
    expect(parseLetra('AB')).toHaveProperty('error');
    expect(parseLetra('1')).toHaveProperty('error');
    expect(parseLetra('Ç')).toHaveProperty('error');
  });

  it('canteiro é inteiro a partir de 1', () => {
    expect(parseNumeroCanteiro('7')).toEqual({ value: 7 });
    expect(parseNumeroCanteiro('0')).toHaveProperty('error');
    expect(parseNumeroCanteiro('2.5')).toHaveProperty('error');
    expect(parseNumeroCanteiro('-1')).toHaveProperty('error');
  });

  it('capacidade é opcional', () => {
    expect(parseCapacidade('')).toEqual({ value: null });
    expect(parseCapacidade('1200')).toEqual({ value: 1200 });
    expect(parseCapacidade('mil')).toHaveProperty('error');
  });

  it('repetido e em uso viram mensagem própria', () => {
    expect(duplicateCanteiroMessage({ code: '23505', constraint: 'canteiros_numero_unico_na_area' }, 7, 'A')).toBe(
      'O canteiro 7 já existe na área A. Escolha outro número.',
    );
    expect(duplicateAreaMessage({ code: '23505', constraint: 'areas_letra_key' }, 'B')).toBe('A área B já existe.');
    expect(duplicateAreaMessage({ code: '23505', constraint: 'outra' }, 'B')).toBeNull();
    expect(emUsoMessage({ code: '23503' }, 'O canteiro')).toMatch(/não pode ser excluído/);
    expect(emUsoMessage(new Error('x'), 'O canteiro')).toBeNull();
  });
});

describe('recipientes (RF-11)', () => {
  it('volume em litros com vírgula, ou em branco', () => {
    expect(parseRecipienteFields({ nome: ' Saco 10x18 ', volume: '0,9' })).toEqual({
      value: { nome: 'Saco 10x18', volumeLitros: 0.9 },
    });
    expect(parseRecipienteFields({ nome: 'Balde', volume: '' })).toEqual({ value: { nome: 'Balde', volumeLitros: null } });
    expect(parseRecipienteFields({ nome: 'Balde', volume: '0' })).toHaveProperty('error');
    expect(parseRecipienteFields({ nome: 'Balde', volume: '1000' })).toHaveProperty('error');
    expect(parseRecipienteFields({ nome: 'B', volume: '' })).toHaveProperty('error');
  });

  it('formata o volume', () => {
    expect(formatVolume(0.9)).toBe('0,9 L');
    expect(formatVolume(0.055)).toBe('55 mL');
    expect(formatVolume(12)).toBe('12 L');
    expect(formatVolume(null)).toBe('');
  });

  it('nome repetido', () => {
    expect(recipienteDuplicado({ code: '23505', constraint: 'recipientes_nome_key' })).toBe(
      'Já existe recipiente com esse nome.',
    );
  });
});

describe('insumos (RF-12)', () => {
  it('categoria e unidade só da lista', () => {
    expect(parseInsumoFields({ nome: 'Vermiculita', categoria: 'substrato', unidadeMedida: 'litro' })).toEqual({
      value: { nome: 'Vermiculita', categoria: 'substrato', unidadeMedida: 'litro' },
    });
    expect(parseInsumoFields({ nome: 'Vermiculita', categoria: 'mineral', unidadeMedida: 'litro' })).toEqual({
      error: 'Escolha a categoria.',
    });
    expect(parseInsumoFields({ nome: 'Vermiculita', categoria: 'substrato', unidadeMedida: 'Kg' })).toEqual({
      error: 'Escolha a unidade de medida.',
    });
  });
});

describe('tipos de tarefa (RF-21)', () => {
  const declaracoes = { eQuantitativa: true, exigeLote: true, exigeEspecie: true, exigeRecipiente: true, exigeArea: true };
  const nenhuma = { eQuantitativa: false, exigeLote: false, exigeEspecie: false, exigeRecipiente: false, exigeArea: false };

  it('com lote exigido, espécie e área não são pedidas: o lote já as determina', () => {
    const parsed = parseTipoTarefaFields({ nome: 'Repicar', categoria: 'plantio', unidadeMedida: 'un', ...declaracoes });
    expect(parsed).toEqual({
      value: { nome: 'Repicar', categoria: 'plantio', unidadeMedida: 'un', ...declaracoes, exigeEspecie: false, exigeArea: false },
    });
  });

  it('sem lote, a espécie e a área podem ser exigidas', () => {
    const parsed = parseTipoTarefaFields({ nome: 'Colher semente', categoria: 'semente', unidadeMedida: 'kg', ...declaracoes, exigeLote: false });
    expect(parsed).toHaveProperty('value.exigeEspecie', true);
    expect(parsed).toHaveProperty('value.exigeArea', true);
    expect(parsed).toHaveProperty('value.unidadeMedida', 'kg');
  });

  it('categoria e unidade fora do CHECK são recusadas antes do banco', () => {
    expect(parseTipoTarefaFields({ nome: 'Regar', categoria: 'irrigacao', unidadeMedida: 'un', ...declaracoes })).toEqual({
      error: 'Escolha a categoria.',
    });
    expect(parseTipoTarefaFields({ nome: 'Regar', categoria: 'manutencao', unidadeMedida: 'quilo', ...declaracoes })).toEqual({
      error: 'Escolha a unidade da quantidade.',
    });
  });

  it('resume o que o formulário vai pedir', () => {
    expect(resumoDeclaracoes({ ...nenhuma, unidadeMedida: 'un' })).toBe('Não pede dado extra');
    expect(resumoDeclaracoes({ ...nenhuma, eQuantitativa: true, exigeLote: true, unidadeMedida: 'un' })).toBe(
      'Pede lote, quantidade por pessoa em un',
    );
    expect(resumoDeclaracoes({ ...nenhuma, eQuantitativa: true, exigeArea: true, unidadeMedida: 'kg' })).toBe(
      'Pede área e canteiro, quantidade por pessoa em kg',
    );
  });
});
