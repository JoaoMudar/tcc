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
    const cabecalho = ['Espécie', 'Recipiente', 'Altura', 'Quantidade'];
    const textos = cabecalho.map((titulo) => screen.getByText(titulo, { selector: 'span' }).textContent);
    expect(textos).toEqual(cabecalho);
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
});
