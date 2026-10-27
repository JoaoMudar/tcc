import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampoDocumento } from '../CampoDocumento';

function campo() {
  return screen.getByLabelText(/CPF|CNPJ/) as HTMLInputElement;
}

describe('CampoDocumento (RF-21)', () => {
  it('não reclama enquanto se digita a primeira vez, e confere ao sair', () => {
    render(<CampoDocumento tipo="pf" />);
    fireEvent.change(campo(), { target: { value: '529.982.247' } });
    expect(campo().getAttribute('aria-invalid')).not.toBe('true');
    fireEvent.blur(campo());
    expect(campo().getAttribute('aria-invalid')).toBe('true');
  });

  it('com o erro na tela, o aviso some assim que o número fica certo, sem sair do campo', () => {
    render(<CampoDocumento tipo="pf" />);
    fireEvent.change(campo(), { target: { value: '529.982.247' } });
    fireEvent.blur(campo());
    expect(campo().getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(campo(), { target: { value: '529.982.247-25' } });
    expect(campo().getAttribute('aria-invalid')).not.toBe('true');
  });

  it('o rótulo segue o tipo de pessoa', () => {
    render(<CampoDocumento tipo="pj" />);
    expect(screen.getByLabelText('CNPJ')).toBeTruthy();
  });
});
