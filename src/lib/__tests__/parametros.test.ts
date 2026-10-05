import { describe, expect, it } from 'vitest';
import {
  ATENCAO,
  CRITICO,
  FRETE_KM_POR_LITRO,
  FRETE_PRECO_LITRO,
  MORTALIDADE,
  PARTIDA_AGROLANDIA,
  PARTIDA_ITAPEMA,
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

  it('consumo e preço do litro aceitam decimal, maior que zero (RN-64)', () => {
    const existentes = [
      ...EXISTENTES,
      { chave: FRETE_KM_POR_LITRO, tipoValor: 'numero' as const, descricao: 'km/L' },
      { chave: FRETE_PRECO_LITRO, tipoValor: 'numero' as const, descricao: 'R$/L' },
    ];
    expect(validateParametros(existentes, { ...VALIDOS, [FRETE_KM_POR_LITRO]: '17', [FRETE_PRECO_LITRO]: '6,59' })).toEqual({
      value: { ...VALIDOS, [FRETE_KM_POR_LITRO]: '17', [FRETE_PRECO_LITRO]: '6.59' },
    });
    expect(validateParametros(existentes, { ...VALIDOS, [FRETE_KM_POR_LITRO]: '0', [FRETE_PRECO_LITRO]: '7' })).toEqual({
      error: '"Frete: consumo do caminhão" precisa ser um número maior que zero.',
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

describe('parâmetros de texto da viagem (P14)', () => {
  const COM_PARTIDA = [
    ...EXISTENTES,
    { chave: PARTIDA_AGROLANDIA, tipoValor: 'texto' as const, descricao: 'agrolandia' },
    { chave: PARTIDA_ITAPEMA, tipoValor: 'texto' as const, descricao: 'itapema' },
  ];

  it('aceitam endereço, sem a checagem de número inteiro', () => {
    const resultado = validateParametros(COM_PARTIDA, {
      ...VALIDOS,
      [PARTIDA_AGROLANDIA]: ' Rodovia SC-302, Agrolândia, SC ',
      [PARTIDA_ITAPEMA]: 'Itapema, SC',
    });
    expect(resultado).toEqual({
      value: { ...VALIDOS, [PARTIDA_AGROLANDIA]: 'Rodovia SC-302, Agrolândia, SC', [PARTIDA_ITAPEMA]: 'Itapema, SC' },
    });
  });

  it('não aceitam vazio', () => {
    const resultado = validateParametros(COM_PARTIDA, { ...VALIDOS, [PARTIDA_AGROLANDIA]: ' ', [PARTIDA_ITAPEMA]: 'x' });
    expect(resultado).toEqual({ error: '"Viagem: saída de Agrolândia" precisa ter de 1 a 500 caracteres.' });
  });
});
