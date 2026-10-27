import { describe, expect, it } from 'vitest';
import { visibleNavItems } from '../menu';

const labels = (perfil: Parameters<typeof visibleNavItems>[0]) => visibleNavItems(perfil).map((i) => i.label);

describe('visibleNavItems', () => {
  it('gerência vê Pedidos, que ela lê para as fases dela, e não vê administração', () => {
    expect(labels('gerencia')).toEqual([
      'Cadastros',
      'Produção',
      'Pedidos',
      'Configurações',
      'Aparelhos conectados',
    ]);
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
    // RF-13: a referência da Flora e Funga é só do administrador
    expect(labels('admin')).toContain('Flora e Funga do Brasil');
    expect(labels('chefia')).not.toContain('Flora e Funga do Brasil');
    expect(labels('admin')).toHaveLength(8);
  });
});
