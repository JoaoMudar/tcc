import { describe, expect, it } from 'vitest';
import {
  CANAIS_VENDA,
  CANAL_PADRAO,
  centavosParaSql,
  chaveSaldo,
  formatMoeda,
  isCanalVenda,
  parsePreco,
  precoParaCampo,
  totalItem,
  totalPedido,
} from '../pedidos-rotulos';
import { parseDataEntrega, parseFiltroPedidos, parseObservacoesPedido, parseQuantidadeItem } from '../pedidos';

describe('canal de venda', () => {
  it('é a lista fechada de cinco valores da RN-42', () => {
    expect(Object.keys(CANAIS_VENDA)).toEqual(['atacado', 'compensacao', 'paisagismo', 'prefeitura', 'varejo']);
  });

  it('tem atacado como padrão', () => {
    expect(CANAL_PADRAO).toBe('atacado');
  });

  it('recusa o que não está na lista', () => {
    expect(isCanalVenda('atacado')).toBe(true);
    expect(isCanalVenda('escambo')).toBe(false);
  });
});

describe('preço digitado (RF-55, RN-50)', () => {
  it('lê a vírgula como separador decimal', () => {
    expect(parsePreco('12,50')).toEqual({ value: 1250 });
  });

  it('lê o ponto decimal de quem digita no teclado do computador', () => {
    expect(parsePreco('12.50')).toEqual({ value: 1250 });
  });

  it('lê o valor inteiro, sem centavos', () => {
    expect(parsePreco('12')).toEqual({ value: 1200 });
  });

  it('lê o ponto como milhar quando há vírgula decimal, e aceita o R$', () => {
    expect(parsePreco('R$ 1.234,56')).toEqual({ value: 123456 });
  });

  it('recusa zero, negativo e texto', () => {
    expect(parsePreco('0')).toHaveProperty('error');
    expect(parsePreco('-1')).toHaveProperty('error');
    expect(parsePreco('caro')).toHaveProperty('error');
    expect(parsePreco('')).toHaveProperty('error');
  });

  it('recusa mais de duas casas, que não caberiam no NUMERIC(10,2)', () => {
    expect(parsePreco('12,505')).toHaveProperty('error');
  });

  it('volta para o campo como a pessoa digitou, e para o SQL como o Postgres espera', () => {
    expect(precoParaCampo(1250)).toBe('12,50');
    expect(centavosParaSql(1250)).toBe('12.50');
  });
});

describe('totais (RF-55)', () => {
  it('o total do item é quantidade por preço', () => {
    expect(totalItem({ quantidade: 200, precoCentavos: 250 })).toBe(50_000);
  });

  it('o total do pedido é a soma dos itens', () => {
    // TA-52: três itens, e o total do pedido reproduz a soma dos três
    const itens = [
      { quantidade: 200, precoCentavos: 250 },
      { quantidade: 50, precoCentavos: 1250 },
      { quantidade: 1, precoCentavos: 999 },
    ];
    expect(totalPedido(itens)).toBe(50_000 + 62_500 + 999);
  });

  it('soma em centavos, e não acumula erro de fração', () => {
    // O mesmo total em número quebrado daria 0,30000000000000004
    const itens = Array.from({ length: 3 }, () => ({ quantidade: 1, precoCentavos: 10 }));
    expect(formatMoeda(totalPedido(itens))).toBe(formatMoeda(30));
  });

  it('pedido sem item tem total zero', () => {
    expect(totalPedido([])).toBe(0);
  });
});

describe('quantidade do item', () => {
  it('aceita o milhar separado, como no resto do sistema', () => {
    expect(parseQuantidadeItem('6.000')).toEqual({ value: 6000 });
  });

  it('recusa zero e quebrado', () => {
    expect(parseQuantidadeItem('0')).toHaveProperty('error');
    expect(parseQuantidadeItem('1,5')).toHaveProperty('error');
  });
});

describe('campos opcionais do pedido', () => {
  it('entrega em branco fica nula, e data inválida é recusada', () => {
    expect(parseDataEntrega('  ')).toEqual({ value: null });
    expect(parseDataEntrega('2026-10-01')).toEqual({ value: '2026-10-01' });
    expect(parseDataEntrega('01/10/2026')).toHaveProperty('error');
  });

  it('a observação cabe em 500 caracteres', () => {
    expect(parseObservacoesPedido('x'.repeat(500))).toEqual({ value: 'x'.repeat(500) });
    expect(parseObservacoesPedido('x'.repeat(501))).toHaveProperty('error');
  });
});

describe('filtro da lista (RF-58)', () => {
  const hoje = '2026-09-21';
  const cliente = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';

  it('sem nada no endereço, são os últimos 90 dias', () => {
    expect(parseFiltroPedidos({}, hoje)).toEqual({ de: '2026-06-23', ate: hoje, clienteId: null, canal: null });
  });

  it('lê cliente, canal e período', () => {
    expect(parseFiltroPedidos({ de: '2026-09-01', ate: '2026-09-10', cliente, canal: 'varejo' }, hoje)).toEqual({
      de: '2026-09-01',
      ate: '2026-09-10',
      clienteId: cliente,
      canal: 'varejo',
    });
  });

  it('período invertido é endireitado, em vez de devolver lista vazia', () => {
    const filtro = parseFiltroPedidos({ de: '2026-09-10', ate: '2026-09-01' }, hoje);
    expect([filtro.de, filtro.ate]).toEqual(['2026-09-01', '2026-09-10']);
  });

  it('o que não vale cai no padrão, e não chega ao SQL', () => {
    const filtro = parseFiltroPedidos({ de: 'ontem', cliente: 'x', canal: 'escambo' }, hoje);
    expect(filtro).toEqual({ de: '2026-06-23', ate: hoje, clienteId: null, canal: null });
  });
});

describe('chave do saldo (RF-56)', () => {
  it('é o par espécie e recipiente, e distingue o recipiente', () => {
    expect(chaveSaldo('e1', 'r1')).toBe(chaveSaldo('e1', 'r1'));
    expect(chaveSaldo('e1', 'r1')).not.toBe(chaveSaldo('e1', 'r2'));
  });
});
