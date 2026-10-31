import { describe, expect, it } from 'vitest';
import {
  cursorPelaDireita,
  cursorPelaEsquerda,
  digitosAntes,
  digitosDepois,
  posicaoAntesDosUltimos,
  posicaoAposDigitos,
} from '../cursor-mascara';

describe('cursor-mascara', () => {
  it('conta os dígitos antes e depois do cursor', () => {
    expect(digitosAntes('(4) 99612-4408', 2)).toBe(1);
    expect(digitosDepois('1,250', 2)).toBe(3);
  });

  it('acha a posição depois do n-ésimo dígito', () => {
    expect(posicaoAposDigitos('(49) 96124-408', 1)).toBe(2);
    expect(posicaoAposDigitos('(47) 99612-4408', 2)).toBe(3);
    expect(posicaoAposDigitos('(47) 99612-4408', 0)).toBe(1);
    expect(posicaoAposDigitos('(47', 9)).toBe(3);
  });

  it('acha a posição que deixa n dígitos à direita', () => {
    expect(posicaoAntesDosUltimos('12,500', 3)).toBe(3);
    expect(posicaoAntesDosUltimos('12,500', 0)).toBe(6);
    expect(posicaoAntesDosUltimos('0,500', 9)).toBe(0);
  });

  it('corrigir o DDD do telefone mantém o cursor depois dele', () => {
    const onde = cursorPelaEsquerda({ value: '(4) 99612-4408', selectionStart: 2, selectionEnd: 2 });
    expect(onde('(49) 96124-408')).toBe(2);
  });

  it('no decimal, o cursor guarda os dígitos que tinha à direita', () => {
    // digitou 9 depois do 1 em "1,500": o 9 entra e os três dígitos à direita ficam à direita
    const onde = cursorPelaDireita({ value: '19,500', selectionStart: 2, selectionEnd: 2 });
    expect(onde('19,500')).toBe(3);
  });
});
