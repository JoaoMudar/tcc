import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NovoPedidoForm } from '../NovoPedidoForm';

vi.mock('../../actions', () => ({ criarPedidoAction: vi.fn() }));
vi.mock('@/app/(sistema)/cadastros/pessoas/actions', () => ({ savePessoaAction: vi.fn() }));
vi.mock('@/app/(sistema)/cadastros/especies/acoes-rapidas', () => ({ criarEspecieRapidaAction: vi.fn() }));

function montar() {
  return render(
    <NovoPedidoForm clientes={[{ value: 'c1', label: 'Sítio Boa Vista' }]} especies={[]} recipientes={[]} saldos={{}} />,
  );
}

/** Os campos que o formulário envia, pelo nome. */
function enviados(container: HTMLElement, nome: string): string[] {
  return [...container.querySelectorAll<HTMLInputElement>(`[name="${nome}"]`)].map((campo) => campo.value);
}

describe('NovoPedidoForm (T8.1)', () => {
  it('pede observação, e não mostra o aviso de que o preço vem depois', () => {
    const { container } = montar();
    expect(screen.getByLabelText('Observação')).toBeTruthy();
    expect(enviados(container, 'observacoes')).toEqual(['']);
    expect(screen.queryByText(/preço de cada item/)).toBeNull();
  });

  it('o canal é um select só, que começa no atacado', () => {
    const { container } = montar();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(enviados(container, 'canal')).toEqual(['atacado']);

    fireEvent.change(screen.getByRole('combobox', { name: 'Canal de venda' }), { target: { value: 'prefeitura' } });
    expect(enviados(container, 'canal')).toEqual(['prefeitura']);
  });

  it('a observação vem antes da grade de itens', () => {
    montar();
    const observacao = screen.getByLabelText('Observação');
    const itens = screen.getByText('Itens');
    expect(observacao.compareDocumentPosition(itens) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('o botão ao lado do cliente abre o cadastro inteiro em tela cheia, exigindo só nome e telefone', () => {
    const { container } = montar();
    fireEvent.click(screen.getByText('+ Novo'));
    expect(screen.getByRole('dialog', { name: 'Cliente novo' })).toBeTruthy();
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    const exigidos = [...container.querySelectorAll<HTMLInputElement>('[role="dialog"] input[required]')].map((c) => c.name);
    expect(exigidos).toEqual(['nome', 'telefone']);
    expect(enviados(container, 'para_pedido')).toEqual(['1']);
    expect(enviados(container, 'papel_cliente')).toEqual(['on']);

    fireEvent.click(screen.getByText('Cancelar'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('o cliente escolhido não repete o nome embaixo do campo', () => {
    montar();
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'boa' } });
    fireEvent.click(screen.getByText('Sítio Boa Vista'));
    expect(screen.queryByText(/Escolhido:/)).toBeNull();
  });

  it('a observação é caixa de texto, que aceita quebra de linha', () => {
    montar();
    expect(screen.getByLabelText('Observação').tagName).toBe('TEXTAREA');
  });

  it('a lixeira da única linha limpa a linha, em vez de não fazer nada', () => {
    const { container } = render(
      <NovoPedidoForm
        clientes={[]}
        especies={[{ id: 'pit', nome: 'Pitanga', nomeCientifico: 'Eugenia uniflora' }]}
        recipientes={[{ value: 'tub', label: 'Tubete' }]}
        saldos={{}}
      />,
    );
    fireEvent.change(screen.getByLabelText('Quantidade do item 1'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Espécie do item 1'), { target: { value: 'pit' } });
    fireEvent.click(screen.getAllByText('Pitanga')[0]);
    expect(enviados(container, 'item_especie')).toEqual(['pit']);
    expect(enviados(container, 'item_quantidade')).toEqual(['300']);

    fireEvent.click(screen.getByLabelText('Excluir o item 1'));
    expect(enviados(container, 'item_especie')).toEqual(['']);
    expect(enviados(container, 'item_quantidade')).toEqual(['']);
    expect(screen.getByLabelText('Espécie do item 1')).toHaveValue('');
  });

  it('espécie digitada que não existe abre o cadastro rápido com o nome preenchido', () => {
    montar();
    fireEvent.change(screen.getByLabelText('Espécie do item 1'), { target: { value: 'Guapuruvu' } });
    fireEvent.click(screen.getByText('+ Cadastrar "Guapuruvu" como espécie nova'));
    expect(screen.getByRole('dialog', { name: 'Espécie nova' })).toBeTruthy();
    expect(screen.getByLabelText('Nome popular')).toHaveValue('Guapuruvu');
  });

  it('a quantidade não é obrigatória no cadastro', () => {
    montar();
    expect(screen.getByLabelText('Quantidade do item 1')).not.toBeRequired();
  });
});
