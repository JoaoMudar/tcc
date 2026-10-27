import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AreaNoMapa, LoteNoMapa } from '@/lib/mapa';
import { MapaCelular, Quadrado } from '../MapaLotes';

function lote(over: Partial<LoteNoMapa> & { id: string }): LoteNoMapa {
  return {
    codigo: over.id.toUpperCase(),
    canteiroId: 'c1',
    posicao: 1,
    especie: 'Ipê-amarelo',
    recipiente: 'tubete',
    fase: 'crescimento',
    saldo: 800,
    situacao: 'saudavel',
    tarefaPendente: null,
    pendenteDesde: null,
    diasAtraso: 0,
    atribuicaoPendenteId: null,
    protocoloEtapaPendenteId: null,
    tipoTarefaPendenteId: null,
    turnoPendenteId: null,
    quantidadeInicial: 1000,
    perdas: 50,
    taxa: 0.05,
    ...over,
  };
}

const ALTA = lote({ id: 'l-alta', perdas: 250, taxa: 0.25 });
const BAIXA = lote({ id: 'l-baixa' });

describe('Quadrado (RF-36)', () => {
  it('o lote acima do limite mostra o percentual escrito, e não só no ponteiro', () => {
    render(<Quadrado lote={ALTA} hoje="2026-10-27" destacado limite={20} />);
    const link = screen.getByRole('link');
    expect(link.textContent).toMatch(/25\s?%/);
    expect(link.getAttribute('title')).toMatch(/acima do limite de 20%/);
  });

  it('o lote abaixo do limite não tem número no quadrado, mas a taxa vai no texto do ponteiro', () => {
    render(<Quadrado lote={BAIXA} hoje="2026-10-27" destacado={false} limite={20} />);
    const link = screen.getByRole('link');
    expect(link.textContent).toBe('');
    expect(link.getAttribute('title')).toMatch(/mortalidade 5\s?%/);
  });
});

describe('MapaCelular (RNF-03)', () => {
  const mapa: AreaNoMapa[] = [
    {
      id: 'a',
      letra: 'A',
      nome: null,
      ocupados: 1,
      contagem: { saudavel: 2, atencao: 0, critico: 0 },
      canteiros: [
        { id: 'c1', numero: 1, lotes: [ALTA, BAIXA], livre: false },
        { id: 'c2', numero: 2, lotes: [], livre: true },
      ],
    },
  ];

  it('preserva canteiro, lote, situação e mortalidade, com o destaque acima do limite', () => {
    render(<MapaCelular mapa={mapa} hoje="2026-10-27" destacados={new Set([ALTA.id])} limite={20} />);
    expect(screen.getByText(/Canteiro A-1/)).toBeTruthy();
    expect(screen.getByText(/Canteiro A-2/).textContent).toMatch(/livre/);
    expect(screen.getByText(/L-ALTA/)).toBeTruthy();
    expect(screen.getByText(/L-BAIXA/)).toBeTruthy();
    expect(screen.getByText(/mortalidade 25\s?%, acima de 20%/)).toBeTruthy();
  });
});
