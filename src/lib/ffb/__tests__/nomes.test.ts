import { describe, expect, it } from 'vitest';
import { normalizaNomeCientifico, separarAutoria } from '../nomes';

describe('separarAutoria (RF-69)', () => {
  it.each([
    ['Luehea divaricata Mart.', 'Luehea divaricata', 'Mart.', 'ESPECIE'],
    ['Talauma ovata St. Hil.', 'Talauma ovata', 'St. Hil.', 'ESPECIE'],
    ['Inga uruguensis Hooker at Arnott', 'Inga uruguensis', 'Hooker at Arnott', 'ESPECIE'],
    ['Rapanea ferruginea (Ruiz et Pav.) Mez', 'Rapanea ferruginea', '(Ruiz et Pav.) Mez', 'ESPECIE'],
    ['Caesalpinea ferrea Mart. ex Tul. var. leiostachya Benth.', 'Caesalpinea ferrea var. leiostachya', 'Benth.', 'VARIEDADE'],
    ['Inga vera subsp. affinis (DC.) T.D.Penn.', 'Inga vera subsp. affinis', '(DC.) T.D.Penn.', 'SUB_ESPECIE'],
    ['Inga vera ssp. affinis', 'Inga vera subsp. affinis', null, 'SUB_ESPECIE'],
    ['Schinus terebinthifolia Raddi var. terebinthifolia', 'Schinus terebinthifolia var. terebinthifolia', 'Raddi', 'VARIEDADE'],
    ['Handroanthus roseo-alba (Rild.) Mattos', 'Handroanthus roseo-alba', '(Rild.) Mattos', 'ESPECIE'],
    ['Platanus × acerifolia (Aiton) Willd.', 'Platanus ×acerifolia', '(Aiton) Willd.', 'ESPECIE'],
    ['Eugenia uniflora', 'Eugenia uniflora', null, 'ESPECIE'],
  ])('%s', (nome, canonico, autoria, categoria) => {
    expect(separarAutoria(nome)).toEqual({ canonico, autoria, categoria });
  });

  it('o "f." do filho (L. f.) no fim não é forma', () => {
    expect(separarAutoria('Cedrela odorata L. f.')).toEqual({ canonico: 'Cedrela odorata', autoria: 'L. f.', categoria: 'ESPECIE' });
  });

  it('rótulo provisório volta inteiro', () => {
    expect(separarAutoria('Myrcia sp. 1').canonico).toBe('Myrcia sp. 1');
    expect(separarAutoria('Guamirim')).toEqual({ canonico: 'Guamirim', autoria: null, categoria: 'ESPECIE' });
  });
});

describe('normalizaNomeCientifico', () => {
  it('é o espelho de normaliza_nome() do banco', () => {
    expect(normalizaNomeCientifico('  Inga   VÉRA ')).toBe('inga vera');
    expect(normalizaNomeCientifico('Schinus terebinthifolia')).toBe('schinus terebinthifolia');
  });
});
