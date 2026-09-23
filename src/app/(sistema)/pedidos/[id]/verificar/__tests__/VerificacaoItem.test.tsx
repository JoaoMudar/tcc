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
  recipienteDisponivel: null,
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

describe('VerificacaoItem, item que chegou incompleto', () => {
  beforeEach(() => acao.mockClear());

  it('sem quantidade, a pergunta é "tem ou não tem", e o "Tem" pede quantas e em que recipiente', async () => {
    const semQuantidade = { ...PENDENTE, quantidade: null, recipiente: null, recipienteId: null };
    render(<VerificacaoItem pedidoId="pedido-1" item={semQuantidade} recipientes={RECIPIENTES} />);
    expect(screen.queryByText('Tem parte')).toBeNull();
    expect(screen.getByText(/quantidade a definir/)).toBeTruthy();

    fireEvent.click(screen.getByText('Tem'));
    fireEvent.change(screen.getByLabelText('Quantas tem'), { target: { value: '350' } });
    fireEvent.blur(screen.getByLabelText('Quantas tem'));
    // Sem recipiente ainda não grava: ele é a única informação de tamanho que o pedido vai ter
    expect(acao).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Em que recipiente está'), { target: { value: 'saco' } });
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('estado')).toBe('disponivel');
    expect(ultimoEnvio().get('quantidade')).toBe('350');
    expect(ultimoEnvio().get('recipiente_id')).toBe('saco');
  });

  it('respondido, mostra quantas tem e onde', () => {
    const respondido = {
      ...PENDENTE,
      quantidade: null,
      disponivel: true,
      quantidadeDisponivel: 350,
      recipienteDisponivelId: 'saco',
      recipienteDisponivel: 'Saco 10x18',
    };
    render(<VerificacaoItem pedidoId="pedido-1" item={respondido} recipientes={RECIPIENTES} />);
    expect(screen.getByText('Tem 350, em Saco 10x18')).toBeTruthy();
  });

  it('com quantidade e sem recipiente, o "Tem tudo" pergunta em qual está', async () => {
    const semRecipiente = { ...PENDENTE, recipiente: null, recipienteId: null };
    render(<VerificacaoItem pedidoId="pedido-1" item={semRecipiente} recipientes={RECIPIENTES} />);
    fireEvent.click(screen.getByText('Tem tudo'));
    expect(acao).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Quantas existem')).toBeNull();

    fireEvent.change(screen.getByLabelText('Em que recipiente está'), { target: { value: 'tub' } });
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('estado')).toBe('disponivel');
    expect(ultimoEnvio().get('recipiente_id')).toBe('tub');
  });
});
