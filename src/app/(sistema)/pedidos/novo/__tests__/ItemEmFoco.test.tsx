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

  it('a altura digitada em centímetros vira metros ao sair do campo', () => {
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
    fireEvent.blur(screen.getByLabelText('Altura em metros'), {
      target: { value: '80' },
    });
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
});
