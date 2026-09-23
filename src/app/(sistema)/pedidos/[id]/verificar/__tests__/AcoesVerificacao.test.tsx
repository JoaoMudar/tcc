import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AcoesVerificacao } from '../AcoesVerificacao';

vi.mock('../actions', () => ({ concluirVerificacaoAction: vi.fn() }));

describe('AcoesVerificacao', () => {
  it('com tudo respondido, o botão diz só "Enviar"', () => {
    render(<AcoesVerificacao pedidoId="pedido-1" pendentes={0} />);
    expect(screen.getByRole('button').textContent).toBe('Enviar');
  });

  it('com item pendente, não mostra o botão nem aviso', () => {
    render(<AcoesVerificacao pedidoId="pedido-1" pendentes={2} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/para responder antes de enviar/)).toBeNull();
  });
});
