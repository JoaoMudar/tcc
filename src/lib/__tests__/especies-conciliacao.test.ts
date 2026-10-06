import { describe, expect, it, vi } from 'vitest';
import {
  type CandidatoFfb,
  type TaxonAceito,
  alertasDeOrigem,
  conciliarNome,
  escolherAproximado,
  escolherHomonimo,
  lerOrigemDeclarada,
  normalizaAutoria,
} from '../especies-conciliacao';
import type { Db } from '../sql';

const C = (c: Partial<CandidatoFfb> & { taxonId: string }): CandidatoFfb => ({
  nomeCanonico: 'Passiflora alata',
  autoria: null,
  situacao: 'NOME_ACEITO',
  aceitoTaxonId: null,
  similaridade: 1,
  ...c,
});

const ACEITO: TaxonAceito = {
  taxonId: '1',
  nomeCanonico: 'Handroanthus impetiginosus',
  autoria: '(Mart. ex DC.) Mattos',
  familia: 'Bignoniaceae',
  categoria: 'ESPECIE',
  origem: 'nativa',
  nativaSc: false,
};

describe('homônimos (RF-69)', () => {
  it('desempata pela autoria, sem pontuação nem espaço', () => {
    const curtis = C({ taxonId: '9', autoria: 'Curtis' });
    const aiton = C({ taxonId: '10', autoria: 'Aiton', situacao: 'SEM_SITUACAO' });
    expect(escolherHomonimo([aiton, curtis], 'Curtis')).toBe(curtis);
    expect(normalizaAutoria('(A. St.-Hil.) Spreng')).toBe(normalizaAutoria('(A.St.-Hil.) Spreng.'));
  });

  it('sem autoria que decida, vale o único com situação na FFB', () => {
    const curtis = C({ taxonId: '9', autoria: 'Curtis' });
    const aiton = C({ taxonId: '10', autoria: 'Aiton', situacao: 'SEM_SITUACAO' });
    expect(escolherHomonimo([aiton, curtis], null)).toBe(curtis);
  });

  it('dois sinônimos que levam ao mesmo aceito não são dúvida', () => {
    const a = C({ taxonId: '25615', situacao: 'SINONIMO', aceitoTaxonId: '25614' });
    const b = C({ taxonId: '614097', situacao: 'SINONIMO', aceitoTaxonId: '25614' });
    expect(escolherHomonimo([a, b], 'Nees')).toBe(a);
  });

  it('dois aceitos de autoria diferente são dúvida', () => {
    expect(escolherHomonimo([C({ taxonId: '1', autoria: 'A' }), C({ taxonId: '2', autoria: 'B' })], 'C')).toBeNull();
  });
});

describe('grafia', () => {
  it('o melhor aproximado vale se for claramente melhor que o segundo', () => {
    const certo = C({ taxonId: '1', similaridade: 0.8 });
    expect(escolherAproximado([C({ taxonId: '2', similaridade: 0.35 }), certo])).toBe(certo);
  });

  it('dois parecidos demais são dúvida; parecido de menos é nada', () => {
    expect(escolherAproximado([C({ taxonId: '1', similaridade: 0.8 }), C({ taxonId: '2', similaridade: 0.75 })])).toBe('duvida');
    expect(escolherAproximado([C({ taxonId: '1', similaridade: 0.5 })])).toBeNull();
    expect(escolherAproximado([])).toBeNull();
  });
});

describe('origem declarada', () => {
  it('lê o texto da planilha', () => {
    expect(lerOrigemDeclarada('Nativa')).toBe('nativa');
    expect(lerOrigemDeclarada(' Exótica ')).toBe('exotica');
    expect(lerOrigemDeclarada('')).toBeNull();
  });

  it('a divergência vira alerta, e a nativa do Brasil que não é de SC também', () => {
    expect(alertasDeOrigem('nativa', ACEITO)).toEqual(['Segundo a FFB, não ocorre nativa em SC']);
    expect(alertasDeOrigem('nativa', { ...ACEITO, origem: 'exotica' })).toEqual(['A planilha diz nativa; a FFB diz exótica no Brasil']);
    expect(alertasDeOrigem('exotica', { ...ACEITO, origem: 'nativa' })).toEqual(['A planilha diz exótica; a FFB diz nativa do Brasil']);
    expect(alertasDeOrigem('nativa', { ...ACEITO, nativaSc: true })).toEqual([]);
    expect(alertasDeOrigem(null, ACEITO)).toEqual([]);
  });
});

describe('conciliarNome', () => {
  /** Banco falso: exatos, aproximados e a ficha de cada táxon */
  function banco(exatos: CandidatoFfb[], aproximados: CandidatoFfb[], fichas: Record<string, object>): Db {
    return {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('nome_normalizado = normaliza_nome')) return { rows: exatos };
        if (sql.includes('similarity(')) return { rows: aproximados };
        if (sql.includes('WHERE t.taxon_id = $1')) {
          const ficha = fichas[String(params[0])];
          return { rows: ficha ? [ficha] : [] };
        }
        throw new Error(sql);
      }),
    } as unknown as Db;
  }
  const ficha = (taxonId: string, nomeCanonico: string, extra: object = {}) => ({
    taxonId,
    nomeCanonico,
    autoria: null,
    familia: 'X',
    categoria: 'ESPECIE',
    origem: 'nativa',
    nativaSc: true,
    situacao: 'NOME_ACEITO',
    aceitoTaxonId: null,
    ...extra,
  });

  it('nome aceito: OK, com a autoria separada', async () => {
    const db = banco([C({ taxonId: '9094', nomeCanonico: 'Luehea divaricata' })], [], { 9094: ficha('9094', 'Luehea divaricata') });
    const r = await conciliarNome(db, 'Luehea divaricata Mart.');
    expect(r).toMatchObject({ situacao: 'OK', canonico: 'Luehea divaricata', autoria: 'Mart.', aceito: { taxonId: '9094' } });
  });

  it('sinônimo: leva ao aceito', async () => {
    const db = banco([C({ taxonId: '4401', situacao: 'SINONIMO', aceitoTaxonId: '15471' })], [], {
      4401: ficha('4401', 'Schinus terebinthifolius', { situacao: 'SINONIMO', aceitoTaxonId: '15471' }),
      15471: ficha('15471', 'Schinus terebinthifolia'),
    });
    const r = await conciliarNome(db, 'Schinus terebinthifolius Raddi');
    expect(r).toMatchObject({ situacao: 'SINONIMO', aceito: { taxonId: '15471', nomeCanonico: 'Schinus terebinthifolia' } });
  });

  it('grafia errada que também é nome antigo: GRAFIA, com o alerta', async () => {
    const db = banco([], [C({ taxonId: '114097', nomeCanonico: 'Handroanthus roseo-albus', situacao: 'SINONIMO', aceitoTaxonId: '114338', similaridade: 0.85 })], {
      114097: ficha('114097', 'Handroanthus roseo-albus', { situacao: 'SINONIMO', aceitoTaxonId: '114338' }),
      114338: ficha('114338', 'Tabebuia roseoalba'),
    });
    const r = await conciliarNome(db, 'Handroanthus roseo-alba (Rild.) Mattos');
    expect(r.situacao).toBe('GRAFIA');
    expect(r.aceito?.nomeCanonico).toBe('Tabebuia roseoalba');
    expect(r.alertas[0]).toMatch(/também é nome antigo/);
  });

  it('o nome existe sem nome aceito: revisão manual, dizendo qual registro achou', async () => {
    const db = banco([C({ taxonId: '63438', nomeCanonico: 'Myrciaria trunciflora', situacao: 'SINONIMO' })], [], {});
    const r = await conciliarNome(db, 'Myrciaria trunciflora Berg');
    expect(r.situacao).toBe('REVISAO_MANUAL');
    expect(r.alertas[0]).toMatch(/taxon 63438/);
  });

  it('nada parecido: não encontrado', async () => {
    const r = await conciliarNome(banco([], [], {}), 'Eugenia reinwardtiana (Blume) DC.');
    expect(r).toMatchObject({ situacao: 'NAO_ENCONTRADO', aceito: null });
  });

  it('o alerta de origem entra junto', async () => {
    const db = banco([C({ taxonId: '1' })], [], { 1: ficha('1', 'Psidium guajava', { origem: 'exotica', nativaSc: false }) });
    const r = await conciliarNome(db, 'Psidium guajava L.', 'nativa');
    expect(r.alertas).toEqual(['A planilha diz nativa; a FFB diz exótica no Brasil']);
  });
});
