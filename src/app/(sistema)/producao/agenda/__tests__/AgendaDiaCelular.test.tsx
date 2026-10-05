import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enviarGuardado } from '@/lib/fila-envio';
import { enfileirar } from '@/lib/fila-local';
import { ANA, GILBERTO, JOAO, MANHA, SEMANA, TARDE, tarefa } from './fixtures';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('@/lib/fila-local', () => ({ enfileirar: vi.fn(async () => undefined), remover: vi.fn(async () => undefined) }));
vi.mock('@/lib/fila-envio', () => ({ enviarGuardado: vi.fn() }));
vi.mock('../actions', () => ({ reagendarAtribuicaoAction: vi.fn(async () => ({})) }));

const { AgendaDiaCelular } = await import('../AgendaDiaCelular');

const DIAS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];

function renderDia(props: Partial<Parameters<typeof AgendaDiaCelular>[0]> = {}) {
  return render(
    <AgendaDiaCelular
      atribuicoes={[tarefa(), tarefa({ id: 'a2', tipo: 'Contar mudas', eQuantitativa: true, participantes: [{ ...JOAO, quantidade: null }] })]}
      funcionarios={[GILBERTO, JOAO, ANA]}
      dias={DIAS}
      dia={SEMANA}
      hoje="2026-09-30"
      turnos={[MANHA, TARDE]}
      podeConfirmar
      podeAlterar
      {...props}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('AgendaDiaCelular (RNF-14, RF-29)', () => {
  it('um dia por vez, agrupado por pessoa, e quem está sem tarefa aparece', () => {
    renderDia();
    expect(screen.getByRole('link', { name: 'Segunda, 28' })).toHaveAttribute('aria-current', 'date');
    expect(screen.getByRole('heading', { name: 'Gilberto' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'João' })).toBeInTheDocument();
    expect(screen.getByText('Sem tarefa: Ana.')).toBeInTheDocument();
  });

  it('marcar feito leva um toque, passa pela fila e fica na agenda', async () => {
    vi.mocked(enviarGuardado).mockResolvedValue({ tipo: 'gravado', success: 'Tarefa confirmada.' });
    renderDia();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Marcar Encher saquinhos/ })));
    expect(enfileirar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'confirmacao_tarefa', campos: expect.objectContaining({ id: 'a1', depois: 'ficar' }) }),
    );
    expect(refresh).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('sem rede, o toque fica guardado no aparelho', async () => {
    vi.mocked(enviarGuardado).mockResolvedValue({ tipo: 'sem_rede' });
    renderDia();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Marcar Encher saquinhos/ })));
    expect(await screen.findByRole('img', { name: /Guardado no aparelho/ })).toBeInTheDocument();
  });

  it('a quantitativa leva à ficha, onde se digita a quantidade', () => {
    renderDia();
    expect(screen.getByRole('link', { name: /Confirmar Contar mudas: abre a ficha/ })).toHaveAttribute('href', '/producao/agenda/a2');
  });

  it('deslizar para a esquerda vai para o dia seguinte; rolar na vertical não', () => {
    const { container } = renderDia();
    const lista = container.firstElementChild!;
    fireEvent.touchStart(lista, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(lista, { changedTouches: [{ clientX: 200, clientY: 110 }] });
    expect(push).toHaveBeenCalledWith('/producao?dia=2026-09-29', { scroll: false });

    push.mockClear();
    fireEvent.touchStart(lista, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(lista, { changedTouches: [{ clientX: 230, clientY: 400 }] });
    expect(push).not.toHaveBeenCalled();
  });

  it('dia vazio explica e oferece o lançamento', () => {
    renderDia({ dia: '2026-10-02', lancarHref: '/producao/agenda/nova?semana=2026-09-28&dia=2026-10-02' });
    expect(screen.getByText(/Nada lançado neste dia/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lançar tarefa' })).toBeInTheDocument();
  });
});

describe('AgendaDiaCelular: a semana que já pode ser fechada', () => {
  it('a não confirmada fica âmbar com "?", e só nessa semana', () => {
    const { rerender } = renderDia({ atribuicoes: [tarefa()] });
    expect(screen.queryByRole('img', { name: 'Presumida' })).not.toBeInTheDocument();
    rerender(
      <AgendaDiaCelular
        atribuicoes={[tarefa(), tarefa({ id: 'a2', tipo: 'Capinar', situacao: 'confirmada', participantes: [{ ...JOAO, quantidade: null }] })]}
        funcionarios={[GILBERTO, JOAO, ANA]}
        dias={DIAS}
        dia={SEMANA}
        hoje="2026-10-05"
        turnos={[MANHA, TARDE]}
        podeConfirmar
        podeAlterar
        aFechar
      />,
    );
    expect(screen.getByRole('img', { name: 'Presumida' })).toBeInTheDocument();
    expect(screen.getByText(/Encher saquinhos/).closest('li')).toHaveClass('bg-amber-50');
    expect(screen.getByText('Capinar').closest('li')).toHaveClass('bg-green-50');
  });
});
