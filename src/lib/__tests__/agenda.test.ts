import { describe, expect, it } from 'vitest';
import {
  type AtribuicaoBruta,
  type AtribuicaoResumo,
  type EstadoTarefaInput,
  detalhesAtribuicao,
  estadoTarefa,
  formatHoraTarefa,
  formatQuantidadeMedida,
  lerQuantidadeMedida,
  montarGrade,
  parseAtribuicao,
  parseConfirmacao,
  parseHorario,
  parseReagendamento,
  siglaTurno,
} from '../agenda';

const P1 = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d01';
const P2 = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d02';
const P3 = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d03';
const TURNO = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e10';
const LOTE = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e11';
const AREA = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e12';
const CANTEIRO = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e13';
const ESPECIE = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e14';
const SEMANA = '2026-09-14';

const SIMPLES = {
  id: 'tipo',
  eQuantitativa: false,
  exigeLote: false,
  exigeEspecie: false,
  exigeRecipiente: false,
  exigeArea: true,
  unidadeMedida: 'un' as const,
};
const COM_LOTE = { ...SIMPLES, eQuantitativa: true, exigeLote: true, exigeArea: false };
/** Colher semente: sem lote e sem lugar, contada em quilo. */
const SEMENTE = { ...SIMPLES, eQuantitativa: true, exigeEspecie: true, exigeArea: false, unidadeMedida: 'kg' as const };

function bruta(over: Partial<AtribuicaoBruta> = {}): AtribuicaoBruta {
  return {
    semana: SEMANA,
    dias: [SEMANA],
    turnoId: TURNO,
    horaInicio: '',
    horaFim: '',
    participantes: [P1],
    loteId: '',
    especieId: '',
    recipienteId: '',
    areaId: '',
    canteiroId: '',
    quantidadePlanejada: '',
    recorrente: false,
    observacoes: '',
    ...over,
  };
}

function valor<T>(resultado: { error: string } | { value: T }): T {
  if ('error' in resultado) throw new Error(resultado.error);
  return resultado.value;
}

describe('hora da tarefa (RN-12)', () => {
  it('admite sem hora, só início, e início com fim (TA-27)', () => {
    expect(parseHorario('', '')).toEqual({ value: { inicio: null, fim: null } });
    expect(parseHorario('12:00', '')).toEqual({ value: { inicio: '12:00', fim: null } });
    expect(parseHorario('07:00', '08:00')).toEqual({ value: { inicio: '07:00', fim: '08:00' } });
  });

  it('recusa fim sem início (TA-28), fim antes do início e formato inválido', () => {
    expect(parseHorario('', '08:00')).toEqual({ error: expect.stringContaining('fim sem hora de início') });
    expect(parseHorario('08:00', '07:00')).toEqual({ error: expect.stringContaining('depois') });
    expect(parseHorario('7h', '')).toEqual({ error: expect.stringContaining('formato') });
  });
});

describe('parseReagendamento (arrasto na agenda, RNF-14)', () => {
  const TURNO = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0a';

  it('aceita dia, turno e o intervalo que o arrasto declarou', () => {
    expect(parseReagendamento({ data: '2026-09-15', turnoId: TURNO, horaInicio: '07:00', horaFim: '08:30' })).toEqual({
      value: { data: '2026-09-15', turnoId: TURNO, horaInicio: '07:00', horaFim: '08:30' },
    });
  });

  it('recusa dia que não existe', () => {
    expect(parseReagendamento({ data: '2026-02-30', turnoId: TURNO, horaInicio: '07:00', horaFim: '08:00' })).toEqual({
      error: 'Dia inválido.',
    });
  });

  it('exige o turno, que o arrasto nunca deixa vazio (RN-12)', () => {
    expect(parseReagendamento({ data: '2026-09-15', turnoId: '', horaInicio: '07:00', horaFim: '08:00' })).toEqual({
      error: expect.stringContaining('Escolha o turno'),
    });
  });

  it('recusa o fim antes do início, como o CHECK do banco', () => {
    expect(parseReagendamento({ data: '2026-09-15', turnoId: TURNO, horaInicio: '08:00', horaFim: '07:00' })).toEqual({
      error: expect.stringContaining('depois'),
    });
  });
});

describe('estadoTarefa (RF-29, RF-31, RN-14)', () => {
  function tarefa(over: Partial<EstadoTarefaInput> = {}): EstadoTarefaInput {
    return { situacao: 'confirmada', eQuantitativa: true, quantidadePlanejada: 100, participantes: [], ...over };
  }

  it('devolve a situação crua quando não há o que medir', () => {
    expect(estadoTarefa(tarefa({ situacao: 'planejada' }))).toBe('planejada');
    expect(estadoTarefa(tarefa({ situacao: 'cancelada' }))).toBe('cancelada');
  });

  it('marca a não confirmada como presumida, e não como feita (RF-31, TA-34)', () => {
    expect(estadoTarefa(tarefa({ situacao: 'nao_confirmada' }))).toBe('presumida');
  });

  it('confirma como feita a tarefa que não tem quantidade a comparar', () => {
    expect(estadoTarefa(tarefa({ eQuantitativa: false }))).toBe('feita');
    expect(estadoTarefa(tarefa({ quantidadePlanejada: null }))).toBe('feita');
  });

  it('trata quantidade em branco como "sem contagem", e não como zero (FA-4)', () => {
    expect(estadoTarefa(tarefa({ participantes: [{ quantidade: null }, { quantidade: null }] }))).toBe('feita');
  });

  it('separa feita, parcial e não feita pela soma dos participantes', () => {
    expect(estadoTarefa(tarefa({ participantes: [{ quantidade: 0 }] }))).toBe('nao_feita');
    expect(estadoTarefa(tarefa({ participantes: [{ quantidade: 40 }, { quantidade: 30 }] }))).toBe('parcial');
    expect(estadoTarefa(tarefa({ participantes: [{ quantidade: 60 }, { quantidade: 40 }] }))).toBe('feita');
    expect(estadoTarefa(tarefa({ participantes: [{ quantidade: 120 }] }))).toBe('feita');
  });

  it('soma só quem foi contado, ignorando os participantes em branco', () => {
    expect(estadoTarefa(tarefa({ participantes: [{ quantidade: 100 }, { quantidade: null }] }))).toBe('feita');
    expect(estadoTarefa(tarefa({ participantes: [{ quantidade: 10 }, { quantidade: null }] }))).toBe('parcial');
  });
});

describe('parseAtribuicao (RF-21, RF-26, RF-30)', () => {
  it('aceita pessoas, dias e turno, sem repetir', () => {
    const v = valor(parseAtribuicao(SIMPLES, bruta({ participantes: [P1, P2, P1], dias: ['2026-09-16', SEMANA, SEMANA] })));
    expect(v.participantes).toEqual([P1, P2]);
    expect(v.dias).toEqual([SEMANA, '2026-09-16']);
    expect(v.horaInicio).toBeNull();
  });

  it('exige ao menos uma pessoa, um dia da semana e o turno', () => {
    expect(parseAtribuicao(SIMPLES, bruta({ participantes: [] }))).toEqual({ error: 'Escolha ao menos uma pessoa.' });
    expect(parseAtribuicao(SIMPLES, bruta({ dias: [] }))).toEqual({ error: 'Escolha ao menos um dia.' });
    expect(parseAtribuicao(SIMPLES, bruta({ dias: ['2026-09-20'] }))).toEqual({ error: expect.stringContaining('dias desta semana') });
    expect(parseAtribuicao(SIMPLES, bruta({ turnoId: '' }))).toEqual({ error: expect.stringContaining('turno') });
    expect(parseAtribuicao(SIMPLES, bruta({ semana: '2026-09-15' }))).toEqual({ error: 'Semana inválida.' });
  });

  it('TA-27 e TA-28: a hora é opcional, mas fim sem início é recusado mesmo com turno', () => {
    expect(valor(parseAtribuicao(SIMPLES, bruta({ horaInicio: '07:00', horaFim: '08:00' })))).toMatchObject({
      turnoId: TURNO,
      horaInicio: '07:00',
      horaFim: '08:00',
    });
    expect(parseAtribuicao(SIMPLES, bruta({ horaFim: '08:00' }))).toEqual({ error: expect.stringContaining('fim sem hora de início') });
  });

  it('descarta o que o tipo não declara, e guarda área e canteiro na tarefa sem lote', () => {
    const v = valor(
      parseAtribuicao(SIMPLES, bruta({ loteId: LOTE, especieId: ESPECIE, areaId: AREA, canteiroId: CANTEIRO, quantidadePlanejada: '50' })),
    );
    expect(v).toMatchObject({ loteId: null, especieId: null, recipienteId: null, areaId: AREA, canteiroId: CANTEIRO, quantidadePlanejada: null });
  });

  it('o lançamento não pede área: sem ela, a tarefa sem lote grava área e canteiro nulos', () => {
    expect(valor(parseAtribuicao(SIMPLES, bruta()))).toMatchObject({ areaId: null, canteiroId: null });
  });

  it('o tipo que não declara área descarta área e canteiro', () => {
    expect(valor(parseAtribuicao(SEMENTE, bruta({ areaId: AREA, canteiroId: CANTEIRO })))).toMatchObject({ areaId: null, canteiroId: null });
  });

  it('quantidade prevista em kg aceita decimal', () => {
    expect(valor(parseAtribuicao(SEMENTE, bruta({ quantidadePlanejada: '2,5' }))).quantidadePlanejada).toBe(2.5);
    expect(parseAtribuicao(COM_LOTE, bruta({ quantidadePlanejada: '2,5' }))).toEqual({ error: expect.stringContaining('inteiro') });
  });

  it('canteiro sem área não fica', () => {
    expect(valor(parseAtribuicao(SIMPLES, bruta({ canteiroId: CANTEIRO })))).toMatchObject({ areaId: null, canteiroId: null });
  });

  it('RN-24: com lote exigido, área e canteiro não são pedidos; o lote pode ficar para a confirmação', () => {
    expect(valor(parseAtribuicao(COM_LOTE, bruta({ loteId: LOTE, areaId: AREA, canteiroId: CANTEIRO })))).toMatchObject({
      loteId: LOTE,
      areaId: null,
      canteiroId: null,
    });
    expect(valor(parseAtribuicao(COM_LOTE, bruta({ loteId: 'nenhum' }))).loteId).toBeNull();
  });

  it('quantidade prevista só na tarefa quantitativa, e maior que zero', () => {
    expect(valor(parseAtribuicao(COM_LOTE, bruta({ quantidadePlanejada: '1.500' }))).quantidadePlanejada).toBe(1500);
    expect(parseAtribuicao(COM_LOTE, bruta({ quantidadePlanejada: '0' }))).toEqual({ error: expect.stringContaining('maior que zero') });
    expect(parseAtribuicao(COM_LOTE, bruta({ quantidadePlanejada: 'muito' }))).toEqual({ error: expect.stringContaining('maior que zero') });
  });

  it('observação até 500 caracteres', () => {
    expect(parseAtribuicao(SIMPLES, bruta({ observacoes: 'x'.repeat(501) }))).toEqual({ error: expect.stringContaining('500') });
  });
});

describe('parseConfirmacao (RF-29, UC-20)', () => {
  const vazia = { loteId: '', areaId: '', canteiroId: '', quantidades: {}, perdidas: '', causa: '' };

  it('TA-32: a tarefa que declara lote não confirma sem ele', () => {
    expect(parseConfirmacao(COM_LOTE, [P1], vazia)).toEqual({ error: expect.stringContaining('exige o lote') });
  });

  it('TA-31: um número por participante; em branco é sem contagem (FA-4)', () => {
    const v = valor(parseConfirmacao(COM_LOTE, [P1, P2, P3], { ...vazia, loteId: LOTE, quantidades: { [P1]: '120', [P2]: '', [P3]: '1.500' } }));
    expect(v.quantidades).toEqual([
      { pessoaId: P1, quantidade: 120 },
      { pessoaId: P2, quantidade: null },
      { pessoaId: P3, quantidade: 1500 },
    ]);
  });

  it('FE-1: um número inválido recusa a tarefa inteira', () => {
    expect(parseConfirmacao(COM_LOTE, [P1, P2], { ...vazia, loteId: LOTE, quantidades: { [P1]: '10', [P2]: '-3' } })).toEqual({
      error: expect.stringContaining('Quantidade inválida'),
    });
  });

  it('a tarefa não quantitativa não guarda número algum', () => {
    const v = valor(parseConfirmacao(SIMPLES, [P1], { ...vazia, quantidades: { [P1]: '99' } }));
    expect(v.quantidades).toEqual([{ pessoaId: P1, quantidade: null }]);
  });

  it('TA-33: sem lote, guarda a área e o canteiro', () => {
    expect(valor(parseConfirmacao(SIMPLES, [P1], { ...vazia, areaId: AREA, canteiroId: 'nenhum' }))).toMatchObject({
      loteId: null,
      areaId: AREA,
      canteiroId: null,
    });
  });

  it('sem a declaração de área, a confirmação não guarda área nem canteiro', () => {
    expect(valor(parseConfirmacao(SEMENTE, [P1], { ...vazia, areaId: AREA, canteiroId: CANTEIRO }))).toMatchObject({
      areaId: null,
      canteiroId: null,
    });
  });

  it('na unidade kg a quantidade de cada um aceita decimal; em un, não', () => {
    const v = valor(parseConfirmacao(SEMENTE, [P1, P2], { ...vazia, quantidades: { [P1]: '2,5', [P2]: '1.200,75' } }));
    expect(v.quantidades).toEqual([
      { pessoaId: P1, quantidade: 2.5 },
      { pessoaId: P2, quantidade: 1200.75 },
    ]);
    expect(parseConfirmacao(COM_LOTE, [P1], { ...vazia, loteId: LOTE, quantidades: { [P1]: '2,5' } })).toEqual({
      error: expect.stringContaining('inteiro'),
    });
  });

  it('as mudas que morreram viram perda, e pedem a causa', () => {
    const comLote = { ...vazia, loteId: LOTE };
    expect(valor(parseConfirmacao(COM_LOTE, [P1], { ...comLote, perdidas: '30', causa: 'seca' })).perda).toEqual({ quantidade: 30, causa: 'seca' });
    expect(parseConfirmacao(COM_LOTE, [P1], { ...comLote, perdidas: '30' })).toEqual({ error: expect.stringContaining('causa') });
    expect(valor(parseConfirmacao(COM_LOTE, [P1], { ...comLote, perdidas: '0' })).perda).toBeNull();
    expect(parseConfirmacao(COM_LOTE, [P1], { ...comLote, perdidas: 'umas' })).toEqual({ error: expect.stringContaining('morreram') });
  });

  it('sem lote não há onde gravar perda', () => {
    expect(valor(parseConfirmacao(SIMPLES, [P1], { ...vazia, perdidas: '30', causa: 'seca' })).perda).toBeNull();
  });
});

function resumo(id: string, data: string, participantes: { id: string; nome: string }[]): AtribuicaoResumo {
  return {
    id,
    semanaId: 's',
    semanaInicio: SEMANA,
    semanaSituacao: 'rascunho',
    data,
    turnoId: TURNO,
    turno: 'manha',
    horaInicio: null,
    horaFim: null,
    tipoTarefaId: 't',
    tipo: 'Encher saquinho',
    eQuantitativa: true,
    exigeLote: false,
    exigeEspecie: false,
    exigeRecipiente: true,
    exigeArea: true,
    unidadeMedida: 'un',
    especieId: null,
    especie: null,
    recipienteId: null,
    recipiente: null,
    loteId: null,
    loteCodigo: null,
    areaId: null,
    area: null,
    canteiroId: null,
    canteiro: null,
    quantidadePlanejada: null,
    eRecorrente: false,
    situacao: 'planejada',
    observacoes: null,
    participantes: participantes.map((p) => ({ ...p, quantidade: null })),
  };
}

describe('montarGrade (T5.1)', () => {
  const rogerio = { id: P1, nome: 'Rogério' };
  const amelia = { id: P2, nome: 'Amélia' };

  it('a tarefa do grupo aparece na linha de cada participante, e a sem ninguém numa linha própria', () => {
    const grupo = resumo('a1', SEMANA, [rogerio, amelia]);
    const orfa = resumo('a2', '2026-09-15', []);
    const grade = montarGrade([rogerio, amelia], [grupo, orfa]);
    expect(grade.map((linha) => linha.pessoa?.nome ?? null)).toEqual(['Amélia', 'Rogério', null]);
    expect(grade[0].porDia[SEMANA]).toEqual([grupo]);
    expect(grade[1].porDia[SEMANA]).toEqual([grupo]);
    expect(grade[2].porDia['2026-09-15']).toEqual([orfa]);
  });

  it('funcionário inativo some da grade vazia, mas fica na semana em que trabalhou', () => {
    const cleusa = { id: P3, nome: 'Cleusa' };
    expect(montarGrade([rogerio], []).map((l) => l.pessoa?.nome)).toEqual(['Rogério']);
    expect(montarGrade([rogerio], [resumo('a3', SEMANA, [cleusa])]).map((l) => l.pessoa?.nome)).toEqual(['Cleusa', 'Rogério']);
  });
});

describe('rótulos da agenda', () => {
  it('mostra a hora só na tarefa que a tem', () => {
    expect(formatHoraTarefa(null, null)).toBeNull();
    expect(formatHoraTarefa('07:00', null)).toBe('07:00');
    expect(formatHoraTarefa('07:00', '08:00')).toBe('07:00 às 08:00');
    expect(siglaTurno('manha')).toBe('M');
  });

  it('resume o que a tarefa leva, com o canteiro no lugar da área', () => {
    expect(
      detalhesAtribuicao({
        loteCodigo: '2026-0001',
        especie: 'Ipê',
        recipiente: null,
        area: 'A',
        canteiro: 'A-3',
        quantidadePlanejada: 1200,
        unidadeMedida: 'un',
      }),
    ).toEqual(['Lote 2026-0001', 'Ipê', 'Canteiro A-3', 'Previsto 1.200 un']);
    expect(
      detalhesAtribuicao({ loteCodigo: null, especie: null, recipiente: null, area: 'B', canteiro: null, quantidadePlanejada: null, unidadeMedida: 'un' }),
    ).toEqual(['Área B']);
  });

  it('lê a quantidade conforme a unidade, e mostra a unidade junto', () => {
    expect(lerQuantidadeMedida('1.500', 'un')).toBe(1500);
    expect(lerQuantidadeMedida('2,5', 'un')).toBeNull();
    expect(lerQuantidadeMedida('2,5', 'kg')).toBe(2.5);
    expect(lerQuantidadeMedida('1.500,25', 'L')).toBe(1500.25);
    expect(lerQuantidadeMedida('12', 'g')).toBe(12);
    expect(lerQuantidadeMedida('2,555', 'kg')).toBeNull();
    expect(lerQuantidadeMedida('2.5', 'kg')).toBeNull();
    expect(lerQuantidadeMedida('100000000', 'mL')).toBeNull();
    expect(formatQuantidadeMedida(2.5, 'kg')).toBe('2,5 kg');
    expect(formatQuantidadeMedida(1200, 'un')).toBe('1.200 un');
  });
});
