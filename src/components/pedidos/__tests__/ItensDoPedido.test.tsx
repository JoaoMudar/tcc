import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type ItemExibido, ItensDoPedido } from '../ItensDoPedido';

function item(extra: Partial<ItemExibido> = {}): ItemExibido {
  return {
    id: 'a',
    especie: 'Ipê-amarelo',
    recipiente: 'Tubete',
    quantidade: 500,
    precoCentavos: null,
    itemPaiId: null,
    especificacao: null,
    ...extra,
  };
}

describe('ItensDoPedido (T8.1)', () => {
  it('antes da conferência mostra espécie, recipiente e quantidade, e nenhum valor', () => {
    render(<ItensDoPedido itens={[item()]} />);
    expect(screen.getByText('Ipê-amarelo')).toBeInTheDocument();
    expect(screen.getByText('Tubete')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.queryByText('Total', { exact: true })).toBeNull();
    // O total do pedido é o único lugar que fala de valor, e ele diz "a definir"
    expect(screen.getByText('a definir')).toBeInTheDocument();
  });

  it('com preço aparecem as colunas de valor', () => {
    render(<ItensDoPedido itens={[item({ precoCentavos: 250 })]} />);
    expect(screen.getByText('Total', { exact: true })).toBeInTheDocument();
    // O total do item e o do pedido: com um item só, os dois são o mesmo valor
    expect(screen.getAllByText('R$ 1.250,00')).toHaveLength(2);
    expect(screen.getByText(/R\$ 2,50 cada/)).toBeInTheDocument();
  });

  it('a espécie do item genérico fica por definir', () => {
    render(<ItensDoPedido itens={[item({ especie: null, especificacao: '500 nativas' })]} />);
    expect(screen.getByText('a definir na conferência')).toBeInTheDocument();
    expect(screen.getByText(/500 nativas/)).toBeInTheDocument();
  });

  it('o filho da composição sai marcado, e não cobra de novo', () => {
    render(
      <ItensDoPedido
        itens={[
          item({ id: 'pai', especie: null, precoCentavos: 200 }),
          item({ id: 'filho', especie: 'Araucária', quantidade: 500, precoCentavos: 200, itemPaiId: 'pai' }),
        ]}
      />,
    );
    // Um total de item só: o do pai. O filho herda o preço e não soma.
    expect(screen.getAllByText('R$ 1.000,00')).toHaveLength(2);
    expect(screen.getByText('·')).toBeInTheDocument();
  });

  it('na lista montada o filho é cobrado, e o genérico não', () => {
    render(
      <ItensDoPedido
        itens={[
          item({ id: 'pai', especie: null, generico: true, quantidade: null, especificacao: 'o que tiver' }),
          item({ id: 'filho', especie: 'Araucária', quantidade: 100, precoCentavos: 300, itemPaiId: 'pai' }),
        ]}
      />,
    );
    expect(screen.getAllByText('R$ 300,00')).toHaveLength(2);
    expect(screen.getByText(/R\$ 3,00 cada/)).toBeInTheDocument();
  });

  it('o recipiente que o cliente não disse fica a definir', () => {
    render(<ItensDoPedido itens={[item({ recipiente: null })]} />);
    expect(screen.getAllByText('a definir').length).toBeGreaterThanOrEqual(2);
  });

  it('a altura pedida sai junto do recipiente, e só quando existe', () => {
    const { rerender } = render(<ItensDoPedido itens={[item({ alturaM: 1.2 })]} />);
    expect(screen.getByText('1,20 m')).toBeInTheDocument();
    rerender(<ItensDoPedido itens={[item()]} />);
    expect(screen.queryByText(/ m$/)).toBeNull();
  });

  it('pedido sem item diz isso, em vez de mostrar uma grade vazia', () => {
    render(<ItensDoPedido itens={[]} />);
    expect(screen.getByText('Nenhum item neste pedido.')).toBeInTheDocument();
  });

  it('o saldo pronto entra junto da espécie, e avisa quando falta muda (RF-56)', () => {
    render(<ItensDoPedido itens={[item({ pronto: 300, emProducao: 100 })]} />);
    expect(screen.getByText(/Pronto para venda/)).toBeInTheDocument();
    expect(screen.getByText(/faltam 200/)).toBeInTheDocument();
  });

  it('o item sem quantidade diz que ela está a definir, e não mostra zero', () => {
    render(<ItensDoPedido itens={[item({ quantidade: null })]} />);
    expect(screen.queryByText('0')).toBeNull();
    // Um "a definir" na quantidade e outro no total
    expect(screen.getAllByText('a definir')).toHaveLength(2);
  });
});
