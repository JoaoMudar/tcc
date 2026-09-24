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

/** O item completo: 500 ipês em tubete, com 1,20 m. */
const PENDENTE: ItemParaConferir = {
  id: 'item-1',
  especie: 'Ipê-amarelo',
  recipiente: 'Tubete',
  recipienteId: 'tub',
  alturaM: 1.2,
  quantidade: 500,
  disponivel: null,
  quantidadeDisponivel: null,
  recipienteDisponivelId: null,
  recipienteDisponivel: null,
  alturaDisponivelM: null,
  observacoesDisponibilidade: null,
};

const acao = vi.mocked(marcarDisponibilidadeAction);

function ultimoEnvio(): FormData {
  return acao.mock.calls.at(-1)![1];
}

function renderiza(item: Partial<ItemParaConferir> = {}) {
  return render(<VerificacaoItem pedidoId="pedido-1" item={{ ...PENDENTE, ...item }} recipientes={RECIPIENTES} />);
}

beforeEach(() => acao.mockClear());

describe('VerificacaoItem, os botões vêm da regra (P12)', () => {
  it('o cliente especificou algo: três botões', () => {
    renderiza();
    expect(screen.getByText('Não tem')).toBeTruthy();
    expect(screen.getByText('Tem parte')).toBeTruthy();
    expect(screen.getByText('Tem tudo')).toBeTruthy();
  });

  it('o cliente não especificou nada: "Não tem" e "Tem"', () => {
    renderiza({ quantidade: null, recipiente: null, recipienteId: null, alturaM: null });
    expect(screen.queryByText('Tem parte')).toBeNull();
    expect(screen.getByText('Tem')).toBeTruthy();
  });

  it('mostra o que foi pedido, e "a definir" no que faltou', () => {
    renderiza({ quantidade: null });
    expect(screen.getByText('quantidade a definir')).toBeTruthy();
    expect(screen.getByText('Tubete')).toBeTruthy();
    expect(screen.getByText('1,20 m')).toBeTruthy();
  });
});

describe('VerificacaoItem, respostas sem pergunta gravam no toque', () => {
  it('"Não tem" grava na hora', async () => {
    renderiza();
    fireEvent.click(screen.getByText('Não tem'));
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('estado')).toBe('indisponivel');
  });

  it('"Tem tudo" no item completo grava na hora, sem abrir campo', async () => {
    renderiza();
    fireEvent.click(screen.getByText('Tem tudo'));
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('estado')).toBe('disponivel');
    expect(screen.queryByLabelText(/Quantas tem/)).toBeNull();
  });
});

describe('VerificacaoItem, "Tem parte"', () => {
  it('pergunta tudo o que foi especificado, já preenchido com o pedido', () => {
    renderiza();
    fireEvent.click(screen.getByText('Tem parte'));
    expect((screen.getByLabelText(/Quantas tem/) as HTMLInputElement).value).toBe('500');
    expect((screen.getByLabelText(/Em que recipiente está/) as HTMLSelectElement).value).toBe('tub');
    expect((screen.getByLabelText(/Com que altura/) as HTMLInputElement).value).toBe('1,20');
    expect(acao).not.toHaveBeenCalled();
  });

  it('sem nada diferente não grava, e diz por quê', () => {
    renderiza();
    fireEvent.click(screen.getByText('Tem parte'));
    fireEvent.blur(screen.getByLabelText(/Quantas tem/));
    expect(acao).not.toHaveBeenCalled();
    expect(screen.getByText(/Nada difere do pedido/)).toBeTruthy();
  });

  it('menos mudas grava ao sair do campo', async () => {
    renderiza();
    fireEvent.click(screen.getByText('Tem parte'));
    const campo = screen.getByLabelText(/Quantas tem/);
    fireEvent.change(campo, { target: { value: '300' } });
    fireEvent.blur(campo);
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('estado')).toBe('parcial');
    expect(ultimoEnvio().get('quantidade')).toBe('300');
    expect(ultimoEnvio().get('recipiente_id')).toBe('tub');
    expect(ultimoEnvio().get('altura')).toBe('1,20');
  });

  it('trocar só o recipiente já é resposta, e grava na troca', async () => {
    renderiza();
    fireEvent.click(screen.getByText('Tem parte'));
    fireEvent.change(screen.getByLabelText(/Em que recipiente está/), { target: { value: 'saco' } });
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('recipiente_id')).toBe('saco');
  });

  it('já gravado: reabre com o gravado, e sair sem mudar não regrava', () => {
    renderiza({ disponivel: false, quantidadeDisponivel: 300 });
    expect(screen.getByText('Tem parte: 300 de 500')).toBeTruthy();
    const campo = screen.getByLabelText(/Quantas tem/) as HTMLInputElement;
    expect(campo.value).toBe('300');
    fireEvent.blur(campo);
    expect(acao).not.toHaveBeenCalled();
  });
});

describe('VerificacaoItem, "Tem" do item incompleto', () => {
  it('sem recipiente no pedido: pergunta em qual está, e só grava quando responde', async () => {
    renderiza({ recipiente: null, recipienteId: null });
    fireEvent.click(screen.getByText('Tem tudo'));
    expect(acao).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/Quantas tem/)).toBeNull();

    fireEvent.change(screen.getByLabelText(/Em que recipiente está/), { target: { value: 'saco' } });
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('estado')).toBe('disponivel');
    expect(ultimoEnvio().get('recipiente_id')).toBe('saco');
  });

  it('sem quantidade no pedido: "Tem" grava no toque, e o número é opcional', async () => {
    renderiza({ quantidade: null });
    fireEvent.click(screen.getByText('Tem tudo'));
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('quantidade')).toBe('');

    const campo = screen.getByLabelText(/Quantas tem/);
    fireEvent.change(campo, { target: { value: '350' } });
    fireEvent.blur(campo);
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(2));
    expect(ultimoEnvio().get('quantidade')).toBe('350');
  });

  it('respondido, diz quantas tem e onde', () => {
    renderiza({
      quantidade: null,
      recipiente: null,
      recipienteId: null,
      alturaM: null,
      disponivel: true,
      quantidadeDisponivel: 350,
      recipienteDisponivelId: 'saco',
      recipienteDisponivel: 'Saco 10x18',
    });
    expect(screen.getByText('Tem 350, em Saco 10x18')).toBeTruthy();
  });
});

describe('VerificacaoItem, observação', () => {
  it('fica recolhida até alguém precisar dela', () => {
    renderiza();
    expect(screen.queryByLabelText('Observação')).toBeNull();
    fireEvent.click(screen.getByText('Adicionar observação'));
    expect(screen.getByLabelText('Observação')).toBeTruthy();
  });

  it('escrita depois da resposta, regrava a mesma resposta com ela', async () => {
    renderiza({ disponivel: false, quantidadeDisponivel: 0 });
    fireEvent.click(screen.getByText('Adicionar observação'));
    const campo = screen.getByLabelText('Observação');
    fireEvent.change(campo, { target: { value: 'ver com o Gilberto' } });
    fireEvent.blur(campo);
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('estado')).toBe('indisponivel');
    expect(ultimoEnvio().get('observacoes')).toBe('ver com o Gilberto');
  });
});
