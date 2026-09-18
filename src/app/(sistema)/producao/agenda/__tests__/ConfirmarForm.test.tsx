import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmarForm } from '../ConfirmarForm';

vi.mock('../actions', () => ({ confirmarAtribuicaoAction: vi.fn() }));

const BASE = {
  atribuicaoId: 'atr1',
  exigeLote: false,
  exigeArea: false,
  eQuantitativa: false,
  unidadeMedida: 'un' as const,
  participantes: [{ id: 'p1', nome: 'Gilberto' }],
  lotes: [{ value: 'l1', label: 'L-1' }],
  areas: [{ id: 'a1', letra: 'A', canteiros: [{ id: 'c1', numero: 1 }] }],
  loteId: null,
  areaId: null,
  canteiroId: null,
};

describe('ConfirmarForm', () => {
  it('colher semente: sem lote nem área, e a quantidade de cada um em kg', () => {
    render(<ConfirmarForm {...BASE} eQuantitativa unidadeMedida="kg" />);
    expect(screen.queryByLabelText('Lote')).toBeNull();
    expect(screen.queryByLabelText(/Área/)).toBeNull();
    expect(screen.queryByLabelText(/Canteiro/)).toBeNull();
    expect(screen.getByText('Quanto cada um fez (kg)')).toBeInTheDocument();
    expect(screen.getByLabelText('Gilberto')).toHaveAttribute('inputmode', 'decimal');
  });

  it('com a declaração de área, oferece área e canteiro', () => {
    render(<ConfirmarForm {...BASE} exigeArea />);
    expect(screen.getByLabelText(/Área/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Canteiro/)).toBeInTheDocument();
  });

  it('com lote, pede o lote e não a área', () => {
    render(<ConfirmarForm {...BASE} exigeLote exigeArea />);
    expect(screen.getByLabelText('Lote')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Área/)).toBeNull();
  });
});
