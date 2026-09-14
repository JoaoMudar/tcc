import { describe, expect, it } from 'vitest';
import { isPublicPath, loginRedirectPath, safeNextPath } from '../route-rules';

describe('isPublicPath', () => {
  it('só o login é aberto', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/trocar-senha')).toBe(false);
    expect(isPublicPath('/loginx')).toBe(false);
  });
});

describe('safeNextPath', () => {
  it('aceita caminho interno com busca', () => {
    expect(safeNextPath('/producao?semana=37')).toBe('/producao?semana=37');
  });

  it.each([
    ['URL externa', 'https://exemplo.com'],
    ['protocolo relativo', '//exemplo.com'],
    ['barra invertida', '/\\exemplo.com'],
    ['o próprio login', '/login'],
    ['vazio', ''],
    ['não texto', null],
  ])('recusa %s e manda para o início', (_caso, valor) => {
    expect(safeNextPath(valor)).toBe('/');
  });
});

describe('loginRedirectPath', () => {
  it('guarda o destino, menos quando é o início', () => {
    expect(loginRedirectPath('/', '')).toBe('/login');
    expect(loginRedirectPath('/pedidos', '?canal=varejo')).toBe('/login?next=%2Fpedidos%3Fcanal%3Dvarejo');
  });
});
