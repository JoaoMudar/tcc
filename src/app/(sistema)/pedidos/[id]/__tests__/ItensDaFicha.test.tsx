import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemDaFicha } from '@/components/pedidos/GradeItensFicha';
import {
  adicionarItemAction,
  atualizarItemAction,
  negociarItensAction,
  removerItemAction,
  salvarFreteAction,
  sugerirFreteAction,
} from '../../actions';
import { ATRASO_GRAVACAO_MS, ItensDaFicha } from '../ItensDaFicha';

vi.mock('../../actions', () => ({
  adicionarItemAction: vi.fn(async () => ({ success: 'ok', itemId: 'novo' })),
  atualizarItemAction: vi.fn(async () => ({ success: 'ok' })),
  removerItemAction: vi.fn(async () => ({ success: 'ok' })),
  negociarItensAction: vi.fn(async () => ({ success: 'Negociação salva.' })),
  salvarFreteAction: vi.fn(async () => ({ success: 'Frete salvo.' })),
  sugerirFreteAction: vi.fn(async () => ({ centavos: 7000, distanciaKm: 85 })),
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

describe('ItensDaFicha: o fechamento do pedido (RF-67)', () => {
  function negociacao(itens = [item({ precoCentavos: 300, pesoKg: 0.35 })], frete?: { centavos: number | null }) {
    return render(
      <ItensDaFicha
        pedidoId="p1"
        modo="negociacao"
        itens={itens}
        saldos={{}}
        proximoPasso={{ ...PASSO, situacao: 'verificado' }}
        frete={frete ? { centavos: frete.centavos, origem: null, distanciaKm: null } : undefined}
      />,
    );
  }

  it('a linha final soma as mudas, o frete e mostra o peso', () => {
    negociacao(undefined, { centavos: 5000 });
    const fechamento = screen.getByRole('region', { name: 'Fechamento do pedido' });
    // 100 × R$ 3,00 = R$ 300,00; com R$ 50,00 de frete, R$ 350,00
    expect(fechamento.textContent).toMatch(/300,00/);
    expect(fechamento.textContent).toMatch(/350,00/);
    expect(fechamento.textContent).toContain('≈ 35 kg');
  });

  it('o total acompanha o frete digitado, e o frete grava quando a digitação para', async () => {
    negociacao();
    fireEvent.change(screen.getByLabelText('Frete'), { target: { value: '80,00' } });
    expect(screen.getByRole('region', { name: 'Fechamento do pedido' }).textContent).toMatch(/380,00/);
    await esperarGravacao();
    const enviado = vi.mocked(salvarFreteAction).mock.calls[0][1];
    expect(enviado.get('frete')).toBe('80,00');
    expect(enviado.get('frete_origem')).toBe('agrolandia');
  });

  it('"Sugerir" pede a conta da origem escolhida e preenche o campo', async () => {
    negociacao();
    fireEvent.click(screen.getByLabelText('Itapema'));
    await act(async () => {
      fireEvent.click(screen.getByText('Sugerir frete pela distância'));
    });
    expect(sugerirFreteAction).toHaveBeenCalledWith('p1', 'itapema');
    expect((screen.getByLabelText('Frete') as HTMLInputElement).value).toBe('70,00');
    expect(screen.getByText(/85 km, ida e volta/)).toBeTruthy();
  });

  it('o aviso da sugestão aparece, e o campo fica como estava', async () => {
    vi.mocked(sugerirFreteAction).mockResolvedValueOnce({ error: 'O cliente não tem endereço de entrega. Digite o frete combinado.' });
    negociacao();
    await act(async () => {
      fireEvent.click(screen.getByText('Sugerir frete pela distância'));
    });
    expect(screen.getByText(/não tem endereço de entrega/)).toBeTruthy();
    expect((screen.getByLabelText('Frete') as HTMLInputElement).value).toBe('');
  });

  it('item sem peso no recipiente é avisado', () => {
    negociacao([item({ precoCentavos: 300, pesoKg: null })]);
    expect(screen.getByText('1 item sem peso')).toBeTruthy();
  });

  it('o peso usa o recipiente conferido, quando é nele que a muda vai', () => {
    negociacao([
      item({ precoCentavos: 300, pesoKg: 0.35, recipienteDisponivelId: 's', recipienteDisponivel: 'Saco', pesoDisponivelKg: 2 }),
    ]);
    expect(screen.getByRole('region', { name: 'Fechamento do pedido' }).textContent).toContain('≈ 200 kg');
  });

  it('na leitura, o frete não é campo', () => {
    render(
      <ItensDaFicha
        pedidoId="p1"
        modo="leitura"
        itens={[item({ precoCentavos: 300 })]}
        saldos={{}}
        proximoPasso={{ ...PASSO, situacao: 'aprovado' }}
        frete={{ centavos: null, origem: null, distanciaKm: null }}
      />,
    );
    expect(screen.queryByLabelText('Frete')).toBeNull();
    expect(screen.getByText('sem frete')).toBeTruthy();
  });
});
