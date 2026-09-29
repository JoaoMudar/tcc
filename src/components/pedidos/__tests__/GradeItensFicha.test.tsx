import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ItemDaFicha, GradeItensFicha } from '../GradeItensFicha';

function item(sobre: Partial<ItemDaFicha> = {}): ItemDaFicha {
  return {
    id: 'a',
    especieId: 'e1',
    especie: 'Ipê-amarelo',
    nomeCientifico: null,
    generico: false,
    quantidade: 100,
    precoCentavos: null,
    recipienteId: 't',
    recipiente: 'Tubete',
    recipienteDisponivelId: null,
    recipienteDisponivel: null,
    alturaM: null,
    alturaDisponivelM: null,
    itemPaiId: null,
    especificacao: null,
    disponivel: null,
    quantidadeDisponivel: null,
    ...sobre,
  };
}

describe('GradeItensFicha (T8.1, RF-55)', () => {
  it('na leitura, o que falta diz "Definir", e não há campo nem total', () => {
    render(<GradeItensFicha itens={[item({ recipienteId: null, recipiente: null })]} saldos={{}} />);
    expect(screen.getAllByText('Definir').length).toBeGreaterThan(0);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(/total do pedido/i)).toBeNull();
    expect(screen.queryByText(/a definir na conferência/i)).toBeNull();
  });

  it('na negociação, preço e quantidade são campos em cada item', () => {
    const onAlterar = vi.fn();
    render(
      <GradeItensFicha
        itens={[item()]}
        saldos={{}}
        valores={{ a: { preco: '', quantidade: '100', recipienteId: 't' } }}
        onAlterar={onAlterar}
      />,
    );
    // Planilha e lista convivem na página: um campo de cada em cada desenho
    const precos = screen.getAllByLabelText('Preço do item 1');
    expect(precos).toHaveLength(2);
    fireEvent.change(precos[0], { target: { value: '8,50' } });
    expect(onAlterar).toHaveBeenCalledWith('a', 'preco', '8,50');
    expect(screen.getAllByLabelText('Quantidade do item 1')).toHaveLength(2);
  });

  it('com recipiente conferido diferente, a célula vira escolha entre os dois', () => {
    const conferido = item({ recipienteDisponivelId: 's', recipienteDisponivel: 'Saco 17x22', disponivel: true });
    render(
      <GradeItensFicha
        itens={[conferido]}
        saldos={{}}
        valores={{ a: { preco: '', quantidade: '100', recipienteId: 's' } }}
        onAlterar={vi.fn()}
      />,
    );
    const [escolha] = screen.getAllByLabelText('Recipiente do item 1');
    expect(Array.from((escolha as HTMLSelectElement).options).map((o) => o.textContent)).toEqual(['Tubete', 'Saco 17x22']);
  });

  it('o genérico com quantidade só recebe preço, e o filho dele não se negocia', () => {
    const pai = item({ id: 'g', generico: true, especie: null, especieId: null, recipienteId: null, recipiente: null });
    const filho = item({ id: 'f', itemPaiId: 'g', especie: 'Cedro' });
    render(
      <GradeItensFicha
        itens={[pai, filho]}
        saldos={{}}
        valores={{ g: { preco: '', quantidade: '', recipienteId: '' } }}
        onAlterar={vi.fn()}
      />,
    );
    expect(screen.getAllByLabelText('Preço do item 1')).toHaveLength(2);
    expect(screen.queryByLabelText('Quantidade do item 1')).toBeNull();
    expect(screen.queryByLabelText('Preço do item 2')).toBeNull();
  });

  it('o "Definir" fica vermelho quando a falta impede a aprovação', () => {
    render(<GradeItensFicha itens={[item({ quantidade: null })]} saldos={{}} faltaBloqueia />);
    expect(screen.getAllByText('Definir')[0].className).toMatch(/red/);
  });
});
