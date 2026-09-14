import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextArea } from '../TextArea';

describe('TextArea', () => {
  it('liga o rótulo e a dica ao campo', () => {
    render(<TextArea label="Nomes populares" name="nomes_populares" hint="Um por linha" defaultValue="Cedro" />);
    const campo = screen.getByLabelText('Nomes populares');
    expect(campo).toHaveValue('Cedro');
    expect(campo).toHaveAccessibleDescription('Um por linha');
  });
});
