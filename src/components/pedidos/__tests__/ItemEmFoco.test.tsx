import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemEmFoco } from '../ItemEmFoco';
import { linhaVazia } from '../linhas-pedido';

describe('item do pedido em tela cheia (T8.1)', () => {
  it('o campo de altura sai sem a frase de apoio embaixo', () => {
    render(
      <ItemEmFoco
        linha={linhaVazia(1)}
        indice={0}
        opcoesEspecie={[{ value: 'ipe', label: 'Ipê-amarelo' }]}
        recipientes={[{ value: 'tub', label: 'Tubete' }]}
        saldos={{}}
        onAlterar={vi.fn()}
        onRemover={vi.fn()}
        onFechar={vi.fn()}
        onCriarEspecie={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Altura em metros')).not.toHaveAccessibleDescription();
    expect(screen.queryByText(/tamanho da muda combinado/)).toBeNull();
  });

  it('a altura sai em metros enquanto é digitada', () => {
    const onAlterar = vi.fn();
    render(
      <ItemEmFoco
        linha={linhaVazia(3)}
        indice={0}
        opcoesEspecie={[{ value: 'ipe', label: 'Ipê-amarelo' }]}
        recipientes={[{ value: 'tub', label: 'Tubete' }]}
        saldos={{}}
        onAlterar={onAlterar}
        onRemover={vi.fn()}
        onFechar={vi.fn()}
        onCriarEspecie={vi.fn()}
      />,
    );
    const campo = screen.getByLabelText('Altura em metros');
    fireEvent.change(campo, { target: { value: ',5' } });
    expect(onAlterar).toHaveBeenLastCalledWith(3, 'altura', '0,5');
    fireEvent.blur(campo, { target: { value: '80' } });
    expect(onAlterar).toHaveBeenLastCalledWith(3, 'altura', '0,80 m');
  });

  it('o genérico é a primeira opção da espécie', () => {
    const onAlterar = vi.fn();
    render(
      <ItemEmFoco
        linha={linhaVazia(2)}
        indice={0}
        opcoesEspecie={[{ value: 'ipe', label: 'Ipê-amarelo' }]}
        recipientes={[{ value: 'tub', label: 'Tubete' }]}
        saldos={{}}
        onAlterar={onAlterar}
        onRemover={vi.fn()}
        onFechar={vi.fn()}
        onCriarEspecie={vi.fn()}
      />,
    );
    fireEvent.focus(screen.getByLabelText('Espécie'));
    const opcoes = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(opcoes[0]).toBe('Genérico');
    fireEvent.click(screen.getByText('Genérico'));
    expect(onAlterar).toHaveBeenCalledWith(2, 'generico', true);
  });

  it('o genérico escolhido fica no campo da espécie, sem botão para voltar', () => {
    const onAlterar = vi.fn();
    render(
      <ItemEmFoco
        linha={{ ...linhaVazia(4), generico: true }}
        indice={0}
        opcoesEspecie={[{ value: 'ipe', label: 'Ipê-amarelo' }]}
        recipientes={[{ value: 'tub', label: 'Tubete' }]}
        saldos={{}}
        onAlterar={onAlterar}
        onRemover={vi.fn()}
        onFechar={vi.fn()}
        onCriarEspecie={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Espécie')).toHaveValue('Genérico');
    expect(screen.getByLabelText('Observação')).toBeInTheDocument();
    expect(screen.queryByText(/Escolher a espécie/)).toBeNull();

    fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'ipe' } });
    fireEvent.click(screen.getByText('Ipê-amarelo'));
    expect(onAlterar).toHaveBeenCalledWith(4, 'generico', false);
    expect(onAlterar).toHaveBeenLastCalledWith(4, 'especieId', 'ipe');
  });

  it('o grupo de espécies fica entre a espécie e a observação, e só no genérico', () => {
    const props = {
      indice: 0,
      opcoesEspecie: [{ value: 'ipe', label: 'Ipê-amarelo' }],
      recipientes: [{ value: 'tub', label: 'Tubete' }],
      saldos: {},
      onAlterar: vi.fn(),
      onRemover: vi.fn(),
      onFechar: vi.fn(),
      onCriarEspecie: vi.fn(),
    };
    const { rerender } = render(<ItemEmFoco {...props} linha={{ ...linhaVazia(5), especieId: 'ipe' }} />);
    expect(screen.queryByText('+ Adicionar espécie do grupo')).toBeNull();

    rerender(<ItemEmFoco {...props} linha={{ ...linhaVazia(5), generico: true }} />);
    const botao = screen.getByText('+ Adicionar espécie do grupo');
    const observacao = screen.getByLabelText('Observação');
    expect(screen.getByLabelText('Espécie').compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(botao.compareDocumentPosition(observacao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(botao);
    expect(props.onAlterar).toHaveBeenCalledWith(5, 'grupo', [{ chave: 1, especieId: '' }]);
  });

  it('trocar o genérico por uma espécie desfaz o grupo', () => {
    const onAlterar = vi.fn();
    render(
      <ItemEmFoco
        linha={{ ...linhaVazia(6), generico: true, grupo: [{ chave: 1, especieId: 'ipe' }] }}
        indice={0}
        opcoesEspecie={[{ value: 'ipe', label: 'Ipê-amarelo' }]}
        recipientes={[]}
        saldos={{}}
        onAlterar={onAlterar}
        onRemover={vi.fn()}
        onFechar={vi.fn()}
        onCriarEspecie={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'ip' } });
    expect(onAlterar).toHaveBeenCalledWith(6, 'grupo', []);
  });
});

describe('estoque disponível no item em tela cheia (RF-62, RN-10)', () => {
  it('a altura digitada decide quais lotes atendem', () => {
    render(
      <ItemEmFoco
        linha={{ ...linhaVazia(1), especieId: 'ipe', recipienteId: 'tub', altura: '1,00 m', quantidade: '50' }}
        indice={0}
        opcoesEspecie={[{ value: 'ipe', label: 'Ipê-amarelo' }]}
        recipientes={[{ value: 'tub', label: 'Tubete' }]}
        saldos={{ 'ipe:tub': [{ alturaM: 1, quantidade: 20 }, { alturaM: 0.8, quantidade: 15 }, { alturaM: null, quantidade: 9 }] }}
        onAlterar={vi.fn()}
        onRemover={vi.fn()}
        onFechar={vi.fn()}
        onCriarEspecie={vi.fn()}
      />,
    );
    expect(screen.getByText('Disponível: 20 · faltam 30 · 15 com até 20 cm a menos · 9 sem altura medida')).toBeInTheDocument();
  });
});
