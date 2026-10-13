import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_ITEMS } from '../nav-items';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
// O indicador da fila tem teste próprio; aqui só o menu
vi.mock('../IndicadorFila', () => ({ IndicadorFila: () => null }));

const { AppNav } = await import('../AppNav');

const logout = async () => {};
const semPedidos = NAV_ITEMS.filter((i) => i.href !== '/pedidos');

describe('AppNav', () => {
  beforeEach(() => {
    pathname = '/';
  });

  it('marca a área da rota atual e só ela', () => {
    pathname = '/producao/lotes';
    render(<AppNav items={NAV_ITEMS} userName="Débora" logoutAction={logout} />);
    const mobile = screen.getByRole('navigation', { name: 'Áreas do sistema' });
    expect(within(mobile).getByRole('link', { name: 'Produção' })).toHaveAttribute('aria-current', 'page');
    expect(within(mobile).getByRole('link', { name: 'Pedidos' })).not.toHaveAttribute('aria-current');
  });

  it('no celular, item secundário acende "Mais"', () => {
    pathname = '/conta/sessoes';
    render(<AppNav items={NAV_ITEMS} userName="Débora" logoutAction={logout} />);
    const mobile = screen.getByRole('navigation', { name: 'Áreas do sistema' });
    expect(within(mobile).getByRole('link', { name: 'Mais' })).toHaveAttribute('aria-current', 'page');
    expect(within(mobile).queryByRole('link', { name: 'Aparelhos conectados' })).toBeNull();
  });

  it('só mostra o que recebeu: sem Pedidos para a gerência', () => {
    render(<AppNav items={semPedidos} userName="Débora" logoutAction={logout} />);
    expect(screen.queryAllByRole('link', { name: 'Pedidos' })).toHaveLength(0);
  });

  it('todo link tem alvo de toque mínimo e há botão de sair', () => {
    render(<AppNav items={NAV_ITEMS} userName="Débora" logoutAction={logout} />);
    for (const link of screen.getAllByRole('link')) expect(link.className).toContain('min-h-touch');
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  describe('coluna lateral', () => {
    const coluna = () => screen.getByRole('navigation', { name: 'Menu' });
    const engrenagem = () => within(coluna()).getByRole('button', { name: 'Configurações' });

    it('mostra só as três áreas; o resto fica atrás da engrenagem', () => {
      render(<AppNav items={NAV_ITEMS} userName="Débora" logoutAction={logout} />);
      const links = within(coluna()).getAllByRole('link').map((l) => l.textContent);
      expect(links).toEqual(['Viveiro Mudar', 'Cadastros', 'Produção', 'Pedidos']);
      expect(engrenagem()).toHaveAttribute('aria-expanded', 'false');
    });

    it('a engrenagem abre as rotinas, e escolher uma fecha', () => {
      render(<AppNav items={NAV_ITEMS} userName="Débora" logoutAction={logout} />);
      fireEvent.click(engrenagem());
      expect(engrenagem()).toHaveAttribute('aria-expanded', 'true');
      for (const nome of ['Configurações', 'Usuários', 'Registro de acessos', 'Aparelhos conectados']) {
        expect(within(coluna()).getByRole('link', { name: nome }).className).toContain('min-h-touch');
      }
      fireEvent.click(within(coluna()).getByRole('link', { name: 'Usuários' }));
      expect(within(coluna()).queryByRole('link', { name: 'Usuários' })).toBeNull();
    });

    it('Esc fecha', () => {
      render(<AppNav items={NAV_ITEMS} userName="Débora" logoutAction={logout} />);
      fireEvent.click(engrenagem());
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(engrenagem()).toHaveAttribute('aria-expanded', 'false');
    });

    it('acende a engrenagem numa rota que ela guarda', () => {
      pathname = '/admin/usuarios';
      render(<AppNav items={NAV_ITEMS} userName="Débora" logoutAction={logout} />);
      expect(engrenagem().className).toContain('bg-brand-light');
    });

    it('sem nada para guardar, não há engrenagem', () => {
      const soAreas = NAV_ITEMS.filter((i) => i.placement === 'primary');
      render(<AppNav items={soAreas} userName="Débora" logoutAction={logout} />);
      expect(within(coluna()).queryByRole('button', { name: 'Configurações' })).toBeNull();
    });
  });
});
