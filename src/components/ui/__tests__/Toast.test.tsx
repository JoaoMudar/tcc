import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from '../Toast';

let busca = 'feito=criado&numero=12';
let caminho = '/pedidos';

vi.mock('next/navigation', () => ({
  usePathname: () => caminho,
  useSearchParams: () => new URLSearchParams(busca),
}));

const replaceState = vi.spyOn(window.history, 'replaceState');

beforeEach(() => {
  vi.useFakeTimers();
  replaceState.mockClear();
  busca = 'feito=criado&numero=12';
  caminho = '/pedidos';
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
    expect(replaceState.mock.calls.at(-1)?.[2]).toBe('/pedidos?numero=12');
  });

  it('tira só o que trouxe o aviso: a agenda continua no mesmo dia', () => {
    caminho = '/producao';
    busca = 'dia=2026-09-14&feito=confirmada&perda=3&causa=seca';
    render(
      <Toast tone="success" limpar={['feito', 'perda', 'causa']}>
        Tarefa confirmada.
      </Toast>,
    );
    expect(replaceState.mock.calls.at(-1)?.[2]).toBe('/producao?dia=2026-09-14');
  });

  it('não mexe no endereço quando não há o que limpar', () => {
    render(
      <Toast tone="success" limpar={[]}>
        Perda registrada.
      </Toast>,
    );
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('aparece de novo quando o gatilho muda, mesmo com o mesmo texto', () => {
    const { rerender } = render(
      <Toast tone="success" limpar={[]} gatilho={1}>
        Perda registrada.
      </Toast>,
    );
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole('status')).toBeNull();
    rerender(
      <Toast tone="success" limpar={[]} gatilho={2}>
        Perda registrada.
      </Toast>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Perda registrada.');
  });
});
