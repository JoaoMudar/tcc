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
const RECIPIENTES = [
  { value: 'tub', label: 'Tubete' },
  { value: 's1722', label: 'Saco 17x22' },
];

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
  fireEvent.change(screen.getByLabelText('Recipiente padrão (vale para todas)'), { target: { value: 'tub' } });
  fireEvent.click(screen.getByText('Reconhecer →'));
  return { ...tela, onImportar };
}

function situacoes(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('td[data-situacao]')].map((celula) => celula.getAttribute('data-situacao'));
}

describe('conferência da lista colada (T8.16)', () => {
  it('é a grade dos itens, com recipiente e altura por linha, e o recipiente padrão no cabeçalho', () => {
    conferir('Ipê amarelo 500');
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Espécie',
      'Recipiente',
      'Altura',
      'Qtd',
      'Genérico',
      'Excluir',
    ]);

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
      { generico: false, especieId: 'pit', especie: 'Pitanga', especificacao: '', recipienteId: 'tub', altura: '', quantidade: '' },
    ]);
  });

  it('sem recipiente padrão a lista é reconhecida, e o recipiente fica a definir (RF-54)', () => {
    const onImportar = vi.fn();
    render(
      <ColarLista
        especies={ESPECIES}
        recipientes={RECIPIENTES}
        textoInicial="Pitanga 30"
        onImportar={onImportar}
        onEspecieNova={vi.fn()}
        onFechar={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Reconhecer →'));
    fireEvent.click(screen.getByText('Adicionar 1 item ao pedido'));
    expect(onImportar.mock.calls[0][0][0]).toMatchObject({ especieId: 'pit', recipienteId: '', quantidade: '30' });
  });

  it('o genérico leva a linha colada como descrição do que o cliente pediu', () => {
    const { onImportar } = conferir('mudas nativas o que tiver');
    fireEvent.click(screen.getByLabelText('Tornar genérico o item da linha 1'));
    fireEvent.click(screen.getByText('Adicionar 1 item ao pedido'));
    expect(onImportar.mock.calls[0][0][0]).toMatchObject({ generico: true, especificacao: 'mudas nativas o que tiver' });
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

  it('a altura e o recipiente lidos na lista vão para a linha, e o preço fica de fora', () => {
    const { onImportar } = conferir('Pitanga — 17x22 — 80–100 cm — R$ 12,00');
    expect(screen.getByLabelText('Altura da linha 1')).toHaveValue('0,80 m');
    expect(screen.getByText(/R\$\s12,00 não entra no pedido/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Adicionar 1 item ao pedido'));
    expect(onImportar).toHaveBeenCalledWith([
      {
        generico: false,
        especieId: 'pit',
        especie: 'Pitanga',
        especificacao: '',
        recipienteId: 's1722',
        altura: '0,80 m',
        quantidade: '',
      },
    ]);
  });

  it('a altura em centímetros vira metros ao sair do campo, e a que não se entende segura', () => {
    conferir('Pitanga 30');
    const altura = screen.getByLabelText('Altura da linha 1');
    fireEvent.change(altura, { target: { value: '120' } });
    fireEvent.blur(altura);
    expect(altura).toHaveValue('1,20 m');

    fireEvent.change(altura, { target: { value: 'alta' } });
    expect(screen.getByText(/Uma linha a resolver/)).toBeInTheDocument();
  });

  it('trocar o recipiente padrão não mexe no recipiente que veio escrito na lista', () => {
    const { onImportar } = conferir('Pitanga 30\nIpê amarelo tubete 50');
    fireEvent.change(screen.getByLabelText('Recipiente padrão (vale para todas)'), { target: { value: 's1722' } });
    fireEvent.click(screen.getByText('Adicionar 2 itens ao pedido'));
    expect(onImportar.mock.calls[0][0].map((item: { recipienteId: string }) => item.recipienteId)).toEqual([
      's1722',
      'tub',
    ]);
  });

  it('lista corrida vira uma linha por espécie', () => {
    conferir('Pitanga | Ipê amarelo');
    expect(screen.getByLabelText('Quantidade da linha 2')).toBeInTheDocument();
  });
});
