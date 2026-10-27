import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EscolhaDoLote } from '../EscolhaDoLote';

const OPCOES = [
  { value: 'l1', label: 'L1 · 500 mudas' },
  { value: 'l2', label: 'L2 · 300 mudas' },
];

describe('EscolhaDoLote (RF-24)', () => {
  it('mostra o lote sugerido e grava ao trocar, sem botão', async () => {
    const action = vi.fn(async () => ({ success: 'Lote escolhido.' }));
    render(<EscolhaDoLote pedidoId="p" cargaItemId="ci" loteId="l1" opcoes={OPCOES} action={action} />);
    const select = screen.getByLabelText(/sai do lote/i) as HTMLSelectElement;
    expect(select.value).toBe('l1');

    fireEvent.change(select, { target: { value: 'l2' } });
    await waitFor(() => expect(action).toHaveBeenCalled());
    const dados = (action.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(dados.get('lote_id')).toBe('l2');
    expect(dados.get('carga_item_id')).toBe('ci');
  });

  it('sem lote do par, avisa que a venda não terá de onde sair', () => {
    render(<EscolhaDoLote pedidoId="p" cargaItemId="ci" loteId={null} opcoes={[]} action={vi.fn()} />);
    expect(screen.getByText(/nenhum lote aberto/i)).toBeTruthy();
  });

  it('travado na viagem pronta: mostra, sem trocar', () => {
    render(<EscolhaDoLote pedidoId="p" cargaItemId="ci" loteId="l1" opcoes={OPCOES} action={vi.fn()} travado />);
    expect((screen.getByLabelText(/sai do lote/i) as HTMLSelectElement).disabled).toBe(true);
  });
});
