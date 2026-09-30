import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmarForm } from '../agenda/ConfirmarForm';
import { ContagemForm } from '../lotes/[id]/ContagemForm';
import { PerdaForm } from '../lotes/[id]/PerdaForm';

/**
 * T10.4: a varredura dos requisitos de campo sobre os três formulários que a
 * gerência preenche no viveiro. Conta o que a pessoa vê, e não o que o código
 * declara: campo oculto não conta, e um grupo de opções é um campo só.
 *   RNF-01  até cinco campos por tela
 *   RNF-02  categoria em lista fechada, nunca digitada
 *   RNF-03  todo alvo de toque com a altura mínima do projeto (min-h-touch, 48 px)
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/fila-local', () => ({ enfileirar: vi.fn(async () => undefined), remover: vi.fn(async () => undefined) }));
vi.mock('@/lib/fila-envio', () => ({ enviarGuardado: vi.fn() }));

function camposVisiveis(form: HTMLElement): string[] {
  const nomes = new Set<string>();
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach((el) => {
    if (el instanceof HTMLInputElement && el.type === 'hidden') return;
    nomes.add(el.name);
  });
  return [...nomes];
}

function alvosPequenos(form: HTMLElement): string[] {
  const alvos = [...form.querySelectorAll<HTMLElement>('button, summary')];
  // A opção de lista fechada é tocada pelo rótulo inteiro, e é ele que precisa do tamanho
  form.querySelectorAll('input[type="radio"]').forEach((radio) => alvos.push(radio.closest('label')!));
  return alvos.filter((el) => !el.className.includes('min-h-touch')).map((el) => el.textContent ?? el.tagName);
}

const CONFIRMAR = {
  atribuicaoId: 'atr1',
  descricao: 'Repicagem, 14/09/2026',
  exigeLote: true,
  exigeArea: false,
  eQuantitativa: true,
  unidadeMedida: 'un' as const,
  participantes: [
    { id: 'p1', nome: 'Rogério' },
    { id: 'p2', nome: 'Amélia' },
  ],
  lotes: [{ value: 'l1', label: '2026-0001' }],
  areas: [],
  loteId: 'l1',
  areaId: null,
  canteiroId: null,
};

describe('requisitos de campo (T10.4)', () => {
  it('TA-21, TA-22, TA-56: perda em três campos, causa em lista fechada, alvos grandes', () => {
    const { container } = render(<PerdaForm loteId="l1" codigo="2026-0001" saldo={100} />);
    const form = container.querySelector('form')!;
    expect(camposVisiveis(form)).toEqual(['quantidade', 'causa', 'observacoes']);
    expect(form.querySelectorAll('input[name="causa"]:not([type="radio"])')).toHaveLength(0);
    expect(alvosPequenos(form)).toEqual([]);
  });

  it('TA-55: contagem em dois campos, alvos grandes', () => {
    const { container } = render(<ContagemForm loteId="l1" codigo="2026-0001" saldo={100} />);
    const form = container.querySelector('form')!;
    expect(camposVisiveis(form)).toEqual(['contado', 'observacoes']);
    expect(alvosPequenos(form)).toEqual([]);
  });

  it('TA-55: confirmação com lote, dois participantes e mudas mortas, cinco campos no máximo', () => {
    const { container } = render(<ConfirmarForm {...CONFIRMAR} />);
    const form = container.querySelector('form')!;
    fireEvent.change(form.querySelector('input[name="perdidas"]')!, { target: { value: '3' } });
    expect(camposVisiveis(form)).toEqual(['lote_id', 'quantidade_p1', 'quantidade_p2', 'perdidas', 'causa']);
    expect(alvosPequenos(form)).toEqual([]);
  });
});
