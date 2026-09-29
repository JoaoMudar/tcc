import { describe, expect, it } from 'vitest';
import {
  type ItemParaAprovar,
  ROTULO_HISTORICO,
  SITUACOES_PEDIDO,
  camposFaltando,
  resumoFaltas,
} from '../pedidos-rotulos';

function item(sobre: Partial<ItemParaAprovar> = {}): ItemParaAprovar {
  return {
    id: 'a',
    generico: false,
    quantidade: 100,
    precoCentavos: 500,
    recipienteId: 'tubete',
    recipienteDisponivelId: null,
    itemPaiId: null,
    disponivel: true,
    quantidadeDisponivel: null,
    ...sobre,
  };
}

const NADA = { quantidade: false, recipiente: false, preco: false, composicao: false };

describe('o que falta para aprovar (espelho de confirmarPedido)', () => {
  it('item completo não tem falta', () => {
    const itens = [item()];
    expect(camposFaltando(itens[0], itens)).toEqual(NADA);
    expect(resumoFaltas(itens)).toBeNull();
  });

  it('sem preço, sem quantidade e sem recipiente são faltas do item vendável', () => {
    const itens = [item({ precoCentavos: null, quantidade: null, recipienteId: null })];
    expect(camposFaltando(itens[0], itens)).toEqual({ ...NADA, preco: true, quantidade: true, recipiente: true });
  });

  it('o recipiente conferido cobre o que o pedido não disse', () => {
    const itens = [item({ recipienteId: null, recipienteDisponivelId: 'saco' })];
    expect(camposFaltando(itens[0], itens).recipiente).toBe(false);
  });

  it('o parcial vale pela quantidade que existe', () => {
    const itens = [item({ quantidade: null, disponivel: false, quantidadeDisponivel: 30 })];
    expect(camposFaltando(itens[0], itens).quantidade).toBe(false);
  });

  it('o indisponível sai na aprovação, e não é cobrado', () => {
    const itens = [item({ precoCentavos: null, disponivel: false, quantidadeDisponivel: 0 })];
    expect(camposFaltando(itens[0], itens)).toEqual(NADA);
  });

  it('o genérico sem composição falta espécies; o filho de genérico com quantidade não é cobrado', () => {
    const pai = item({ id: 'g', generico: true, recipienteId: null, precoCentavos: null });
    expect(camposFaltando(pai, [pai])).toEqual({ ...NADA, preco: true, composicao: true });

    const filho = item({ id: 'f', itemPaiId: 'g', precoCentavos: null });
    expect(camposFaltando(filho, [pai, filho])).toEqual(NADA);
    expect(camposFaltando(pai, [pai, filho]).composicao).toBe(false);
  });

  it('na lista montada (genérico sem quantidade) cada filho é cobrado', () => {
    const pai = item({ id: 'g', generico: true, quantidade: null, recipienteId: null, precoCentavos: null });
    const filho = item({ id: 'f', itemPaiId: 'g', precoCentavos: null });
    expect(camposFaltando(pai, [pai, filho])).toEqual(NADA);
    expect(camposFaltando(filho, [pai, filho]).preco).toBe(true);
  });

  it('o resumo conta por motivo, no singular e no plural', () => {
    const itens = [
      item({ id: 'a', precoCentavos: null }),
      item({ id: 'b', precoCentavos: null, recipienteId: null }),
    ];
    expect(resumoFaltas(itens)).toBe('Falta preço em 2 itens e recipiente em 1 item.');
  });
});

describe('rótulos da linha do tempo', () => {
  it('cobrem as oito situações', () => {
    expect(Object.keys(ROTULO_HISTORICO).sort()).toEqual(Object.keys(SITUACOES_PEDIDO).sort());
    expect(ROTULO_HISTORICO.cadastrado).toBe('Cadastrado');
  });
});
