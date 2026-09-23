import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { definirPrecosAction } from '../../actions';
import { PrecosForm } from '../PrecosForm';

vi.mock('../../actions', () => ({
  definirPrecosAction: vi.fn(async () => ({ success: 'Preço salvo.' })),
}));

const ITENS = [
  { id: 'a', especie: 'Ipê-amarelo', recipiente: 'Tubete', quantidade: 100, precoCentavos: null },
  { id: 'b', especie: 'Pitanga', recipiente: 'Tubete', quantidade: 50, precoCentavos: 1250 },
];

const acao = vi.mocked(definirPrecosAction);

describe('PrecosForm (RF-55)', () => {
  beforeEach(() => acao.mockClear());

  it('não tem botão de salvar: o preço grava ao sair do campo', async () => {
    render(<PrecosForm pedidoId="pedido-1" itens={ITENS} />);
    expect(screen.queryByText('Salvar preços')).toBeNull();

    const campo = screen.getByLabelText('Ipê-amarelo');
    fireEvent.change(campo, { target: { value: '8,00' } });
    fireEvent.blur(campo);

    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    const enviado = acao.mock.calls[0][1];
    expect(enviado.getAll('preco_item_id')).toEqual(['a', 'b']);
    expect(enviado.getAll('preco_valor')).toEqual(['8,00', '12,50']);
    expect(await screen.findByText('Preço salvo.')).toBeTruthy();
  });

  it('sair do campo sem mudar nada não grava', () => {
    render(<PrecosForm pedidoId="pedido-1" itens={ITENS} />);
    fireEvent.blur(screen.getByLabelText('Pitanga'));
    expect(acao).not.toHaveBeenCalled();
  });

  it('com todos os campos em branco não há o que gravar', () => {
    const semPreco = ITENS.map((item) => ({ ...item, precoCentavos: null }));
    render(<PrecosForm pedidoId="pedido-1" itens={semPreco} />);
    const campo = screen.getByLabelText('Pitanga');
    fireEvent.change(campo, { target: { value: '  ' } });
    fireEvent.blur(campo);
    expect(acao).not.toHaveBeenCalled();
  });
});
