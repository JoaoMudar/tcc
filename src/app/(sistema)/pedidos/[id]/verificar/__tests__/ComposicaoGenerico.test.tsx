import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { definirComposicaoAction, marcarGenericoIndisponivelAction } from '../actions';
import { ComposicaoGenerico, type GenericoParaCompor } from '../ComposicaoGenerico';

vi.mock('../actions', () => ({
  definirComposicaoAction: vi.fn(async () => ({ success: 'Composição gravada.' })),
  marcarGenericoIndisponivelAction: vi.fn(async () => ({ success: 'Resposta gravada.' })),
}));

const RECIPIENTES = [
  { value: 'tub', label: 'Tubete' },
  { value: 'saco', label: 'Saco 10x18' },
];
const ESPECIES = [
  { value: 'ipe', label: 'Ipê-amarelo' },
  { value: 'aroeira', label: 'Aroeira' },
];

/** "500 mudas nativas em tubete", ainda sem resposta. */
const PENDENTE: GenericoParaCompor = {
  id: 'pai-1',
  quantidade: 500,
  recipiente: 'Tubete',
  recipienteId: 'tub',
  alturaM: null,
  especificacao: 'Mudas nativas',
  disponivel: null,
  quantidadeDisponivel: null,
  observacoesDisponibilidade: null,
  especiesPermitidas: [],
  filhos: [],
};

const filho = (especieId: string, quantidade: number | null, recipienteId = 'tub') => ({
  id: `f-${especieId}`,
  especieId,
  especie: especieId,
  recipienteId,
  recipiente: recipienteId === 'tub' ? 'Tubete' : 'Saco 10x18',
  quantidade,
  alturaM: null,
});

function renderiza(item: Partial<GenericoParaCompor> = {}) {
  return render(
    <ComposicaoGenerico pedidoId="pedido-1" item={{ ...PENDENTE, ...item }} especies={ESPECIES} recipientes={RECIPIENTES} />,
  );
}

const naoTem = vi.mocked(marcarGenericoIndisponivelAction);
const compor = vi.mocked(definirComposicaoAction);

beforeEach(() => {
  naoTem.mockClear();
  compor.mockClear();
});

describe('ComposicaoGenerico (P12)', () => {
  it('tem os mesmos três botões do item com espécie', () => {
    renderiza();
    expect(screen.getByText('Não tem')).toBeTruthy();
    expect(screen.getByText('Tem parte')).toBeTruthy();
    expect(screen.getByText('Tem tudo')).toBeTruthy();
  });

  it('"Não tem" grava no toque', async () => {
    renderiza();
    fireEvent.click(screen.getByText('Não tem'));
    await waitFor(() => expect(naoTem).toHaveBeenCalledTimes(1));
    expect(naoTem.mock.calls[0][1].get('item_pai_id')).toBe('pai-1');
  });

  it('"Tem tudo" com recipiente no pedido pergunta espécie e quantas, e não o recipiente', () => {
    renderiza();
    fireEvent.click(screen.getByText('Tem tudo'));
    expect(screen.getByLabelText(/Quantas/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Recipiente/)).toBeNull();
    expect(screen.getByText('Faltam 500')).toBeTruthy();
  });

  it('não tem botão "Gravar": grava ao sair do campo, e só quando a soma fecha', async () => {
    renderiza({ disponivel: true, filhos: [filho('ipe', 300), filho('aroeira', 200)] });
    expect(screen.queryByText('Gravar')).toBeNull();
    expect(screen.getByText('Fechou!')).toBeTruthy();

    const segunda = screen.getAllByLabelText(/Quantas/)[1];
    fireEvent.change(segunda, { target: { value: '100' } });
    fireEvent.blur(segunda);
    expect(screen.getByText('Faltam 100')).toBeTruthy();
    expect(compor).not.toHaveBeenCalled();

    fireEvent.change(screen.getAllByLabelText(/Quantas/)[0], { target: { value: '400' } });
    fireEvent.blur(screen.getAllByLabelText(/Quantas/)[0]);
    await waitFor(() => expect(compor).toHaveBeenCalledTimes(1));
    const dados = compor.mock.calls[0][1];
    expect(dados.get('estado')).toBe('disponivel');
    expect(dados.getAll('composicao_especie')).toEqual(['ipe', 'aroeira']);
    expect(dados.getAll('composicao_quantidade')).toEqual(['400', '100']);
    // Em "Tem tudo" o recipiente não é perguntado: vai vazio, e o servidor herda do genérico
    expect(dados.getAll('composicao_recipiente')).toEqual(['', '']);
  });

  it('sair do campo sem mudar nada não regrava a composição gravada', () => {
    renderiza({ disponivel: true, filhos: [filho('ipe', 300), filho('aroeira', 200)] });
    fireEvent.blur(screen.getAllByLabelText(/Quantas/)[0]);
    expect(compor).not.toHaveBeenCalled();
  });

  it('"Tem parte" aceita soma menor e mostra quantas de quantas', () => {
    renderiza({ disponivel: false, quantidadeDisponivel: 300, filhos: [filho('ipe', 300)] });
    expect(screen.getByText('300 de 500')).toBeTruthy();
    // Em "Tem parte" o recipiente é perguntado, já com o pedido
    expect((screen.getByLabelText(/^Recipiente/) as HTMLSelectElement).value).toBe('tub');
  });

  it('"Tem parte" com soma menor grava ao sair do campo', async () => {
    renderiza({ disponivel: false, quantidadeDisponivel: 300, filhos: [filho('ipe', 300)] });
    const campo = screen.getByLabelText(/Quantas/);
    fireEvent.change(campo, { target: { value: '250' } });
    fireEvent.blur(campo);
    await waitFor(() => expect(compor).toHaveBeenCalledTimes(1));
    expect(compor.mock.calls[0][1].get('estado')).toBe('parcial');
    expect(compor.mock.calls[0][1].getAll('composicao_quantidade')).toEqual(['250']);
  });

  it('não repete embaixo do título o que o botão já diz', () => {
    renderiza({ disponivel: true, filhos: [filho('ipe', 300), filho('aroeira', 200)] });
    expect(screen.queryByText(/2 espécies/)).toBeNull();
    expect(screen.getAllByText('Tem tudo')).toHaveLength(1);
  });

  it('lista montada (sem quantidade no pedido): "Tem" e quantidade opcional', () => {
    renderiza({ quantidade: null, recipiente: null, recipienteId: null });
    expect(screen.queryByText('Tem parte')).toBeNull();
    fireEvent.click(screen.getByText('Tem'));
    expect((screen.getByLabelText(/Quantas/) as HTMLInputElement).required).toBe(false);
    expect((screen.getByLabelText(/^Recipiente/) as HTMLSelectElement).required).toBe(true);
  });
});

describe('ComposicaoGenerico, o cartão pinta no toque (P13)', () => {
  it('"Tem parte" pinta de amarelo e "Tem tudo" de verde, antes de gravar', () => {
    const { container } = renderiza();
    const cartao = container.querySelector('li')!;
    expect(cartao.className).toContain('bg-white');
    fireEvent.click(screen.getByText('Tem parte'));
    expect(cartao.className).toContain('bg-amber-50');
    fireEvent.click(screen.getByText('Tem tudo'));
    expect(cartao.className).toContain('bg-green-50');
  });

  it('"Não tem" pinta de vermelho no toque', () => {
    const { container } = renderiza();
    fireEvent.click(screen.getByText('Não tem'));
    expect(container.querySelector('li')!.className).toContain('bg-red-50');
  });
});

describe('ComposicaoGenerico, sem "Nada difere do pedido"', () => {
  it('"Tem parte" igual ao pedido não grava, e não escreve a frase', () => {
    renderiza({ disponivel: false, quantidadeDisponivel: 300, filhos: [filho('ipe', 300)] });
    const campo = screen.getByLabelText(/Quantas/);
    fireEvent.change(campo, { target: { value: '500' } });
    fireEvent.blur(campo);
    expect(compor).not.toHaveBeenCalled();
    expect(screen.queryByText(/Nada difere do pedido/)).toBeNull();
  });
});
