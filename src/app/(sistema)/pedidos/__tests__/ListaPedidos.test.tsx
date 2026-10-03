import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ListaPedidos, type PedidoDaLista } from '../ListaPedidos';

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

describe('ListaPedidos e o filtro de cliente (RF-58, TA-54)', () => {
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
