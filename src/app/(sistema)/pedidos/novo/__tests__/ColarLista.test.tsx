import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColarLista } from '../ColarLista';

vi.mock('@/app/(sistema)/cadastros/especies/acoes-rapidas', () => ({
  adicionarNomePopularAction: vi.fn(),
  criarEspecieRapidaAction: vi.fn(),
}));

const ESPECIES = [
  { id: 'ipe', nome: 'Ipê-amarelo', nomeCientifico: 'Handroanthus albus', nomesPopulares: ['Ipê-amarelo'] },
  { id: 'pit', nome: 'Pitanga', nomeCientifico: 'Eugenia uniflora', nomesPopulares: ['Pitanga'] },
];
const RECIPIENTES = [{ value: 'tub', label: 'Tubete' }];

/** Monta a colagem já reconhecida, que é a etapa da conferência. */
function conferir(texto: string, onImportar = vi.fn()) {
  const tela = render(
    <ColarLista
      especies={ESPECIES}
      recipientes={RECIPIENTES}
      textoInicial={texto}
      onImportar={onImportar}
      onEspecieNova={vi.fn()}
      onFechar={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText('Reconhecer →'));
  return { ...tela, onImportar };
}

function situacoes(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('td[data-situacao]')].map((celula) => celula.getAttribute('data-situacao'));
}

describe('conferência da lista colada (T8.16)', () => {
  it('é uma grade com espécie, quantidade e genérico, e o recipiente padrão no cabeçalho', () => {
    conferir('Ipê amarelo 500');
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Espécie', 'Qtd', 'Genérico', 'Excluir']);

    const recipiente = screen.getByLabelText('Recipiente padrão (vale para todas)');
    expect(recipiente).toHaveValue('tub');
    expect(recipiente.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a espécie encontrada fica verde, e a que não casou fica vermelha', () => {
    const { container } = conferir('Ipê amarelo 500\nPlanta desconhecida 20');
    expect(situacoes(container)).toEqual(['encontrada', 'nao-encontrada']);
    expect(screen.getByText(/Cadastrar "Planta desconhecida"/)).toBeInTheDocument();
  });

  it('marcar genérico resolve a linha sem espécie', () => {
    const { container } = conferir('Planta desconhecida 20');
    expect(screen.queryByText(/Adicionar 1 item/)).toBeNull();

    fireEvent.click(screen.getByLabelText('Tornar genérico o item da linha 1'));
    expect(situacoes(container)).toEqual(['generico']);
    expect(screen.getByText('Espécie a definir na conferência')).toBeInTheDocument();
    expect(screen.getByText('Adicionar 1 item ao pedido')).toBeInTheDocument();
  });

  it('a quantidade em branco não segura a importação, porque no cadastro ela é opcional', () => {
    const { onImportar } = conferir('Pitanga');
    expect(screen.getByLabelText('Quantidade da linha 1')).toHaveValue('');

    fireEvent.click(screen.getByText('Adicionar 1 item ao pedido'));
    expect(onImportar).toHaveBeenCalledWith([
      { generico: false, especieId: 'pit', especie: 'Pitanga', recipienteId: 'tub', quantidade: '' },
    ]);
  });

  it('quantidade que não é número continua segurando', () => {
    conferir('Pitanga 30');
    fireEvent.change(screen.getByLabelText('Quantidade da linha 1'), { target: { value: 'trinta' } });
    expect(screen.getByText(/Uma linha a resolver/)).toBeInTheDocument();
  });

  it('a espécie aparece com o científico embaixo', () => {
    conferir('Pitanga 30');
    expect(screen.getByText('Eugenia uniflora')).toBeInTheDocument();
  });
});
