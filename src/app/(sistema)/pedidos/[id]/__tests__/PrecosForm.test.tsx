import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { negociarItensAction } from '../../actions';
import { type ItemParaNegociar, PrecosForm } from '../PrecosForm';

vi.mock('../../actions', () => ({
  negociarItensAction: vi.fn(async () => ({ success: 'Negociação salva.' })),
}));

const TUBETE = { value: 't', label: 'Tubete' };
const SACO = { value: 's', label: 'Saco 17x22 (conferido)' };

const ITENS: ItemParaNegociar[] = [
  { id: 'a', especie: 'Ipê-amarelo', generico: false, confirmada: 100, precoCentavos: null, recipientes: [TUBETE], recipienteId: 't' },
  { id: 'b', especie: 'Pitanga', generico: false, confirmada: 50, precoCentavos: 1250, recipientes: [TUBETE], recipienteId: 't' },
];

const acao = vi.mocked(negociarItensAction);

describe('PrecosForm, a negociação (RF-55)', () => {
  beforeEach(() => acao.mockClear());

  it('não tem botão de salvar: grava ao sair do campo, com a quantidade confirmada junto', async () => {
    render(<PrecosForm pedidoId="pedido-1" itens={ITENS} />);
    expect(screen.queryByRole('button')).toBeNull();

    const campo = screen.getAllByLabelText('Preço da muda')[0];
    fireEvent.change(campo, { target: { value: '8,00' } });
    fireEvent.blur(campo);

    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    const enviado = acao.mock.calls[0][1];
    expect(enviado.getAll('negociar_item_id')).toEqual(['a', 'b']);
    expect(enviado.getAll('negociar_preco')).toEqual(['8,00', '12,50']);
    // A quantidade vem preenchida com o que a conferência confirmou
    expect(enviado.getAll('negociar_quantidade')).toEqual(['100', '50']);
    expect(await screen.findByText('Negociação salva.')).toBeTruthy();
  });

  it('sair do campo sem mudar nada não grava', () => {
    render(<PrecosForm pedidoId="pedido-1" itens={ITENS} />);
    fireEvent.blur(screen.getAllByLabelText('Preço da muda')[1]);
    expect(acao).not.toHaveBeenCalled();
  });

  it('o total acompanha a quantidade baixada', () => {
    render(<PrecosForm pedidoId="pedido-1" itens={[ITENS[1]]} />);
    expect(screen.getByText('R$ 625,00')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '10' } });
    expect(screen.getByText('R$ 125,00')).toBeTruthy();
  });

  it('com recipiente conferido diferente, a chefia escolhe entre os dois', async () => {
    const item = { ...ITENS[0], recipientes: [TUBETE, SACO], recipienteId: 's' };
    render(<PrecosForm pedidoId="pedido-1" itens={[item]} />);
    fireEvent.change(screen.getByLabelText('Recipiente'), { target: { value: 't' } });
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(acao.mock.calls[0][1].getAll('negociar_recipiente')).toEqual(['t']);
  });

  it('o genérico com quantidade só recebe preço: a soma é da composição', () => {
    const generico = { ...ITENS[0], especie: 'Genérico: mudas nativas', generico: true, recipientes: [] };
    render(<PrecosForm pedidoId="pedido-1" itens={[generico]} />);
    expect(screen.queryByLabelText('Quantidade')).toBeNull();
    expect(screen.getByLabelText('Preço da muda')).toBeTruthy();
  });
});
