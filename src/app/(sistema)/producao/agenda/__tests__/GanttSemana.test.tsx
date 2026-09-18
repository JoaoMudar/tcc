import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtribuicaoResumo, LinhaGrade } from '@/lib/agenda';
import type { Turno } from '@/lib/turnos';

vi.mock('../actions', () => ({ reagendarAtribuicaoAction: vi.fn(async () => ({})) }));

const { reagendarAtribuicaoAction } = await import('../actions');
const { GanttSemana } = await import('../GanttSemana');

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

function montar(grade: LinhaGrade[], props: { podeArrastar?: boolean } = {}) {
  return render(<GanttSemana grade={grade} dias={DIAS} turnos={TURNOS} hoje={SEGUNDA} semana={SEGUNDA} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GanttSemana (T5.1, RF-26, RNF-14)', () => {
  it('desenha uma barra por tarefa, com o tipo legível', () => {
    montar([linha({ [SEGUNDA]: [tarefa()] })]);
    expect(screen.getByRole('link', { name: /Semeadura/ })).toHaveTextContent('Semeadura');
  });

  it('separa os dias com régua, e tinge a coluna de hoje', () => {
    const { container } = montar([linha({ [SEGUNDA]: [tarefa()] })]);
    const colunas = (nome: string) => Array.from(container.querySelectorAll(`[aria-label="${nome}"]`));

    const [segunda] = colunas('Segunda');
    const [terca] = colunas('Terça');
    expect(segunda.className).toContain('border-r');
    expect(terca.className).toContain('border-r');
    // Hoje é a segunda: só ela vem tingida.
    expect(segunda.className).toContain('bg-brand-light/25');
    expect(terca.className).not.toContain('bg-brand-light/25');
  });

  it('não desenha marca de hora sobre a régua do dia', () => {
    const { container } = montar([linha({ [SEGUNDA]: [tarefa()] })]);
    const marcas = Array.from(container.querySelectorAll<HTMLElement>('[aria-label="Segunda"] .w-px'));

    expect(marcas.length).toBeGreaterThan(0);
    for (const marca of marcas) {
      expect(marca.style.left).not.toBe('0%');
      expect(marca.style.left).not.toBe('100%');
    }
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

  it('empilha duas tarefas sobrepostas em sub-linhas, sem esconder nenhuma (RF-26, TA-26)', () => {
    montar([
      linha({
        [SEGUNDA]: [tarefa({ id: 'a1', tipo: 'Semeadura' }), tarefa({ id: 'a2', tipo: 'Irrigação' })],
      }),
    ]);
    expect(screen.getByRole('link', { name: /Semeadura/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Irrigação/ })).toBeInTheDocument();
  });

  it('posiciona a barra pela hora dentro do eixo do dia', () => {
    const { container } = montar([
      linha({
        [SEGUNDA]: [tarefa({ id: 'a1', tipo: 'Semeadura' }), tarefa({ id: 'a2', tipo: 'Adubação', turnoId: TARDE.id, turno: 'tarde' })],
      }),
    ]);
    const caixa = (rotulo: string) => container.querySelector(`a[aria-label*="${rotulo}"]`)!.parentElement as HTMLElement;
    // O eixo vai das 07h às 17h: a manhã ocupa os primeiros 40%, a tarde os últimos 40%
    expect(caixa('Manhã').style.left).toBe('0%');
    expect(caixa('Manhã').style.width).toBe('40%');
    expect(caixa('Tarde').style.left).toBe('60%');
    expect(caixa('Tarde').style.width).toBe('40%');
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

describe('eixo de hora', () => {
  it('numera as horas cheias da janela no cabeçalho do dia', () => {
    montar([linha({ [SEGUNDA]: [tarefa()] })]);
    const cabecalho = screen.getByRole('link', { name: /SEG/ }).parentElement as HTMLElement;
    expect(within(cabecalho).getByText('7')).toBeInTheDocument();
    expect(within(cabecalho).getByText('12')).toBeInTheDocument();
    expect(within(cabecalho).getByText('17')).toBeInTheDocument();
  });
});

describe('arrastar para remarcar (RNF-14, RNF-03)', () => {
  const planejada = (over: Partial<AtribuicaoResumo> = {}) =>
    tarefa({ situacao: 'planejada', horaInicio: '07:00', horaFim: '08:00', ...over });

  it('sem permissão de alterar, a barra não tem borda para puxar', () => {
    montar([linha({ [SEGUNDA]: [planejada()] })], { podeArrastar: false });
    expect(screen.queryByLabelText(/Mudar o início/)).not.toBeInTheDocument();
  });

  it('a tarefa que já aconteceu não se remaneja, mesmo com permissão', () => {
    montar([linha({ [SEGUNDA]: [planejada({ situacao: 'confirmada' })] })], { podeArrastar: true });
    expect(screen.queryByLabelText(/Mudar o início/)).not.toBeInTheDocument();
  });

  it('a planejada ganha as duas bordas quando se pode alterar', () => {
    montar([linha({ [SEGUNDA]: [planejada()] })], { podeArrastar: true });
    expect(screen.getByLabelText('Mudar o início de Semeadura')).toBeInTheDocument();
    expect(screen.getByLabelText('Mudar o fim de Semeadura')).toBeInTheDocument();
  });

  it('shift com a seta remarca pelo teclado, e manda o turno junto (RNF-03)', async () => {
    montar([linha({ [SEGUNDA]: [planejada()] })], { podeArrastar: true });
    fireEvent.keyDown(screen.getByRole('link', { name: /Semeadura/ }), { key: 'ArrowRight', shiftKey: true });

    expect(reagendarAtribuicaoAction).toHaveBeenCalledTimes(1);
    const dados = vi.mocked(reagendarAtribuicaoAction).mock.calls[0][1] as FormData;
    expect(Object.fromEntries(dados.entries())).toEqual({
      id: 'a1',
      data: SEGUNDA,
      turno_id: MANHA.id,
      hora_inicio: '07:15',
      hora_fim: '08:15',
    });
  });

  it('alt com a seta muda só a duração, e o início fica onde estava', async () => {
    montar([linha({ [SEGUNDA]: [planejada()] })], { podeArrastar: true });
    fireEvent.keyDown(screen.getByRole('link', { name: /Semeadura/ }), { key: 'ArrowRight', altKey: true });

    const dados = vi.mocked(reagendarAtribuicaoAction).mock.calls[0][1] as FormData;
    expect(dados.get('hora_inicio')).toBe('07:00');
    expect(dados.get('hora_fim')).toBe('08:15');
  });

  it('seta sem modificador não remarca: é navegação', () => {
    montar([linha({ [SEGUNDA]: [planejada()] })], { podeArrastar: true });
    fireEvent.keyDown(screen.getByRole('link', { name: /Semeadura/ }), { key: 'ArrowRight' });
    expect(reagendarAtribuicaoAction).not.toHaveBeenCalled();
  });

  it('arrastar a barra para outro dia remarca, sem quebrar o estado otimista', async () => {
    // No jsdom toda caixa mede zero: a coluna vale 1px, e um clientX por dia
    montar([linha({ [SEGUNDA]: [planejada()] })], { podeArrastar: true });
    const barra = screen.getByRole('link', { name: /Semeadura/ });

    fireEvent.pointerDown(barra, { button: 0, clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 1, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 1, pointerId: 1 });

    expect(reagendarAtribuicaoAction).toHaveBeenCalledTimes(1);
    const dados = vi.mocked(reagendarAtribuicaoAction).mock.calls[0][1] as FormData;
    expect(dados.get('data')).toBe(TERCA);
    expect(dados.get('hora_inicio')).toBe('07:00');
    expect(dados.get('hora_fim')).toBe('08:00');
  });

  it('soltar sem ter saído do lugar não chama o servidor', () => {
    montar([linha({ [SEGUNDA]: [planejada()] })], { podeArrastar: true });
    const barra = screen.getByRole('link', { name: /Semeadura/ });

    fireEvent.pointerDown(barra, { button: 0, clientX: 0, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 0, pointerId: 1 });

    expect(reagendarAtribuicaoAction).not.toHaveBeenCalled();
  });

  it('a etiqueta mostra a hora e o minuto enquanto se arrasta, e some ao soltar', () => {
    montar([linha({ [SEGUNDA]: [planejada()] })], { podeArrastar: true });
    const barra = screen.getByRole('link', { name: /Semeadura/ });
    expect(screen.queryByText('07:15\u201308:15')).not.toBeInTheDocument();

    fireEvent.pointerDown(barra, { button: 0, clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 0.025, pointerId: 1 });
    // A etiqueta na barra, e o mesmo texto na região viva
    expect(screen.getAllByText('07:15\u201308:15')).toHaveLength(2);
    // O mesmo horário para quem não vê a etiqueta (RNF-03)
    expect(screen.getByRole('status')).toHaveTextContent('07:15\u201308:15');

    fireEvent.pointerUp(window, { clientX: 0.025, pointerId: 1 });
    // Solta a barra: a etiqueta sai, e só o anúncio guarda o horário
    expect(screen.getAllByText('07:15\u201308:15')).toHaveLength(1);
  });

  it('sem as listas do formulário, clicar no vazio não lança nada', () => {
    montar([linha({ [TERCA]: [planejada({ data: TERCA })] })], { podeArrastar: true });
    expect(screen.queryByLabelText(/Lançar tarefa em/)).not.toBeInTheDocument();
  });
});
