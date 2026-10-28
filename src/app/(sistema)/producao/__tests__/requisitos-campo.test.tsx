import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PessoaForm } from '../../cadastros/pessoas/PessoaForm';
import { ConfirmarForm } from '../agenda/ConfirmarForm';
import { RegistrarFeitaForm } from '../agenda/RegistrarFeitaForm';
import { AlturaForm } from '../lotes/[id]/AlturaForm';
import { ContagemForm } from '../lotes/[id]/ContagemForm';
import { DivisaoForm } from '../lotes/[id]/DivisaoForm';
import { PerdaForm } from '../lotes/[id]/PerdaForm';
import { RepicagemForm } from '../lotes/[id]/RepicagemForm';

/**
 * T10.4: a varredura dos requisitos de campo sobre os três formulários que a
 * gerência preenche no viveiro. Conta o que a pessoa vê, e não o que o código
 * declara: campo oculto não conta, e um grupo de opções é um campo só.
 *   RNF-07  até cinco campos por tela
 *   RNF-06  categoria em lista fechada, nunca digitada
 *   RNF-08  todo alvo de toque com a altura mínima do projeto (min-h-touch, 48 px)
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/fila-local', () => ({ enfileirar: vi.fn(async () => undefined), remover: vi.fn(async () => undefined) }));
vi.mock('@/lib/fila-envio', () => ({ enviarGuardado: vi.fn() }));
vi.mock('../agenda/actions', () => ({ registrarTarefaFeitaAction: vi.fn(async () => ({})) }));
vi.mock('../lotes/actions', () => ({
  repicarLoteAction: vi.fn(async () => ({})),
  dividirLoteAction: vi.fn(async () => ({})),
  alterarAlturaAction: vi.fn(async () => ({})),
}));
vi.mock('../../cadastros/pessoas/actions', () => ({ savePessoaAction: vi.fn(async () => ({})) }));

/**
 * O que a pessoa vê agora: campo oculto não conta, nem o do passo escondido
 * (`hidden`), nem o que está dentro de um `<details>` fechado.
 */
function camposVisiveis(form: HTMLElement): string[] {
  const nomes = new Set<string>();
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach((el) => {
    if (el instanceof HTMLInputElement && el.type === 'hidden') return;
    if (el.closest('[hidden]')) return;
    const recolhido = el.closest('details');
    if (recolhido && !recolhido.open) return;
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

const CANTEIROS = [{ id: 'c1', areaId: 'a1', letra: 'A', numero: 1, capacidade: null, lotes: 0, mudas: 0 }];

/** RNF-07: o passo seguinte é tocado pelo botão de continuar. */
function continuar(form: HTMLElement) {
  fireEvent.click([...form.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Continuar'))!);
}

describe('RNF-07: até cinco campos por passo (auditoria de 24/10/2026)', () => {
  it('confirmação com três participantes vira dois passos: lote e quantidades, depois as mortas', () => {
    const tres = [...CONFIRMAR.participantes, { id: 'p3', nome: 'Jaison' }];
    const { container } = render(<ConfirmarForm {...CONFIRMAR} participantes={tres} />);
    const form = container.querySelector('form')!;
    expect(camposVisiveis(form)).toEqual(['lote_id', 'quantidade_p1', 'quantidade_p2', 'quantidade_p3']);

    continuar(form);
    fireEvent.change(form.querySelector('input[name="perdidas"]')!, { target: { value: '3' } });
    expect(camposVisiveis(form)).toEqual(['perdidas', 'causa']);
    expect(alvosPequenos(form)).toEqual([]);
  });

  it('tarefa feita fora da agenda: dia, turno e quem fez; depois quanto cada um fez e as mortas', () => {
    const funcionarios = [
      { value: 'p1', label: 'Rogério' },
      { value: 'p2', label: 'Amélia' },
      { value: 'p3', label: 'Jaison' },
    ];
    const { container } = render(
      <RegistrarFeitaForm
        etapaId="e1"
        loteId="l1"
        tipoTarefaId="t1"
        eQuantitativa
        unidadeMedida="un"
        funcionarios={funcionarios}
        turnos={[{ value: 'm', label: 'Manhã' }]}
        turnoId="m"
        hoje="2026-10-27"
      />,
    );
    const form = container.querySelector('form')!;
    for (const nome of ['Rogério', 'Amélia', 'Jaison']) fireEvent.click(screen.getByLabelText(nome));
    expect(camposVisiveis(form)).toEqual(['dias', 'turno_id', 'participantes']);

    continuar(form);
    fireEvent.change(form.querySelector('input[name="perdidas"]')!, { target: { value: '2' } });
    const segundo = camposVisiveis(form);
    expect(segundo.length).toBeLessThanOrEqual(5);
    expect(segundo).toEqual(['quantidade_p1', 'quantidade_p2', 'quantidade_p3', 'perdidas', 'causa']);
  });

  it('repicagem: para onde vão primeiro, as que morreram depois', () => {
    const { container } = render(
      <RepicagemForm loteId="l1" codigo="2026-0001" saldo={500} recipientes={[{ value: 's', label: 'Saco' }]} canteiros={CANTEIROS} />,
    );
    const form = container.querySelector('form')!;
    const primeiro = camposVisiveis(form);
    expect(primeiro.length).toBeLessThanOrEqual(5);
    expect(primeiro).toContain('quantidade');
    expect(primeiro).toContain('recipiente_id');
    expect(primeiro).not.toContain('perdidas');
  });

  it('divisão e altura ficam em até cinco campos', () => {
    const divisao = render(<DivisaoForm loteId="l1" codigo="2026-0001" saldo={500} canteiros={CANTEIROS} canteiroAtualId="c1" />);
    expect(camposVisiveis(divisao.container.querySelector('form')!).length).toBeLessThanOrEqual(5);
    const altura = render(<AlturaForm loteId="l1" alturaM={1.2} />);
    expect(camposVisiveis(altura.container.querySelector('form')!).length).toBeLessThanOrEqual(5);
  });

  it('RN-48: cliente novo dentro do pedido mostra tipo, nome e telefone; o resto fica recolhido', () => {
    const { container } = render(
      <PessoaForm verFiscal podeEditar paraPedido={{ onCriado: vi.fn(), onCancelar: vi.fn() }} />,
    );
    expect(camposVisiveis(container.querySelector('form')!)).toEqual(['tipo', 'nome', 'telefone']);
    expect(screen.getByText('Completar cadastro (opcional)')).toBeInTheDocument();
  });
});
