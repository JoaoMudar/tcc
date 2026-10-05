import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampoTelefone } from '../CampoTelefone';

function campo() {
  return screen.getByLabelText(/Telefone/) as HTMLInputElement;
}

describe('CampoTelefone', () => {
  it('põe o número na máscara enquanto se digita', () => {
    render(<CampoTelefone />);
    fireEvent.change(campo(), { target: { value: '4799612' } });
    expect(campo().value).toBe('(47) 99612');
    fireEvent.change(campo(), { target: { value: '(47) 996124408' } });
    expect(campo().value).toBe('(47) 99612-4408');
  });

  it('o valor que já vem também entra na máscara', () => {
    render(<CampoTelefone defaultValue="47996124408" />);
    expect(campo().value).toBe('(47) 99612-4408');
  });

  it('ao sair do campo, mostra o erro do número incompleto', () => {
    render(<CampoTelefone />);
    fireEvent.change(campo(), { target: { value: '471234' } });
    fireEvent.blur(campo());
    expect(screen.getByText('Telefone precisa ter DDD e número, como (47) 99612-4408.')).toBeTruthy();
    expect(campo().getAttribute('aria-invalid')).toBe('true');
  });

  it('com todos os dígitos, confere sem esperar sair do campo', () => {
    render(<CampoTelefone />);
    fireEvent.change(campo(), { target: { value: '20996124408' } });
    expect(screen.getByText('DDD 20 não existe. Confira os dois primeiros números.')).toBeTruthy();
  });

  it('com o erro na tela, o aviso some assim que o número fica certo', () => {
    render(<CampoTelefone />);
    fireEvent.change(campo(), { target: { value: '4799612' } });
    fireEvent.blur(campo());
    fireEvent.change(campo(), { target: { value: '47996124408' } });
    expect(screen.queryByText(/Telefone precisa/)).toBeNull();
    expect(campo().getAttribute('aria-invalid')).toBeNull();
  });

  it('antes de completar, digitar não acusa nada', () => {
    render(<CampoTelefone />);
    fireEvent.change(campo(), { target: { value: '47' } });
    expect(campo().getAttribute('aria-invalid')).toBeNull();
  });
});
