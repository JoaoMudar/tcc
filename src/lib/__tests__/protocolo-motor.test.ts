import { describe, expect, it } from 'vitest';
import { diasDeAtraso, situacaoDaEtapa, vencimentoDaEtapa } from '../protocolo-motor';

/**
 * A prova de mesa de `rotinas/2-producao/06`, linhas 315 a 345, é normativa: o
 * `E2` diz que qualquer implementação do motor tem de reproduzir estas datas.
 * Os testes vieram antes do módulo, e é o que o P1 pede em T6.4.
 *
 * Protocolo do tubete, o recorte da prova:
 *   1 Plantar no tubete        sequencial  criação do lote   0 dias  alerta
 *   2 Classificar pós-germ.    sequencial  conclusão da 1   40 dias  alerta
 *   3 Classificar seleção      recorrente  conclusão da 2   60 dias  alerta
 *   4 Limpar mato              recorrente  criação do lote  90 dias  alerta
 *   5 Irrigação                recorrente  criação do lote   1 dia   SEM alerta
 */

const JANELA_PADRAO = 20;

/** Uma etapa do protocolo do tubete, com o que a prova de mesa declara. */
const etapa = {
  plantar: { dias: 0, intervaloDias: null, alertaLigado: true, janelaAvisoPct: null },
  classificar: { dias: 40, intervaloDias: null, alertaLigado: true, janelaAvisoPct: null },
  selecao: { dias: 60, intervaloDias: 60, alertaLigado: true, janelaAvisoPct: null },
  limpeza: { dias: 90, intervaloDias: 90, alertaLigado: true, janelaAvisoPct: null },
  irrigacao: { dias: 1, intervaloDias: 1, alertaLigado: false, janelaAvisoPct: null },
} as const;

describe('vencimentoDaEtapa: a contagem é da execução real (RN-32, RN-40)', () => {
  it('10/01, lote criado: as etapas que ancoram na criação já vencem', () => {
    const criacao = { dataAncora: '2026-01-10', ultimaExecucaoEm: null, ocorrencias: 0 };
    expect(vencimentoDaEtapa(etapa.plantar, criacao, null)).toBe('2026-01-10');
    expect(vencimentoDaEtapa(etapa.limpeza, criacao, null)).toBe('2026-04-10');
    expect(vencimentoDaEtapa(etapa.irrigacao, criacao, null)).toBe('2026-01-11');
  });

  it('10/01: âncora não resolvida não vence nada, e é informação, não falta de dado', () => {
    const semAncora = { dataAncora: null, ultimaExecucaoEm: null, ocorrencias: 0 };
    expect(vencimentoDaEtapa(etapa.classificar, semAncora, null)).toBeNull();
    expect(vencimentoDaEtapa(etapa.selecao, semAncora, null)).toBeNull();
  });

  it('25/01, plantio concluído: a classificação vence em 06/03, e não em 19/02', () => {
    // 19/02 é o que sairia se a etapa ancorasse na criação do lote: o erro que RN-31 existe para impedir
    const ancorada = { dataAncora: '2026-01-25', ultimaExecucaoEm: null, ocorrencias: 0 };
    expect(vencimentoDaEtapa(etapa.classificar, ancorada, null)).toBe('2026-03-06');
    expect(vencimentoDaEtapa(etapa.classificar, ancorada, null)).not.toBe('2026-02-19');
  });

  it('08/03, classificação feita 2 dias atrasada: a seleção vence em 07/05', () => {
    const ancorada = { dataAncora: '2026-03-08', ultimaExecucaoEm: null, ocorrencias: 0 };
    expect(vencimentoDaEtapa(etapa.selecao, ancorada, null)).toBe('2026-05-07');
  });

  /** TA-41, e o `E2` chama este de um dos dois casos que decidem se o motor está certo. */
  it('TA-41: limpeza vencida em 10/04 e executada em 15/09 vence de novo em 14/12', () => {
    const executada = { dataAncora: '2026-01-10', ultimaExecucaoEm: '2026-09-15', ocorrencias: 1 };
    const proximo = vencimentoDaEtapa(etapa.limpeza, executada, null);
    expect(proximo).toBe('2026-12-14');
    // Nem o calendário previsto, nem o trimestre seguinte ao perdido
    expect(proximo).not.toBe('2026-07-09');
    expect(proximo).not.toBe('2026-10-08');
  });

  it('a ocorrência seguinte usa o intervalo, e não o prazo da primeira', () => {
    const primeira = { dataAncora: '2026-03-08', ultimaExecucaoEm: null, ocorrencias: 0 };
    const segunda = { dataAncora: '2026-03-08', ultimaExecucaoEm: '2026-05-07', ocorrencias: 1 };
    // A seleção tem dias 60 e intervalo 60: aqui coincidem, então um caso com valores diferentes
    const trimestralQuePrimeiroEspera30 = { dias: 30, intervaloDias: 90, alertaLigado: true, janelaAvisoPct: null };
    expect(vencimentoDaEtapa(trimestralQuePrimeiroEspera30, primeira, null)).toBe('2026-04-07');
    expect(vencimentoDaEtapa(trimestralQuePrimeiroEspera30, segunda, null)).toBe('2026-08-05');
  });

  /** TA-44: o tempo da espécie manda no tempo do protocolo (RN-36). */
  it('TA-44: espécie com 70 dias próprios vence em 70, a sem customização em 40', () => {
    const ancorada = { dataAncora: '2026-01-25', ultimaExecucaoEm: null, ocorrencias: 0 };
    expect(vencimentoDaEtapa(etapa.classificar, ancorada, { dias: 70, intervaloDias: null })).toBe('2026-04-05');
    expect(vencimentoDaEtapa(etapa.classificar, ancorada, null)).toBe('2026-03-06');
  });

  it('a espécie sobrescreve só o que declara, e o resto continua vindo do protocolo', () => {
    const segunda = { dataAncora: '2026-01-10', ultimaExecucaoEm: '2026-09-15', ocorrencias: 1 };
    // Declara só `dias`: a ocorrência seguinte continua usando o intervalo do protocolo
    expect(vencimentoDaEtapa(etapa.limpeza, segunda, { dias: 45, intervaloDias: null })).toBe('2026-12-14');
    expect(vencimentoDaEtapa(etapa.limpeza, segunda, { dias: null, intervaloDias: 120 })).toBe('2027-01-13');
  });
});

describe('situacaoDaEtapa: amarelo é proporcional, e nem toda etapa avisa (RN-35)', () => {
  const emAndamento = { dataAncora: '2026-01-25', ultimaExecucaoEm: null, ocorrencias: 0 };

  it('27/02: a janela de 20% de 40 dias é 8 dias, e a etapa fica amarela a partir daí', () => {
    // Vence em 06/03; 8 dias antes é 26/02
    expect(situacaoDaEtapa(etapa.classificar, emAndamento, null, JANELA_PADRAO, '2026-02-25')).toBe('em_dia');
    expect(situacaoDaEtapa(etapa.classificar, emAndamento, null, JANELA_PADRAO, '2026-02-26')).toBe('atencao');
    expect(situacaoDaEtapa(etapa.classificar, emAndamento, null, JANELA_PADRAO, '2026-02-27')).toBe('atencao');
  });

  it('no dia do vencimento ainda é atenção; passou dele, é atraso', () => {
    expect(situacaoDaEtapa(etapa.classificar, emAndamento, null, JANELA_PADRAO, '2026-03-06')).toBe('atencao');
    expect(situacaoDaEtapa(etapa.classificar, emAndamento, null, JANELA_PADRAO, '2026-03-07')).toBe('atraso');
  });

  /** TA-37: o caso que protege o mapa de virar ruído. */
  it('TA-37: a trimestral fica em atenção 18 dias antes; a diária não recebe cor nenhuma', () => {
    const criacao = { dataAncora: '2026-01-10', ultimaExecucaoEm: null, ocorrencias: 0 };
    // Limpeza de 90 dias vence em 10/04; a janela de 20% são 18 dias, logo 23/03
    expect(situacaoDaEtapa(etapa.limpeza, criacao, null, JANELA_PADRAO, '2026-03-22')).toBe('em_dia');
    expect(situacaoDaEtapa(etapa.limpeza, criacao, null, JANELA_PADRAO, '2026-03-23')).toBe('atencao');

    // A irrigação diária não recebe indicação, nem verde, feita ou não
    expect(situacaoDaEtapa(etapa.irrigacao, criacao, null, JANELA_PADRAO, '2026-01-11')).toBe('sem_alerta');
    expect(situacaoDaEtapa(etapa.irrigacao, criacao, null, JANELA_PADRAO, '2026-06-01')).toBe('sem_alerta');
  });

  it('a janela própria da etapa prevalece sobre a de Configurações (FA-2 do UC-17)', () => {
    const comJanelaPropria = { ...etapa.limpeza, janelaAvisoPct: 50 };
    const criacao = { dataAncora: '2026-01-10', ultimaExecucaoEm: null, ocorrencias: 0 };
    // 50% de 90 dias são 45: a atenção começa em 24/02, e não em 23/03
    expect(situacaoDaEtapa(comJanelaPropria, criacao, null, JANELA_PADRAO, '2026-02-24')).toBe('atencao');
  });

  it('TA-43: a etapa sem âncora resolvida não tem vencimento nem situação', () => {
    const semAncora = { dataAncora: null, ultimaExecucaoEm: null, ocorrencias: 0 };
    expect(vencimentoDaEtapa(etapa.classificar, semAncora, null)).toBeNull();
    expect(situacaoDaEtapa(etapa.classificar, semAncora, null, JANELA_PADRAO, '2026-06-01')).toBeNull();
  });
});

describe('diasDeAtraso: uma pendência, cada vez mais velha (RN-33, RF-50)', () => {
  /** TA-42, o outro caso que o `E2` diz decidir se o motor está certo. */
  it('TA-42: a limpeza vencida em 10/04, olhada em 10/07, tem 91 dias e é uma só', () => {
    const naoExecutada = { dataAncora: '2026-01-10', ultimaExecucaoEm: null, ocorrencias: 0 };
    expect(vencimentoDaEtapa(etapa.limpeza, naoExecutada, null)).toBe('2026-04-10');
    expect(diasDeAtraso(etapa.limpeza, naoExecutada, null, '2026-07-10')).toBe(91);
    // A ocorrência continua sendo a primeira: nenhuma nova nasceu no caminho
    expect(naoExecutada.ocorrencias).toBe(0);
  });

  it('vermelho de três dias e vermelho de cinco meses são a mesma pendência, mais velha', () => {
    const naoExecutada = { dataAncora: '2026-01-10', ultimaExecucaoEm: null, ocorrencias: 0 };
    expect(diasDeAtraso(etapa.limpeza, naoExecutada, null, '2026-04-13')).toBe(3);
    expect(diasDeAtraso(etapa.limpeza, naoExecutada, null, '2026-09-10')).toBe(153);
  });

  it('etapa em dia não tem atraso, e a sem âncora também não', () => {
    const criacao = { dataAncora: '2026-01-10', ultimaExecucaoEm: null, ocorrencias: 0 };
    const semAncora = { dataAncora: null, ultimaExecucaoEm: null, ocorrencias: 0 };
    expect(diasDeAtraso(etapa.limpeza, criacao, null, '2026-02-01')).toBe(0);
    expect(diasDeAtraso(etapa.limpeza, semAncora, null, '2026-02-01')).toBe(0);
  });
});

describe('a divisão herda, e os dois seguem independentes (RN-39)', () => {
  /** TA-46, a parte que é aritmética do motor: o estado herdado produz a mesma data. */
  it('20/12: os dois filhos herdam o vencimento de 14/12, já vencido', () => {
    const herdado = { dataAncora: '2026-01-10', ultimaExecucaoEm: '2026-09-15', ocorrencias: 1 };
    expect(vencimentoDaEtapa(etapa.limpeza, herdado, null)).toBe('2026-12-14');
    expect(diasDeAtraso(etapa.limpeza, herdado, null, '2026-12-20')).toBe(6);
  });

  it('22/12: o filho limpo vence em 22/03; o outro continua atrasado desde 14/12', () => {
    const limpo = { dataAncora: '2026-01-10', ultimaExecucaoEm: '2026-12-22', ocorrencias: 2 };
    const naoLimpo = { dataAncora: '2026-01-10', ultimaExecucaoEm: '2026-09-15', ocorrencias: 1 };
    expect(vencimentoDaEtapa(etapa.limpeza, limpo, null)).toBe('2027-03-22');
    expect(vencimentoDaEtapa(etapa.limpeza, naoLimpo, null)).toBe('2026-12-14');
    expect(diasDeAtraso(etapa.limpeza, naoLimpo, null, '2026-12-22')).toBe(8);
  });
});
