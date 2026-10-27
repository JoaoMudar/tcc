import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const ATRIBUICAO =
  'Fonte da nomenclatura: Flora e Funga do Brasil, Jardim Botânico do Rio de Janeiro (versão 393.9), licença CC-BY 4.0.';

vi.mock('@/lib/db', () => ({ default: {} }));
vi.mock('@/lib/auth/guards', () => ({ requirePageAccess: vi.fn(async () => ({ perfil: 'chefia' })) }));
vi.mock('@/lib/especies-ffb', () => ({ atribuicaoFfb: vi.fn(async () => ATRIBUICAO) }));
vi.mock('@/lib/especies', async (original) => ({
  ...(await original<typeof import('@/lib/especies')>()),
  searchEspecies: vi.fn(async () => []),
}));
vi.mock('../NovaEspecie', () => ({ NovaEspecie: () => <p>busca</p> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));

const { default: EspeciesPage } = await import('../page');
const { default: NovaEspeciePage } = await import('../nova/page');

describe('RNF-18: a atribuição da Flora e Funga onde os nomes aparecem', () => {
  it('na lista de espécies', async () => {
    render(await EspeciesPage({ searchParams: Promise.resolve({}) } as Parameters<typeof EspeciesPage>[0]));
    expect(screen.getByText(ATRIBUICAO)).toBeInTheDocument();
  });

  it('na busca de espécie nova', async () => {
    render(await NovaEspeciePage());
    expect(screen.getByText(ATRIBUICAO)).toBeInTheDocument();
  });
});
