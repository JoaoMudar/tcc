import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  it('é type=button por padrão, para não enviar formulário sem querer', () => {
    render(<Button>Registrar perda</Button>);
    expect(screen.getByRole('button', { name: 'Registrar perda' })).toHaveAttribute('type', 'button');
  });

  it('tem alvo de toque mínimo (RNF-03)', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole('button').className).toContain('min-h-touch');
  });

  it('durante a gravação trava e avisa que está salvando', () => {
    render(
      <Button type="submit" pending>
        Salvar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Salvando…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
