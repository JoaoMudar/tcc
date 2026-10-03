import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NENHUM } from '@/lib/agenda-rotulos';
import { AtribuicaoForm, type OpcoesAtribuicao } from '../AtribuicaoForm';

vi.mock('../actions', () => ({
  criarAtribuicaoAction: vi.fn(),
  atualizarAtribuicaoAction: vi.fn(),
}));

const SIMPLES = {
  id: 'simples',
  nome: 'Irrigação',
  categoria: 'manutencao' as const,
  eQuantitativa: false,
  exigeLote: false,
  exigeEspecie: false,
  exigeRecipiente: false,
  exigeArea: true,
  unidadeMedida: 'un' as const,
};
const COM_LOTE = { ...SIMPLES, id: 'repicagem', nome: 'Repicagem', categoria: 'plantio' as const, eQuantitativa: true, exigeLote: true, exigeArea: false };
const SEMENTE = { ...SIMPLES, id: 'semente', nome: 'Colher semente', categoria: 'semente' as const, eQuantitativa: true, exigeArea: false, unidadeMedida: 'kg' as const };

const OPCOES: OpcoesAtribuicao = {
  funcionarios: [{ value: 'p1', label: 'Gilberto' }],
  tipos: [SEMENTE, COM_LOTE, SIMPLES],
  turnos: [{ value: 't1', label: 'Manhã · 07:00' }],
  dias: [{ value: '2026-09-14', label: 'Seg 14/09' }],
  lotes: [{ value: 'l1', label: 'L-1', grupo: 'Área A · Canteiro 1' }],
  especies: [],
  recipientes: [],
};

function formulario(inicial: Record<string, string>, atribuicaoId?: string) {
  const { container } = render(<AtribuicaoForm semana="2026-09-14" opcoes={OPCOES} inicial={inicial} atribuicaoId={atribuicaoId} />);
  return container;
}

describe('AtribuicaoForm', () => {
  it('tipo sem declarações: sem área, lote nem quantidade, e os detalhes fechados', () => {
    const container = formulario({ tipo_tarefa_id: SIMPLES.id });
    expect(screen.queryByLabelText(/Área/)).toBeNull();
    expect(screen.queryByLabelText('Lote')).toBeNull();
    expect(screen.queryByLabelText(/Quantidade prevista/)).toBeNull();
    expect(container.querySelector('input[name="area_id"]')).toBeNull();
    expect(container.querySelector('details')?.open).toBe(false);
  });

  it('a tarefa aparece debaixo do título da categoria', () => {
    formulario({});
    const grupos = [...screen.getByLabelText(/Tarefa/).querySelectorAll('optgroup')];
    expect(grupos.map((g) => g.label)).toEqual(['Semente', 'Plantio', 'Manutenção']);
    expect(grupos[0].textContent).toBe('Colher semente');
  });

  it('o lote aparece debaixo da área e do canteiro, e o "escolher depois" fica solto', () => {
    formulario({ tipo_tarefa_id: COM_LOTE.id });
    const lote = screen.getByLabelText('Lote');
    expect(lote.querySelector('optgroup')?.label).toBe('Área A · Canteiro 1');
    expect(lote.querySelector('optgroup')?.textContent).toBe('L-1');
    expect(lote.querySelector(`option[value="${NENHUM}"]`)?.parentElement).toBe(lote);
  });

  it('mostra só os campos que o tipo declara', () => {
    formulario({ tipo_tarefa_id: COM_LOTE.id });
    expect(screen.getByLabelText('Lote')).toBeInTheDocument();
    expect(screen.getByLabelText(/Quantidade prevista/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Espécie')).toBeNull();
    expect(screen.queryByLabelText('Recipiente')).toBeNull();
  });

  it('abre os detalhes quando já há observação, para nada ficar escondido', () => {
    const container = formulario({ tipo_tarefa_id: SIMPLES.id, observacoes: 'Levar a mangueira' });
    expect(container.querySelector('details')?.open).toBe(true);
  });

  it('na alteração, a área gravada vai junto sem aparecer', () => {
    const container = formulario({ tipo_tarefa_id: SIMPLES.id, dias: '2026-09-14', area_id: 'a1', canteiro_id: 'c1' }, 'atr1');
    expect((container.querySelector('input[name="area_id"]') as HTMLInputElement).value).toBe('a1');
    expect((container.querySelector('input[name="canteiro_id"]') as HTMLInputElement).value).toBe('c1');
    expect(screen.queryByLabelText(/Área/)).toBeNull();
  });

  it('o tipo sem a declaração de área não carrega área nem na alteração, e a quantidade diz a unidade', () => {
    const container = formulario({ tipo_tarefa_id: SEMENTE.id, dias: '2026-09-14', area_id: 'a1' }, 'atr1');
    expect(container.querySelector('input[name="area_id"]')).toBeNull();
    expect(screen.getByLabelText(/Quantidade prevista em kg/)).toHaveAttribute('inputmode', 'decimal');
  });

  it('vindo do clique no Gantt, não pergunta dia nem turno, e a pessoa vem marcada', () => {
    const { container } = render(
      <AtribuicaoForm semana="2026-09-14" opcoes={OPCOES} inicial={{ participantes: 'p1' }} fixos={{ dia: '2026-09-14', turnoId: 't1' }} />,
    );
    expect(screen.queryByText('Dias')).toBeNull();
    expect(screen.queryByText('Turno')).toBeNull();
    expect((container.querySelector('input[type="hidden"][name="dias"]') as HTMLInputElement).value).toBe('2026-09-14');
    expect((container.querySelector('input[type="hidden"][name="turno_id"]') as HTMLInputElement).value).toBe('t1');
    expect(screen.getByLabelText('Gilberto')).toBeChecked();
  });
});
