import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/producao/lotes' }));

const { AppNav } = await import('../AppNav');

describe('AppNav', () => {
  it('marca a área da rota atual e só ela', () => {
    render(<AppNav />);
    expect(screen.getByRole('link', { name: 'Produção' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Pedidos' })).not.toHaveAttribute('aria-current');
  });

  it('todo link da navegação tem alvo de toque mínimo', () => {
    render(<AppNav />);
    const links = screen.getAllByRole('link').filter((l) => l.textContent !== 'Viveiro Mudar');
    expect(links).toHaveLength(4);
    for (const link of links) expect(link.className).toContain('min-h-touch');
  });
});
