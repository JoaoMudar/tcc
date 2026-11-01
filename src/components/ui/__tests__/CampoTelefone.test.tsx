import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampoTelefone } from '../CampoTelefone';

/** Como o navegador: o texto muda, o cursor fica onde a tecla o deixou, e o evento sai. */
function teclar(c: HTMLInputElement, valor: string, cursor: number) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(c, valor);
  c.setSelectionRange(cursor, cursor);
  fireEvent.change(c);
}

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

  it('corrigir só o DDD no meio do número não embaralha o resto (TA-84)', () => {
    render(<CampoTelefone />);
    const c = campo();
    c.focus();
    fireEvent.change(c, { target: { value: '20996124408' } });
    expect(c.value).toBe('(20) 99612-4408');
    expect(screen.getByText(/DDD 20 não existe/)).toBeTruthy();
    // selecionar o "20" e digitar "4", depois "7"
    teclar(c, '(4) 99612-4408', 2);
    expect(c.selectionStart).toBe(2);
    teclar(c, `${c.value.slice(0, 2)}7${c.value.slice(2)}`, 3);
    expect(c.value).toBe('(47) 99612-4408');
    expect(c.selectionStart).toBe(3);
    expect(screen.queryByText(/DDD 20 não existe/)).toBeNull();
  });
});
