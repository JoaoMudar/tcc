import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../ZoomAgenda', () => ({ useZoomAgenda: () => ({ zoom: 'semana' }) }));

const { NavegacaoAgenda } = await import('../NavegacaoAgenda');

/** O jsdom não aplica o Tailwind: o que se confere é que cada seta declara um `display` só. */
function exibicoes(link: HTMLElement): string[] {
  return link.className.split(/\s+/).filter((classe) => /^(md:)?(hidden|inline-flex|flex|block)$/.test(classe));
}

describe('NavegacaoAgenda', () => {
  it('no celular aparecem duas setas, e não quatro', () => {
    render(<NavegacaoAgenda dia="2026-09-30" hoje="2026-09-30" />);
    const setas = screen.getAllByRole('link', { name: /semana/i });
    expect(setas).toHaveLength(4);
    const doCelular = setas.filter((seta) => exibicoes(seta).includes('inline-flex') && !exibicoes(seta).includes('hidden'));
    const daTelaLarga = setas.filter((seta) => exibicoes(seta).includes('hidden'));
    expect(doCelular).toHaveLength(2);
    expect(daTelaLarga).toHaveLength(2);
    for (const seta of daTelaLarga) expect(exibicoes(seta)).toEqual(['hidden', 'md:inline-flex']);
  });
});
