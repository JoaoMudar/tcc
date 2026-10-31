import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { savePessoaAction } from '../actions';
import { PessoaForm } from '../PessoaForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('../actions', () => ({ savePessoaAction: vi.fn() }));

describe('PessoaForm, aviso de telefone duplicado', () => {
  it('o vínculo do funcionário escolhido continua escolhido depois do aviso', async () => {
    vi.mocked(savePessoaAction).mockImplementation(async (_anterior, dados: FormData) => ({
      candidatas: [{ id: 'c1', nome: 'Outra pessoa' }],
      fields: Object.fromEntries([...dados.entries()].map(([k, v]) => [k, String(v)])),
    }));
    render(<PessoaForm verFiscal={false} podeEditar />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'TESTE Funcionario' } });
    fireEvent.click(screen.getByLabelText('Funcionário'));
    const vinculo = screen.getByLabelText(/Vínculo do funcionário/) as HTMLSelectElement;
    fireEvent.change(vinculo, { target: { value: 'diarista' } });

    fireEvent.submit(vinculo.form!);
    await waitFor(() => expect(savePessoaAction).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Outra pessoa/)).toBeTruthy());
    expect((screen.getByLabelText(/Vínculo do funcionário/) as HTMLSelectElement).value).toBe('diarista');
    expect((screen.getByLabelText('Funcionário') as HTMLInputElement).checked).toBe(true);
  });
});
