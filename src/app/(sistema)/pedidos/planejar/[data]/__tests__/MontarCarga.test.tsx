import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MontarCarga } from '../MontarCarga';

vi.mock('../actions', () => ({
  adicionarPedidoAction: vi.fn(),
  confirmarCargaAction: vi.fn(),
  tirarPedidoAction: vi.fn(),
}));

const PEDIDO = { id: 'p1', numero: 12, cliente: 'Prefeitura', local: null, itens: [] };

describe('MontarCarga', () => {
  it('tira da carga pelo X, sem o botão de texto "Tirar"', () => {
    render(<MontarCarga data="2026-10-06" viagemId="v1" carga={[PEDIDO]} marcados={[]} abertos={[]} />);
    expect(screen.getByLabelText('Tirar o pedido 12 da carga')).toBeTruthy();
    expect(screen.queryByText('Tirar')).toBeNull();
  });
});
