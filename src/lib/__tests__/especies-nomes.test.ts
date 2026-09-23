import { describe, expect, it } from 'vitest';
import { type NomeConhecido, achaConflitoDeNome, normalizeNomePopular } from '../especies-nomes';

const CONHECIDOS: NomeConhecido[] = [
  { especieId: 'ipe', nome: 'Ipê-amarelo', especie: 'Ipê-amarelo' },
  { especieId: 'arauc', nome: 'Pinheiro-do-paraná', especie: 'Araucária' },
];

describe('normalizeNomePopular (RN-01)', () => {
  it('tira acento, maiúscula e os separadores que viram espaço', () => {
    expect(normalizeNomePopular('Ipê-Amarelo')).toBe('ipe amarelo');
    expect(normalizeNomePopular('  pau_d arco / amarelo ')).toBe('pau d arco amarelo');
  });

  it('espaços repetidos colapsam num só', () => {
    expect(normalizeNomePopular('ipe    amarelo')).toBe('ipe amarelo');
  });

  it('texto em branco vira texto em branco', () => {
    expect(normalizeNomePopular('   ')).toBe('');
  });
});

describe('achaConflitoDeNome (RN-01)', () => {
  it('o nome de outra espécie é conflito, ainda que escrito diferente', () => {
    expect(achaConflitoDeNome('pinheiro do parana', CONHECIDOS)).toMatchObject({ especieId: 'arauc' });
  });

  it('nome livre não conflita', () => {
    expect(achaConflitoDeNome('guabiroba', CONHECIDOS)).toBeNull();
  });

  it('o nome que a própria espécie já tem não é conflito dela mesma', () => {
    expect(achaConflitoDeNome('Ipê amarelo', CONHECIDOS, 'ipe')).toBeNull();
    expect(achaConflitoDeNome('Ipê amarelo', CONHECIDOS)).toMatchObject({ especieId: 'ipe' });
  });

  it('nome em branco não conflita com nada', () => {
    expect(achaConflitoDeNome('  ', CONHECIDOS)).toBeNull();
  });
});
