import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, isActive } from '../nav-items';

describe('isActive', () => {
  it('ativa na rota e nas filhas', () => {
    expect(isActive('/producao', '/producao')).toBe(true);
    expect(isActive('/producao/lotes/12', '/producao')).toBe(true);
  });

  it('não ativa por prefixo de texto nem na raiz', () => {
    expect(isActive('/pedidos-antigos', '/pedidos')).toBe(false);
    expect(isActive('/', '/cadastros')).toBe(false);
  });
});

describe('NAV_ITEMS', () => {
  it('traz as três áreas e Configurações, com rotas únicas', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(['Cadastros', 'Produção', 'Pedidos', 'Configurações']);
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(NAV_ITEMS.length);
  });
});
