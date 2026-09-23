import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from '../Toast';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/pedidos',
}));

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('anuncia o que acabou de acontecer como status', () => {
    render(<Toast tone="success">Pedido 12 registrado.</Toast>);
    expect(screen.getByRole('status')).toHaveTextContent('Pedido 12 registrado.');
  });

  it('some sozinho depois do tempo, sem ninguém tocar em nada', () => {
    render(<Toast tone="success">Pedido 12 registrado.</Toast>);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('limpa o endereço, para o aviso não voltar a cada recarregamento', () => {
    render(<Toast tone="success">Pedido 12 registrado.</Toast>);
    expect(replace).toHaveBeenCalledWith('/pedidos', { scroll: false });
  });
});
