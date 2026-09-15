import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AtribuicaoForm, type OpcoesAtribuicao } from '../AtribuicaoForm';

vi.mock('../actions', () => ({
  criarAtribuicaoAction: vi.fn(),
  atualizarAtribuicaoAction: vi.fn(),
}));

const SIMPLES = { id: 'simples', nome: 'Irrigação', eQuantitativa: false, exigeLote: false, exigeEspecie: false, exigeRecipiente: false };
const COM_LOTE = { ...SIMPLES, id: 'repicagem', nome: 'Repicagem', eQuantitativa: true, exigeLote: true };

const OPCOES: OpcoesAtribuicao = {
  funcionarios: [{ value: 'p1', label: 'Gilberto' }],
  tipos: [SIMPLES, COM_LOTE],
  turnos: [{ value: 't1', label: 'Manhã · 07:00' }],
  dias: [{ value: '2026-09-14', label: 'Seg 14/09' }],
  lotes: [{ value: 'l1', label: 'L-1' }],
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
});
