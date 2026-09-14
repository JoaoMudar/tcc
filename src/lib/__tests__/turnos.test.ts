import { describe, expect, it } from 'vitest';
import {
  duplicateMessage,
  duracaoMinutos,
  formatDuracao,
  jornadaDiaria,
  parseHora,
  parseNomeTurno,
  parseTurnoFields,
  turnoLabel,
} from '../turnos';

describe('parseHora', () => {
  it('aceita HH:MM e o HH:MM:SS que o Postgres devolve', () => {
    expect(parseHora('07:30')).toBe(450);
    expect(parseHora('17:00:00')).toBe(1020);
  });

  it('recusa hora fora do relógio ou mal escrita', () => {
    for (const texto of ['24:00', '7:30', '07:60', '', 'manhã']) expect(parseHora(texto), texto).toBeNull();
  });
});

describe('parseTurnoFields', () => {
  it('devolve os horários sem segundos', () => {
    expect(parseTurnoFields({ inicio: '07:30:00', fim: '11:30' })).toEqual({ value: { inicio: '07:30', fim: '11:30' } });
  });

  it('fim igual ou antes do início é recusado (mesma regra do CHECK)', () => {
    expect(parseTurnoFields({ inicio: '13:00', fim: '13:00' })).toHaveProperty('error');
    expect(parseTurnoFields({ inicio: '13:00', fim: '11:00' })).toEqual({
      error: 'O fim do turno precisa ser depois do início.',
    });
  });

  it('hora inválida tem mensagem própria', () => {
    expect(parseTurnoFields({ inicio: '', fim: '11:00' })).toEqual({ error: 'Informe o início e o fim no formato 07:30.' });
  });
});

describe('parseNomeTurno', () => {
  it('normaliza para minúsculas e recusa nome curto', () => {
    expect(parseNomeTurno('  Noite ')).toEqual({ value: 'noite' });
    expect(parseNomeTurno('x')).toHaveProperty('error');
  });
});

describe('jornada (RF-08)', () => {
  const manha = { inicio: '07:30', fim: '11:30', ativo: true };
  const tarde = { inicio: '13:00', fim: '17:00', ativo: true };

  it('duração é fim menos início', () => {
    expect(duracaoMinutos(manha)).toBe(240);
  });

  it('a jornada soma só os turnos ativos, e acompanha o horário alterado (TA-12)', () => {
    expect(jornadaDiaria([manha, tarde])).toBe(480);
    expect(jornadaDiaria([{ ...manha, fim: '12:00' }, tarde])).toBe(510);
    expect(jornadaDiaria([manha, { ...tarde, ativo: false }])).toBe(240);
  });

  it('formata em horas e minutos', () => {
    expect(formatDuracao(480)).toBe('8h00');
    expect(formatDuracao(510)).toBe('8h30');
  });
});

describe('turnoLabel e duplicateMessage', () => {
  it('mostra o nome com acento e maiúscula', () => {
    expect(turnoLabel('manha')).toBe('Manhã');
    expect(turnoLabel('madrugada')).toBe('Madrugada');
  });

  it('só traduz a violação do nome único', () => {
    expect(duplicateMessage({ code: '23505', constraint: 'turnos_trabalho_nome_key' })).toBe('Já existe turno com esse nome.');
    expect(duplicateMessage({ code: '23505', constraint: 'outra' })).toBeNull();
    expect(duplicateMessage(null)).toBeNull();
  });
});
