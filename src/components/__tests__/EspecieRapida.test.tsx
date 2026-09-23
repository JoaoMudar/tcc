import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EspecieRapida } from '../EspecieRapida';

vi.mock('@/app/(sistema)/cadastros/especies/acoes-rapidas', () => ({
  criarEspecieRapidaAction: vi.fn(),
}));

describe('EspecieRapida', () => {
  it('abre no meio da tela, e não encostada no rodapé', () => {
    render(<EspecieRapida onCriada={vi.fn()} onFechar={vi.fn()} />);
    const fundo = screen.getByRole('dialog').parentElement!;
    expect(fundo.className).toContain('justify-center');
    expect(fundo.className).not.toContain('justify-end');
  });

  it('traz o nome popular da linha já preenchido', () => {
    render(<EspecieRapida nomeSugerido="Ipê-amarelo" onCriada={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.getByLabelText(/Nome popular/)).toHaveProperty('value', 'Ipê-amarelo');
  });
});
