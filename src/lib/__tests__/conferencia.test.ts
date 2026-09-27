import { describe, expect, it } from 'vitest';
import {
  type ItemParaResponder,
  type PerguntasDoItem,
  estadoDaResposta,
  estadoDoGenerico,
  perguntasDoItem,
  resolveComplemento,
  resolveDisponibilidade,
  validarComposicaoGenerico,
} from '../pedidos-rotulos';

/** "q" é quantidade, "r" recipiente, "a" altura; "?" marca o opcional. */
function siglas(perguntas: PerguntasDoItem['tudo']): string {
  return perguntas.map((p) => `${p.campo[0]}${p.obrigatorio ? '' : '?'}`).join(',');
}

function item(especificado: string): ItemParaResponder {
  return {
    quantidade: especificado.includes('Q') ? 500 : null,
    recipienteId: especificado.includes('R') ? 'tubete' : null,
    alturaM: especificado.includes('A') ? 1.2 : null,
  };
}

describe('perguntasDoItem: uma regra para os 16 tipos de item (P12)', () => {
  // [o que o cliente especificou, botões, campos de "Tem tudo", campos de "Tem parte"]
  const especificos: [string, number, string, string][] = [
    ['QRA', 3, '', 'q,r,a'],
    ['QR', 3, '', 'q,r'],
    ['QA', 3, 'r', 'q,r,a'],
    ['Q', 3, 'r', 'q,r'],
    ['RA', 3, 'q?', 'q?,r,a'],
    ['R', 3, 'q?', 'q?,r'],
    ['A', 3, 'q?,r', 'q?,r,a'],
    ['', 2, 'q?,r', 'q?,r'],
  ];
  const genericos: [string, number, string, string][] = [
    ['QRA', 3, 'q', 'q,r,a'],
    ['QR', 3, 'q', 'q,r'],
    ['QA', 3, 'q,r', 'q,r,a'],
    ['Q', 3, 'q,r', 'q,r'],
    ['RA', 3, 'q?', 'q?,r,a'],
    ['R', 3, 'q?', 'q?,r'],
    ['A', 3, 'q?,r', 'q?,r,a'],
    ['', 2, 'q?,r', 'q?,r'],
  ];

  it.each(especificos)('espécie com "%s": %i botões, tudo [%s], parte [%s]', (especificado, botoes, tudo, parte) => {
    const perguntas = perguntasDoItem(item(especificado));
    expect(perguntas.temParte ? 3 : 2).toBe(botoes);
    expect(siglas(perguntas.tudo)).toBe(tudo);
    expect(siglas(perguntas.parte)).toBe(parte);
  });

  it.each(genericos)('genérico com "%s": %i botões, tudo [%s], parte [%s]', (especificado, botoes, tudo, parte) => {
    const perguntas = perguntasDoItem(item(especificado), true);
    expect(perguntas.temParte ? 3 : 2).toBe(botoes);
    expect(siglas(perguntas.tudo)).toBe(tudo);
    expect(siglas(perguntas.parte)).toBe(parte);
  });

  it('sem nada especificado o botão é "Tem", e não "Tem tudo"', () => {
    expect(perguntasDoItem(item('')).rotuloTudo).toBe('Tem');
    expect(perguntasDoItem(item('R')).rotuloTudo).toBe('Tem tudo');
  });
});

describe('resolveDisponibilidade (P12)', () => {
  const completo = item('QRA');

  it('"Não tem" é falso com zero, e não guarda nada conferido', () => {
    expect(resolveDisponibilidade('indisponivel', completo)).toEqual({
      value: { disponivel: false, quantidadeDisponivel: 0, recipienteDisponivelId: null, alturaDisponivelM: null },
    });
  });

  it('"Tem tudo" no item completo é o pedido: ignora recipiente enviado', () => {
    expect(resolveDisponibilidade('disponivel', completo, { recipienteId: 'saco' })).toEqual({
      value: { disponivel: true, quantidadeDisponivel: null, recipienteDisponivelId: null, alturaDisponivelM: null },
    });
  });

  it('"Tem tudo" sem recipiente no pedido exige o recipiente, e o grava', () => {
    expect(resolveDisponibilidade('disponivel', item('Q'))).toEqual({ error: 'Escolha o recipiente em que a muda está.' });
    expect(resolveDisponibilidade('disponivel', item('Q'), { recipienteId: 'saco' })).toEqual({
      value: { disponivel: true, quantidadeDisponivel: null, recipienteDisponivelId: 'saco', alturaDisponivelM: null },
    });
  });

  it('"Tem" sem quantidade no pedido: o número é opcional', () => {
    expect(resolveDisponibilidade('disponivel', item('R'))).toEqual({
      value: { disponivel: true, quantidadeDisponivel: null, recipienteDisponivelId: null, alturaDisponivelM: null },
    });
    expect(resolveDisponibilidade('disponivel', item('R'), { quantidade: 350 })).toEqual({
      value: { disponivel: true, quantidadeDisponivel: 350, recipienteDisponivelId: null, alturaDisponivelM: null },
    });
    expect(resolveDisponibilidade('disponivel', item('R'), { quantidade: 0 })).toHaveProperty('error');
  });

  it('"Tem parte" com menos mudas é falso com a contada', () => {
    expect(resolveDisponibilidade('parcial', completo, { quantidade: 300, recipienteId: 'tubete', alturaM: 1.2 })).toEqual({
      value: { disponivel: false, quantidadeDisponivel: 300, recipienteDisponivelId: null, alturaDisponivelM: null },
    });
  });

  it('"Tem parte" com todas, mas em outro recipiente ou outra altura, é verdadeiro com o conferido', () => {
    expect(resolveDisponibilidade('parcial', completo, { quantidade: 500, recipienteId: 'saco', alturaM: 0.8 })).toEqual({
      value: { disponivel: true, quantidadeDisponivel: null, recipienteDisponivelId: 'saco', alturaDisponivelM: 0.8 },
    });
  });

  it('"Tem parte" igual ao pedido manda usar "Tem tudo"', () => {
    const resolvida = resolveDisponibilidade('parcial', completo, { quantidade: 500, recipienteId: 'tubete', alturaM: 1.2 });
    expect(resolvida).toEqual({ error: 'Nada difere do pedido.' });
  });

  it('"Tem parte" não passa do pedido e exige a quantidade quando ela foi pedida', () => {
    expect(resolveDisponibilidade('parcial', completo, { quantidade: 600 })).toHaveProperty('error');
    expect(resolveDisponibilidade('parcial', completo, { recipienteId: 'saco' })).toHaveProperty('error');
  });

  it('"Tem parte" sem quantidade no pedido: a diferença é o recipiente ou a altura', () => {
    expect(resolveDisponibilidade('parcial', item('R'), { recipienteId: 'saco' })).toEqual({
      value: { disponivel: true, quantidadeDisponivel: null, recipienteDisponivelId: 'saco', alturaDisponivelM: null },
    });
    expect(resolveDisponibilidade('parcial', item('R'), { quantidade: 40 })).toHaveProperty('error');
  });

  it('item sem recipiente: o recipiente conferido é o que faltava, e não conta como diferença', () => {
    expect(resolveDisponibilidade('parcial', item('Q'), { quantidade: 500, recipienteId: 'saco' })).toHaveProperty('error');
    expect(resolveDisponibilidade('parcial', item('Q'), { quantidade: 200, recipienteId: 'saco' })).toEqual({
      value: { disponivel: false, quantidadeDisponivel: 200, recipienteDisponivelId: 'saco', alturaDisponivelM: null },
    });
  });

  it('item sem nada especificado não tem "Tem parte"', () => {
    expect(resolveDisponibilidade('parcial', item(''), { recipienteId: 'saco' })).toHaveProperty('error');
  });
});

describe('estadoDaResposta (P12)', () => {
  const base = {
    recipienteId: 'tubete',
    disponivel: null as boolean | null,
    quantidadeDisponivel: null as number | null,
    recipienteDisponivelId: null as string | null,
    alturaDisponivelM: null as number | null,
  };

  it('lê as quatro respostas das colunas', () => {
    expect(estadoDaResposta(base)).toBe('pendente');
    expect(estadoDaResposta({ ...base, disponivel: false, quantidadeDisponivel: 0 })).toBe('nao_tem');
    expect(estadoDaResposta({ ...base, disponivel: false, quantidadeDisponivel: 300 })).toBe('parte');
    expect(estadoDaResposta({ ...base, disponivel: true })).toBe('tudo');
    expect(estadoDaResposta({ ...base, disponivel: true, recipienteDisponivelId: 'saco' })).toBe('parte');
    expect(estadoDaResposta({ ...base, disponivel: true, alturaDisponivelM: 0.8 })).toBe('parte');
  });

  it('no item sem recipiente, o recipiente conferido não faz a resposta virar parte', () => {
    expect(estadoDaResposta({ ...base, recipienteId: null, disponivel: true, recipienteDisponivelId: 'saco' })).toBe('tudo');
  });
});

describe('validarComposicaoGenerico (P12)', () => {
  const linha = (especieId: string, quantidade: number | null, extra: { recipienteId?: string; alturaM?: number } = {}) => ({
    especieId,
    quantidade,
    recipienteId: extra.recipienteId ?? null,
    alturaM: extra.alturaM ?? null,
  });

  it('"Tem tudo" herda recipiente e altura do pai, e a soma tem de fechar', () => {
    const pai = item('QRA');
    const validada = validarComposicaoGenerico(pai, [linha('e1', 300), linha('e2', 200)]);
    expect(validada).toEqual({
      value: {
        linhas: [
          { especieId: 'e1', recipienteId: 'tubete', quantidade: 300, alturaM: 1.2 },
          { especieId: 'e2', recipienteId: 'tubete', quantidade: 200, alturaM: 1.2 },
        ],
        disponivel: true,
        quantidadeDisponivel: null,
      },
    });
    expect(validarComposicaoGenerico(pai, [linha('e1', 300)])).toEqual({ error: 'Faltam 200 mudas para fechar o item.' });
    expect(validarComposicaoGenerico(pai, [linha('e1', 600)])).toEqual({ error: 'Passou 100 mudas do que o item pede.' });
  });

  it('"Tem tudo" sem recipiente no pai exige o recipiente de cada linha', () => {
    expect(validarComposicaoGenerico(item('Q'), [linha('e1', 500)])).toEqual({ error: 'Escolha o recipiente da linha 1.' });
    expect(validarComposicaoGenerico(item('Q'), [linha('e1', 500, { recipienteId: 'saco' })])).toHaveProperty('value');
  });

  it('com quantidade no pai, a quantidade de cada linha é obrigatória', () => {
    expect(validarComposicaoGenerico(item('QR'), [linha('e1', null)])).toHaveProperty('error');
  });

  it('"Tem parte" aceita soma menor, e o pai grava quantas somou', () => {
    const validada = validarComposicaoGenerico(item('QR'), [linha('e1', 300, { recipienteId: 'tubete' })], [], 'parcial');
    expect(validada).toMatchObject({ value: { disponivel: false, quantidadeDisponivel: 300 } });
  });

  it('"Tem parte" que fecha a soma precisa de alguma diferença de recipiente ou altura', () => {
    const pai = item('QRA');
    const igual = [linha('e1', 500, { recipienteId: 'tubete', alturaM: 1.2 })];
    expect(validarComposicaoGenerico(pai, igual, [], 'parcial')).toEqual({ error: 'Nada difere do pedido.' });
    const outraAltura = [linha('e1', 500, { recipienteId: 'tubete', alturaM: 0.8 })];
    expect(validarComposicaoGenerico(pai, outraAltura, [], 'parcial')).toMatchObject({
      value: { disponivel: true, quantidadeDisponivel: null, linhas: [{ alturaM: 0.8 }] },
    });
  });

  it('lista montada (pai sem quantidade): quantidade de cada espécie é opcional', () => {
    expect(validarComposicaoGenerico(item('R'), [linha('e1', null), linha('e2', 35)])).toMatchObject({
      value: { disponivel: true, linhas: [{ quantidade: null }, { quantidade: 35 }] },
    });
    expect(validarComposicaoGenerico(item('R'), [])).toHaveProperty('error');
  });

  it('o escopo do cliente é bloqueio, e não aviso', () => {
    const recusada = validarComposicaoGenerico(item('QR'), [linha('e9', 500)], ['e1', 'e2']);
    expect(recusada).toHaveProperty('error');
    expect((recusada as { error: string }).error).toMatch(/aceita/i);
  });

  it('pai sem nada especificado não tem "Tem parte"', () => {
    expect(validarComposicaoGenerico(item(''), [linha('e1', null, { recipienteId: 'saco' })], [], 'parcial')).toHaveProperty(
      'error',
    );
  });
});

describe('estadoDoGenerico (P12)', () => {
  const pai = { ...item('QRA'), disponivel: true as boolean | null, quantidadeDisponivel: null as number | null };

  it('sai dos filhos: outro recipiente ou outra altura é parte', () => {
    expect(estadoDoGenerico(pai, [{ recipienteId: 'tubete', alturaM: 1.2 }])).toBe('tudo');
    expect(estadoDoGenerico(pai, [{ recipienteId: 'saco', alturaM: 1.2 }])).toBe('parte');
    expect(estadoDoGenerico(pai, [{ recipienteId: 'tubete', alturaM: 0.8 }])).toBe('parte');
  });

  it('pendente, não tem e parte com falta vêm do pai', () => {
    expect(estadoDoGenerico({ ...pai, disponivel: null }, [])).toBe('pendente');
    expect(estadoDoGenerico({ ...pai, disponivel: false, quantidadeDisponivel: 0 }, [])).toBe('nao_tem');
    expect(estadoDoGenerico({ ...pai, disponivel: false, quantidadeDisponivel: 300 }, [])).toBe('parte');
  });
});

describe('resolveComplemento: o "+" de "Tem parte" (P13)', () => {
  const pedido = item('QR');

  it('completa em outro recipiente até o pedido', () => {
    expect(resolveComplemento(pedido, { quantidade: 300 }, { quantidade: 200, recipienteId: 'saco' })).toEqual({
      value: { quantidade: 200, recipienteId: 'saco', alturaM: null },
    });
    expect(resolveComplemento(pedido, { quantidade: 300 }, { quantidade: 100, recipienteId: 'saco' })).toHaveProperty('value');
  });

  it('as duas linhas não passam do pedido', () => {
    expect(resolveComplemento(pedido, { quantidade: 300 }, { quantidade: 201, recipienteId: 'saco' })).toEqual({
      error: 'As duas linhas passam do pedido: são 500 mudas.',
    });
  });

  it('quantas e em que recipiente são obrigatórios', () => {
    expect(resolveComplemento(pedido, { quantidade: 300 }, { recipienteId: 'saco' })).toHaveProperty('error');
    expect(resolveComplemento(pedido, { quantidade: 300 }, { quantidade: 0, recipienteId: 'saco' })).toHaveProperty('error');
    expect(resolveComplemento(pedido, { quantidade: 300 }, { quantidade: 200 })).toEqual({
      error: 'Escolha o recipiente do complemento.',
    });
  });

  it('igual à primeira linha é recusado', () => {
    expect(resolveComplemento(pedido, { quantidade: 300 }, { quantidade: 200, recipienteId: 'tubete' })).toHaveProperty('error');
    expect(
      resolveComplemento(pedido, { quantidade: 300, recipienteId: 'saco' }, { quantidade: 200, recipienteId: 'saco' }),
    ).toHaveProperty('error');
  });

  it('com altura pedida, a outra altura no mesmo recipiente basta, e a altura vazia herda a pedida', () => {
    const comAltura = item('QRA');
    expect(resolveComplemento(comAltura, { quantidade: 300 }, { quantidade: 200, recipienteId: 'tubete', alturaM: 0.8 })).toEqual({
      value: { quantidade: 200, recipienteId: 'tubete', alturaM: 0.8 },
    });
    expect(resolveComplemento(comAltura, { quantidade: 300 }, { quantidade: 200, recipienteId: 'saco' })).toEqual({
      value: { quantidade: 200, recipienteId: 'saco', alturaM: 1.2 },
    });
  });

  it('item sem quantidade pedida não se completa', () => {
    expect(resolveComplemento(item('R'), { quantidade: 30 }, { quantidade: 20, recipienteId: 'saco' })).toHaveProperty('error');
  });
});
