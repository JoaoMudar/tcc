import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AcoesVerificacao } from '../AcoesVerificacao';
import { ItensEmAberto, useItemEmAberto } from '../ItensEmAberto';

vi.mock('../actions', () => ({ concluirVerificacaoAction: vi.fn(), salvarParaDepoisAction: vi.fn() }));

function CartaoEmAberto({ id }: { id: string }) {
  useItemEmAberto(id, true);
  return null;
}

describe('AcoesVerificacao', () => {
  it('com tudo respondido, o botão diz só "Enviar"', () => {
    render(<AcoesVerificacao pedidoId="pedido-1" pendentes={0} />);
    expect(screen.getByRole('button').textContent).toBe('Enviar');
    expect(screen.queryByText(/Falta completar/)).toBeNull();
  });

  it('com item pendente no banco, o botão é "Salvar" e diz quantos faltam', () => {
    render(<AcoesVerificacao pedidoId="pedido-1" pendentes={2} />);
    expect(screen.getByRole('button').textContent).toBe('Salvar');
    expect(screen.getByText(/Falta completar 2 itens/)).toBeTruthy();
  });

  it('com o banco em dia mas um cartão em aberto na tela, ainda é "Salvar"', () => {
    render(
      <ItensEmAberto>
        <CartaoEmAberto id="item-1" />
        <AcoesVerificacao pedidoId="pedido-1" pendentes={0} />
      </ItensEmAberto>,
    );
    expect(screen.getByRole('button').textContent).toBe('Salvar');
    expect(screen.getByText(/Falta completar 1 item/)).toBeTruthy();
  });

  it('o cartão que sai da tela deixa de contar', () => {
    const { rerender } = render(
      <ItensEmAberto>
        <CartaoEmAberto id="item-1" />
        <AcoesVerificacao pedidoId="pedido-1" pendentes={0} />
      </ItensEmAberto>,
    );
    rerender(
      <ItensEmAberto>
        <AcoesVerificacao pedidoId="pedido-1" pendentes={0} />
      </ItensEmAberto>,
    );
    expect(screen.getByRole('button').textContent).toBe('Enviar');
  });
});
