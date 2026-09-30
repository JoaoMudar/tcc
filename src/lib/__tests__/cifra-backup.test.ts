import { describe, expect, it } from 'vitest';
import { cifrar, decifrar } from '../cifra-backup';

const FRASE = 'uma frase longa o bastante para o teste';
const DADOS = Buffer.from('PGDMP conteúdo da cópia com CPF 123.456.789-09');

describe('cifra do backup (T10.1)', () => {
  it('decifra de volta o mesmo conteúdo', () => {
    expect(decifrar(cifrar(DADOS, FRASE), FRASE).equals(DADOS)).toBe(true);
  });

  it('não deixa o conteúdo legível no arquivo cifrado', () => {
    expect(cifrar(DADOS, FRASE).includes(Buffer.from('123.456.789-09'))).toBe(false);
  });

  it('cifra diferente a cada vez, pelo sal e pelo iv', () => {
    expect(cifrar(DADOS, FRASE).equals(cifrar(DADOS, FRASE))).toBe(false);
  });

  it('recusa a frase errada em vez de devolver lixo', () => {
    expect(() => decifrar(cifrar(DADOS, FRASE), `${FRASE}!`)).toThrow('frase está errada');
  });

  it('recusa o arquivo adulterado', () => {
    const arquivo = cifrar(DADOS, FRASE);
    arquivo[arquivo.length - 1] ^= 1;
    expect(() => decifrar(arquivo, FRASE)).toThrow('corrompido');
  });

  it('recusa o que não é cópia do viveiro e a frase curta', () => {
    expect(() => decifrar(DADOS, FRASE)).toThrow('não é uma cópia cifrada');
    expect(() => cifrar(DADOS, 'curta')).toThrow('ao menos 20');
  });
});
