import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { marcarGenericoIndisponivelAction } from '../actions';
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

beforeEach(() => naoTem.mockClear());

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

  it('o gravar só habilita quando a soma fecha', () => {
    renderiza({ disponivel: true, filhos: [filho('ipe', 300), filho('aroeira', 200)] });
    expect(screen.getByText('Fechou!')).toBeTruthy();
    expect((screen.getByText('Gravar').closest('button') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(screen.getAllByLabelText(/Quantas/)[1], { target: { value: '100' } });
    expect(screen.getByText('Faltam 100')).toBeTruthy();
    expect((screen.getByText('Gravar').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('"Tem parte" aceita soma menor e mostra quantas de quantas', () => {
    renderiza({ disponivel: false, quantidadeDisponivel: 300, filhos: [filho('ipe', 300)] });
    expect(screen.getByText('300 de 500')).toBeTruthy();
    // Em "Tem parte" o recipiente é perguntado, já com o pedido
    expect((screen.getByLabelText(/^Recipiente/) as HTMLSelectElement).value).toBe('tub');
    expect((screen.getByText('Gravar').closest('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('lista montada (sem quantidade no pedido): "Tem" e quantidade opcional', () => {
    renderiza({ quantidade: null, recipiente: null, recipienteId: null });
    expect(screen.queryByText('Tem parte')).toBeNull();
    fireEvent.click(screen.getByText('Tem'));
    expect((screen.getByLabelText(/Quantas/) as HTMLInputElement).required).toBe(false);
    expect((screen.getByLabelText(/^Recipiente/) as HTMLSelectElement).required).toBe(true);
  });
});
