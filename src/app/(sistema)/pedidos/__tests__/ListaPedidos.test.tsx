import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ATRASO_FILTRO_MS, ListaPedidos, type PedidoDaLista } from '../ListaPedidos';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/pedidos',
  useSearchParams: () => new URLSearchParams('feito=criado'),
}));

function pedido(numero: number, clienteId: string, cliente: string): PedidoDaLista {
  return {
    id: `p${numero}`,
    numero,
    clienteId,
    cliente,
    canal: 'atacado',
    situacao: 'cadastrado',
    criadoEm: new Date('2026-09-20T12:00:00Z'),
    dataEntrega: null,
    itens: 1,
    totalCentavos: null,
  };
}

const PEDIDOS = [
  pedido(3, 'c1', 'José Antônio'),
  pedido(2, 'c2', 'Prefeitura de Ibirama'),
  pedido(1, 'c1', 'José Antônio'),
];

const numeros = () =>
  screen.getAllByRole('link').map((link) => link.textContent?.match(/^(\d+) ·/)?.[1]);

describe('ListaPedidos e o filtro de cliente (RF-60, TA-54)', () => {
  it('digitar parte do nome deixa só os pedidos desse cliente, e apagar traz todos de volta', () => {
    render(<ListaPedidos pedidos={PEDIDOS} hoje="2026-09-21" />);
    const campo = screen.getByLabelText('Cliente');

    fireEvent.change(campo, { target: { value: 'jose' } });
    expect(numeros()).toEqual(['3', '1']);

    fireEvent.change(campo, { target: { value: '' } });
    expect(numeros()).toEqual(['3', '2', '1']);
  });

  it('tocar no cliente da lista filtra por ele', () => {
    render(<ListaPedidos pedidos={PEDIDOS} hoje="2026-09-21" />);
    fireEvent.focus(screen.getByLabelText('Cliente'));
    fireEvent.click(screen.getByRole('button', { name: 'Prefeitura de Ibirama' }));
    expect(numeros()).toEqual(['2']);
  });

  it('texto que não acha ninguém diz que não há pedido desse cliente', () => {
    render(<ListaPedidos pedidos={PEDIDOS} hoje="2026-09-21" />);
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'xyz' } });
    expect(screen.getByText('Nenhum pedido desse cliente.')).toBeInTheDocument();
  });
});

describe('o filtro vai ao servidor (RF-60)', () => {
  it('depois de uma pausa na digitação, o texto vai para o endereço, sem perder os outros parâmetros', async () => {
    vi.useFakeTimers();
    replace.mockClear();
    render(<ListaPedidos pedidos={PEDIDOS} hoje="2026-09-21" />);
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'jose' } });
    expect(replace).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ATRASO_FILTRO_MS);
    });
    expect(replace).toHaveBeenCalledWith('/pedidos?feito=criado&q=jose', { scroll: false });
    vi.useRealTimers();
  });

  it('abrir a tela não reescreve o endereço', () => {
    replace.mockClear();
    render(<ListaPedidos pedidos={PEDIDOS} hoje="2026-09-21" filtroInicial={{ clienteId: '', texto: 'jose' }} />);
    expect(replace).not.toHaveBeenCalled();
  });
});
