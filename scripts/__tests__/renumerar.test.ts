// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { comporFaixa, excluidosCitados, lerMapaCsv, trocar } from '../renumerar-lib.mjs';

const CSV = [
  '\uFEFFtipo,antigo,novo,situacao,observacao',
  'RN,RN-10,RN-19,renumerada,',
  'RN,RN-19,RN-14,renumerada,',
  'RN,RN-14,RN-10,renumerada,',
  'RN,RN-21,,excluida,Excluída (linha em branco)',
  'RNF,RNF-10,RNF-14,renumerada,',
  'RF,RF-18,RF-18,igual,',
].join('\r\n');

describe('lerMapaCsv', () => {
  it('lê o CSV com BOM e quebra do Windows, e separa as excluídas', () => {
    const { mapa, excluidos } = lerMapaCsv(CSV);
    expect(mapa.get('RN-10')).toBe('RN-19');
    expect(mapa.get('RF-18')).toBe('RF-18');
    expect(mapa.has('RN-21')).toBe(false);
    expect([...excluidos]).toEqual(['RN-21']);
  });

  it('recusa dois antigos com o mesmo destino', () => {
    expect(() => lerMapaCsv('tipo,antigo,novo,situacao\nRN,RN-01,RN-02,renumerada\nRN,RN-03,RN-02,renumerada')).toThrow(/RN-02/);
  });

  it('recusa linha sem destino que não seja exclusão', () => {
    expect(() => lerMapaCsv('tipo,antigo,novo,situacao\nRN,RN-01,,renumerada')).toThrow(/sem código novo/);
  });

  it('recusa arquivo sem o cabeçalho esperado', () => {
    expect(() => lerMapaCsv('a,b,c\nRN,RN-01,RN-02')).toThrow(/cabeçalho/);
  });
});

describe('trocar', () => {
  const { mapa } = lerMapaCsv(CSV);

  it('não encadeia trocas que se cruzam', () => {
    expect(trocar('RN-10, RN-19 e RN-14', mapa)).toBe('RN-19, RN-14 e RN-10');
  });

  it('não confunde RNF com RN', () => {
    expect(trocar('RNF-10 e RN-10', mapa)).toBe('RNF-14 e RN-19');
  });

  it('preserva NUL que já estava no texto', () => {
    expect(trocar('a\u0000b RN-10', mapa)).toBe('a\u0000b RN-19');
  });

  it('deixa intacto o que não está no mapa', () => {
    expect(trocar('UC-10, TA-10, RN-99 e RN-100', mapa)).toBe('UC-10, TA-10, RN-99 e RN-100');
  });
});

describe('trocar: faixas', () => {
  const { mapa } = lerMapaCsv(
    [
      'tipo,antigo,novo,situacao,observacao',
      'RF,RF-01,RF-01,igual,',
      'RF,RF-02,RF-05,renumerada,',
      'RF,RF-03,RF-02,renumerada,',
      'RF,RF-04,RF-03,renumerada,',
      'RF,RF-05,RF-04,renumerada,',
      'RF,RF-06,,excluida,',
      'RF,RF-07,RF-09,renumerada,',
    ].join('\n'),
  );

  it('faixa que continua contígua sai como faixa', () => {
    expect(trocar('(RF-01 a RF-05)', mapa)).toBe('(RF-01 a RF-05)');
  });

  it('faixa que se parte vira lista, sem o excluído', () => {
    expect(trocar('RF-04 a RF-07', mapa)).toBe('RF-03, RF-04, RF-09');
  });

  it('mantém o conectivo "até"', () => {
    expect(trocar('RF-03 até RF-05', mapa)).toBe('RF-02 até RF-04');
  });
});

describe('comporFaixa', () => {
  it('junta três ou mais seguidos e lista o resto', () => {
    expect(comporFaixa(['RF-06', 'RF-01', 'RF-02', 'RF-03', 'RF-05'])).toBe('RF-01 a RF-03, RF-05, RF-06');
  });

  it('um código só sai sozinho', () => {
    expect(comporFaixa(['RN-07'])).toBe('RN-07');
  });
});

describe('excluidosCitados', () => {
  it('acha a excluída citada, uma vez só', () => {
    const { excluidos } = lerMapaCsv(CSV);
    expect(excluidosCitados('RN-21 e RN-21, mas não RN-210', excluidos)).toEqual(['RN-21']);
  });
});
