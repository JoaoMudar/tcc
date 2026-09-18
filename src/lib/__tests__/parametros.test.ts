import { describe, expect, it } from 'vitest';
import {
  ATENCAO,
  CRITICO,
  MORTALIDADE,
  type TipoValor,
  parametroLabel,
  sortParametros,
  validateParametros,
  validateValor,
} from '../parametros';

const EXISTENTES: { chave: string; tipoValor: TipoValor; descricao: string }[] = [
  { chave: ATENCAO, tipoValor: 'numero', descricao: 'atencao' },
  { chave: CRITICO, tipoValor: 'numero', descricao: 'critico' },
  { chave: MORTALIDADE, tipoValor: 'numero', descricao: 'mortalidade' },
];

const VALIDOS = { [ATENCAO]: '0', [CRITICO]: '3', [MORTALIDADE]: '20' };

describe('validateValor', () => {
  it('numero aceita inteiro, decimal e vírgula', () => {
    expect(validateValor('numero', ' 30 ')).toEqual({ value: '30' });
    expect(validateValor('numero', '2,5')).toEqual({ value: '2.5' });
    expect(validateValor('numero', 'vinte')).toHaveProperty('error');
  });

  it('booleano só true ou false', () => {
    expect(validateValor('booleano', 'true')).toEqual({ value: 'true' });
    expect(validateValor('booleano', 'sim')).toHaveProperty('error');
  });

  it('data precisa existir no calendário', () => {
    expect(validateValor('data', '2026-02-28')).toEqual({ value: '2026-02-28' });
    expect(validateValor('data', '2026-02-30')).toHaveProperty('error');
  });

  it('texto não pode ser vazio', () => {
    expect(validateValor('texto', '  ')).toHaveProperty('error');
    expect(validateValor('texto', 'ok')).toEqual({ value: 'ok' });
  });
});

describe('validateParametros (RF-09)', () => {
  it('aceita os três valores do F1', () => {
    expect(validateParametros(EXISTENTES, VALIDOS)).toEqual({ value: VALIDOS });
  });

  it('TA-07: alterar a mortalidade para 30% passa', () => {
    expect(validateParametros(EXISTENTES, { ...VALIDOS, [MORTALIDADE]: '30' })).toEqual({
      value: { ...VALIDOS, [MORTALIDADE]: '30' },
    });
  });

  it('recusa chave que não existe no banco: ninguém cria parâmetro', () => {
    expect(validateParametros(EXISTENTES, { ...VALIDOS, 'producao.novo': '1' })).toEqual({
      error: 'Parâmetro desconhecido. Não é possível criar parâmetro.',
    });
  });

  it('recusa formulário sem uma das chaves', () => {
    const semCritico = Object.fromEntries(Object.entries(VALIDOS).filter(([chave]) => chave !== CRITICO));
    expect(validateParametros(EXISTENTES, semCritico)).toEqual({ error: 'Falta o valor de "Atraso: crítico".' });
  });

  it('percentual fora de 0 a 100, decimal ou negativo é recusado', () => {
    for (const valor of ['101', '-1', '20.5']) {
      expect(validateParametros(EXISTENTES, { ...VALIDOS, [MORTALIDADE]: valor }), valor).toEqual({
        error: '"Limite de mortalidade" precisa ser um número inteiro de 0 a 100.',
      });
    }
  });

  it('crítico igual ou abaixo de atenção é recusado', () => {
    expect(validateParametros(EXISTENTES, { ...VALIDOS, [ATENCAO]: '3', [CRITICO]: '3' })).toEqual({
      error: 'O atraso crítico precisa ser maior que o atraso de atenção.',
    });
  });

  it('chave sem rótulo conhecido só passa pela validação do tipo', () => {
    const existentes = [...EXISTENTES, { chave: 'outro.flag', tipoValor: 'booleano' as const, descricao: 'Uma flag' }];
    expect(validateParametros(existentes, { ...VALIDOS, 'outro.flag': 'talvez' })).toEqual({
      error: '"Uma flag" precisa ser sim ou não.',
    });
  });
});

describe('apresentação', () => {
  it('rótulo do F1, ou a descrição do banco', () => {
    expect(parametroLabel({ chave: MORTALIDADE, descricao: 'x' })).toBe('Limite de mortalidade');
    expect(parametroLabel({ chave: 'outro', descricao: 'Descrição' })).toBe('Descrição');
  });

  it('ordena como o F1: mortalidade, atenção, crítico, e o resto no fim', () => {
    const ordenados = sortParametros([{ chave: 'a.extra' }, { chave: CRITICO }, { chave: ATENCAO }, { chave: MORTALIDADE }]);
    expect(ordenados.map((p) => p.chave)).toEqual([MORTALIDADE, ATENCAO, CRITICO, 'a.extra']);
  });
});
