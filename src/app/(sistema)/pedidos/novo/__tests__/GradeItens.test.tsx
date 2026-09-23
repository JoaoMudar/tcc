import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GradeItens } from '../GradeItens';
import { type Linha, linhaVazia } from '../linhas-pedido';

const ESPECIES = [
  { value: 'ipe', label: 'Ipê-amarelo' },
  { value: 'pit', label: 'Pitanga' },
];
const RECIPIENTES = [{ value: 'tub', label: 'Tubete · 0,05 L' }];

function preenchida(extra: Partial<Linha> = {}): Linha {
  return { ...linhaVazia(1), especieId: 'ipe', recipienteId: 'tub', altura: '1,20', quantidade: '500', ...extra };
}

function montar(linhas: readonly Linha[], acoes: Partial<Parameters<typeof GradeItens>[0]> = {}) {
  const props = {
    linhas,
    opcoesEspecie: ESPECIES,
    recipientes: RECIPIENTES,
    saldos: {},
    onAlterar: vi.fn(),
    onRemover: vi.fn(),
    onAdicionar: vi.fn(),
    onEditar: vi.fn(),
    onColar: vi.fn(),
    onColarLista: vi.fn(),
    onCriarEspecie: vi.fn(),
    ...acoes,
  };
  return { ...render(<GradeItens {...props} />), props };
}

/** Os campos que o formulário envia, que são os escondidos e não os visíveis. */
function enviados(container: HTMLElement, nome: string): string[] {
  return [...container.querySelectorAll<HTMLInputElement>(`input[name="${nome}"]`)].map((campo) => campo.value);
}

describe('planilha de itens do pedido (T8.1, RF-54)', () => {
  it('as colunas saem na ordem em que se lê um pedido', () => {
    montar([preenchida()]);
    const textos = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(textos).toEqual(['Espécie', 'Recipiente', 'Altura', 'Quantidade', 'Excluir']);
  });

  it('cada linha manda um campo escondido de cada, e não um por desenho de tela', () => {
    const { container } = montar([preenchida(), preenchida({ chave: 2, especieId: 'pit', altura: '', quantidade: '30' })]);
    expect(enviados(container, 'item_especie')).toEqual(['ipe', 'pit']);
    expect(enviados(container, 'item_altura')).toEqual(['1,20', '']);
    expect(enviados(container, 'item_quantidade')).toEqual(['500', '30']);
    expect(enviados(container, 'item_recipiente')).toEqual(['tub', 'tub']);
  });

  it('o item genérico vai sem espécie, ainda que a linha tenha uma guardada', () => {
    const { container } = montar([preenchida({ generico: true })]);
    expect(enviados(container, 'item_especie')).toEqual(['']);
    expect(enviados(container, 'item_generico')).toEqual(['1']);
  });

  it('o genérico manda o que o cliente pediu, e o item com espécie não manda descrição', () => {
    const { container } = montar([
      preenchida({ generico: true, especificacao: 'mudas nativas, o que tiver' }),
      preenchida({ chave: 2, especificacao: 'sobra de antes' }),
    ]);
    expect(enviados(container, 'item_especificacao')).toEqual(['mudas nativas, o que tiver', '']);
  });

  it('a linha sem espécie pode virar genérico, e o recipiente em branco vai vazio', () => {
    const onAlterar = vi.fn();
    const { container } = montar([{ ...linhaVazia(1), quantidade: '10' }], { onAlterar });
    expect(enviados(container, 'item_recipiente')).toEqual(['']);
    fireEvent.focus(screen.getByLabelText('Espécie do item 1'));
    fireEvent.click(screen.getByText('Genérico'));
    expect(onAlterar).toHaveBeenCalledWith(1, 'generico', true);
  });

  it('o genérico fica no campo da espécie, em azul, com a descrição embaixo', () => {
    const { container } = montar([preenchida({ generico: true }), preenchida({ chave: 2 })]);
    expect(screen.getByLabelText('Espécie do item 1')).toHaveValue('Genérico');
    expect(screen.getByLabelText('O que o cliente pediu no item 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('O que o cliente pediu no item 2')).toBeNull();
    expect(screen.queryByText(/Escolher a espécie/)).toBeNull();
    const [generica, comEspecie] = container.querySelectorAll('tbody tr');
    expect(generica).toHaveClass('bg-blue-50');
    expect(comEspecie).not.toHaveClass('bg-blue-50');
  });

  it('escolher uma espécie no genérico desfaz o genérico', () => {
    const onAlterar = vi.fn();
    montar([preenchida({ generico: true, especieId: '' })], { onAlterar });
    fireEvent.change(screen.getByLabelText('Espécie do item 1'), { target: { value: 'pit' } });
    expect(onAlterar).toHaveBeenCalledWith(1, 'generico', false);
    fireEvent.click(screen.getByText('Pitanga'));
    expect(onAlterar).toHaveBeenLastCalledWith(1, 'especieId', 'pit');
  });

  it('a lixeira tira a linha, e o "+" acrescenta outra', () => {
    const onRemover = vi.fn();
    const onAdicionar = vi.fn();
    montar([preenchida()], { onRemover, onAdicionar });

    fireEvent.click(screen.getByLabelText('Excluir o item 1'));
    expect(onRemover).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText('+ Adicionar linha'));
    expect(onAdicionar).toHaveBeenCalledWith(false);
    // No celular a linha nova abre em tela cheia, e é outro botão
    fireEvent.click(screen.getByText('+ Adicionar item'));
    expect(onAdicionar).toHaveBeenCalledWith(true);
  });

  it('no celular a linha não se edita: ela abre o item em tela cheia', () => {
    const onEditar = vi.fn();
    montar([preenchida()], { onEditar });
    // A linha da lista é um botão inteiro, e é o único lugar com esse nome
    fireEvent.click(screen.getByRole('button', { name: /Ipê-amarelo/ }));
    expect(onEditar).toHaveBeenCalledWith(1);
  });

  it('o botão de colar lista chama a revisão, e não cola nada sozinho', () => {
    const onColarLista = vi.fn();
    montar([preenchida()], { onColarLista });
    fireEvent.click(screen.getByText('📋 Colar lista'));
    expect(onColarLista).toHaveBeenCalled();
  });

  it('o Ctrl+V de várias linhas é entregue com a célula em que o cursor estava', () => {
    const onColar = vi.fn();
    montar([preenchida(), preenchida({ chave: 2 })], { onColar });

    fireEvent.focus(screen.getByLabelText('Quantidade do item 2'));
    fireEvent.paste(screen.getByLabelText('Quantidade do item 2'), {
      clipboardData: { getData: () => '500\n300' },
    });
    expect(onColar).toHaveBeenCalledWith('500\n300', { linha: 1, coluna: 3 });
  });

  it('colar uma célula só é colagem comum, e o navegador é quem faz', () => {
    const onColar = vi.fn();
    montar([preenchida()], { onColar });
    fireEvent.paste(screen.getByLabelText('Quantidade do item 1'), {
      clipboardData: { getData: () => '500' },
    });
    expect(onColar).not.toHaveBeenCalled();
  });

  it('no celular o científico vai miúdo embaixo do nome popular', () => {
    montar([preenchida()], { opcoesEspecie: [{ value: 'ipe', label: 'Ipê-amarelo', detalhe: 'Handroanthus albus' }] });
    expect(screen.getAllByText('Handroanthus albus').length).toBeGreaterThan(0);
  });

  it('a espécie que não está no catálogo se cadastra dali mesmo, pela linha', () => {
    const onCriarEspecie = vi.fn();
    montar([preenchida({ chave: 7, especieId: '' })], { onCriarEspecie });
    fireEvent.change(screen.getByLabelText('Espécie do item 1'), { target: { value: 'Guapuruvu' } });
    fireEvent.click(screen.getByText('+ Cadastrar "Guapuruvu" como espécie nova'));
    expect(onCriarEspecie).toHaveBeenCalledWith(7, 'Guapuruvu');
  });

  it('a altura digitada em centímetros vira metros ao sair do campo', () => {
    const onAlterar = vi.fn();
    montar([preenchida({ altura: '' })], { onAlterar });
    fireEvent.blur(screen.getByLabelText('Altura do item 1, em metros'), {
      target: { value: '120' },
    });
    expect(onAlterar).toHaveBeenLastCalledWith(1, 'altura', '1,20 m');
  });

  it('no celular a altura aparece uma vez só com a unidade', () => {
    montar([preenchida({ altura: '1,20 m' })]);
    expect(screen.getByText('Tubete · 0,05 L · 1,20 m')).toBeInTheDocument();
  });
});
