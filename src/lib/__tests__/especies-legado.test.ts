import { describe, expect, it } from 'vitest';
import { lerPlanilha } from '../carga-inicial';
import type { ResultadoConciliacao } from '../especies-conciliacao';
import {
  COLUNAS_LEGADO,
  COLUNAS_RELATORIO,
  type EntradaLegada,
  alertasDaPlanilha,
  escreverCsv,
  lerDecisao,
  lerEntradasLegadas,
  montarLinhaRelatorio,
  observacoesLegado,
  planejar,
} from '../especies-legado';

const ARVORES = [
  '﻿id;slug;nome_popular;nome_cientifico;origem;altura;floracao',
  '128;tipuana-;Tipuana ;Tipuana tipu (Benth.) Kuntze;Exótica;25-25m;outubro-dezembro',
  '77;inga-banana;Ingá-banana;Inga uruguensis Hooker at Arnott;Nativa;5-8m (10-15m na mata);',
].join('\r\n');

function entradas(): EntradaLegada[] {
  const lido = lerPlanilha(ARVORES, 'arvores', COLUNAS_LEGADO);
  if ('error' in lido) throw new Error(lido.error);
  const e = lerEntradasLegadas(lido.value);
  if ('error' in e) throw new Error(e.error);
  return e.value;
}

describe('planilha antiga (arvores.csv)', () => {
  it('lê com BOM e ponto e vírgula, e guarda os campos botânicos', () => {
    const [tipuana, inga] = entradas();
    expect(tipuana).toMatchObject({ idLegado: 128, nomePopular: 'Tipuana', nomeCsv: 'Tipuana tipu (Benth.) Kuntze', origemCsv: 'Exótica' });
    expect(tipuana.extras).toEqual({ altura: '25-25m', floracao: 'outubro-dezembro' });
    expect(inga.extras).toEqual({ altura: '5-8m (10-15m na mata)' });
  });

  it('aceita também as colunas da conciliação semente', () => {
    const lido = lerPlanilha('id_legado;nome_popular;nome_csv;origem_csv\n9;Aperta-goela;Gomidesia affinis;Nativa', 'semente', COLUNAS_LEGADO);
    if ('error' in lido) throw new Error(lido.error);
    const e = lerEntradasLegadas(lido.value);
    expect('value' in e && e.value[0]).toMatchObject({ idLegado: 9, nomeCsv: 'Gomidesia affinis', origemCsv: 'Nativa' });
  });

  it('linha sem id ou sem nome é recusada', () => {
    const lido = lerPlanilha('id;nome_popular;nome_cientifico\nx;A;B', 'arvores', COLUNAS_LEGADO);
    if ('error' in lido) throw new Error(lido.error);
    expect(lerEntradasLegadas(lido.value)).toEqual({ error: 'arvores.csv linha 2: id inválido.' });
  });

  it('os defeitos de dado são listados, e não corrigidos', () => {
    const [tipuana, inga] = entradas();
    expect(alertasDaPlanilha(tipuana, 'tipuana-')).toEqual([
      'Slug malformado: "tipuana-"',
      'Altura com mínimo igual ao máximo: "25-25m"',
    ]);
    expect(alertasDaPlanilha(inga, 'inga-banana')).toEqual(['Autoria com "at" (talvez "&" ou "et")']);
  });

  it('as observações levam o que não tem coluna própria', () => {
    expect(observacoesLegado(entradas()[0])).toBe('Altura: 25-25m.\nFloração: outubro-dezembro.\nOrigem declarada na planilha antiga: Exótica.');
    expect(observacoesLegado({ origemCsv: '', extras: {} })).toBeNull();
  });
});

describe('relatório de conciliação', () => {
  const resultado: ResultadoConciliacao = {
    situacao: 'SINONIMO',
    canonico: 'Inga uruguensis',
    autoria: 'Hooker at Arnott',
    encontrado: null,
    aceito: {
      taxonId: '23040',
      nomeCanonico: 'Inga vera subsp. affinis',
      autoria: '(DC.) T.D.Penn.',
      familia: 'Fabaceae',
      categoria: 'SUB_ESPECIE',
      origem: 'nativa',
      nativaSc: true,
    },
    alertas: [],
  };

  it('a linha diz se confere com a semente, e sai com a decisão em branco', () => {
    const linha = montarLinhaRelatorio(entradas()[1], resultado, { situacao: 'SINONIMO', taxonId: '23040' });
    expect(linha).toMatchObject({ id_legado: '77', situacao: 'SINONIMO', nome_aceito: 'Inga vera subsp. affinis', nativa_sc: 'sim', confere_semente: 'sim', decisao: '' });
    expect(montarLinhaRelatorio(entradas()[1], resultado, { situacao: 'OK', taxonId: '1' }).confere_semente).toBe('NAO');
    expect(montarLinhaRelatorio(entradas()[1], resultado, undefined).confere_semente).toBe('');
  });

  it('o CSV abre no Excel: BOM, ponto e vírgula, aspas onde precisa, comentários no topo', () => {
    const csv = escreverCsv(['a', 'b'], [{ a: 'x;y', b: 'diz "oi"' }], ['leia']);
    expect(csv).toBe('﻿# leia\r\na;b\r\n"x;y";"diz ""oi"""\r\n');
  });

  it('o relatório escrito é lido de volta pelo leitor da carga', () => {
    const linha = montarLinhaRelatorio(entradas()[1], resultado, undefined, ['um; dois']);
    const lido = lerPlanilha(escreverCsv(COLUNAS_RELATORIO, [linha], ['comentário']), 'r', ['decisao']);
    expect('value' in lido && lido.value[0]).toMatchObject({ id_legado: '77', alertas: 'um; dois', decisao: '' });
  });
});

describe('decisões (RN-67)', () => {
  it('lê as quatro decisões e recusa o resto', () => {
    expect(lerDecisao('')).toEqual({ tipo: 'vazia' });
    expect(lerDecisao(' Aceitar ')).toEqual({ tipo: 'aceitar' });
    expect(lerDecisao('manter_nome_csv')).toEqual({ tipo: 'manter_nome_csv' });
    expect(lerDecisao('usar_taxon: 10852')).toEqual({ tipo: 'usar_taxon', taxonId: '10852' });
    expect(lerDecisao('nao_importar')).toEqual({ tipo: 'nao_importar' });
    expect(lerDecisao('talvez')).toEqual({ error: 'Decisão desconhecida: "talvez".' });
  });

  it('em branco, só a linha OK entra: grafia e sinônimo esperam decisão', () => {
    expect(planejar('OK', '9094', { tipo: 'vazia' })).toEqual({ acao: 'ffb', taxonId: '9094' });
    expect(planejar('SINONIMO', '15471', { tipo: 'vazia' })).toEqual({ acao: 'pular', motivo: 'sem_decisao' });
    expect(planejar('GRAFIA', '6827', { tipo: 'vazia' })).toEqual({ acao: 'pular', motivo: 'sem_decisao' });
    expect(planejar('REVISAO_MANUAL', '', { tipo: 'vazia' })).toEqual({ acao: 'pular', motivo: 'sem_decisao' });
  });

  it('aceitar sem nome da FFB é erro; manter o nome da planilha marca a situação', () => {
    expect(planejar('NAO_ENCONTRADO', '', { tipo: 'aceitar' })).toMatchObject({ acao: 'erro' });
    expect(planejar('NAO_ENCONTRADO', '', { tipo: 'manter_nome_csv' })).toEqual({ acao: 'csv', status: 'fora_da_ffb' });
    expect(planejar('REVISAO_MANUAL', '', { tipo: 'manter_nome_csv' })).toEqual({ acao: 'csv', status: 'pendente' });
    expect(planejar('REVISAO_MANUAL', '', { tipo: 'usar_taxon', taxonId: '10852' })).toEqual({ acao: 'ffb', taxonId: '10852' });
    expect(planejar('OK', '1', { tipo: 'nao_importar' })).toEqual({ acao: 'pular', motivo: 'nao_importar' });
  });
});
