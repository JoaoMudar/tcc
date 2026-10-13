import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GrupoEspecies } from '../GrupoEspecies';

const OPCOES = [
  { value: 'ara', label: 'Araçá' },
  { value: 'ipe', label: 'Ipê-amarelo' },
  { value: 'inga', label: 'Ingá-anão' },
];

describe('grupo de espécies do genérico (T8.7)', () => {
  it('sem linha nenhuma, diz que qualquer espécie serve, e o botão abre a primeira', () => {
    const onAlterar = vi.fn();
    render(<GrupoEspecies doItem="do item 1" grupo={[]} opcoesEspecie={OPCOES} onAlterar={onAlterar} />);
    expect(screen.getByText(/qualquer espécie serve/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar espécie do grupo' }));
    expect(onAlterar).toHaveBeenCalledWith([{ chave: 1, especieId: '' }]);
  });

  it('escolher a espécie grava na linha certa', () => {
    const onAlterar = vi.fn();
    render(
      <GrupoEspecies
        doItem="do item 1"
        grupo={[
          { chave: 1, especieId: 'ara' },
          { chave: 2, especieId: '' },
        ]}
        opcoesEspecie={OPCOES}
        onAlterar={onAlterar}
      />,
    );
    fireEvent.focus(screen.getByLabelText('Espécie 2'));
    fireEvent.click(screen.getByText('Ingá-anão'));
    expect(onAlterar).toHaveBeenCalledWith([
      { chave: 1, especieId: 'ara' },
      { chave: 2, especieId: 'inga' },
    ]);
  });

  it('a espécie já escolhida em outra linha não aparece de novo', () => {
    render(
      <GrupoEspecies
        doItem="do item 1"
        grupo={[
          { chave: 1, especieId: 'ara' },
          { chave: 2, especieId: '' },
        ]}
        opcoesEspecie={OPCOES}
        onAlterar={vi.fn()}
      />,
    );
    fireEvent.focus(screen.getByLabelText('Espécie 2'));
    const lista = screen.getByLabelText('Espécie 2').parentElement!;
    expect(within(lista).queryByText('Araçá')).toBeNull();
    expect(within(lista).getByText('Ipê-amarelo')).toBeInTheDocument();
  });

  it('a lixeira tira só aquela linha', () => {
    const onAlterar = vi.fn();
    render(
      <GrupoEspecies
        doItem="do item 1"
        grupo={[
          { chave: 1, especieId: 'ara' },
          { chave: 2, especieId: 'ipe' },
        ]}
        opcoesEspecie={OPCOES}
        onAlterar={onAlterar}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tirar a espécie 1 do grupo do item 1' }));
    expect(onAlterar).toHaveBeenCalledWith([{ chave: 2, especieId: 'ipe' }]);
  });
});
