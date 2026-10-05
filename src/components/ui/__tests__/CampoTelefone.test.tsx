import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampoTelefone } from '../CampoTelefone';

describe('CampoTelefone', () => {
  it('ao sair do campo, mostra o erro do número incompleto', () => {
    render(<CampoTelefone />);
    const campo = screen.getByLabelText(/Telefone/);
    fireEvent.change(campo, { target: { value: '(47) 1234' } });
    fireEvent.blur(campo);
    expect(screen.getByText('Telefone precisa ter DDD e número, como (47) 99612-4408.')).toBeTruthy();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
  });

  it('com o erro na tela, o aviso some assim que o número fica certo', () => {
    render(<CampoTelefone />);
    const campo = screen.getByLabelText(/Telefone/);
    fireEvent.change(campo, { target: { value: '4799612' } });
    fireEvent.blur(campo);
    fireEvent.change(campo, { target: { value: '47996124408' } });
    expect(screen.queryByText(/Telefone precisa/)).toBeNull();
  });

  it('número certo vai para a máscara ao sair do campo', () => {
    render(<CampoTelefone />);
    const campo = screen.getByLabelText(/Telefone/) as HTMLInputElement;
    fireEvent.change(campo, { target: { value: '47996124408' } });
    fireEvent.blur(campo);
    expect(campo.value).toBe('(47) 99612-4408');
  });

  it('antes do primeiro erro, digitar não acusa nada', () => {
    render(<CampoTelefone />);
    const campo = screen.getByLabelText(/Telefone/);
    fireEvent.change(campo, { target: { value: '47' } });
    expect(campo.getAttribute('aria-invalid')).toBeNull();
  });
});
