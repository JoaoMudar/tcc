import { describe, expect, it } from 'vitest';
import {
  CANAIS_VENDA,
  CANAL_PADRAO,
  DONO_SITUACAO,
  SITUACOES_PEDIDO,
  TRANSICOES,
  centavosParaSql,
  chaveSaldo,
  formatMoeda,
  isCanalVenda,
  isSituacaoPedido,
  parsePreco,
  podeTransicionar,
  precoParaCampo,
  totalItem,
  totalPedido,
  transicoesDe,
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

describe('máquina de estados do pedido (T8.5, RN-53)', () => {
  it('são as oito situações, na ordem do fluxo', () => {
    expect(Object.keys(SITUACOES_PEDIDO)).toEqual([
      'cadastrado',
      'verificando',
      'verificado',
      'pendente_alteracao',
      'aprovado',
      'separando',
      'pronto_envio',
      'cancelado',
    ]);
  });

  it('recusa situação que não está na lista', () => {
    expect(isSituacaoPedido('aprovado')).toBe(true);
    expect(isSituacaoPedido('rascunho')).toBe(false);
  });

  it('cada situação diz de quem o pedido está esperando, e o fim de linha não espera ninguém', () => {
    expect(DONO_SITUACAO.cadastrado).toBe('gerencia');
    expect(DONO_SITUACAO.verificado).toBe('chefia');
    expect(DONO_SITUACAO.pronto_envio).toBeNull();
    expect(DONO_SITUACAO.cancelado).toBeNull();
  });

  it('a conferência é da gerência, e a chefia também a executa', () => {
    expect(podeTransicionar('cadastrado', 'verificando', 'gerencia')).toBe(true);
    expect(podeTransicionar('cadastrado', 'verificando', 'chefia')).toBe(true);
    expect(podeTransicionar('verificando', 'verificado', 'gerencia')).toBe(true);
    expect(podeTransicionar('verificando', 'verificado', 'chefia')).toBe(true);
  });

  it('aprovar e devolver são da chefia, porque é quem responde por preço (RN-50)', () => {
    expect(podeTransicionar('verificado', 'aprovado', 'chefia')).toBe(true);
    expect(podeTransicionar('verificado', 'pendente_alteracao', 'chefia')).toBe(true);
    expect(podeTransicionar('verificado', 'aprovado', 'gerencia')).toBe(false);
  });

  it('a separação é da gerência, e a chefia também separa', () => {
    expect(podeTransicionar('aprovado', 'separando', 'gerencia')).toBe(true);
    expect(podeTransicionar('separando', 'pronto_envio', 'gerencia')).toBe(true);
    expect(podeTransicionar('aprovado', 'separando', 'chefia')).toBe(true);
  });

  it('a gerência executa exatamente duas fases: conferir e separar', () => {
    const daGerencia = TRANSICOES.filter((t) => t.por.includes('gerencia')).map((t) => `${t.de} > ${t.para}`);
    expect(daGerencia).toEqual([
      'cadastrado > verificando',
      'verificando > verificado',
      'aprovado > separando',
      'separando > pronto_envio',
    ]);
  });

  it('a chefia executa todas as fases, e o admin passa por cima de todas', () => {
    expect(TRANSICOES.every((t) => t.por.includes('chefia'))).toBe(true);
    expect(TRANSICOES.every((t) => podeTransicionar(t.de, t.para, 'admin'))).toBe(true);
  });

  it('o admin passa por cima, como em can()', () => {
    expect(podeTransicionar('cadastrado', 'verificando', 'admin')).toBe(true);
    expect(podeTransicionar('verificado', 'aprovado', 'admin')).toBe(true);
  });

  it('editar devolve o pedido ao começo da conferência, das quatro situações em que cabe', () => {
    for (const de of ['verificado', 'pendente_alteracao', 'aprovado', 'separando'] as const) {
      expect(podeTransicionar(de, 'cadastrado', 'chefia')).toBe(true);
      expect(podeTransicionar(de, 'cadastrado', 'gerencia')).toBe(false);
    }
  });

  it('pronto para envio também cancela, que é a decisão de 21/09/2026', () => {
    expect(podeTransicionar('pronto_envio', 'cancelado', 'chefia')).toBe(true);
  });

  it('cancelado é fim de linha, e não cancela de novo', () => {
    expect(podeTransicionar('cancelado', 'cancelado', 'chefia')).toBe(false);
    expect(transicoesDe('cancelado', 'chefia')).toEqual([]);
    expect(transicoesDe('cancelado', 'admin')).toEqual([]);
  });

  it('não se pula etapa: do cadastro não se vai direto a aprovado nem a pronto', () => {
    expect(podeTransicionar('cadastrado', 'aprovado', 'chefia')).toBe(false);
    expect(podeTransicionar('cadastrado', 'pronto_envio', 'admin')).toBe(false);
    expect(podeTransicionar('verificando', 'aprovado', 'chefia')).toBe(false);
  });

  it('nenhuma transição sai de cancelado, e nenhuma aponta para si mesma', () => {
    expect(TRANSICOES.filter((t) => t.de === 'cancelado')).toEqual([]);
    expect(TRANSICOES.filter((t) => t.de === t.para)).toEqual([]);
  });

  it('a tela monta os botões do que o perfil pode fazer agora', () => {
    const daChefia = transicoesDe('verificado', 'chefia').map((t) => t.para);
    expect(daChefia).toContain('aprovado');
    expect(daChefia).toContain('pendente_alteracao');
    expect(transicoesDe('verificado', 'gerencia')).toEqual([]);
  });
});
