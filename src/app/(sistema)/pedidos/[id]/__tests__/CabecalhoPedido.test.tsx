import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { atualizarCabecalhoAction } from '../../actions';
import { CabecalhoPedido } from '../CabecalhoPedido';

vi.mock('../../actions', () => ({
  atualizarCabecalhoAction: vi.fn(async () => ({ success: 'Pedido alterado.' })),
}));

const CLIENTES = [
  { value: 'c1', label: 'Prefeitura de Rio do Sul' },
  { value: 'c2', label: 'Paisagismo Vale' },
];

function montar() {
  return render(
    <CabecalhoPedido pedidoId="p1" clientes={CLIENTES} clienteId="c1" canal="atacado" dataEntrega="2026-11-20" />,
  );
}

const enviado = () => vi.mocked(atualizarCabecalhoAction).mock.calls.at(-1)![1];

beforeEach(() => vi.clearAllMocks());

describe('cabeçalho editável da ficha (cliente, canal, entrega)', () => {
  it('trocar o canal grava na hora, com os três campos', async () => {
    montar();
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Canal de venda/), { target: { value: 'paisagismo' } });
    });
    expect(atualizarCabecalhoAction).toHaveBeenCalledTimes(1);
    expect(enviado().get('cliente_id')).toBe('c1');
    expect(enviado().get('canal')).toBe('paisagismo');
    expect(enviado().get('data_entrega')).toBe('2026-11-20');
  });

  it('apagar a data é "sem previsão", e grava', async () => {
    montar();
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Entrega prevista/), { target: { value: '' } });
    });
    expect(enviado().get('data_entrega')).toBe('');
  });

  it('digitar no cliente é busca: só grava quando um cliente é escolhido', async () => {
    montar();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Cliente', { exact: false, selector: 'input' }), { target: { value: 'Paisag' } });
    });
    expect(atualizarCabecalhoAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByText('Paisagismo Vale'));
    });
    expect(enviado().get('cliente_id')).toBe('c2');
  });

  it('o erro do servidor aparece embaixo dos campos', async () => {
    vi.mocked(atualizarCabecalhoAction).mockResolvedValueOnce({ error: 'O pedido 7 está cancelado, e não muda mais.' });
    montar();
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Canal de venda/), { target: { value: 'varejo' } });
    });
    expect(screen.getByText('O pedido 7 está cancelado, e não muda mais.')).toBeInTheDocument();
  });
});
