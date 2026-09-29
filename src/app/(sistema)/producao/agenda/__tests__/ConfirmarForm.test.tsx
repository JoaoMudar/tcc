import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enviarGuardado } from '@/lib/fila-envio';
import { enfileirar } from '@/lib/fila-local';
import { ConfirmarForm } from '../ConfirmarForm';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock('@/lib/fila-local', () => ({ enfileirar: vi.fn(async () => undefined), remover: vi.fn(async () => undefined) }));
vi.mock('@/lib/fila-envio', () => ({ enviarGuardado: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

const BASE = {
  atribuicaoId: 'atr1',
  descricao: 'Plantio, 14/09/2026',
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

  it('com rede, vai para a tela que o servidor devolveu', async () => {
    vi.mocked(enviarGuardado).mockResolvedValue({ tipo: 'gravado', success: 'Tarefa confirmada.', destino: '/producao/agenda/atr1?feito=confirmada' });
    render(<ConfirmarForm {...BASE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar tarefa' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/producao/agenda/atr1?feito=confirmada'));
    expect(enfileirar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'confirmacao_tarefa', rotulo: 'Confirmação: Plantio, 14/09/2026', campos: expect.objectContaining({ id: 'atr1' }) }),
    );
  });

  it('UC-20 FA-3: sem rede, diz na hora que guardou e tira o formulário, para não confirmar duas vezes', async () => {
    vi.mocked(enviarGuardado).mockResolvedValue({ tipo: 'sem_rede' });
    render(<ConfirmarForm {...BASE} exigeLote loteId="l1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e registrar a repicagem' }));
    expect(await screen.findByText(/Guardado no aparelho.*repicagem se registra na ficha do lote/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar tarefa' })).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
