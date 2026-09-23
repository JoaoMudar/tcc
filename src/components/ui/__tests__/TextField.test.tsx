import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from '../TextField';

describe('TextField', () => {
  it('liga o rótulo ao campo', () => {
    render(<TextField label="Quantidade" name="quantidade" inputMode="numeric" />);
    const input = screen.getByLabelText('Quantidade');
    expect(input).toHaveAttribute('name', 'quantidade');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marca o erro e o associa ao campo', () => {
    render(<TextField label="Quantidade" name="quantidade" error="Maior que o saldo do lote." />);
    const input = screen.getByLabelText('Quantidade');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Maior que o saldo do lote.');
  });

  it('o obrigatório leva o asterisco no rótulo, sem mudar o nome do campo', () => {
    render(<TextField label="Nome" name="nome" required />);
    expect(screen.getByLabelText('Nome')).toBeRequired();
    expect(screen.getByText('Nome').className).toContain("after:content-['*']");
  });

  it('o opcional não leva marca nenhuma', () => {
    render(<TextField label="Observação" name="observacoes" />);
    expect(screen.getByText('Observação').className).not.toContain('after:content');
  });
});
