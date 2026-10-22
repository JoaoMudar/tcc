// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { excluidosCitados, lerMapaCsv, trocar } from '../renumerar-lib.mjs';

const CSV = [
  '﻿tipo,antigo,novo,situacao,observacao',
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

  it('deixa intacto o que não está no mapa', () => {
    expect(trocar('UC-10, TA-10, RN-99 e RN-100', mapa)).toBe('UC-10, TA-10, RN-99 e RN-100');
  });
});

describe('excluidosCitados', () => {
  it('acha a excluída citada, uma vez só', () => {
    const { excluidos } = lerMapaCsv(CSV);
    expect(excluidosCitados('RN-21 e RN-21, mas não RN-210', excluidos)).toEqual(['RN-21']);
  });
});
