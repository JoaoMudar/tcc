import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampoLocalizacao } from '../CampoLocalizacao';

describe('CampoLocalizacao (P17)', () => {
  it('o ponto colado aparece lido, com o link para conferir', () => {
    render(<CampoLocalizacao name="localizacao" />);
    fireEvent.change(screen.getByLabelText('Localização do WhatsApp'), {
      target: { value: 'https://maps.google.com/maps?q=-27.05%2C-49.52' },
    });
    expect(screen.getByText(/Ponto lido: -27.050000, -49.520000/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'ver no mapa' }).getAttribute('href')).toContain('-27.05,-49.52');
  });

  it('o link curto é lido ao salvar', () => {
    render(<CampoLocalizacao name="localizacao" />);
    fireEvent.change(screen.getByLabelText('Localização do WhatsApp'), { target: { value: 'https://maps.app.goo.gl/AbC123' } });
    expect(screen.getByText(/lido ao salvar/)).toBeTruthy();
  });

  it('o que não se lê avisa no campo', () => {
    render(<CampoLocalizacao name="localizacao" />);
    fireEvent.change(screen.getByLabelText('Localização do WhatsApp'), { target: { value: 'perto do posto' } });
    expect(screen.getByText(/Não deu para ler o ponto/)).toBeTruthy();
  });
});
