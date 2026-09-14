import { describe, expect, it } from 'vitest';
import { visibleNavItems } from '../menu';

const labels = (perfil: Parameters<typeof visibleNavItems>[0]) => visibleNavItems(perfil).map((i) => i.label);

describe('visibleNavItems', () => {
  it('gerência não vê Pedidos nem administração', () => {
    expect(labels('gerencia')).toEqual(['Cadastros', 'Produção', 'Configurações', 'Aparelhos conectados']);
  });

  it('chefia vê Pedidos e não vê administração', () => {
    expect(labels('chefia')).toEqual([
      'Cadastros',
      'Produção',
      'Pedidos',
      'Configurações',
      'Aparelhos conectados',
    ]);
  });

  it('admin vê tudo', () => {
    expect(labels('admin')).toContain('Usuários');
    expect(labels('admin')).toContain('Registro de acessos');
    expect(labels('admin')).toHaveLength(7);
  });
});
