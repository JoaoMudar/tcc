import { describe, expect, it } from 'vitest';
import {
  formatDocumento,
  formatTelefone,
  isCnpj,
  isCpf,
  onlyDigits,
  validateDocumento,
  validateTelefone,
} from '../documento';

describe('isCpf (RF-17)', () => {
  it.each(['529.982.247-25', '52998224725', '111.444.777-35'])('aceita %s', (cpf) => {
    expect(isCpf(cpf)).toBe(true);
  });

  it.each(['529.982.247-24', '111.111.111-11', '000.000.000-00', '5299822472', '529982247250', ''])('recusa "%s"', (cpf) => {
    expect(isCpf(cpf)).toBe(false);
  });
});

describe('isCnpj (RF-17)', () => {
  it.each(['11.222.333/0001-81', '11222333000181', '11.444.777/0001-61'])('aceita %s', (cnpj) => {
    expect(isCnpj(cnpj)).toBe(true);
  });

  it.each(['11.222.333/0001-80', '11.111.111/1111-11', '1122233300018', ''])('recusa "%s"', (cnpj) => {
    expect(isCnpj(cnpj)).toBe(false);
  });
});

describe('validateDocumento', () => {
  it('vazio é documento ausente, e não inválido (cadastro rápido, RF-15)', () => {
    expect(validateDocumento('pf', '  ')).toEqual({ value: null });
  });

  it('grava só os dígitos', () => {
    expect(validateDocumento('pf', '529.982.247-25')).toEqual({ value: '52998224725' });
    expect(validateDocumento('pj', '11.222.333/0001-81')).toEqual({ value: '11222333000181' });
  });

  it('CPF em pessoa jurídica e CNPJ em pessoa física são recusados', () => {
    expect(validateDocumento('pj', '529.982.247-25')).toEqual({ error: 'CNPJ inválido. Confira os números.' });
    expect(validateDocumento('pf', '11.222.333/0001-81')).toEqual({ error: 'CPF inválido. Confira os números.' });
  });
});

describe('validateTelefone', () => {
  it('aceita com ou sem máscara, e tira o 55 do WhatsApp', () => {
    expect(validateTelefone('(47) 99612-4408')).toEqual({ value: '47996124408' });
    expect(validateTelefone('+55 47 99612-4408')).toEqual({ value: '47996124408' });
    expect(validateTelefone('4735210000')).toEqual({ value: '4735210000' });
    expect(validateTelefone('')).toEqual({ value: null });
  });

  it('recusa sem DDD', () => {
    expect(validateTelefone('99612-4408')).toHaveProperty('error');
  });
});

describe('formatação', () => {
  it('põe a máscara de volta na tela', () => {
    expect(formatDocumento('52998224725')).toBe('529.982.247-25');
    expect(formatDocumento('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatTelefone('47996124408')).toBe('(47) 99612-4408');
    expect(formatTelefone('4735210000')).toBe('(47) 3521-0000');
    expect(formatTelefone(null)).toBe('');
    expect(onlyDigits('a1-2 3')).toBe('123');
  });
});
