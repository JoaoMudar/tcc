import { describe, expect, it } from 'vitest';
import { filtraOpcoes, normalizeTexto } from '../busca-opcoes';

const ESPECIES = [
  { value: '1', label: 'Ipê-amarelo' },
  { value: '2', label: 'Ipê-roxo' },
  { value: '3', label: 'Araçá' },
  { value: '4', label: 'Palmeira juçara' },
];

describe('normalizeTexto', () => {
  it('tira acento, caixa e espaço das pontas', () => {
    expect(normalizeTexto('  Ipê-Amarelo ')).toBe('ipe-amarelo');
    expect(normalizeTexto('Araçá')).toBe('araca');
  });
});

describe('filtraOpcoes', () => {
  it('sem texto, devolve a lista inteira', () => {
    expect(filtraOpcoes(ESPECIES, '   ')).toHaveLength(4);
  });

  it('acha sem acento, que é como se digita no celular', () => {
    expect(filtraOpcoes(ESPECIES, 'ipe').map((o) => o.value)).toEqual(['1', '2']);
    expect(filtraOpcoes(ESPECIES, 'araca').map((o) => o.value)).toEqual(['3']);
  });

  it('cada pedaço digitado conta, em qualquer ordem', () => {
    expect(filtraOpcoes(ESPECIES, 'ama ipe').map((o) => o.value)).toEqual(['1']);
    expect(filtraOpcoes(ESPECIES, 'jucara palmeira').map((o) => o.value)).toEqual(['4']);
  });

  it('devolve vazio quando nada bate', () => {
    expect(filtraOpcoes(ESPECIES, 'eucalipto')).toEqual([]);
  });

  it('não mexe na lista recebida', () => {
    const original = [...ESPECIES];
    filtraOpcoes(ESPECIES, 'ipe');
    expect(ESPECIES).toEqual(original);
  });
});
