import { describe, expect, it } from 'vitest';
import { detectaCicloDeAncoras, parseEtapaFields, parseProtocoloFields } from '../protocolos';
import { resumoAgendamento } from '../protocolo-rotulos';

const TAREFA = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';
const TURNO = '1c8e4f2a-7b6d-4e3f-8a9b-0c1d2e3f4a5b';

/** Uma etapa válida, para cada caso mexer só no que está sendo testado. */
function etapa(overrides: Partial<Parameters<typeof parseEtapaFields>[0]> = {}) {
  return parseEtapaFields({
    tipoTarefaId: TAREFA,
    rotulo: 'Classificar pós-germinação',
    tipoAgendamento: 'sequencial',
    tipoAncora: 'criacao_do_lote',
    etapaAncoraId: '',
    dias: '40',
    intervaloDias: '',
    turnoId: TURNO,
    alertaLigado: true,
    janelaAvisoPct: '',
    faseResultante: '',
    ...overrides,
  });
}

describe('parseProtocoloFields', () => {
  it('nome curto demais é recusado, e a observação vazia vira nula', () => {
    expect(parseProtocoloFields({ recipienteId: TAREFA, nome: 'x', observacoes: '' })).toHaveProperty('error');
    expect(parseProtocoloFields({ recipienteId: TAREFA, nome: 'Protocolo do tubete', observacoes: '  ' })).toEqual({
      value: { recipienteId: TAREFA, nome: 'Protocolo do tubete', observacoes: null },
    });
  });
});

describe('parseEtapaFields', () => {
  it('a etapa sequencial mais simples é aceita, e não guarda intervalo', () => {
    const parsed = etapa();
    expect(parsed).toHaveProperty('value');
    if ('value' in parsed) {
      expect(parsed.value.intervaloDias).toBeNull();
      expect(parsed.value.etapaAncoraId).toBeNull();
      expect(parsed.value.faseResultante).toBeNull();
    }
  });

  it('FE-2: recorrente sem intervalo é recusada', () => {
    expect(etapa({ tipoAgendamento: 'recorrente', intervaloDias: '' })).toEqual({
      error: 'O intervalo entre as ocorrências precisa ser um número inteiro de dias.',
    });
    expect(etapa({ tipoAgendamento: 'recorrente', intervaloDias: '0' })).toEqual({
      error: 'O intervalo entre as ocorrências precisa ser maior que zero.',
    });
    expect(etapa({ tipoAgendamento: 'recorrente', intervaloDias: '90' })).toHaveProperty('value');
  });

  it('RN-31: âncora em etapa exige dizer qual, e a de criação descarta a que veio', () => {
    expect(etapa({ tipoAncora: 'conclusao_de_etapa', etapaAncoraId: '' })).toEqual({
      error: 'Escolha a etapa cuja conclusão inicia a contagem.',
    });
    const comLixo = etapa({ tipoAncora: 'criacao_do_lote', etapaAncoraId: TAREFA });
    expect(comLixo).toHaveProperty('value');
    if ('value' in comLixo) expect(comLixo.value.etapaAncoraId).toBeNull();
  });

  it('RN-34: etapa que repete não avança fase', () => {
    expect(etapa({ tipoAgendamento: 'recorrente', intervaloDias: '90', faseResultante: 'germinado' })).toEqual({
      error: 'Etapa que repete não avança a fase do lote. Deixe a fase em branco.',
    });
    expect(etapa({ faseResultante: 'germinado' })).toHaveProperty('value');
    expect(etapa({ faseResultante: 'encerrado' })).toEqual({ error: 'Escolha a fase na lista.' });
  });

  it('prazo zero vale, e é a etapa que vence no dia da âncora', () => {
    const parsed = etapa({ dias: '0' });
    expect(parsed).toHaveProperty('value');
    if ('value' in parsed) expect(parsed.value.dias).toBe(0);
  });

  it('RN-35: a janela é percentual de 0 a 100, e vazia usa a de Configurações', () => {
    expect(etapa({ janelaAvisoPct: '120' })).toEqual({ error: 'A janela de aviso vai de 0 a 100 por cento.' });
    expect(etapa({ janelaAvisoPct: 'muito' })).toHaveProperty('error');
    const propria = etapa({ janelaAvisoPct: '12,5' });
    if ('value' in propria) expect(propria.value.janelaAvisoPct).toBe(12.5);
    const padrao = etapa({ janelaAvisoPct: '' });
    if ('value' in padrao) expect(padrao.value.janelaAvisoPct).toBeNull();
  });
});

/**
 * C2 UC-17 FE-1, e TA-36. É a recusa que o banco não sabe fazer: sem ela as duas
 * etapas nunca venceriam nada, e o silêncio é o que a torna cara.
 */
describe('detectaCicloDeAncoras', () => {
  const plantio = { id: 'p', rotulo: 'Plantar no tubete', etapaAncoraId: null };
  const classificar = { id: 'c', rotulo: 'Classificar pós-germinação', etapaAncoraId: 'p' };
  const selecao = { id: 's', rotulo: 'Classificar seleção', etapaAncoraId: 'c' };

  it('cadeia que termina na criação do lote não é ciclo', () => {
    expect(detectaCicloDeAncoras([plantio, classificar], selecao)).toBeNull();
  });

  it('TA-36: ancorar o plantio na classificação que já depende dele é recusado', () => {
    const ciclo = detectaCicloDeAncoras([plantio, classificar], { ...plantio, etapaAncoraId: 'c' });
    expect(ciclo).not.toBeNull();
    expect(ciclo).toContain('Plantar no tubete');
    expect(ciclo).toContain('Classificar pós-germinação');
  });

  it('pega o ciclo indireto, e não só o par que se aponta', () => {
    const ciclo = detectaCicloDeAncoras([plantio, classificar, selecao], { ...plantio, etapaAncoraId: 's' });
    expect(ciclo).not.toBeNull();
    expect(ciclo!.length).toBeGreaterThan(3);
  });

  it('a etapa que se ancora nela mesma é ciclo de um passo só', () => {
    expect(detectaCicloDeAncoras([plantio], { ...plantio, etapaAncoraId: 'p' })).not.toBeNull();
  });

  it('etapa nova, ainda sem id, também é conferida', () => {
    const nova = { id: null, rotulo: 'Nova', etapaAncoraId: 'c' };
    expect(detectaCicloDeAncoras([plantio, classificar], nova)).toBeNull();
  });
});

describe('resumoAgendamento', () => {
  it('diz em português o que a etapa faz', () => {
    expect(resumoAgendamento({ tipoAgendamento: 'sequencial', dias: 40, intervaloDias: null })).toBe(
      'Uma vez, 40 dias depois',
    );
    expect(resumoAgendamento({ tipoAgendamento: 'recorrente', dias: 90, intervaloDias: 90 })).toBe(
      '90 dias depois, e repete a cada 90 dias',
    );
    expect(resumoAgendamento({ tipoAgendamento: 'sequencial', dias: 0, intervaloDias: null })).toBe(
      'Uma vez, no mesmo dia',
    );
  });
});
