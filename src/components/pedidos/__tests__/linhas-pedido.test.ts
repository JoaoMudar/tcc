import { describe, expect, it } from 'vitest';
import type { EspecieParaColagem, RecipienteParaColagem } from '@/lib/pedidos-colagem';
import { chaveSaldo, saldoDoItem } from '@/lib/pedidos-rotulos';
import {
  type Linha,
  aplicarColagemTabular,
  conferenciaDoItem,
  confirmadaNaVerificacao,
  especiesDoGrupo,
  estaVazia,
  faltaNoItem,
  faltantesDoPedido,
  linhaVazia,
  montarSaldos,
  proximaChave,
  resumoDaConferencia,
  textoSaldo,
} from '../linhas-pedido';

const ESPECIES: EspecieParaColagem[] = [
  { id: 'ipe', nome: 'Ipê-amarelo', nomeCientifico: 'Handroanthus albus', nomesPopulares: ['Ipê-amarelo'] },
  { id: 'pit', nome: 'Pitanga', nomeCientifico: 'Eugenia uniflora', nomesPopulares: ['Pitanga'] },
];

const RECIPIENTES: RecipienteParaColagem[] = [
  { id: 'tub', nome: 'Tubete · 0,05 L' },
  { id: 's1722', nome: 'Saco 17x22 · 3 L' },
];

const DO_ZERO = { linha: 0, coluna: 0 };

function colar(linhas: readonly Linha[], celulas: string[][], inicio = DO_ZERO) {
  return aplicarColagemTabular(linhas, inicio, celulas, ESPECIES, RECIPIENTES);
}

describe('linhas da planilha de itens (T8.1)', () => {
  it('a linha nova nasce vazia, e a chave nunca repete', () => {
    const linhas = [linhaVazia(1), linhaVazia(2)];
    expect(estaVazia(linhas[0])).toBe(true);
    expect(proximaChave(linhas)).toBe(3);
  });

  it('a linha com altura e mais nada já não está vazia', () => {
    expect(estaVazia({ ...linhaVazia(1), altura: '1,20' })).toBe(false);
  });
});

describe('colagem de planilha nas células (T8.16)', () => {
  it('as quatro colunas caem na ordem da tela, a partir da primeira célula', () => {
    const [linha] = colar([linhaVazia(1)], [['Ipê-amarelo', 'Tubete', '1,20', '500']]);
    expect(linha).toMatchObject({ especieId: 'ipe', recipienteId: 'tub', altura: '1,20 m', quantidade: '500' });
  });

  it('o que passa do fim da tabela vira linha nova', () => {
    const linhas = colar([linhaVazia(1)], [['Ipê-amarelo'], ['Pitanga'], ['Ipê-amarelo']]);
    expect(linhas).toHaveLength(3);
    expect(linhas.map((linha) => linha.chave)).toEqual([1, 2, 3]);
  });

  it('colando no meio da tabela, as colunas andam com o foco', () => {
    const [linha] = colar([{ ...linhaVazia(1), especieId: 'pit' }], [['0,80', '300']], { linha: 0, coluna: 2 });
    // A espécie que já estava não é apagada: a colagem começou na altura
    expect(linha).toMatchObject({ especieId: 'pit', altura: '0,80 m', quantidade: '300' });
  });

  it('a espécie que o catálogo não reconhece fica em branco, e não é chutada', () => {
    const [linha] = colar([linhaVazia(1)], [['Espécie que não existe', 'Tubete', '', '10']]);
    expect(linha.especieId).toBe('');
    expect(linha.recipienteId).toBe('tub');
  });

  it('o milhar da planilha vira número limpo, e a altura vira "1,20 m"', () => {
    const [linha] = colar([linhaVazia(1)], [['Pitanga', 'Saco 17x22 · 3 L', '1.2', '1.000']]);
    expect(linha).toMatchObject({ altura: '1,20 m', quantidade: '1000' });
  });

  it('o que não dá para entender fica na célula como veio, para a pessoa corrigir', () => {
    const [linha] = colar([linhaVazia(1)], [['Pitanga', 'Tubete', 'grande', 'meia dúzia']]);
    expect(linha).toMatchObject({ altura: 'grande', quantidade: 'meia dúzia' });
  });

  it('célula vazia não apaga o que já estava na linha', () => {
    const antes: Linha = { ...linhaVazia(1), especieId: 'ipe', recipienteId: 'tub', altura: '1,20', quantidade: '50' };
    const [linha] = colar([antes], [['', '', '', '80']]);
    expect(linha).toMatchObject({ especieId: 'ipe', recipienteId: 'tub', altura: '1,20', quantidade: '80' });
  });

  it('colar espécie no item genérico o torna específico, porque agora ele tem espécie', () => {
    const [linha] = colar([{ ...linhaVazia(1), generico: true }], [['Pitanga']]);
    expect(linha).toMatchObject({ generico: false, especieId: 'pit' });
  });
});

describe('estoque disponível no item (RF-56, RN-06, RN-62)', () => {
  const faixas = [
    { especieId: 'ipe', recipienteId: 'tub', alturaM: 1.2, quantidade: 100 },
    { especieId: 'ipe', recipienteId: 'tub', alturaM: 1, quantidade: 30 },
    { especieId: 'ipe', recipienteId: 'tub', alturaM: null, quantidade: 40 },
    { especieId: 'ipe', recipienteId: 'saco', alturaM: 0.5, quantidade: 7 },
  ];

  it('agrupa as faixas de altura por par espécie e recipiente', () => {
    const saldos = montarSaldos(faixas);
    expect(saldos[chaveSaldo('ipe', 'tub')]).toHaveLength(3);
    expect(saldos[chaveSaldo('ipe', 'saco')]).toEqual([{ alturaM: 0.5, quantidade: 7 }]);
  });

  it('sem falta, diz só o disponível', () => {
    expect(textoSaldo({ disponivel: 170, abaixo: 0, semAltura: 0 }, 100)).toBe('Disponível: 170');
    expect(textoSaldo({ disponivel: 170, abaixo: 30, semAltura: 40 }, null)).toBe('Disponível: 170');
  });

  it('faltando, diz quanto falta, quanto há até 20 cm abaixo e quanto não foi medido', () => {
    const saldo = saldoDoItem(montarSaldos(faixas)[chaveSaldo('ipe', 'tub')], 1.2);
    expect(textoSaldo(saldo, 150)).toBe('Disponível: 100 · faltam 50 · 30 com até 20 cm a menos · 40 sem altura medida');
  });

  it('depois da verificação, falta o pedido menos o que ela contou, e não menos o saldo', () => {
    const vazio = { disponivel: 0, abaixo: 0, semAltura: 0 };
    expect(textoSaldo(vazio, 10, 3)).toBe('Disponível: 0 · faltam 7');
    expect(textoSaldo(vazio, 10, 10)).toBe('Disponível: 0');
    expect(textoSaldo({ ...vazio, disponivel: 50 }, 10, 3)).toBe('Disponível: 50 · faltam 7');
    expect(faltaNoItem(vazio, 10, null)).toBe(10);
  });

  it('a verificação dá número só ao item que ela olhou e contou', () => {
    const item = { generico: false, quantidade: 10 };
    expect(confirmadaNaVerificacao({ ...item, disponivel: null })).toBeNull();
    expect(confirmadaNaVerificacao({ ...item, disponivel: false, quantidadeDisponivel: 3 })).toBe(3);
    expect(confirmadaNaVerificacao({ ...item, disponivel: false, quantidadeDisponivel: 0 })).toBe(0);
    expect(confirmadaNaVerificacao({ ...item, disponivel: true })).toBe(10);
    expect(confirmadaNaVerificacao({ ...item, generico: true, disponivel: true })).toBeNull();
  });
});

describe('grupo de espécies do genérico (T8.7)', () => {
  const grupo = [
    { chave: 1, especieId: 'ipe' },
    { chave: 2, especieId: '' },
    { chave: 3, especieId: 'pit' },
    { chave: 4, especieId: 'ipe' },
  ];

  it('vai ao servidor sem linha em branco e sem repetida', () => {
    expect(especiesDoGrupo({ generico: true, grupo })).toEqual(['ipe', 'pit']);
  });

  it('fora do genérico o grupo não vale', () => {
    expect(especiesDoGrupo({ generico: false, grupo })).toEqual([]);
  });

  it('colar uma espécie na linha genérica desfaz o grupo junto', () => {
    const linhas: Linha[] = [{ ...linhaVazia(1), generico: true, grupo }];
    const [linha] = colar(linhas, [['Pitanga']]);
    expect(linha.generico).toBe(false);
    expect(linha.grupo).toEqual([]);
  });
});

describe('o que a verificação achou, por item', () => {
  const base = {
    id: 'a',
    generico: false,
    quantidade: 50,
    recipienteId: 't',
    alturaM: null,
    disponivel: null as boolean | null,
    quantidadeDisponivel: null as number | null,
    recipienteDisponivelId: null,
    alturaDisponivelM: null,
  };

  it('sem resposta não pinta; tem, parte e não tem pintam', () => {
    expect(conferenciaDoItem(base, [base])).toBeNull();
    expect(conferenciaDoItem({ ...base, disponivel: true }, [])).toBe('tudo');
    expect(conferenciaDoItem({ ...base, disponivel: false, quantidadeDisponivel: 30 }, [])).toBe('parte');
    expect(conferenciaDoItem({ ...base, disponivel: false, quantidadeDisponivel: 0 }, [])).toBe('nao_tem');
  });

  it('o complemento e a espécie do genérico são o que tem', () => {
    const principal = { ...base, disponivel: false, quantidadeDisponivel: 30 };
    const complemento = { ...base, id: 'c', complementaItemId: 'a', disponivel: true };
    expect(conferenciaDoItem(complemento, [principal, complemento])).toBe('tudo');
    const filho = { ...base, id: 'f', itemPaiId: 'g' };
    expect(conferenciaDoItem(filho, [filho])).toBe('tudo');
  });

  it('o genérico sai dos filhos', () => {
    const generico = { ...base, id: 'g', generico: true, recipienteId: null, disponivel: true };
    const filho = { ...base, id: 'f', itemPaiId: 'g' };
    expect(conferenciaDoItem(generico, [generico, filho])).toBe('tudo');
    expect(conferenciaDoItem({ ...generico, disponivel: false, quantidadeDisponivel: 0 }, [])).toBe('nao_tem');
  });

  it('a frase diz o que foi achado, e onde', () => {
    expect(resumoDaConferencia('nao_tem', base)).toBe('Verificação: não tem');
    expect(resumoDaConferencia('tudo', base)).toBe('Verificação: tem 50');
    expect(
      resumoDaConferencia('parte', { ...base, quantidadeDisponivel: 30, recipienteDisponivel: 'Saco 17x22', alturaDisponivelM: 1.2 }),
    ).toBe('Verificação: tem 30 em Saco 17x22 · 1,20 m');
    expect(resumoDaConferencia('tudo', { ...base, generico: true }, 3)).toBe('Verificação: montado com 3 espécies');
  });
});

describe('copiar faltantes', () => {
  // Ids de recipiente: s2026 é o 20x26 pedido, s1722 o achado na verificação
  const ipe = {
    id: 'i',
    generico: false,
    especie: 'Ipê' as string | null,
    especificacao: null as string | null,
    itemPaiId: null as string | null,
    complementaItemId: null as string | null,
    quantidade: 10 as number | null,
    recipienteId: 's2026' as string | null,
    alturaM: null as number | null,
    disponivel: null as boolean | null,
    quantidadeDisponivel: null as number | null,
    recipienteDisponivelId: null as string | null,
    alturaDisponivelM: null as number | null,
  };
  const naoTem = { disponivel: false, quantidadeDisponivel: 0 };
  const generico = { ...ipe, id: 'g', generico: true, especie: null, especificacao: 'mudas nativas', recipienteId: null };
  const faltantes = (...itens: (typeof ipe & { suplente?: boolean })[]) => faltantesDoPedido(itens);

  it('1. não tem: quantidade, espécie e altura pedidas', () => {
    expect(faltantes({ ...ipe, alturaM: 1.2, ...naoTem })).toEqual(['10 - Ipê - 1,20 m']);
  });

  it('2. não tem, sem altura no pedido', () => {
    expect(faltantes({ ...ipe, ...naoTem })).toEqual(['10 - Ipê']);
  });

  it('3. não tem, sem quantidade nem altura', () => {
    expect(faltantes({ ...ipe, quantidade: null, ...naoTem })).toEqual(['Ipê']);
  });

  it('4. não tem, sem quantidade e com altura', () => {
    expect(faltantes({ ...ipe, quantidade: null, alturaM: 1.2, ...naoTem })).toEqual(['Ipê - 1,20 m']);
  });

  it('5. tem parte: 6 das 10', () => {
    expect(faltantes({ ...ipe, alturaM: 1.2, disponivel: false, quantidadeDisponivel: 6 })).toEqual([
      '4 - Ipê - 1,20 m',
    ]);
  });

  it('6. tem parte: 6 das 10 em outro recipiente', () => {
    expect(faltantes({ ...ipe, disponivel: false, quantidadeDisponivel: 6, recipienteDisponivelId: 's1722' })).toEqual([
      '4 - Ipê',
    ]);
  });

  it('7. tem parte: as 10, em altura menor, não falta', () => {
    expect(faltantes({ ...ipe, alturaM: 1.2, disponivel: true, alturaDisponivelM: 1 })).toEqual([]);
  });

  it('8. tem parte: as 10, em outro recipiente, não falta', () => {
    expect(faltantes({ ...ipe, disponivel: true, recipienteDisponivelId: 's1722' })).toEqual([]);
  });

  it('9. tem parte: 6 das 10, pedido sem recipiente', () => {
    expect(
      faltantes({ ...ipe, recipienteId: null, disponivel: false, quantidadeDisponivel: 6, recipienteDisponivelId: 's1722' }),
    ).toEqual(['4 - Ipê']);
  });

  it('10. tem parte: 6 e o complemento de 4 fecham o pedido', () => {
    const principal = { ...ipe, disponivel: false, quantidadeDisponivel: 6 };
    const complemento = { ...ipe, id: 'c', complementaItemId: 'i', quantidade: 4, recipienteId: 's1722', disponivel: true };
    expect(faltantes(principal, complemento)).toEqual([]);
  });

  it('11. tem parte: 5 e o complemento de 3, faltam 2', () => {
    const principal = { ...ipe, disponivel: false, quantidadeDisponivel: 5 };
    const complemento = { ...ipe, id: 'c', complementaItemId: 'i', quantidade: 3, recipienteId: 's1722', disponivel: true };
    expect(faltantes(principal, complemento)).toEqual(['2 - Ipê']);
  });

  it('12. tem tudo dividido em dois recipientes não falta', () => {
    const principal = {
      ...ipe,
      recipienteId: null,
      disponivel: false,
      quantidadeDisponivel: 6,
      recipienteDisponivelId: 's2026',
    };
    const complemento = { ...ipe, id: 'c', complementaItemId: 'i', quantidade: 4, recipienteId: 's1722', disponivel: true };
    expect(faltantes(principal, complemento)).toEqual([]);
  });

  it('13. tem tudo não falta', () => {
    expect(faltantes({ ...ipe, disponivel: true })).toEqual([]);
  });

  it('14. tem parte sem quantidade pedida não falta', () => {
    expect(faltantes({ ...ipe, quantidade: null, disponivel: true, recipienteDisponivelId: 's1722' })).toEqual([]);
  });

  it('15. item ainda não verificado não entra', () => {
    expect(faltantes(ipe)).toEqual([]);
  });

  it('16. a quantidade sai com o milhar separado', () => {
    expect(faltantes({ ...ipe, quantidade: 1500, ...naoTem })).toEqual(['1.500 - Ipê']);
  });

  it('17. genérico que não tem', () => {
    expect(faltantes({ ...generico, quantidade: 500, ...naoTem })).toEqual(['500 - Genérico: mudas nativas']);
  });

  it('18. genérico composto com 300 das 500', () => {
    const pai = { ...generico, quantidade: 500, alturaM: 1.2, disponivel: false, quantidadeDisponivel: 300 };
    const filho = { ...ipe, id: 'f', itemPaiId: 'g', quantidade: 300, alturaM: 1.2 };
    expect(faltantes(pai, filho)).toEqual(['200 - Genérico: mudas nativas - 1,20 m']);
  });

  it('19. genérico sem observação e sem quantidade', () => {
    expect(faltantes({ ...generico, especificacao: null, quantidade: null, ...naoTem })).toEqual(['Genérico']);
  });

  it('20. o pedido inteiro, na ordem da grade, sem o suplente', () => {
    const itens = [
      { ...ipe, id: 'a', alturaM: 1.2, ...naoTem },
      { ...ipe, id: 'b', especie: 'Pitanga', disponivel: true },
      { ...ipe, id: 'c', especie: 'Araçá', alturaM: 1.2, disponivel: false, quantidadeDisponivel: 6 },
      { ...ipe, id: 's', especie: 'Ingá', complementaItemId: 'c', suplente: true, ...naoTem },
    ];
    expect(faltantes(...itens)).toEqual(['10 - Ipê - 1,20 m', '4 - Araçá - 1,20 m']);
  });

  it('21. pedido só com "tem tudo" não tem faltante', () => {
    expect(faltantes({ ...ipe, disponivel: true }, { ...ipe, id: 'b', disponivel: true })).toEqual([]);
  });
});
