import { describe, expect, it } from 'vitest';
import {
  type EspecieParaColagem,
  casaEspecie,
  casaRecipiente,
  coeficienteDice,
  montaLinhasColadas,
  parseColagemTabular,
  parseLinhasPedido,
} from '../pedidos-colagem';

/** O catálogo de um viveiro pequeno, com sinônimo e científico, como no banco. */
const CATALOGO: EspecieParaColagem[] = [
  {
    id: 'ipe',
    nome: 'Ipê-amarelo',
    nomeCientifico: 'Handroanthus albus',
    nomesPopulares: ['Ipê-amarelo', 'Pau-d’arco-amarelo'],
  },
  { id: 'arauc', nome: 'Araucária', nomeCientifico: 'Araucaria angustifolia', nomesPopulares: ['Araucária', 'Pinheiro-do-paraná'] },
  { id: 'pit', nome: 'Pitanga', nomeCientifico: 'Eugenia uniflora', nomesPopulares: ['Pitanga'] },
  { id: 'aro', nome: 'Aroeira', nomeCientifico: 'Schinus terebinthifolia', nomesPopulares: ['Aroeira'] },
];

describe('leitura da lista colada (T8.16)', () => {
  it('número no fim, com os separadores que as pessoas escrevem', () => {
    const lidas = parseLinhasPedido('Ipê amarelo 500\npitanga - 100\nguabiroba: 150\naroeira x 30');
    expect(lidas.map((linha) => [linha.nome, linha.quantidade])).toEqual([
      ['Ipê amarelo', 500],
      ['pitanga', 100],
      ['guabiroba', 150],
      ['aroeira', 30],
    ]);
  });

  it('número no início, com e sem o "x"', () => {
    const lidas = parseLinhasPedido('200 araucária\n2x pitanga');
    expect(lidas.map((linha) => [linha.nome, linha.quantidade])).toEqual([
      ['araucária', 200],
      ['pitanga', 2],
    ]);
  });

  it('o milhar do WhatsApp vira número, com ponto ou com vírgula', () => {
    expect(parseLinhasPedido('aroeira 1.000')[0].quantidade).toBe(1000);
    expect(parseLinhasPedido('aroeira 1,000')[0].quantidade).toBe(1000);
  });

  it('a unidade grudada é ignorada, e não vira parte do nome', () => {
    for (const texto of ['ipê 500un', 'ipê 500 mudas', 'ipê 20 pçs']) {
      const [linha] = parseLinhasPedido(texto);
      expect(linha.nome).toBe('ipê');
      expect(linha.quantidade).toBeGreaterThan(0);
    }
  });

  it('o marcador de lista sai, seja traço, ponto ou número', () => {
    const lidas = parseLinhasPedido('- ipê 10\n* pitanga 20\n• aroeira 30\n1) cedro 40\n2. canela 50');
    expect(lidas.map((linha) => linha.nome)).toEqual(['ipê', 'pitanga', 'aroeira', 'cedro', 'canela']);
  });

  it('linha sem quantidade guarda o nome, para a pessoa preencher na revisão', () => {
    const [linha] = parseLinhasPedido('ipê amarelo');
    expect(linha).toMatchObject({ nome: 'ipê amarelo', quantidade: null });
  });

  it('linha vazia e linha sem letra nenhuma são descartadas', () => {
    expect(parseLinhasPedido('\n   \n123\n---\nipê 10')).toHaveLength(1);
  });

  it('guarda a linha original, para a revisão mostrar de onde a leitura veio', () => {
    expect(parseLinhasPedido('  - Ipê amarelo 500  ')[0].bruta).toBe('- Ipê amarelo 500');
  });

  it('o texto inteiro do exemplo vira cinco linhas', () => {
    const texto = '- Ipê amarelo 500\n200 araucária\n2x pitanga\n1.000 mudas de aroeira\nguabiroba: 150 un';
    expect(parseLinhasPedido(texto).map((linha) => linha.quantidade)).toEqual([500, 200, 2, 1000, 150]);
  });
});

describe('semelhança entre nomes', () => {
  it('nomes iguais valem 1 e nomes sem nada em comum valem 0', () => {
    expect(coeficienteDice('ipe', 'ipe')).toBe(1);
    expect(coeficienteDice('ipe', 'xyz')).toBe(0);
  });

  it('erro de digitação continua alto', () => {
    expect(coeficienteDice('aracuaria', 'araucaria')).toBeGreaterThan(0.6);
  });

  it('texto vazio não quebra a conta', () => {
    expect(coeficienteDice('', '')).toBe(0);
    expect(coeficienteDice('', 'ipe')).toBe(0);
  });
});

describe('casamento com o catálogo (T8.16)', () => {
  it('acento e hífen não atrapalham: "ipe amarelo" é "Ipê-amarelo"', () => {
    expect(casaEspecie('ipe amarelo', CATALOGO)).toMatchObject({ situacao: 'exata', especieId: 'ipe' });
  });

  it('plural casa com singular', () => {
    expect(casaEspecie('pitangas', CATALOGO)).toMatchObject({ situacao: 'exata', especieId: 'pit' });
  });

  it('erro de digitação vira provável, com a espécie certa pré-selecionada', () => {
    const casamento = casaEspecie('aracuaria', CATALOGO);
    expect(casamento.situacao).toBe('provavel');
    expect(casamento.especieId).toBe('arauc');
  });

  it('nome pela metade é provável, e não exato', () => {
    expect(casaEspecie('ipe', CATALOGO)).toMatchObject({ situacao: 'provavel', especieId: 'ipe' });
  });

  it('nome desconhecido não ganha sugestão nenhuma', () => {
    expect(casaEspecie('guabiroba', CATALOGO)).toMatchObject({ situacao: 'nenhuma', especieId: null });
  });

  it('casar pelo nome principal não anuncia "reconhecido por"', () => {
    expect(casaEspecie('aroeira', CATALOGO).casouPor).toBeNull();
  });

  it('o sinônimo devolve a espécie dona, e diz por qual nome reconheceu', () => {
    const casamento = casaEspecie('pinheiro do parana', CATALOGO);
    expect(casamento).toMatchObject({ situacao: 'exata', especieId: 'arauc', casouPor: 'Pinheiro-do-paraná' });
  });

  it('o científico também reconhece', () => {
    const casamento = casaEspecie('Eugenia uniflora', CATALOGO);
    expect(casamento).toMatchObject({ situacao: 'exata', especieId: 'pit', casouPor: 'Eugenia uniflora' });
  });

  it('o principal exato vence o sinônimo parecido de outra espécie', () => {
    const catalogo: EspecieParaColagem[] = [
      { id: 'a', nome: 'Cedro', nomesPopulares: ['Cedro', 'Pitangueira-brava'] },
      { id: 'b', nome: 'Pitanga', nomesPopulares: ['Pitanga'] },
    ];
    expect(casaEspecie('pitanga', catalogo).especieId).toBe('b');
  });

  it('espécie sem científico e sem sinônimo continua funcionando', () => {
    expect(casaEspecie('cedro', [{ id: 'c', nome: 'Cedro' }])).toMatchObject({ situacao: 'exata', especieId: 'c' });
  });

  it('texto vazio não casa com nada', () => {
    expect(casaEspecie('   ', CATALOGO)).toMatchObject({ situacao: 'nenhuma', especieId: null });
  });
});

describe('montaLinhasColadas', () => {
  it('junta leitura e casamento numa linha por espécie', () => {
    const linhas = montaLinhasColadas('Ipê amarelo 500\nguabiroba 150', CATALOGO);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ quantidade: 500, casamento: { situacao: 'exata', especieId: 'ipe' } });
    expect(linhas[1]).toMatchObject({ quantidade: 150, casamento: { situacao: 'nenhuma' } });
  });
});


describe('colagem vinda de planilha (T8.16)', () => {
  const RECIPIENTES = [
    { id: 'tub', nome: 'Tubete · 0,05 L' },
    { id: 's1722', nome: 'Saco 17x22 · 3 L' },
    { id: 's2026', nome: 'Saco 20x26 · 6 L' },
  ];

  it('separa as células pela tabulação, uma linha por item', () => {
    expect(parseColagemTabular('Ipê\tTubete\t1,20\t500\nPitanga\tTubete\t\t100')).toEqual([
      ['Ipê', 'Tubete', '1,20', '500'],
      ['Pitanga', 'Tubete', '', '100'],
    ]);
  });

  it('sem tabulação devolve nulo, porque aquilo é lista de conversa e não planilha', () => {
    expect(parseColagemTabular('Ipê amarelo 500\npitanga 100')).toBeNull();
  });

  it('ignora linha vazia e a quebra de linha do Windows', () => {
    expect(parseColagemTabular('Ipê\t500\r\n\r\nPitanga\t100\r\n')).toEqual([
      ['Ipê', '500'],
      ['Pitanga', '100'],
    ]);
  });

  it('linhas de tamanhos diferentes continuam sendo o que vieram', () => {
    expect(parseColagemTabular('Ipê\tTubete\nPitanga\tTubete\t0,80\t100')).toEqual([
      ['Ipê', 'Tubete'],
      ['Pitanga', 'Tubete', '0,80', '100'],
    ]);
  });

  it('o recipiente casa por igualdade e por nome contido, sem acento', () => {
    expect(casaRecipiente('Tubete · 0,05 L', RECIPIENTES)).toBe('tub');
    expect(casaRecipiente('17x22', RECIPIENTES)).toBe('s1722');
  });

  it('o que serve a mais de um recipiente não é escolhido por conta própria', () => {
    // "Saco" está nos dois: chutar aqui separaria a muda no tamanho errado
    expect(casaRecipiente('Saco', RECIPIENTES)).toBeNull();
    expect(casaRecipiente('balde', RECIPIENTES)).toBeNull();
    expect(casaRecipiente('   ', RECIPIENTES)).toBeNull();
  });
});

describe('linha longa (SEC-004)', () => {
  it('uma linha de espaços sem número no fim não trava a tela', () => {
    const inicio = performance.now();
    const lidas = parseLinhasPedido('Ipê' + ' '.repeat(5000) + 'x');
    expect(performance.now() - inicio).toBeLessThan(50);
    expect(lidas).toHaveLength(1);
    expect(lidas[0].quantidade).toBeNull();
  });

  it('a linha colada é cortada em 200 caracteres', () => {
    const [lida] = parseLinhasPedido('a'.repeat(1000));
    expect(lida.bruta).toHaveLength(200);
  });
});

/** O que interessa de cada item lido: nome, altura, preço e quantidade. */
function resumo(texto: string) {
  return parseLinhasPedido(texto).map(({ nome, alturaM, precoCentavos, quantidade }) => [
    nome,
    alturaM,
    precoCentavos,
    quantidade,
  ]);
}

describe('os formatos de lista que os clientes mandam', () => {
  const TRES = ['Ipê-amarelo', 'Guabiroba', 'Ingá'];

  it('1. completa: nome, tamanho e preço', () => {
    expect(resumo('Ipê-amarelo — 80 cm — R$ 12,00\nGuabiroba — 60 cm — R$ 10,00\nIngá — 70 cm — R$ 9,00')).toEqual([
      ['Ipê-amarelo', 0.8, 1200, null],
      ['Guabiroba', 0.6, 1000, null],
      ['Ingá', 0.7, 900, null],
    ]);
  });

  it('2. nome e tamanho', () => {
    expect(resumo('Ipê-amarelo — 80 cm\nGuabiroba — 60 cm\nIngá — 70 cm')).toEqual([
      ['Ipê-amarelo', 0.8, null, null],
      ['Guabiroba', 0.6, null, null],
      ['Ingá', 0.7, null, null],
    ]);
  });

  it('3. nome e preço', () => {
    expect(resumo('Ipê-amarelo — R$ 12,00\nGuabiroba — R$ 10,00\nIngá — R$ 9,00')).toEqual([
      ['Ipê-amarelo', null, 1200, null],
      ['Guabiroba', null, 1000, null],
      ['Ingá', null, 900, null],
    ]);
  });

  it('4. faixa de tamanho: fica o menor valor', () => {
    expect(
      resumo('Ipê-amarelo — 80–100 cm — R$ 12,00\nGuabiroba — 50–70 cm — R$ 10,00\nIngá — 60-80cm — R$ 9,00'),
    ).toEqual([
      ['Ipê-amarelo', 0.8, 1200, null],
      ['Guabiroba', 0.5, 1000, null],
      ['Ingá', 0.6, 900, null],
    ]);
    expect(resumo('Ipê 1,00 a 1,50 m')).toEqual([['Ipê', 1, null, null]]);
  });

  it('5. só nomes', () => {
    expect(resumo('Ipê-amarelo\nGuabiroba\nIngá').map(([nome]) => nome)).toEqual(TRES);
  });

  it('6. só tamanhos: linhas sem espécie, para escolher na revisão', () => {
    expect(resumo('80 cm\n60 cm\n70 cm')).toEqual([
      ['', 0.8, null, null],
      ['', 0.6, null, null],
      ['', 0.7, null, null],
    ]);
  });

  it('7. só preços: linhas sem espécie também', () => {
    expect(resumo('R$ 12,00\nR$ 10,00\nR$ 9,00')).toEqual([
      ['', null, 1200, null],
      ['', null, 1000, null],
      ['', null, 900, null],
    ]);
  });

  it('8. lista corrida completa', () => {
    expect(resumo('Ipê-amarelo — 80 cm — R$ 12,00 | Guabiroba — 60 cm — R$ 10,00 | Ingá — 70 cm — R$ 9,00')).toEqual([
      ['Ipê-amarelo', 0.8, 1200, null],
      ['Guabiroba', 0.6, 1000, null],
      ['Ingá', 0.7, 900, null],
    ]);
  });

  it('9. lista corrida só com nomes, e cada trecho guarda o seu "lido"', () => {
    const lidas = parseLinhasPedido('Ipê-amarelo | Guabiroba | Ingá');
    expect(lidas.map((linha) => linha.nome)).toEqual(TRES);
    expect(lidas.map((linha) => linha.bruta)).toEqual(TRES);
  });

  it('10. agrupada por tamanho', () => {
    expect(resumo('60 cm: Guabiroba — R$ 10,00\n70 cm: Ingá — R$ 9,00\n80 cm: Ipê-amarelo — R$ 12,00')).toEqual([
      ['Guabiroba', 0.6, 1000, null],
      ['Ingá', 0.7, 900, null],
      ['Ipê-amarelo', 0.8, 1200, null],
    ]);
  });

  it('11. agrupada por preço', () => {
    expect(resumo('R$ 9,00: Ingá\nR$ 10,00: Guabiroba\nR$ 12,00: Ipê-amarelo')).toEqual([
      ['Ingá', null, 900, null],
      ['Guabiroba', null, 1000, null],
      ['Ipê-amarelo', null, 1200, null],
    ]);
  });

  it('12. ultraenxuto: depois do tamanho, o número solto pequeno é preço', () => {
    expect(resumo('Ipê 80cm 12 | Guabiroba 60cm 10 | Ingá 70cm 9')).toEqual([
      ['Ipê', 0.8, 1200, null],
      ['Guabiroba', 0.6, 1000, null],
      ['Ingá', 0.7, 900, null],
    ]);
  });

  it('depois do tamanho, número grande ou com unidade continua quantidade', () => {
    expect(resumo('Ipê 80cm 300')).toEqual([['Ipê', 0.8, null, 300]]);
    expect(resumo('Ipê 80cm 50 mudas')).toEqual([['Ipê', 0.8, null, 50]]);
    expect(resumo('Ipê 80 cm x 20')).toEqual([['Ipê', 0.8, null, 20]]);
  });

  it('tudo junto: quantidade, tamanho e preço na mesma linha', () => {
    expect(resumo('Ipê amarelo 500 un 1,20 m R$ 15,00')).toEqual([['Ipê amarelo', 1.2, 1500, 500]]);
  });

  it('o cabeçalho sozinho na linha vale para as de baixo, até o próximo', () => {
    expect(resumo('60 cm:\nGuabiroba 100\nIngá\n80 cm:\nIpê')).toEqual([
      ['Guabiroba', 0.6, null, 100],
      ['Ingá', 0.6, null, null],
      ['Ipê', 0.8, null, null],
    ]);
  });

  it('o recipiente escrito na lista é lido, e o "17x22" não vira quantidade', () => {
    const [lida] = parseLinhasPedido('Ipê saco 17x22 80cm 300');
    expect(lida).toMatchObject({
      nome: 'Ipê',
      recipiente: 'saco 17x22',
      alturaM: 0.8,
      quantidade: 300,
    });
    expect(parseLinhasPedido('Pitanga tubete 200')[0]).toMatchObject({
      nome: 'Pitanga',
      recipiente: 'tubete',
      quantidade: 200,
    });
  });

  it('"mudas" não é lido como metro', () => {
    expect(resumo('Pitanga 500 mudas')).toEqual([['Pitanga', null, null, 500]]);
  });

  it('para no teto de itens de um envio', () => {
    expect(parseLinhasPedido(Array.from({ length: 500 }, () => 'ipê').join(' | '))).toHaveLength(200);
  });
});

describe('recipiente da lista casado com o cadastro', () => {
  const RECIPIENTES = [
    { id: 'tub', nome: 'Tubete · 0,29 L' },
    { id: 's1722', nome: 'Saco 17x22 · 3 L' },
    { id: 's2026', nome: 'Saco 20x26 · 5 L' },
  ];

  it('reconhece o recipiente escrito e deixa em branco o que não veio', () => {
    const linhas = montaLinhasColadas('Ipê 17x22 300\nPitanga tubete 100\nAroeira 50', CATALOGO, RECIPIENTES);
    expect(linhas.map((linha) => linha.recipienteId)).toEqual(['s1722', 'tub', null]);
  });
});
