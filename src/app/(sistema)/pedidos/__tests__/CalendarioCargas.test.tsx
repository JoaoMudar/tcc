import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalendarioCargas, type DiaDoPedido } from '../CalendarioCargas';

const PEDIDO: DiaDoPedido = {
  id: 'p1',
  numero: 7,
  cliente: 'Prefeitura de Rio do Sul',
  dataEntrega: '2026-10-02',
  diaDeCarregar: '2026-10-01',
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
    // O painel continua listando quem carrega no dia
    expect(screen.getByRole('link', { name: /Prefeitura de Rio do Sul/ }).textContent).toContain('carregar');
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
});
