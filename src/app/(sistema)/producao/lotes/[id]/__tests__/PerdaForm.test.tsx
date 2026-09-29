import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enviarGuardado } from '@/lib/fila-envio';
import { enfileirar } from '@/lib/fila-local';
import { ContagemForm } from '../ContagemForm';
import { PerdaForm } from '../PerdaForm';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock('@/lib/fila-local', () => ({ enfileirar: vi.fn(async () => undefined), remover: vi.fn(async () => undefined) }));
vi.mock('@/lib/fila-envio', () => ({ enviarGuardado: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

function preencherPerda() {
  render(<PerdaForm loteId="l1" codigo="2026-0012" saldo={200} />);
  fireEvent.change(screen.getByLabelText(/Quantidade perdida/), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Seca' }));
  fireEvent.click(screen.getByRole('button', { name: 'Registrar perda' }));
}

describe('PerdaForm (T4.5, T9.3)', () => {
  it('guarda no aparelho antes de enviar, com o rótulo que o indicador mostra', async () => {
    vi.mocked(enviarGuardado).mockResolvedValue({ tipo: 'gravado', success: 'Perda de 30 por seca registrada.' });
    preencherPerda();
    expect(await screen.findByText('Perda de 30 por seca registrada.')).toBeInTheDocument();
    expect(enfileirar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'perda',
        rotulo: 'Perda de 30 no lote 2026-0012',
        campos: expect.objectContaining({ lote_id: 'l1', quantidade: '30', causa: 'seca' }),
      }),
    );
    expect(vi.mocked(enfileirar).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(enviarGuardado).mock.invocationCallOrder[0]);
    expect(refresh).toHaveBeenCalled();
  });

  it('TA-23: sem rede, a confirmação aparece na hora', async () => {
    vi.mocked(enviarGuardado).mockResolvedValue({ tipo: 'sem_rede' });
    preencherPerda();
    expect(await screen.findByText('Guardado no aparelho. Vai sozinho quando a rede voltar.')).toBeInTheDocument();
  });

  it('recusada pelo servidor, mostra o motivo e mantém o digitado', async () => {
    vi.mocked(enviarGuardado).mockResolvedValue({
      tipo: 'recusado',
      error: 'O lote 2026-0012 tem 200 mudas.',
      fields: { quantidade: '30', causa: 'seca', observacoes: '' },
    });
    preencherPerda();
    expect(await screen.findByText('O lote 2026-0012 tem 200 mudas.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Quantidade perdida/)).toHaveValue('30');
  });
});

describe('ContagemForm (T4.6, T9.3)', () => {
  it('sem rede, avisa que a diferença é calculada quando chegar', async () => {
    vi.mocked(enviarGuardado).mockResolvedValue({ tipo: 'sem_rede' });
    render(<ContagemForm loteId="l1" codigo="2026-0012" saldo={200} />);
    fireEvent.change(screen.getByLabelText(/Contado agora/), { target: { value: '185' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar contagem' }));
    expect(await screen.findByText(/Guardado no aparelho.*diferença é calculada quando chegar/)).toBeInTheDocument();
    expect(enfileirar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'contagem', rotulo: 'Contagem de 185 no lote 2026-0012' }));
  });
});
