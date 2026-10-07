import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalendarioCargas, type DiaDoPedido } from '../CalendarioCargas';

const PEDIDO: DiaDoPedido = {
  id: 'p1',
  numero: 7,
  cliente: 'Prefeitura de Rio do Sul',
  dataEntrega: '2026-10-02',
  situacao: 'aprovado',
  cargas: 0,
  prontas: 0,
};

function dia(n: number) {
  return screen.getByText(String(n), { selector: 'span' }).parentElement!;
}

describe('CalendarioCargas e a rotina "Planejar pedido" (P14)', () => {
  it('dia com entrega abre a rotina', () => {
    render(<CalendarioCargas mes="2026-10-01" hoje="2026-09-29" pedidos={[PEDIDO]} />);
    expect(dia(2).tagName).toBe('A');
    expect(dia(2).getAttribute('href')).toBe('/pedidos/planejar/2026-10-02');
  });

  it('dia sem entrega abre o painel, com o botão de planejar ali', () => {
    render(<CalendarioCargas mes="2026-10-01" hoje="2026-09-29" pedidos={[PEDIDO]} />);
    expect(dia(1).tagName).toBe('BUTTON');
    fireEvent.click(dia(1));
    const link = screen.getByRole('link', { name: 'Planejar entrega neste dia' });
    expect(link.getAttribute('href')).toBe('/pedidos/planejar/2026-10-01');
    // A véspera da entrega não ganha cor nem lista o pedido
    expect(dia(1).className).not.toMatch(/bg-(green|amber|red)/);
    expect(screen.queryByRole('link', { name: /Prefeitura de Rio do Sul/ })).toBeNull();
  });

  it('viagem em andamento: cartão "Continuar" na etapa em que parou, e ponto no dia', () => {
    render(
      <CalendarioCargas
        mes="2026-10-01"
        hoje="2026-09-29"
        pedidos={[PEDIDO]}
        viagens={[{ id: 'v1', data: '2026-10-02', situacao: 'roteirizando' }]}
      />,
    );
    const cartao = screen.getByText('Entrega de 02/10').closest('section')!;
    expect(within(cartao).getByText('Parou em Rota')).toBeTruthy();
    expect(within(cartao).getByRole('link', { name: 'Continuar' }).getAttribute('href')).toBe('/pedidos/planejar/2026-10-02');
    expect(within(dia(2)).getByLabelText('viagem em andamento')).toBeTruthy();
  });

  it('sem viagem, não há cartão nem ponto', () => {
    render(<CalendarioCargas mes="2026-10-01" hoje="2026-09-29" pedidos={[PEDIDO]} />);
    expect(screen.queryByText('Continuar')).toBeNull();
    expect(screen.queryByLabelText('viagem em andamento')).toBeNull();
  });

  it('entrega sem viagem pronta fica amarela; com viagem pronta, verde', () => {
    const outro = { ...PEDIDO, id: 'p2', dataEntrega: '2026-10-05' };
    render(<CalendarioCargas mes="2026-10-01" hoje="2026-09-29" pedidos={[PEDIDO, outro]} diasProntos={['2026-10-05']} />);
    expect(dia(2).className).toContain('bg-amber-200');
    expect(dia(5).className).toContain('bg-green-200');
  });

  it('entrega que passou sem o pedido pronto fica vermelha, mesmo com viagem pronta', () => {
    render(<CalendarioCargas mes="2026-10-01" hoje="2026-10-03" pedidos={[PEDIDO]} diasProntos={['2026-10-02']} />);
    expect(dia(2).className).toContain('bg-red-200');
  });

  it('a legenda mostra a cor num quadradinho, sem escrever o nome dela', () => {
    render(<CalendarioCargas mes="2026-10-01" hoje="2026-09-29" pedidos={[PEDIDO]} />);
    const item = screen.getByText('entrega não terminada de configurar');
    expect(item.querySelector('span')!.className).toContain('bg-amber-200');
    expect(screen.queryByText(/Amarelo|Verde|Vermelho/)).toBeNull();
  });
});
