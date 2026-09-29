import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SituacaoPedido } from '@/lib/pedidos-rotulos';
import { ProximoPasso } from '../ProximoPasso';

vi.mock('../../actions', () => ({
  confirmarPedidoAction: vi.fn(async () => ({})),
  transicionarPedidoAction: vi.fn(async () => ({})),
}));

function montar(situacao: SituacaoPedido, sobre: Partial<Parameters<typeof ProximoPasso>[0]> = {}) {
  return render(
    <ProximoPasso
      pedidoId="p1"
      situacao={situacao}
      podeConferir
      podeDecidir
      podeSeparar
      faltas={null}
      salvando={false}
      {...sobre}
    />,
  );
}

const botoes = () => screen.queryAllByRole('button').map((b) => b.textContent);
const links = () => screen.queryAllByRole('link').map((l) => l.textContent);

describe('ProximoPasso: só o passo seguinte do fluxo (RN-53)', () => {
  it('no orçamento, só começar a verificação', () => {
    montar('cadastrado');
    expect(links()).toEqual(['Começar verificação']);
    expect(botoes()).toEqual([]);
  });

  it('verificado: aprovar e solicitar alteração, e mais nada', () => {
    montar('verificado');
    expect(botoes()).toEqual(['Aprovar pedido', 'Solicitar alteração']);
    expect(links()).toEqual([]);
  });

  it('o que falta aparece e trava a aprovação', () => {
    montar('verificado', { faltas: 'Falta preço em 2 itens.' });
    expect(screen.getByText('Falta preço em 2 itens.')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Aprovar pedido' }).disabled).toBe(true);
  });

  it('com gravação em andamento, aprovar espera', () => {
    montar('verificado', { salvando: true });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Aprovar pedido' }).disabled).toBe(true);
  });

  it('a gerência não decide o pedido verificado', () => {
    montar('verificado', { podeDecidir: false });
    expect(botoes()).toEqual([]);
  });

  it('aprovado: organizar as cargas; separando: continuar', () => {
    const { unmount } = montar('aprovado');
    expect(links()).toEqual(['Organizar cargas']);
    unmount();
    montar('separando');
    expect(links()).toEqual(['Continuar separação']);
  });

  it('pronto para envio e cancelado não têm passo seguinte', () => {
    const { container, unmount } = montar('pronto_envio');
    expect(container.textContent).toBe('');
    unmount();
    expect(montar('cancelado').container.textContent).toBe('');
  });
});
