import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Notice } from '../Notice';

describe('Notice', () => {
  it('confirmação de gravação é anunciada como status', () => {
    render(<Notice tone="success">Perda registrada.</Notice>);
    expect(screen.getByRole('status')).toHaveTextContent('Perda registrada.');
  });

  it('erro é anunciado como alerta', () => {
    render(<Notice tone="error">Não foi possível salvar.</Notice>);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar.');
  });
});
