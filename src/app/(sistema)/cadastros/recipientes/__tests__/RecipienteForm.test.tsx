import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateRecipiente } from '../actions';
import { ESPERA_PARA_GRAVAR_MS, RecipienteForm } from '../RecipienteForm';

vi.mock('../actions', () => ({
  updateRecipiente: vi.fn(async () => ({ success: 'Recipiente salvo.' })),
}));

const acao = vi.mocked(updateRecipiente);

const SACO = { id: 'r1', nome: 'Saco 17x22', volumeLitros: 2.8, pesoKg: null, ativo: true };

function renderiza() {
  return render(<RecipienteForm recipiente={SACO} podeEditar />);
}

function ultimoEnvio(): FormData {
  return acao.mock.calls.at(-1)![1];
}

beforeEach(() => {
  acao.mockClear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('RecipienteForm, salva ao digitar', () => {
  it('não tem botão "Salvar"', () => {
    renderiza();
    expect(screen.queryByText('Salvar')).toBeNull();
  });

  it('o volume vem do banco na máscara de três casas', () => {
    renderiza();
    expect((screen.getByLabelText('Volume (L)') as HTMLInputElement).value).toBe('2,800');
  });

  it('grava um tempo depois da última tecla, com o número na máscara', async () => {
    renderiza();
    fireEvent.change(screen.getByLabelText('Peso cheio (kg)'), { target: { value: '450' } });
    expect((screen.getByLabelText('Peso cheio (kg)') as HTMLInputElement).value).toBe('0,450');
    expect(acao).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(ESPERA_PARA_GRAVAR_MS));
    expect(acao).toHaveBeenCalledTimes(1);
    expect(ultimoEnvio().get('peso')).toBe('0,450');
    expect(ultimoEnvio().get('ativo')).toBe('on');
  });

  it('sair do campo grava na hora, e sair de novo sem mudar não regrava', async () => {
    renderiza();
    const nome = screen.getByLabelText(/Nome/);
    fireEvent.change(nome, { target: { value: 'Saco 17x22 preto' } });
    await act(async () => fireEvent.blur(nome));
    expect(acao).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.blur(nome));
    await act(async () => vi.advanceTimersByTime(ESPERA_PARA_GRAVAR_MS));
    expect(acao).toHaveBeenCalledTimes(1);
  });

  it('desmarcar "Em uso" grava na hora, sem o ativo', async () => {
    renderiza();
    await act(async () => fireEvent.click(screen.getByLabelText('Em uso')));
    expect(acao).toHaveBeenCalledTimes(1);
    expect(ultimoEnvio().get('ativo')).toBeNull();
  });

  it('nome vazio não grava, e avisa', async () => {
    renderiza();
    const nome = screen.getByLabelText(/Nome/);
    fireEvent.change(nome, { target: { value: '' } });
    await act(async () => fireEvent.blur(nome));
    expect(acao).not.toHaveBeenCalled();
    expect(screen.getByText(/de 2 a 60 caracteres/)).toBeTruthy();
  });
});
