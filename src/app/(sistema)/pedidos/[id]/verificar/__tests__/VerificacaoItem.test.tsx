import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { marcarDisponibilidadeAction } from '../actions';
import { type ItemParaConferir, VerificacaoItem } from '../VerificacaoItem';

vi.mock('../actions', () => ({
  marcarDisponibilidadeAction: vi.fn(async () => ({ success: 'Resposta gravada.' })),
}));

const RECIPIENTES = [
  { value: 'tub', label: 'Tubete' },
  { value: 'saco', label: 'Saco 10x18' },
];

const PENDENTE: ItemParaConferir = {
  id: 'item-1',
  especie: 'Ipê-amarelo',
  recipiente: 'Tubete',
  recipienteId: 'tub',
  alturaM: null,
  quantidade: 500,
  disponivel: null,
  quantidadeDisponivel: null,
  recipienteDisponivelId: null,
  observacoesDisponibilidade: null,
};

const acao = vi.mocked(marcarDisponibilidadeAction);

function ultimoEnvio(): FormData {
  return acao.mock.calls.at(-1)![1];
}

describe('VerificacaoItem, parcial (T8.12)', () => {
  beforeEach(() => acao.mockClear());

  it('não tem botão de gravar: a quantidade grava ao sair do campo', async () => {
    render(<VerificacaoItem pedidoId="pedido-1" item={PENDENTE} recipientes={RECIPIENTES} />);
    fireEvent.click(screen.getByText('Tem parte'));
    expect(screen.queryByText('Gravar o que tem')).toBeNull();

    const campo = screen.getByLabelText('Quantas existem');
    fireEvent.change(campo, { target: { value: '300' } });
    fireEvent.blur(campo);

    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('estado')).toBe('parcial');
    expect(ultimoEnvio().get('quantidade')).toBe('300');
    expect(ultimoEnvio().get('recipiente_id')).toBe('tub');
  });

  it('sair do campo vazio não grava', () => {
    render(<VerificacaoItem pedidoId="pedido-1" item={PENDENTE} recipientes={RECIPIENTES} />);
    fireEvent.click(screen.getByText('Tem parte'));
    fireEvent.blur(screen.getByLabelText('Quantas existem'));
    expect(acao).not.toHaveBeenCalled();
  });

  it('item já gravado como parcial: sair sem mudar não regrava, trocar o recipiente grava', async () => {
    const parcial = { ...PENDENTE, disponivel: false, quantidadeDisponivel: 300, recipienteDisponivelId: 'tub' };
    render(<VerificacaoItem pedidoId="pedido-1" item={parcial} recipientes={RECIPIENTES} />);

    fireEvent.blur(screen.getByLabelText('Quantas existem'));
    expect(acao).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Em que recipiente está'), { target: { value: 'saco' } });
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('recipiente_id')).toBe('saco');
    expect(ultimoEnvio().get('quantidade')).toBe('300');
  });
});
