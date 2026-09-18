import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SearchForm } from '../SearchForm';

describe('SearchForm', () => {
  it('liga o rótulo ao campo, mantém o termo e preserva os campos escondidos', () => {
    render(
      <SearchForm label="Buscar por qualquer nome" defaultValue="cedro">
        <input type="hidden" name="papel" value="cliente" />
      </SearchForm>,
    );
    expect(screen.getByRole('searchbox', { name: 'Buscar por qualquer nome' })).toHaveValue('cedro');
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('search')).toHaveFormValues({ busca: 'cedro', papel: 'cliente' });
  });
});
