import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AtribuicaoResumo, LinhaGrade } from '@/lib/agenda';
import type { Turno } from '@/lib/turnos';
import { GanttSemana } from '../GanttSemana';

const SEGUNDA = '2026-09-14';
const TERCA = '2026-09-15';
const DIAS = [SEGUNDA, TERCA];

const MANHA: Turno = { id: 'turno-manha', nome: 'manha', inicio: '07:00', fim: '11:00', ativo: true };
const TARDE: Turno = { id: 'turno-tarde', nome: 'tarde', inicio: '13:00', fim: '17:00', ativo: true };
const TURNOS = [MANHA, TARDE];

function tarefa(over: Partial<AtribuicaoResumo> = {}): AtribuicaoResumo {
  return {
    id: 'a1',
    semanaId: 's1',
    semanaInicio: SEGUNDA,
    semanaSituacao: 'publicada',
    data: SEGUNDA,
    turnoId: MANHA.id,
    turno: 'manha',
    horaInicio: null,
    horaFim: null,
    tipoTarefaId: 't1',
    tipo: 'Semeadura',
    eQuantitativa: false,
    exigeLote: false,
    exigeEspecie: false,
    exigeRecipiente: false,
    exigeArea: false,
    unidadeMedida: 'un',
    especieId: null,
    especie: null,
    recipienteId: null,
    recipiente: null,
    loteId: null,
    loteCodigo: null,
    areaId: null,
    area: null,
    canteiroId: null,
    canteiro: null,
    quantidadePlanejada: null,
    eRecorrente: false,
    situacao: 'confirmada',
    observacoes: null,
    participantes: [],
    ...over,
  };
}

function linha(porDia: Record<string, AtribuicaoResumo[]>, nome = 'Rogério'): LinhaGrade {
  return { pessoa: { id: `p-${nome}`, nome }, porDia };
}

function montar(grade: LinhaGrade[]) {
  return render(<GanttSemana grade={grade} dias={DIAS} turnos={TURNOS} hoje={SEGUNDA} />);
}

describe('GanttSemana (T5.1, RF-26, RNF-14)', () => {
  it('desenha uma barra por tarefa, com o tipo legível', () => {
    montar([linha({ [SEGUNDA]: [tarefa()] })]);
    expect(screen.getByRole('link', { name: /Semeadura/ })).toHaveTextContent('Semeadura');
  });

  it('diz o estado no rótulo, para a cor não ser o único sinal', () => {
    montar([linha({ [SEGUNDA]: [tarefa({ situacao: 'nao_confirmada' })] })]);
    expect(screen.getByLabelText('Semeadura, Segunda, Manhã, Presumida')).toBeInTheDocument();
  });

  it('deriva parcial da soma abaixo do planejado (RF-29)', () => {
    montar([
      linha({
        [SEGUNDA]: [
          tarefa({ eQuantitativa: true, quantidadePlanejada: 100, participantes: [{ id: 'p1', nome: 'Ana', quantidade: 40 }] }),
        ],
      }),
    ]);
    expect(screen.getByLabelText(/Parcial$/)).toBeInTheDocument();
  });

  it('empilha duas tarefas do mesmo turno em sub-linhas, sem esconder nenhuma (RF-26, TA-26)', () => {
    montar([
      linha({
        [SEGUNDA]: [tarefa({ id: 'a1', tipo: 'Semeadura' }), tarefa({ id: 'a2', tipo: 'Irrigação' })],
      }),
    ]);
    expect(screen.getByRole('link', { name: /Semeadura/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Irrigação/ })).toBeInTheDocument();
  });

  it('separa os turnos do mesmo dia em colunas diferentes', () => {
    const { container } = montar([
      linha({
        [SEGUNDA]: [tarefa({ id: 'a1', tipo: 'Semeadura' }), tarefa({ id: 'a2', tipo: 'Adubação', turnoId: TARDE.id, turno: 'tarde' })],
      }),
    ]);
    const manha = container.querySelector('a[aria-label*="Manhã"]') as HTMLElement;
    const tarde = container.querySelector('a[aria-label*="Tarde"]') as HTMLElement;
    expect(manha.style.gridColumn).toBe('1');
    expect(tarde.style.gridColumn).toBe('2');
  });

  it('mostra a hora só na tarefa que a tem (RN-12)', () => {
    montar([linha({ [SEGUNDA]: [tarefa({ tipo: 'Irrigação', horaInicio: '07:00', horaFim: '08:00' })] })]);
    expect(screen.getByRole('link', { name: /Irrigação/ })).toHaveTextContent('07:00 às 08:00');
  });

  it('nomeia a linha das tarefas sem ninguém escalado', () => {
    montar([{ pessoa: null, porDia: { [SEGUNDA]: [tarefa()] } }]);
    expect(screen.getByText('Sem ninguém')).toBeInTheDocument();
  });

  it('traz a legenda dos estados', () => {
    const { container } = montar([linha({ [SEGUNDA]: [tarefa()] })]);
    const legenda = container.querySelector('ul') as HTMLElement;
    for (const rotulo of ['Feita', 'Parcial', 'Presumida', 'Não feita']) {
      expect(within(legenda).getByText(rotulo)).toBeInTheDocument();
    }
  });
});
