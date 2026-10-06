import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtribuicaoResumo } from '@/lib/agenda';
import { ANA, GILBERTO, JOAO, MANHA, SEMANA, TARDE, tarefa } from './fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock('../actions', () => ({
  reagendarAtribuicaoAction: vi.fn(async () => ({ success: 'Tarefa remarcada.' })),
  promoverAtribuicaoAction: vi.fn(async () => ({ success: 'Tarefa em destaque.' })),
}));
// O formulário do lançamento tem a sua própria bateria; aqui só importa para onde ele aponta
vi.mock('../NovaTarefaModal', () => ({
  NovaTarefaModal: ({
    ponto,
  }: {
    ponto: { dia: string; turnoId: string; participanteId: string | null; horaInicio?: string | null; horaFim?: string | null };
  }) => (
    <div role="dialog" aria-label="Lançar tarefa">
      {ponto.dia} {ponto.turnoId} {ponto.participanteId} {ponto.horaInicio ?? 'sem-hora'} {ponto.horaFim ?? 'sem-hora'}
    </div>
  ),
}));

const { promoverAtribuicaoAction, reagendarAtribuicaoAction } = await import('../actions');
const { GanttSemana, HOVER_EXPAND } = await import('../GanttSemana');
const { ZoomAgenda } = await import('../ZoomAgenda');
const { SeletorZoom } = await import('../SeletorZoom');

const TERCA = '2026-09-29';
const DIAS = [SEMANA, TERCA];
const OPCOES = { funcionarios: [], tipos: [], turnos: [], dias: [], lotes: [], especies: [], recipientes: [] };
const TITULO = /Encher saquinhos/;

function montar(atribuicoes: AtribuicaoResumo[] = [tarefa()], props: Partial<Parameters<typeof GanttSemana>[0]> = {}) {
  return render(
    <GanttSemana
      atribuicoes={atribuicoes}
      funcionarios={[GILBERTO, JOAO, ANA]}
      dias={DIAS}
      turnos={[MANHA, TARDE]}
      hoje={SEMANA}
      semana={SEMANA}
      podeArrastar
      {...props}
    />,
  );
}

/** A área de dias da linha de uma pessoa, que é o que o arrasto procura sob o ponteiro. */
function linhaDe(id: string): Element {
  return document.querySelector(`[data-pessoa="${id}"]`)!;
}

function enviado(chamada = 0): Record<string, FormDataEntryValue> {
  const dados = vi.mocked(reagendarAtribuicaoAction).mock.calls[chamada][1] as FormData;
  return Object.fromEntries(dados.entries());
}

function estilo(link: Element): CSSStyleDeclaration {
  return (link.parentElement as HTMLElement).style;
}

/** Irrigação das 08:30 às 09:30, dentro da tarefa da manhã inteira: mais curta, fica na faixa de baixo. */
const IRRIGACAO = { id: 'a2', tipo: 'Irrigação', horaInicio: '08:30', horaFim: '09:30' };

/**
 * No jsdom toda caixa mede zero: cada coluna de dia vale 1px. O eixo tem as
 * 07:30–11:30 e as 13:30–17:30, oito horas úteis, e o almoço não ocupa largura:
 * 0.25 da coluna é 09:30, 0.5 é o divisor, e logo depois já é a tarde.
 */
async function arrastar(alvo: Element, ate: { clientX: number; linha?: Element }) {
  const original = document.elementFromPoint;
  document.elementFromPoint = () => ate.linha ?? null;
  fireEvent.pointerDown(alvo, { button: 0, clientX: 0, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: ate.clientX, pointerId: 1 });
  await act(async () => fireEvent.pointerUp(window, { clientX: ate.clientX, pointerId: 1 }));
  document.elementFromPoint = original;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => vi.useRealTimers());

describe('GanttSemana: desenho (T5.1, RNF-14)', () => {
  it('a barra traz o título, a faixa e o fundo da categoria, e leva à ficha', () => {
    montar();
    const barra = screen.getByRole('link', { name: TITULO });
    expect(barra).toHaveAttribute('href', '/producao/agenda/a1');
    expect(barra.querySelector('.bg-orange-800')).not.toBeNull();
    expect(barra.className).toContain('bg-orange-800/[0.08]');
  });

  it('confirmada, a barra ganha a cor cheia da categoria e o título branco', () => {
    montar([tarefa({ situacao: 'confirmada' })]);
    const barra = screen.getByRole('link', { name: TITULO });
    expect(barra.className).not.toContain('bg-orange-800/[0.08]');
    expect(barra.className.split(' ')).toContain('bg-orange-800');
    expect(within(barra).getByText(TITULO).className).toContain('text-white');
  });

  it('o almoço não ocupa largura: a manhã é a primeira metade e a tarde a segunda, sem tracejado (RN-12)', () => {
    montar([tarefa(), tarefa({ id: 'a2', turnoId: TARDE.id, turno: 'tarde' })]);
    const [manha, tarde] = screen.getAllByRole('link', { name: TITULO });
    expect(estilo(manha).left).toBe('0%');
    expect(estilo(manha).width).toBe('50%');
    expect(estilo(tarde).left).toBe('50%');
    expect(manha.className).not.toContain('border-dashed');
  });

  it('com hora, a barra ocupa a hora e mostra o horário; sem hora, mostra o turno no mesmo lugar', () => {
    montar([tarefa({ horaInicio: '07:30', horaFim: '08:30' }), tarefa({ id: 'a2', data: TERCA })]);
    const [comHora, semHora] = screen.getAllByRole('link', { name: TITULO });
    expect(comHora).toHaveTextContent('07:30–08:30');
    expect(estilo(comHora).width).toBe('12.5%');
    expect(semHora).toHaveTextContent('Manhã');
    expect(semHora).toHaveAttribute('title', expect.stringContaining('sem hora marcada'));
  });

  it('o título nunca quebra no meio da palavra', () => {
    montar();
    const titulo = within(screen.getByRole('link', { name: TITULO })).getByText(TITULO);
    expect(titulo.className).toContain('[word-break:normal]');
    expect(titulo.className).toContain('[overflow-wrap:normal]');
    expect(titulo.className).not.toMatch(/break-all|break-words|wrap-anywhere/);
  });

  it('o ícone de estado só aparece fora do planejado', () => {
    montar([tarefa(), tarefa({ id: 'a2', data: TERCA, situacao: 'nao_confirmada' })]);
    expect(screen.queryByRole('img', { name: 'Planejada' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Presumida' })).toBeInTheDocument();
  });

  it('a régua fora de foco numera só as horas pares, sem a hora do almoço, e mostra todas as pessoas', () => {
    montar([]);
    expect(screen.getAllByText('8').length).toBeGreaterThan(0);
    expect(screen.queryByText('9')).toBeNull();
    expect(screen.queryByText('12')).toBeNull();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getAllByText('Sem tarefa na semana')).toHaveLength(3);
  });

  it('não há mais o parágrafo de instruções sob a grade', () => {
    montar([tarefa()], { opcoes: OPCOES });
    expect(screen.queryByText(/Clique em qualquer vazio/)).toBeNull();
    expect(screen.queryByText(/arraste-a para cima/)).toBeNull();
  });

  it('a barra de ocupação mostra o quanto da jornada a pessoa tem no dia', () => {
    montar([tarefa(), tarefa(IRRIGACAO)]);
    // A manhã inteira (4h) mais a irrigação (1h), numa jornada de 8h
    expect(within(linhaDe(GILBERTO.id) as HTMLElement).getByRole('img', { name: 'Ocupação: 5h00 de 8h00' })).toHaveAttribute('title', '5h00 / 8h00');
  });
});

describe('GanttSemana: sobreposição em duas faixas (RF-26)', () => {
  it('a linha não cresce: a mais longa fica em cima com 60%, e a outra embaixo com 40%', () => {
    montar([tarefa(), tarefa(IRRIGACAO)]);
    expect((linhaDe(GILBERTO.id) as HTMLElement).style.height).toBe('60px');
    // A manhã é um card só, do começo ao fim, recortado embaixo só durante a irrigação
    const principais = screen.getAllByRole('link', { name: /^Encher saquinhos.*Planejada$/ });
    expect(principais).toHaveLength(1);
    expect(estilo(principais[0])).toMatchObject({ left: '0%', width: '50%' });
    const recorte = principais[0].getAttribute('data-recorte');
    expect(recorte).toContain('calc(25% + -1px) calc(60% + -0.6px)');
    expect(recorte).toContain('calc(50% + 0px) calc(60% + -0.6px)');
    const irrigar = screen.getByRole('link', { name: /^Irrigação.*faixa de baixo/ });
    expect(estilo(irrigar)).toMatchObject({ left: '12.5%', width: '12.5%' });
    expect(irrigar.getAttribute('data-recorte')).toContain('calc(60% + 1.4px)');
  });

  it('a tarefa longa cruzada por outra é um card só, com um título e uma faixa de cor', () => {
    montar([
      tarefa({ tipo: 'Adubar', turnoId: MANHA.id, horaInicio: '07:30', horaFim: '17:30' }),
      tarefa({ id: 'a2', tipo: 'Semear', horaInicio: '09:30', horaFim: '10:30' }),
    ]);
    const adubar = screen.getAllByRole('link', { name: /^Adubar/ });
    expect(adubar).toHaveLength(1);
    expect(adubar[0].querySelectorAll('.bg-orange-800')).toHaveLength(1);
    expect(screen.getAllByText('Adubar')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /^Semear.*faixa de baixo/ })).toBeInTheDocument();
  });

  it('a secundária mostra só o título, sem horário', () => {
    montar([tarefa(), tarefa(IRRIGACAO)]);
    const irrigar = screen.getByRole('link', { name: /^Irrigação.*faixa de baixo/ });
    expect(irrigar).toHaveTextContent(/^Irrigação$/);
  });

  it('a escolhida à mão fica em cima, mesmo sendo a mais curta', () => {
    montar([tarefa(), tarefa({ ...IRRIGACAO, prioridadeEm: '2026-09-21T12:00:00.000000Z' })]);
    expect(screen.getByRole('link', { name: /Encher saquinhos.*faixa de baixo/ })).toBeInTheDocument();
    // A irrigação, só no seu horário, fica com a faixa de cima: o recorte a corta em 60%
    expect(screen.getByRole('link', { name: /^Irrigação.*Planejada$/ }).getAttribute('data-recorte')).toContain('calc(60% + -0.6px)');
  });

  it('"Tornar principal" na secundária grava a escolha', async () => {
    montar([tarefa(), tarefa(IRRIGACAO)]);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Tornar principal: Irrigação' })));
    expect(promoverAtribuicaoAction).toHaveBeenCalledTimes(1);
    expect(Object.fromEntries((vi.mocked(promoverAtribuicaoAction).mock.calls[0][1] as FormData).entries())).toEqual({ id: 'a2' });
  });

  it('Shift com seta para cima na secundária também a torna principal (RNF-03)', async () => {
    montar([tarefa(), tarefa(IRRIGACAO)]);
    await act(async () => fireEvent.keyDown(screen.getByRole('link', { name: /^Irrigação.*faixa de baixo/ }), { key: 'ArrowUp', shiftKey: true }));
    expect(promoverAtribuicaoAction).toHaveBeenCalledTimes(1);
  });

  it('sem permissão, não há "Tornar principal"', () => {
    montar([tarefa(), tarefa(IRRIGACAO)], { podeArrastar: false });
    expect(screen.queryByRole('button', { name: /Tornar principal/ })).toBeNull();
  });

  it('a terceira que não cabe vira "+1", que abre a lista com o "Tornar principal" dela', async () => {
    montar([tarefa(), tarefa(IRRIGACAO), tarefa({ id: 'a3', tipo: 'Adubar', categoria: 'manutencao', horaInicio: '08:45', horaFim: '09:15' })]);
    fireEvent.click(screen.getByRole('button', { name: 'Mais 1 tarefa neste horário' }));
    const lista = screen.getByRole('dialog', { name: 'Tarefas no mesmo horário' });
    expect(within(lista).getByRole('link', { name: /Adubar/ })).toHaveAttribute('href', '/producao/agenda/a3');
    await act(async () => fireEvent.click(within(lista).getByRole('button', { name: 'Tornar principal' })));
    expect(Object.fromEntries((vi.mocked(promoverAtribuicaoAction).mock.calls[0][1] as FormData).entries())).toEqual({ id: 'a3' });
  });

  it('a que termina às 9h45 e a que começa às 9h45 se encostam, sem recuo entre elas', () => {
    montar([
      tarefa({ horaInicio: '09:00', horaFim: '09:45' }),
      tarefa({ ...IRRIGACAO, horaInicio: '09:45', horaFim: '10:30' }),
    ]);
    const antes = screen.getByRole('link', { name: /^Encher saquinhos/ });
    const depois = screen.getByRole('link', { name: /^Irrigação/ });
    expect(antes.parentElement).not.toHaveClass('pr-0.5');
    expect(antes).toHaveClass('rounded-r-none');
    expect(depois.parentElement).not.toHaveClass('pl-0.5');
    expect(depois).toHaveClass('rounded-l-none');
  });

  it('a alça de duração só fica na borda real da tarefa cortada', () => {
    montar([tarefa(), tarefa(IRRIGACAO)]);
    expect(screen.getAllByLabelText(/Mudar o início de Encher/)).toHaveLength(1);
    expect(screen.getAllByLabelText(/Mudar o fim de Encher/)).toHaveLength(1);
  });
});

describe('GanttSemana: o dia sob o mouse cresce', () => {
  const colunasDa = (id: string) => (linhaDe(id) as HTMLElement).style.gridTemplateColumns;
  const celula = (id: string, nome: string) => within(linhaDe(id) as HTMLElement).getByLabelText(nome);

  it('só depois de 150ms parado, e a grade toda junto; sair da grade devolve', () => {
    vi.useFakeTimers();
    montar();
    fireEvent.pointerEnter(celula(GILBERTO.id, 'Terça'));
    act(() => vi.advanceTimersByTime(100));
    expect(colunasDa(GILBERTO.id)).not.toContain(`${HOVER_EXPAND}fr`);
    act(() => vi.advanceTimersByTime(60));
    expect(colunasDa(GILBERTO.id)).toBe(`minmax(0, 1fr) minmax(0, ${HOVER_EXPAND}fr)`);
    expect(colunasDa(JOAO.id)).toBe(colunasDa(GILBERTO.id));

    fireEvent.pointerLeave(linhaDe(GILBERTO.id).parentElement!.parentElement!);
    expect(colunasDa(GILBERTO.id)).toBe('minmax(0, 1fr) minmax(0, 1fr)');
  });

  it('no dia em foco a régua numera todas as horas', () => {
    vi.useFakeTimers();
    montar([]);
    expect(screen.queryByText('9')).toBeNull();
    fireEvent.pointerEnter(celula(GILBERTO.id, 'Segunda'));
    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('durante o arrasto as larguras ficam paradas', () => {
    vi.useFakeTimers();
    montar([tarefa({ horaInicio: '07:30', horaFim: '08:30' })]);
    fireEvent.pointerDown(screen.getByRole('link', { name: TITULO }), { button: 0, clientX: 0, pointerId: 1 });
    fireEvent.pointerEnter(celula(GILBERTO.id, 'Terça'));
    act(() => vi.advanceTimersByTime(300));
    expect(colunasDa(GILBERTO.id)).toBe('minmax(0, 1fr) minmax(0, 1fr)');
    fireEvent.keyDown(window, { key: 'Escape' });
  });

  it('o arrasto mede o dia pela largura real da célula, e não por colunas iguais', async () => {
    montar([tarefa({ horaInicio: '07:30', horaFim: '08:30' })]);
    // Segunda em foco: 1.6px; terça: 1px
    const [segunda, terca] = [celula(GILBERTO.id, 'Segunda'), celula(GILBERTO.id, 'Terça')];
    const caixa = (left: number, width: number) => () => ({ left, width, top: 0, height: 60, right: left + width, bottom: 60, x: left, y: 0, toJSON: () => ({}) });
    segunda.getBoundingClientRect = caixa(0, 1.6);
    terca.getBoundingClientRect = caixa(1.6, 1);
    await arrastar(screen.getByRole('link', { name: TITULO }), { clientX: 1.85, linha: linhaDe(GILBERTO.id) });
    expect(enviado()).toMatchObject({ data: TERCA, hora_inicio: '09:30', hora_fim: '10:30' });
  });
});

describe('GanttSemana: lançar no vazio (RF-26)', () => {
  /** A célula com 100px: oito horas úteis, cada pixel vale 4,8 minutos. */
  function clicarEm(botao: Element, clientX: number) {
    botao.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 60, right: 100, bottom: 60, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.click(botao, { clientX, detail: 1 });
  }

  it('o clique no turno vazio lança já com pessoa, dia e turno, sem hora', () => {
    montar([tarefa()], { opcoes: OPCOES });
    clicarEm(screen.getByRole('button', { name: 'Lançar tarefa: João, Terça' }), 70);
    expect(screen.getByRole('dialog', { name: 'Lançar tarefa' })).toHaveTextContent(`${TERCA} ${TARDE.id} ${JOAO.id} sem-hora sem-hora`);
  });

  it('ao lado de uma tarefa marcada, a nova ocupa o resto livre do turno', () => {
    montar([tarefa({ horaInicio: '08:00', horaFim: '09:00' })], { opcoes: OPCOES });
    // 40px = 10:42, à direita da tarefa das 8 às 9
    clicarEm(screen.getByRole('button', { name: 'Lançar tarefa: Gilberto, Segunda' }), 40);
    expect(screen.getByRole('dialog', { name: 'Lançar tarefa' })).toHaveTextContent(`${SEMANA} ${MANHA.id} ${GILBERTO.id} 09:00 11:30`);
  });

  it('o mouse sobre o vazio mostra a faixa de quinze minutos com o "+"', () => {
    montar([], { opcoes: OPCOES });
    const botao = screen.getByRole('button', { name: 'Lançar tarefa: Ana, Segunda' });
    botao.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 60, right: 100, bottom: 60, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(botao, { clientX: 25 });
    expect(botao.parentElement).toHaveTextContent('+');
    fireEvent.pointerLeave(botao);
    expect(botao.parentElement).not.toHaveTextContent('+');
  });

  it('pelo teclado, o botão lança no começo do dia', () => {
    montar([], { opcoes: OPCOES });
    fireEvent.click(screen.getByRole('button', { name: 'Lançar tarefa: Ana, Segunda' }));
    expect(screen.getByRole('dialog', { name: 'Lançar tarefa' })).toHaveTextContent(`${SEMANA} ${MANHA.id} ${ANA.id} sem-hora`);
  });

  it('sem as listas do formulário não há onde clicar', () => {
    montar();
    expect(screen.queryByRole('button', { name: /Lançar tarefa/ })).toBeNull();
  });
});

describe('GanttSemana: arrastar (RNF-14, RN-61)', () => {
  it('sem permissão, ou tarefa já feita, a barra não tem borda para puxar', () => {
    const { unmount } = montar([tarefa()], { podeArrastar: false });
    expect(screen.queryByLabelText(/Mudar o início/)).toBeNull();
    unmount();
    montar([tarefa({ situacao: 'confirmada' })]);
    expect(screen.queryByLabelText(/Mudar o início/)).toBeNull();
  });

  it('puxar a borda do fim declara a hora', async () => {
    montar([tarefa({ horaInicio: '07:30', horaFim: '08:30' })]);
    // 0.25 da coluna = 07:30 + 2h
    await arrastar(screen.getByLabelText(/Mudar o fim/), { clientX: 0.25 });
    expect(enviado()).toEqual({ id: 'a1', data: SEMANA, turno_id: MANHA.id, hora_inicio: '07:30', hora_fim: '09:30' });
  });

  it('o balão mostra o horário durante o arrasto, e a pessoa nova ao trocar de linha', () => {
    montar([tarefa({ horaInicio: '07:30', horaFim: '08:30' })]);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => linhaDe(JOAO.id);
    fireEvent.pointerDown(screen.getByRole('link', { name: TITULO }), { button: 0, clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 0.25, pointerId: 1 });
    const fantasma = within(linhaDe(JOAO.id) as HTMLElement).getByRole('link', { name: TITULO });
    expect(fantasma.parentElement).toHaveTextContent('09:30–10:30→ João');
    // O lugar de origem fica apagado, para o olho medir quanto andou
    expect(linhaDe(GILBERTO.id).querySelector('.opacity-40')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    document.elementFromPoint = original;
  });

  it('arrastar para outro dia na mesma hora não inventa hora', async () => {
    montar();
    await arrastar(screen.getByRole('link', { name: TITULO }), { clientX: 1, linha: linhaDe(GILBERTO.id) });
    expect(enviado()).toEqual({ id: 'a1', data: TERCA, turno_id: MANHA.id, hora_inicio: '', hora_fim: '' });
  });

  it('passado o divisor já é a tarde, e perto do começo dela a barra se imanta; com aviso e desfazer', async () => {
    montar([tarefa({ horaInicio: '07:30', horaFim: '08:30' })]);
    // 0.51 da coluna = 13:35, a cinco minutos do começo da tarde
    await arrastar(screen.getByRole('link', { name: TITULO }), { clientX: 0.51, linha: linhaDe(GILBERTO.id) });
    expect(enviado()).toMatchObject({ turno_id: TARDE.id, hora_inicio: '13:30', hora_fim: '14:30' });

    const aviso = screen.getAllByRole('status').find((el) => el.textContent?.includes('remarcada'))!;
    await act(async () => fireEvent.click(within(aviso).getByRole('button', { name: 'Desfazer' })));
    expect(enviado(1)).toMatchObject({ turno_id: MANHA.id, hora_inicio: '07:30', hora_fim: '08:30' });
  });

  it('Ctrl+Z desfaz enquanto o aviso está na tela', async () => {
    montar([tarefa({ horaInicio: '07:30', horaFim: '08:30' })]);
    await arrastar(screen.getByRole('link', { name: TITULO }), { clientX: 0.25, linha: linhaDe(GILBERTO.id) });
    await act(async () => fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }));
    expect(reagendarAtribuicaoAction).toHaveBeenCalledTimes(2);
    expect(enviado(1)).toMatchObject({ hora_inicio: '07:30', hora_fim: '08:30' });
  });

  it('soltar na linha de outra pessoa troca quem faz', async () => {
    montar();
    await arrastar(screen.getByRole('link', { name: TITULO }), { clientX: 0, linha: linhaDe(JOAO.id) });
    expect(enviado()).toMatchObject({ data: SEMANA, sai: GILBERTO.id, entra: JOAO.id, hora_inicio: '' });
  });

  it('não põe na tarefa quem já está nela', async () => {
    montar([tarefa({ participantes: [{ ...GILBERTO, quantidade: null }, { ...JOAO, quantidade: null }] })]);
    const [doGilberto] = screen.getAllByRole('link', { name: TITULO });
    await arrastar(doGilberto, { clientX: 0, linha: linhaDe(JOAO.id) });
    expect(reagendarAtribuicaoAction).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('João já está nesta tarefa');
  });

  it('soltar sem sair do lugar não chama o servidor', async () => {
    montar();
    await arrastar(screen.getByRole('link', { name: TITULO }), { clientX: 0, linha: linhaDe(GILBERTO.id) });
    expect(reagendarAtribuicaoAction).not.toHaveBeenCalled();
  });

  it('shift com a seta remarca pelo teclado, sem trocar de semana (RNF-03)', async () => {
    montar([tarefa({ horaInicio: '07:30', horaFim: '08:30' })]);
    await act(async () => fireEvent.keyDown(screen.getByRole('link', { name: TITULO }), { key: 'ArrowRight', shiftKey: true }));
    expect(enviado()).toEqual({ id: 'a1', data: SEMANA, turno_id: MANHA.id, hora_inicio: '07:45', hora_fim: '08:45' });
    expect(push).not.toHaveBeenCalled();
  });

  describe('a tarefa do grupo anda junta', () => {
    const DO_GRUPO = { horaInicio: '07:30', horaFim: '08:30', participantes: [{ ...GILBERTO, quantidade: null }, { ...JOAO, quantidade: null }] };

    /** Pega a barra e leva o ponteiro, sem soltar: é o desenho no meio do gesto. */
    function pegarEMover(alvo: Element, ate: { clientX: number; linha: Element }) {
      document.elementFromPoint = () => ate.linha;
      fireEvent.pointerDown(alvo, { button: 0, clientX: 0, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: ate.clientX, pointerId: 1 });
    }

    it('a cópia do colega vai para o dia e a hora novos durante o arrasto, não só no soltar', async () => {
      montar([tarefa(DO_GRUPO)]);
      const original = document.elementFromPoint;
      const [doGilberto] = screen.getAllByRole('link', { name: TITULO });
      // 1.51 = terça, 13:35, imantada nas 13:30
      pegarEMover(doGilberto, { clientX: 1.51, linha: linhaDe(GILBERTO.id) });

      const doJoao = within(linhaDe(JOAO.id) as HTMLElement).getByRole('link', { name: TITULO });
      expect(doJoao.closest('[aria-label="Terça"]')).not.toBeNull();
      expect(estilo(doJoao).left).toBe('50%');

      await act(async () => fireEvent.pointerUp(window, { clientX: 1.51, pointerId: 1 }));
      document.elementFromPoint = original;
      expect(reagendarAtribuicaoAction).toHaveBeenCalledTimes(1);
    });

    it('levada para a linha de um colega, a linha dele mostra a tarefa uma vez só', () => {
      montar([tarefa(DO_GRUPO)]);
      const original = document.elementFromPoint;
      const [doGilberto] = screen.getAllByRole('link', { name: TITULO });
      pegarEMover(doGilberto, { clientX: 0, linha: linhaDe(JOAO.id) });
      expect(within(linhaDe(JOAO.id) as HTMLElement).getAllByRole('link', { name: TITULO })).toHaveLength(1);
      fireEvent.keyDown(window, { key: 'Escape' });
      document.elementFromPoint = original;
    });
  });

  describe('a secundária também tem a borda para puxar', () => {
    /** 08:00 às 09:00, dentro de uma irrigação das 07:30 às 11:30: é a mais curta, e fica embaixo. */
    const CRUZADAS = [tarefa({ horaInicio: '08:00', horaFim: '09:00' }), tarefa({ id: 'a2', tipo: 'Irrigação', horaInicio: '07:30', horaFim: '11:30' })];

    it('puxar o fim da secundária muda a duração, sem torná-la principal', async () => {
      montar(CRUZADAS);
      expect(screen.getByRole('link', { name: /Encher saquinhos.*faixa de baixo/ })).toBeInTheDocument();
      expect(screen.getByLabelText(/Mudar o início de Encher/)).toBeInTheDocument();
      // 0.25 da coluna = 09:30
      await arrastar(screen.getByLabelText(/Mudar o fim de Encher/), { clientX: 0.25 });
      expect(enviado()).toEqual({ id: 'a1', data: SEMANA, turno_id: MANHA.id, hora_inicio: '08:00', hora_fim: '09:30' });
      expect(promoverAtribuicaoAction).not.toHaveBeenCalled();
    });

    it('sem permissão, a secundária não tem borda', () => {
      montar(CRUZADAS, { podeArrastar: false });
      expect(screen.queryByLabelText(/Mudar o fim de Encher/)).toBeNull();
    });
  });

  it('atalhos: ← e → trocam de semana, T volta para hoje', () => {
    montar();
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.body, { key: 't' });
    expect(push).toHaveBeenNthCalledWith(1, '/producao?dia=2026-09-21', { scroll: false });
    expect(push).toHaveBeenNthCalledWith(2, '/producao', { scroll: false });
  });
});

describe('GanttSemana: linha do agora e sem balões de instrução', () => {
  it('a linha do agora aparece só na coluna de hoje, na hora corrente', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 9, 30));
    montar([]);
    const linhas = linhaDe(GILBERTO.id).querySelectorAll<HTMLElement>('[data-agora]');
    expect(linhas).toHaveLength(1);
    expect(linhas[0].closest('[aria-label="Segunda"]')).not.toBeNull();
    expect(linhas[0].style.left).toBe('25%');
  });

  it('em outra semana não há linha do agora', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 9, 30));
    montar([], { hoje: '2026-10-01' });
    expect(document.querySelector('[data-agora]')).toBeNull();
  });

  it('nenhum balão de instrução nem tooltip de "clique para lançar" na grade', () => {
    montar([tarefa(), tarefa({ id: 'a2', data: TERCA })], { opcoes: OPCOES });
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText(/Arraste para remarcar/)).toBeNull();
    expect(document.querySelector('[title="Clique para lançar tarefa aqui"]')).toBeNull();
  });
});

describe('GanttSemana: zoom', () => {
  const DIAS_SEMANA = [SEMANA, TERCA, '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];

  function comZoom(inicial: 'semana' | '3dias' | 'dia', dia = '2026-09-30') {
    return render(
      <ZoomAgenda inicial={inicial}>
        <SeletorZoom />
        <GanttSemana atribuicoes={[]} funcionarios={[GILBERTO]} dias={DIAS_SEMANA} dia={dia} turnos={[MANHA, TARDE]} hoje={SEMANA} semana={SEMANA} />
      </ZoomAgenda>,
    );
  }

  const colunas = () => Array.from(linhaDe(GILBERTO.id).children).map((celula) => celula.getAttribute('aria-label'));

  it('a semana mostra os cinco dias úteis, o 3 dias começa no dia, e o Dia só ele', () => {
    const { unmount } = comZoom('semana');
    expect(colunas()).toEqual(['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']);
    unmount();
    const outro = comZoom('3dias');
    expect(colunas()).toEqual(['Quarta', 'Quinta', 'Sexta']);
    outro.unmount();
    comZoom('dia');
    expect(colunas()).toEqual(['Quarta']);
  });

  it('sábado e domingo entram na grade pelos zooms 3 dias e Dia', () => {
    const { unmount } = comZoom('3dias', '2026-10-02');
    expect(colunas()).toEqual(['Sexta', 'Sábado', 'Domingo']);
    unmount();
    comZoom('dia', '2026-10-04');
    expect(colunas()).toEqual(['Domingo']);
  });

  it('o seletor troca o zoom e o guarda no cookie', () => {
    comZoom('semana');
    fireEvent.click(screen.getByRole('button', { name: 'Dia' }));
    expect(colunas()).toEqual(['Quarta']);
    expect(screen.getByRole('button', { name: 'Dia' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.cookie).toContain('agenda_zoom=dia');
  });

  it('Ctrl + roda para cima aproxima, para baixo afasta; sem Ctrl, nada muda', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    comZoom('semana');
    const grade = linhaDe(GILBERTO.id).closest('.overflow-x-auto')!;
    fireEvent.wheel(grade, { deltaY: -100 });
    expect(colunas()).toHaveLength(5);
    fireEvent.wheel(grade, { deltaY: -100, ctrlKey: true });
    expect(colunas()).toHaveLength(3);
    // A pinça do touchpad manda vários eventos seguidos: só um passo por vez
    fireEvent.wheel(grade, { deltaY: -100, ctrlKey: true });
    expect(colunas()).toHaveLength(3);
    vi.advanceTimersByTime(300);
    fireEvent.wheel(grade, { deltaY: 100, ctrlKey: true });
    expect(colunas()).toHaveLength(5);
  });

  it('no zoom Dia, ← e → andam um dia corrido, sábado inclusive', () => {
    comZoom('dia', '2026-10-02');
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(push).toHaveBeenLastCalledWith('/producao?dia=2026-10-03', { scroll: false });
  });
});
