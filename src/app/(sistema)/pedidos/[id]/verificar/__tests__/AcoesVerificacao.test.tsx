import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AcoesVerificacao } from '../AcoesVerificacao';

vi.mock('../actions', () => ({ concluirVerificacaoAction: vi.fn() }));

describe('AcoesVerificacao', () => {
  it('com tudo respondido, o botão diz só "Enviar"', () => {
    render(<AcoesVerificacao pedidoId="pedido-1" pendentes={0} />);
    expect(screen.getByRole('button').textContent).toBe('Enviar');
  });

  it('com item pendente, avisa quantos faltam e não mostra o botão', () => {
    render(<AcoesVerificacao pedidoId="pedido-1" pendentes={2} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Faltam 2 itens para responder antes de enviar.')).toBeTruthy();
  });
});
