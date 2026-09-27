import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  complemento: null,
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

  it('sem nada diferente não grava, e não escreve "Nada difere do pedido"', () => {
    renderiza();
    fireEvent.click(screen.getByText('Tem parte'));
    fireEvent.blur(screen.getByLabelText(/Quantas tem/));
    expect(acao).not.toHaveBeenCalled();
    expect(screen.queryByText(/Nada difere do pedido/)).toBeNull();
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

  it('respondido com "Tem", não repete embaixo do título o que o botão já diz', () => {
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
    expect(screen.queryByText(/Tem 350/)).toBeNull();
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

describe('VerificacaoItem, o cartão pinta no toque (P13)', () => {
  it('cada botão dá a sua cor ao cartão, antes de gravar', async () => {
    const { container } = renderiza();
    const cartao = container.querySelector('li')!;
    expect(cartao.className).toContain('bg-white');
    fireEvent.click(screen.getByText('Tem parte'));
    expect(cartao.className).toContain('bg-amber-50');
    fireEvent.click(screen.getByText('Tem tudo'));
    expect(cartao.className).toContain('bg-green-50');
    // "Tem tudo" gravou, e os botões esperam a gravação acabar
    await waitFor(() => expect((screen.getByText('Não tem') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByText('Não tem'));
    expect(cartao.className).toContain('bg-red-50');
  });

  it('não mostra os textos de apoio que saíram', () => {
    renderiza({ quantidade: null });
    fireEvent.click(screen.getByText('Tem tudo'));
    expect(screen.queryByText(/Grava ao sair do campo/)).toBeNull();
    expect(screen.queryByText(/Gravando/)).toBeNull();
    expect(screen.queryByText(/Gravado/)).toBeNull();
    expect(screen.queryByText(/Se não contou/)).toBeNull();
  });
});

describe('VerificacaoItem, o "+" completa em outro recipiente (P13)', () => {
  it('duplica os campos, já com o que falta, e o "+" some', () => {
    renderiza();
    fireEvent.click(screen.getByText('Tem parte'));
    fireEvent.change(screen.getByLabelText(/Quantas tem/), { target: { value: '300' } });
    fireEvent.click(screen.getByText('+ Completar com outro recipiente'));

    expect(screen.getAllByLabelText(/Quantas tem/)).toHaveLength(2);
    const bloco = within(screen.getByRole('group', { name: 'Complemento' }));
    expect((bloco.getByLabelText(/Quantas tem/) as HTMLInputElement).value).toBe('200');
    expect((bloco.getByLabelText(/Com que altura/) as HTMLInputElement).value).toBe('1,20');
    expect(screen.queryByText('+ Completar com outro recipiente')).toBeNull();
  });

  it('não aparece em "Tem parte" de item sem quantidade', () => {
    renderiza({ quantidade: null });
    fireEvent.click(screen.getByText('Tem parte'));
    expect(screen.queryByText('+ Completar com outro recipiente')).toBeNull();
  });

  it('grava as duas linhas quando o recipiente do complemento é escolhido', async () => {
    renderiza();
    fireEvent.click(screen.getByText('Tem parte'));
    fireEvent.change(screen.getByLabelText(/Quantas tem/), { target: { value: '300' } });
    fireEvent.click(screen.getByText('+ Completar com outro recipiente'));
    const bloco = within(screen.getByRole('group', { name: 'Complemento' }));
    fireEvent.change(bloco.getByLabelText(/Em que recipiente está/), { target: { value: 'saco' } });

    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('quantidade')).toBe('300');
    expect(ultimoEnvio().get('complemento_quantidade')).toBe('200');
    expect(ultimoEnvio().get('complemento_recipiente_id')).toBe('saco');
  });

  it('a soma das duas linhas não passa do pedido', () => {
    renderiza();
    fireEvent.click(screen.getByText('Tem parte'));
    fireEvent.change(screen.getByLabelText(/Quantas tem/), { target: { value: '300' } });
    fireEvent.click(screen.getByText('+ Completar com outro recipiente'));
    const bloco = within(screen.getByRole('group', { name: 'Complemento' }));
    fireEvent.change(bloco.getByLabelText(/Quantas tem/), { target: { value: '300' } });
    fireEvent.change(bloco.getByLabelText(/Em que recipiente está/), { target: { value: 'saco' } });
    expect(acao).not.toHaveBeenCalled();
    expect(screen.getByText(/passam do pedido/)).toBeTruthy();
  });

  it('gravado com complemento: reabre as duas linhas e o resumo diz as duas', () => {
    renderiza({
      disponivel: false,
      quantidadeDisponivel: 300,
      complemento: { quantidade: 200, recipienteId: 'saco', recipiente: 'Saco 10x18', alturaM: 1.2 },
    });
    expect(screen.getByText('Tem parte: 300 de 500 + 200, em Saco 10x18, 1,20 m')).toBeTruthy();
    expect(screen.getAllByLabelText(/Quantas tem/)).toHaveLength(2);
  });

  it('"Tirar complemento" regrava só a primeira linha', async () => {
    renderiza({
      disponivel: false,
      quantidadeDisponivel: 300,
      complemento: { quantidade: 200, recipienteId: 'saco', recipiente: 'Saco 10x18', alturaM: 1.2 },
    });
    fireEvent.click(screen.getByText('Tirar complemento'));
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(ultimoEnvio().get('complemento_quantidade')).toBeNull();
    expect(screen.getAllByLabelText(/Quantas tem/)).toHaveLength(1);
  });
});

describe('VerificacaoItem, sem resumo que repete o botão', () => {
  it('"Não tem" gravado não escreve "Não tem no viveiro"', () => {
    renderiza({ disponivel: false, quantidadeDisponivel: 0 });
    expect(screen.queryByText(/Não tem no viveiro/)).toBeNull();
  });

  it('"Tem tudo" gravado não escreve "Tem tudo" de novo', () => {
    renderiza({ disponivel: true });
    expect(screen.getAllByText('Tem tudo')).toHaveLength(1);
  });
});
