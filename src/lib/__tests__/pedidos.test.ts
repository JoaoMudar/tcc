import { describe, expect, it } from 'vitest';
import { diaUtilAnterior } from '../datas';
import {
  CANAIS_VENDA,
  alturaParaCampo,
  CANAL_PADRAO,
  DONO_SITUACAO,
  SITUACOES_PEDIDO,
  TRANSICOES,
  centavosParaSql,
  chaveSaldo,
  saldoDoItem,
  filtraPedidosPorCliente,
  formatAltura,
  formatMoeda,
  formatTotal,
  rotuloGenerico,
  isCanalVenda,
  isSituacaoPedido,
  itemVendavel,
  mascaraAltura,
  normalizaCampoAltura,
  parseAltura,
  parsePreco,
  podeTransicionar,
  precoParaCampo,
  quantidadeConfirmada,
  totalItem,
  totalPedido,
  transicoesDe,
  urgenciaPedido,
  validarDivisaoCargas,
} from '../pedidos-rotulos';
import {
  parseDataEntrega,
  parseObservacoesPedido,
  parseQuantidadeItem,
  parseQuantidadeOpcional,
} from '../pedidos';

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

  it('sem quantidade não há total, nem do item nem do pedido', () => {
    expect(totalItem({ quantidade: null, precoCentavos: 250 })).toBeNull();
    expect(totalPedido([{ quantidade: null, precoCentavos: 250 }, { quantidade: 10, precoCentavos: 100 }])).toBeNull();
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
    expect(formatMoeda(totalPedido(itens)!)).toBe(formatMoeda(30));
  });

  it('pedido sem item tem total zero', () => {
    expect(totalPedido([])).toBe(0);
  });

  it('o filho do item genérico não soma de novo, senão a venda dobraria', () => {
    // O pai foi vendido por 500 × 2,00. Os filhos herdam o preço e só dizem
    // quais espécies compõem aquelas 500 mudas.
    const itens = [
      { quantidade: 500, precoCentavos: 200 },
      { quantidade: 300, precoCentavos: 200, itemPaiId: 'pai' },
      { quantidade: 200, precoCentavos: 200, itemPaiId: 'pai' },
    ];
    expect(totalPedido(itens)).toBe(100_000);
  });

  it('sem preço não há total: o item ainda não foi precificado', () => {
    expect(totalItem({ quantidade: 200, precoCentavos: null })).toBeNull();
  });

  it('um item sem preço deixa o pedido inteiro sem total, e não uma soma parcial', () => {
    // Somar só os precificados anunciaria uma venda menor que a verdadeira, e é
    // esse número que a chefia olha para aprovar.
    const itens = [
      { quantidade: 200, precoCentavos: 250 },
      { quantidade: 50, precoCentavos: null },
    ];
    expect(totalPedido(itens)).toBeNull();
  });

  it('na lista montada quem soma são os filhos, cada um pelo seu preço', () => {
    const itens = [
      { id: 'pai', generico: true, quantidade: null, precoCentavos: null },
      { id: 'a', itemPaiId: 'pai', quantidade: 100, precoCentavos: 300 },
      { id: 'b', itemPaiId: 'pai', quantidade: 50, precoCentavos: 1000 },
    ];
    expect(totalPedido(itens)).toBe(30_000 + 50_000);
  });

  it('a lista montada ainda sem espécies deixa o total a definir', () => {
    expect(totalPedido([{ id: 'pai', generico: true, quantidade: null, precoCentavos: null }])).toBeNull();
  });

  it('o item que não tem nenhuma não pede preço para o total existir', () => {
    const itens = [
      { quantidade: 100, precoCentavos: 250 },
      { quantidade: 50, precoCentavos: null, disponivel: false, quantidadeDisponivel: 0 },
    ];
    expect(totalPedido(itens)).toBe(25_000);
  });

  it('o filho sem preço não impede o total: quem soma é o item de topo', () => {
    const itens = [
      { quantidade: 500, precoCentavos: 200 },
      { quantidade: 500, precoCentavos: null, itemPaiId: 'pai' },
    ];
    expect(totalPedido(itens)).toBe(100_000);
  });

  it('formatTotal diz "a definir" enquanto falta preço', () => {
    expect(formatTotal(null)).toBe('a definir');
    expect(formatTotal(50_000)).toBe(formatMoeda(50_000));
  });
});

describe('rotuloGenerico', () => {
  it('sem observação o genérico é só "Genérico", e com ela leva o texto', () => {
    expect(rotuloGenerico(null)).toBe('Genérico');
    expect(rotuloGenerico('  ')).toBe('Genérico');
    expect(rotuloGenerico(' mudas nativas ')).toBe('Genérico: mudas nativas');
  });
});

describe('quantidade confirmada pela conferência', () => {
  it('"tem tudo" confirma a pedida; parcial e "tenho 350" confirmam a contada', () => {
    expect(quantidadeConfirmada({ quantidade: 500, disponivel: true, quantidadeDisponivel: null })).toBe(500);
    expect(quantidadeConfirmada({ quantidade: 500, disponivel: false, quantidadeDisponivel: 300 })).toBe(300);
    expect(quantidadeConfirmada({ quantidade: null, disponivel: true, quantidadeDisponivel: 350 })).toBe(350);
    expect(quantidadeConfirmada({ quantidade: 500, disponivel: false, quantidadeDisponivel: 0 })).toBe(0);
  });

  it('"tem", sem número, no item sem quantidade: não há teto (P12)', () => {
    expect(quantidadeConfirmada({ quantidade: null, disponivel: true, quantidadeDisponivel: null })).toBeNull();
  });
});

describe('item vendável', () => {
  const pai = (quantidade: number | null) => ({ id: 'pai', generico: true, quantidade, precoCentavos: null });
  const filho = { id: 'f', itemPaiId: 'pai', quantidade: 100, precoCentavos: null };

  it('o genérico com quantidade é vendido, e o filho dele não', () => {
    const itens = [pai(500), filho];
    expect(itemVendavel(itens[0], itens)).toBe(true);
    expect(itemVendavel(filho, itens)).toBe(false);
  });

  it('na lista montada é o contrário: o filho é vendido, e o genérico não', () => {
    const itens = [pai(null), filho];
    expect(itemVendavel(itens[0], itens)).toBe(false);
    expect(itemVendavel(filho, itens)).toBe(true);
  });

  it('o que a conferência disse que não tem nenhuma não é vendido', () => {
    const item = { quantidade: 100, precoCentavos: null, disponivel: false, quantidadeDisponivel: 0 };
    expect(itemVendavel(item, [item])).toBe(false);
  });
});

describe('divisão em cargas (T8.9)', () => {
  const itens = [
    { id: 'i1', quantidade: 500, nome: 'Ipê Amarelo' },
    { id: 'i2', quantidade: 200, nome: 'Araucária' },
  ];

  it('fecha quando cada item soma o seu total nas cargas', () => {
    const cargas = [
      [
        { itemId: 'i1', quantidade: 300 },
        { itemId: 'i2', quantidade: 200 },
      ],
      [{ itemId: 'i1', quantidade: 200 }],
    ];
    expect(validarDivisaoCargas(itens, cargas)).toEqual({ value: cargas });
  });

  it('divide em três cargas', () => {
    const cargas = [
      [{ itemId: 'i1', quantidade: 200 }],
      [{ itemId: 'i1', quantidade: 200 }],
      [
        { itemId: 'i1', quantidade: 100 },
        { itemId: 'i2', quantidade: 200 },
      ],
    ];
    expect(validarDivisaoCargas(itens, cargas)).toHaveProperty('value');
  });

  it('item que ficou faltando é recusado, dizendo qual é e quanto deu', () => {
    const cargas = [
      [
        { itemId: 'i1', quantidade: 450 },
        { itemId: 'i2', quantidade: 200 },
      ],
    ];
    expect(validarDivisaoCargas(itens, cargas)).toEqual({
      error: 'Ipê Amarelo: a soma das cargas (450) não bate com o total do item (500).',
    });
  });

  it('item que passou do total é recusado', () => {
    const cargas = [
      [
        { itemId: 'i1', quantidade: 500 },
        { itemId: 'i2', quantidade: 250 },
      ],
    ];
    expect(validarDivisaoCargas(itens, cargas)).toHaveProperty('error');
  });

  it('item que não entrou em carga nenhuma é recusado', () => {
    const cargas = [[{ itemId: 'i1', quantidade: 500 }]];
    expect(validarDivisaoCargas(itens, cargas)).toHaveProperty('error');
  });

  it('quantidade negativa é recusada', () => {
    const cargas = [
      [
        { itemId: 'i1', quantidade: 600 },
        { itemId: 'i2', quantidade: 200 },
      ],
      [{ itemId: 'i1', quantidade: -100 }],
    ];
    expect(validarDivisaoCargas(itens, cargas)).toHaveProperty('error');
  });

  it('carga vazia não é erro: ela é descartada na gravação', () => {
    const cargas = [
      [
        { itemId: 'i1', quantidade: 500 },
        { itemId: 'i2', quantidade: 200 },
      ],
      [],
    ];
    expect(validarDivisaoCargas(itens, cargas)).toHaveProperty('value');
  });

  it('sem carga nenhuma é recusado', () => {
    expect(validarDivisaoCargas(itens, [])).toHaveProperty('error');
  });

  it('item de outro pedido é recusado', () => {
    expect(validarDivisaoCargas(itens, [[{ itemId: 'alheio', quantidade: 1 }]])).toHaveProperty('error');
  });
});

describe('urgência do pedido (T8.9)', () => {
  const hoje = '2026-09-21'; // segunda-feira

  it('sem data de entrega não há urgência nenhuma', () => {
    expect(urgenciaPedido(hoje, null, null)).toBeNull();
  });

  it('entrega hoje vem antes de tudo', () => {
    expect(urgenciaPedido(hoje, hoje, diaUtilAnterior(hoje))).toBe('entrega_hoje');
  });

  it('entrega que já passou fica atrasada', () => {
    expect(urgenciaPedido(hoje, '2026-09-18', diaUtilAnterior('2026-09-18'))).toBe('atrasada');
  });

  it('o dia de carregar chegou, e é o que a gerência precisa ver', () => {
    // Entrega terça 22, carrega segunda 21, que é hoje
    expect(urgenciaPedido(hoje, '2026-09-22', diaUtilAnterior('2026-09-22'))).toBe('carregar_hoje');
  });

  it('entrega amanhã sem ser dia de carregar ainda aparece', () => {
    // Quando o dia de carregar é depois de hoje, o que resta é o aviso da entrega
    expect(urgenciaPedido(hoje, '2026-09-22', '2026-09-22')).toBe('entrega_amanha');
  });

  it('até três dias é em breve, e depois disso não ganha etiqueta', () => {
    expect(urgenciaPedido(hoje, '2026-09-24', '2026-09-23')).toBe('em_breve');
    expect(urgenciaPedido(hoje, '2026-10-30', '2026-10-29')).toBeNull();
  });
});

describe('dia de carregar (T8.9)', () => {
  it('entrega na segunda carrega na sexta, pulando o fim de semana', () => {
    expect(diaUtilAnterior('2026-09-21')).toBe('2026-09-18');
  });

  it('entrega na terça carrega na segunda', () => {
    expect(diaUtilAnterior('2026-09-22')).toBe('2026-09-21');
  });

  it('entrega no sábado e no domingo carregam na sexta', () => {
    expect(diaUtilAnterior('2026-09-26')).toBe('2026-09-25');
    expect(diaUtilAnterior('2026-09-27')).toBe('2026-09-25');
  });

  it('não devolve nunca um sábado nem um domingo', () => {
    for (let dia = 1; dia <= 28; dia++) {
      const data = `2026-09-${String(dia).padStart(2, '0')}`;
      const carrega = new Date(`${diaUtilAnterior(data)}T00:00:00Z`).getUTCDay();
      expect(carrega).not.toBe(0);
      expect(carrega).not.toBe(6);
    }
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

  it('no cadastro pode ficar em branco, e o que for escrito continua valendo as mesmas regras', () => {
    expect(parseQuantidadeOpcional('  ')).toEqual({ value: null });
    expect(parseQuantidadeOpcional('500')).toEqual({ value: 500 });
    expect(parseQuantidadeOpcional('0')).toHaveProperty('error');
  });
});

describe('altura da muda pedida (RF-54)', () => {
  it('lê a vírgula, que é como o viveiro escreve', () => {
    expect(parseAltura('1,20')).toEqual({ value: 1.2 });
  });

  it('lê o ponto também, e a unidade escrita junto', () => {
    expect(parseAltura('0.8')).toEqual({ value: 0.8 });
    expect(parseAltura('1,20 m')).toEqual({ value: 1.2 });
  });

  it('em branco é nula, e não erro: a altura é opcional', () => {
    expect(parseAltura('')).toEqual({ value: null });
    expect(parseAltura('   ')).toEqual({ value: null });
  });

  it('recusa zero, negativo e texto', () => {
    expect(parseAltura('0')).toHaveProperty('error');
    expect(parseAltura('-1')).toHaveProperty('error');
    expect(parseAltura('grande')).toHaveProperty('error');
  });

  it('recusa o que só pode ser a quantidade digitada no campo errado', () => {
    expect(parseAltura('5000')).toHaveProperty('error');
  });

  it('lê centímetros: com a unidade, ou o inteiro sem unidade a partir de 10', () => {
    expect(parseAltura('120')).toEqual({ value: 1.2 });
    expect(parseAltura('80')).toEqual({ value: 0.8 });
    expect(parseAltura('80 cm')).toEqual({ value: 0.8 });
    expect(parseAltura('80cm')).toEqual({ value: 0.8 });
    expect(parseAltura('1.20m')).toEqual({ value: 1.2 });
  });

  it('o inteiro abaixo de 10 continua sendo metro', () => {
    expect(parseAltura('2')).toEqual({ value: 2 });
    expect(parseAltura('4 m')).toEqual({ value: 4 });
  });

  it('o campo que perde o foco mostra como o sistema entendeu', () => {
    expect(normalizaCampoAltura('120')).toBe('1,20 m');
    expect(normalizaCampoAltura('0,8')).toBe('0,80 m');
    expect(normalizaCampoAltura('1,20 m')).toBe('1,20 m');
    expect(normalizaCampoAltura('')).toBe('');
    expect(normalizaCampoAltura('grande')).toBe('grande');
  });

  it('a máscara da grade enche pela direita, com os centímetros nas duas últimas casas', () => {
    expect(mascaraAltura('1', '')).toBe('0,01 m');
    expect(mascaraAltura('0,01 m2', '0,01 m')).toBe('0,12 m');
    expect(mascaraAltura('0,12 m3', '0,12 m')).toBe('1,23 m');
    expect(mascaraAltura('1,23 m4', '1,23 m')).toBe('12,34 m');
    expect(mascaraAltura('123', '')).toBe('1,23 m');
    expect(mascaraAltura('1a2b', '')).toBe('0,12 m');
    expect(mascaraAltura('12345', '')).toBe('12,34 m');
    expect(mascaraAltura('', '0,01 m')).toBe('');
    expect(mascaraAltura('abc', '')).toBe('');
  });

  it('o apagar que só tira o " m" tira o último dígito', () => {
    expect(mascaraAltura('1,23 ', '1,23 m')).toBe('0,12 m');
    expect(mascaraAltura('0,01 ', '0,01 m')).toBe('');
    expect(mascaraAltura('1,2 m', '1,23 m')).toBe('0,12 m');
  });

  it('não guarda mais que dois decimais, que é o que a trena mede', () => {
    expect(parseAltura('1,205')).toHaveProperty('error');
  });

  it('na tela sai com a unidade, e no campo sai sem', () => {
    expect(formatAltura(1.2)).toBe('1,20 m');
    expect(formatAltura(null)).toBe('');
    expect(alturaParaCampo(1.2)).toBe('1,20');
    expect(alturaParaCampo(null)).toBe('');
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

describe('filtro da lista por cliente (RF-58)', () => {
  const pedidos = [
    { id: '1', clienteId: 'c1', cliente: 'José Antônio' },
    { id: '2', clienteId: 'c2', cliente: 'Prefeitura de Ibirama' },
    { id: '3', clienteId: 'c3', cliente: 'José Antônio' },
    { id: '4', clienteId: 'c1', cliente: 'José Antônio' },
  ];
  const ids = (lista: readonly { id: string }[]) => lista.map((p) => p.id);

  it('sem texto nem escolha, mostra todos', () => {
    expect(ids(filtraPedidosPorCliente(pedidos, { clienteId: '', texto: '  ' }))).toEqual(['1', '2', '3', '4']);
  });

  it('pedaço do nome acha sem acento nem caixa, em qualquer ordem', () => {
    expect(ids(filtraPedidosPorCliente(pedidos, { clienteId: '', texto: 'jose' }))).toEqual(['1', '3', '4']);
    expect(ids(filtraPedidosPorCliente(pedidos, { clienteId: '', texto: 'IBI pref' }))).toEqual(['2']);
  });

  it('cliente escolhido na lista vale pelo id, e não pelo nome igual de outro', () => {
    expect(ids(filtraPedidosPorCliente(pedidos, { clienteId: 'c1', texto: 'José Antônio' }))).toEqual(['1', '4']);
  });

  it('texto que não acha ninguém devolve lista vazia', () => {
    expect(filtraPedidosPorCliente(pedidos, { clienteId: '', texto: 'xyz' })).toEqual([]);
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

describe('saldo do item por altura (RN-06, RN-62)', () => {
  const faixas = [
    { alturaM: 1.5, quantidade: 10 },
    { alturaM: 1.2, quantidade: 100 },
    { alturaM: 1, quantidade: 30 },
    { alturaM: 0.99, quantidade: 5 },
    { alturaM: null, quantidade: 40 },
  ];

  it('item sem altura é atendido por todos os lotes do par, medidos ou não', () => {
    expect(saldoDoItem(faixas, null)).toEqual({ disponivel: 185, abaixo: 0, semAltura: 0 });
  });

  it('com altura, atende a muda igual ou maior; até 20 cm abaixo completa, e a borda dos 20 cm entra', () => {
    expect(saldoDoItem(faixas, 1.2)).toEqual({ disponivel: 110, abaixo: 30, semAltura: 40 });
  });

  it('a muda mais de 20 cm abaixo não aparece, nem como complemento', () => {
    expect(saldoDoItem(faixas, 1.21)).toEqual({ disponivel: 10, abaixo: 100, semAltura: 40 });
  });

  it('sem estoque do par, tudo zero', () => {
    expect(saldoDoItem(undefined, 1)).toEqual({ disponivel: 0, abaixo: 0, semAltura: 0 });
  });
});
