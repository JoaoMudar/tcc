import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_ITEMS } from '../nav-items';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

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
});
