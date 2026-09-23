import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextArea } from '../TextArea';

describe('TextArea', () => {
  it('liga o rótulo e a dica ao campo', () => {
    render(<TextArea label="Nomes populares" name="nomes_populares" hint="Um por linha" defaultValue="Cedro" />);
    const campo = screen.getByLabelText('Nomes populares');
    expect(campo).toHaveValue('Cedro');
    expect(campo).toHaveAccessibleDescription('Um por linha');
  });

  it('com ajustaAltura, a caixa acompanha a altura do texto a cada linha', () => {
    render(<TextArea label="Observação" name="observacoes" rows={1} ajustaAltura />);
    const campo = screen.getByLabelText('Observação');
    Object.defineProperty(campo, 'scrollHeight', { configurable: true, value: 96 });
    fireEvent.input(campo, { target: { value: 'linha 1\nlinha 2\nlinha 3' } });
    expect(campo.style.height).toBe('96px');
  });

  it('sem ajustaAltura, a altura fica com o navegador', () => {
    render(<TextArea label="Observação" name="observacoes" />);
    const campo = screen.getByLabelText('Observação');
    fireEvent.input(campo, { target: { value: 'a\nb' } });
    expect(campo.style.height).toBe('');
  });

  it('o obrigatório leva o asterisco no rótulo, o opcional não', () => {
    render(<TextArea label="Motivo" name="motivo" required />);
    render(<TextArea label="Observação" name="observacoes" />);
    expect(screen.getByText('Motivo').className).toContain("after:content-['*']");
    expect(screen.getByText('Observação').className).not.toContain('after:content');
  });
});
