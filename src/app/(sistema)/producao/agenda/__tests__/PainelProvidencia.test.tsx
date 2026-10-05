import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Providencia } from '@/lib/providencia';

vi.mock('../actions', () => ({
  adiarEtapaAction: vi.fn(async () => ({})),
  adiarAtribuicaoAction: vi.fn(async () => ({})),
}));

const { PainelProvidencia } = await import('../PainelProvidencia');

const BASE = { chave: 'k', titulo: 'L-012 · Ipê-amarelo', detalhe: 'Limpeza, atrasada 10 dias', prazo: '2026-09-20' };
const ETAPA: Providencia = {
  ...BASE,
  origem: {
    tipo: 'etapa',
    loteId: 'l1',
    etapaId: 'e1',
    lancarHref: '/producao/agenda/nova?semana=2026-09-28',
    registrarHref: '/producao/agenda/registrar?etapa=e1',
  },
};

function abrir(providencia: Providencia) {
  return render(<PainelProvidencia providencia={providencia} onFechar={vi.fn()} onFeito={vi.fn()} />);
}

describe('PainelProvidencia (RF-66)', () => {
  // Hoje no viveiro: 15/09, antes do prazo de 20/09
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-15T12:00:00-03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('abre com as três saídas, e postergar não vem aberto', () => {
    abrir(ETAPA);
    expect(screen.getByRole('button', { name: 'Postergar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Marcar na agenda' })).toHaveAttribute('href', '/producao/agenda/nova?semana=2026-09-28');
    expect(screen.getByRole('link', { name: 'Confirmar tarefa' })).toHaveAttribute('href', '/producao/agenda/registrar?etapa=e1');
    expect(screen.queryByText(/Novo prazo/)).not.toBeInTheDocument();
  });

  it('a tarefa já lançada se remarca e se confirma pela ficha, sem lançar outra', () => {
    abrir({ ...BASE, origem: { tipo: 'tarefa', atribuicaoId: 'a1', marcarHref: '/producao/agenda/a1/editar?semana=2026-10-05&voltar=agenda' } });
    expect(screen.getByRole('link', { name: 'Marcar na agenda' })).toHaveAttribute('href', '/producao/agenda/a1/editar?semana=2026-10-05&voltar=agenda');
    expect(screen.getByRole('link', { name: 'Confirmar tarefa' })).toHaveAttribute('href', '/producao/agenda/a1');
  });

  it('postergar escolhe os dias por toque, e o novo prazo conta do atual', () => {
    abrir(ETAPA);
    fireEvent.click(screen.getByRole('button', { name: 'Postergar' }));
    expect(screen.getByText('Novo prazo: 27/09/2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '15 dias' }));
    expect(screen.getByRole('button', { name: '15 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Novo prazo: 05/10/2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Um dia a mais' }));
    expect(screen.getByRole('button', { name: 'Postergar 16 dias' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1 dia' }));
    expect(screen.getByRole('button', { name: 'Um dia a menos' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('link', { name: 'Confirmar tarefa' })).toBeInTheDocument();
  });

  it('com o prazo já vencido, o novo prazo conta de hoje', () => {
    vi.setSystemTime(new Date('2026-10-05T12:00:00-03:00'));
    abrir(ETAPA);
    fireEvent.click(screen.getByRole('button', { name: 'Postergar' }));
    fireEvent.click(screen.getByRole('button', { name: '1 dia' }));
    expect(screen.getByText('Novo prazo: 06/10/2026')).toBeInTheDocument();
  });
});
