import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemDaFicha } from '@/components/pedidos/GradeItensFicha';
import { adicionarItemAction, atualizarItemAction, negociarItensAction, removerItemAction } from '../../actions';
import { ATRASO_GRAVACAO_MS, ItensDaFicha } from '../ItensDaFicha';

vi.mock('../../actions', () => ({
  adicionarItemAction: vi.fn(async () => ({ success: 'ok', itemId: 'novo' })),
  atualizarItemAction: vi.fn(async () => ({ success: 'ok' })),
  removerItemAction: vi.fn(async () => ({ success: 'ok' })),
  negociarItensAction: vi.fn(async () => ({ success: 'Negociação salva.' })),
  confirmarPedidoAction: vi.fn(async () => ({})),
  transicionarPedidoAction: vi.fn(async () => ({})),
}));

function item(sobre: Partial<ItemDaFicha> = {}): ItemDaFicha {
  return {
    id: 'a',
    especieId: 'e1',
    especie: 'Ipê-amarelo',
    nomeCientifico: null,
    generico: false,
    quantidade: 100,
    precoCentavos: null,
    recipienteId: 't',
    recipiente: 'Tubete',
    recipienteDisponivelId: null,
    recipienteDisponivel: null,
    alturaM: null,
    alturaDisponivelM: null,
    itemPaiId: null,
    especificacao: null,
    disponivel: true,
    quantidadeDisponivel: null,
    ...sobre,
  };
}

const PASSO = { pedidoId: 'p1', podeConferir: true, podeDecidir: true, podeSeparar: true };

/** A digitação para, o atraso passa e as gravações da fila terminam. */
async function esperarGravacao() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ATRASO_GRAVACAO_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe('ItensDaFicha: a negociação grava ao digitar (RF-55)', () => {
  function negociacao(itens = [item()]) {
    return render(
      <ItensDaFicha
        pedidoId="p1"
        modo="negociacao"
        itens={itens}
        saldos={{}}
        faltaBloqueia
        proximoPasso={{ ...PASSO, situacao: 'verificado' }}
      />,
    );
  }

  it('não há botão de salvar nem aviso de salvo: o preço grava quando a digitação para', async () => {
    negociacao();
    fireEvent.change(screen.getAllByLabelText('Preço do item 1')[0], { target: { value: '8,00' } });
    expect(negociarItensAction).not.toHaveBeenCalled();

    await esperarGravacao();
    expect(negociarItensAction).toHaveBeenCalledTimes(1);
    const enviado = vi.mocked(negociarItensAction).mock.calls[0][1];
    expect(enviado.getAll('negociar_item_id')).toEqual(['a']);
    expect(enviado.getAll('negociar_preco')).toEqual(['8,00']);
    expect(enviado.getAll('negociar_quantidade')).toEqual(['100']);
    expect(screen.queryByText(/salva/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /salvar/i })).toBeNull();
  });

  it('várias teclas seguidas viram uma gravação só', async () => {
    negociacao();
    const campo = screen.getAllByLabelText('Preço do item 1')[0];
    fireEvent.change(campo, { target: { value: '8' } });
    fireEvent.change(campo, { target: { value: '8,5' } });
    fireEvent.change(campo, { target: { value: '8,50' } });
    await esperarGravacao();
    expect(negociarItensAction).toHaveBeenCalledTimes(1);
  });

  it('o que falta para aprovar acompanha o que está digitado', async () => {
    negociacao();
    expect(screen.getByText('Falta preço em 1 item.')).toBeTruthy();
    fireEvent.change(screen.getAllByLabelText('Preço do item 1')[0], { target: { value: '8,00' } });
    expect(screen.queryByText('Falta preço em 1 item.')).toBeNull();
  });

  it('o erro do servidor aparece em cima da grade', async () => {
    vi.mocked(negociarItensAction).mockResolvedValueOnce({ error: 'No item 1: o preço é grande demais.' });
    negociacao();
    fireEvent.change(screen.getAllByLabelText('Preço do item 1')[0], { target: { value: '9999999999' } });
    await esperarGravacao();
    expect(screen.getByText('No item 1: o preço é grande demais.')).toBeTruthy();
  });
});

describe('ItensDaFicha: o orçamento edita a grade do cadastro, gravando ao digitar', () => {
  function orcamento(itens = [item()]) {
    return render(
      <ItensDaFicha
        pedidoId="p1"
        modo="cadastro"
        itens={itens}
        saldos={{}}
        opcoesEspecie={[
          { value: 'e1', label: 'Ipê-amarelo' },
          { value: 'e2', label: 'Pitanga' },
        ]}
        recipientes={[{ value: 't', label: 'Tubete' }]}
        proximoPasso={{ ...PASSO, situacao: 'cadastrado' }}
      />,
    );
  }

  it('alterar a quantidade grava o item existente', async () => {
    orcamento();
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '250' } });
    await esperarGravacao();
    expect(atualizarItemAction).toHaveBeenCalledTimes(1);
    const enviado = vi.mocked(atualizarItemAction).mock.calls[0][1];
    expect(enviado.get('item_id')).toBe('a');
    expect(enviado.get('quantidade')).toBe('250');
    expect(enviado.get('item_especie')).toBe('e1');
  });

  it('a linha nova vira item quando ganha espécie, e depois só se atualiza', async () => {
    orcamento();
    fireEvent.click(screen.getAllByText('+ Adicionar linha')[0]);
    // Sem espécie a linha ainda está sendo digitada: não grava
    fireEvent.change(screen.getByLabelText('Quantidade do item 2'), { target: { value: '5' } });
    await esperarGravacao();
    expect(adicionarItemAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Espécie do item 2'), { target: { value: 'Pitan' } });
    fireEvent.click(screen.getByText('Pitanga'));
    await esperarGravacao();
    expect(adicionarItemAction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(adicionarItemAction).mock.calls[0][1].get('item_especie')).toBe('e2');

    fireEvent.change(screen.getByLabelText('Quantidade do item 2'), { target: { value: '6' } });
    await esperarGravacao();
    expect(adicionarItemAction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(atualizarItemAction).mock.calls.at(-1)![1].get('item_id')).toBe('novo');
  });

  it('a lixeira tira o item na hora', async () => {
    orcamento([item(), item({ id: 'b', especie: 'Pitanga', especieId: 'e2' })]);
    fireEvent.click(screen.getByLabelText('Excluir o item 2'));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(removerItemAction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(removerItemAction).mock.calls[0][1].get('item_id')).toBe('b');
  });
});
