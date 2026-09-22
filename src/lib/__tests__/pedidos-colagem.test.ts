import { describe, expect, it } from 'vitest';
import {
  type EspecieParaColagem,
  casaEspecie,
  coeficienteDice,
  montaLinhasColadas,
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
