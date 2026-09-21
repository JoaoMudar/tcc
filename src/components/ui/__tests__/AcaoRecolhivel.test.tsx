import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AcaoRecolhivel } from '../AcaoRecolhivel';

describe('AcaoRecolhivel', () => {
  it('nasce fechada, para a ficha abrir curta', () => {
    render(
      <AcaoRecolhivel titulo="Alterar itens do pedido">
        <p>campos</p>
      </AcaoRecolhivel>,
    );
    expect(screen.getByText('Alterar itens do pedido')).toBeInTheDocument();
    expect(screen.getByRole('group')).not.toHaveAttribute('open');
  });

  it('abre quando a página pede', () => {
    render(
      <AcaoRecolhivel titulo="Repicar" aberta>
        <p>campos</p>
      </AcaoRecolhivel>,
    );
    expect(screen.getByRole('group')).toHaveAttribute('open');
  });
});
