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

  it('dia sem entrega nem carregamento abre o painel, com o botão de planejar ali', () => {
    render(<CalendarioCargas mes="2026-10-01" hoje="2026-09-29" pedidos={[PEDIDO]} />);
    expect(dia(7).tagName).toBe('BUTTON');
    fireEvent.click(dia(7));
    const link = screen.getByRole('link', { name: 'Planejar entrega neste dia' });
    expect(link.getAttribute('href')).toBe('/pedidos/planejar/2026-10-07');
    expect(dia(7).className).not.toMatch(/bg-(green|amber|red|blue)/);
    expect(screen.queryByRole('link', { name: /Prefeitura de Rio do Sul/ })).toBeNull();
  });

  it('RF-68: a véspera útil da entrega é dia de carregar, com cor e legenda próprias, e lista o pedido', () => {
    render(<CalendarioCargas mes="2026-10-01" hoje="2026-09-29" pedidos={[PEDIDO]} />);
    expect(dia(1).className).toMatch(/bg-blue/);
    expect(dia(1).textContent).toMatch(/carregar/);
    fireEvent.click(dia(1));
    expect(screen.getByRole('link', { name: /Carregar o pedido 7/ }).getAttribute('href')).toBe('/pedidos/planejar/2026-10-02');
    expect(screen.getByText(/carregar \(dia útil antes da entrega\)/)).toBeInTheDocument();
  });

  it('RF-68: a entrega de segunda carrega na sexta, e o mês navega pelas setas', () => {
    const segunda = { ...PEDIDO, id: 'p2', dataEntrega: '2026-10-12' };
    render(<CalendarioCargas mes="2026-10-01" hoje="2026-09-29" pedidos={[segunda]} />);
    expect(dia(9).textContent).toMatch(/carregar/);
    expect(screen.getByRole('link', { name: 'Mês anterior' }).getAttribute('href')).toBe('/pedidos?mes=2026-09');
    expect(screen.getByRole('link', { name: 'Mês seguinte' }).getAttribute('href')).toBe('/pedidos?mes=2026-11');
  });

  it('viagem em andamento: sem cartão, o dia fica amarelo, com ponto, e abre a rotina', () => {
    render(
      <CalendarioCargas
        mes="2026-10-01"
        hoje="2026-09-29"
        pedidos={[PEDIDO]}
        viagens={[{ id: 'v1', data: '2026-10-02', situacao: 'roteirizando' }]}
      />,
    );
    expect(screen.queryByText(/Entrega de/)).toBeNull();
    expect(screen.queryByText('Continuar')).toBeNull();
    expect(dia(2).className).toContain('bg-amber-200');
    expect(dia(2).getAttribute('href')).toBe('/pedidos/planejar/2026-10-02');
    expect(within(dia(2)).getByLabelText('viagem em andamento')).toBeTruthy();
  });

  it('viagem em andamento num dia sem pedido também fica amarela e abre a rotina', () => {
    render(
      <CalendarioCargas
        mes="2026-10-01"
        hoje="2026-09-29"
        pedidos={[PEDIDO]}
        viagens={[{ id: 'v1', data: '2026-10-07', situacao: 'carregando' }]}
      />,
    );
    expect(dia(7).className).toContain('bg-amber-200');
    expect(dia(7).getAttribute('href')).toBe('/pedidos/planejar/2026-10-07');
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
    const item = screen.getByText('não confirmada');
    expect(item.querySelector('span')!.className).toContain('bg-amber-200');
    expect(screen.queryByText(/Amarelo|Verde|Vermelho/)).toBeNull();
  });
});
