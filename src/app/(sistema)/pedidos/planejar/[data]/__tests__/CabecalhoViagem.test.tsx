import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CabecalhoViagem } from '../CabecalhoViagem';

vi.mock('../actions', () => ({ irParaEtapaAction: vi.fn(async () => ({})) }));

const VIAGEM = 'v1';

describe('CabecalhoViagem: os passos andam (P17)', () => {
  it('no carregamento, a seta volta à rota e os dois passos anteriores são botões', () => {
    render(<CabecalhoViagem data="2026-10-02" viagemId={VIAGEM} etapa="carregando" />);
    const seta = screen.getByRole('button', { name: 'Voltar' });
    expect((seta.closest('form')!.querySelector('input[name="para"]') as HTMLInputElement).value).toBe('roteirizando');
    expect(screen.getByRole('button', { name: 'Voltar para 1 · Carga' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Voltar para 2 · Rota' })).toBeTruthy();
  });

  it('na carga, só a rota é alcançável, para frente', () => {
    render(<CabecalhoViagem data="2026-10-02" viagemId={VIAGEM} etapa="montando" />);
    expect(screen.getByRole('button', { name: 'Seguir para 2 · Rota' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /3 · Carregamento/ })).toBeNull();
  });

  it('a viagem pronta não anda', () => {
    render(<CabecalhoViagem data="2026-10-02" viagemId={VIAGEM} etapa="pronta" />);
    expect(screen.queryByRole('button', { name: /Voltar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Seguir/ })).toBeNull();
  });
});
