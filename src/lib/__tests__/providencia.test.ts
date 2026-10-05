import { describe, expect, it } from 'vitest';
import type { LoteNoMapa } from '../mapa';
import { parseDiasAdiamento } from '../protocolo-rotulos';
import { vencimentoDaEtapa } from '../protocolo-motor';
import type { Sugestao } from '../protocolos';
import { destinoAposAlterar, lancarDaEtapa, prazoAdiado, registrarDaEtapa, providenciaDaSugestao, providenciaDoLote } from '../providencia';

const SEMANA = '2026-09-28';

function lote(extra: Partial<LoteNoMapa> = {}): LoteNoMapa {
  return {
    id: 'l1',
    codigo: 'L-012',
    canteiroId: 'c1',
    posicao: 1,
    especie: 'Ipê-amarelo',
    recipiente: 'tubete',
    fase: 'crescimento',
    saldo: 500,
    situacao: 'critico',
    tarefaPendente: 'Limpeza',
    pendenteDesde: '2026-09-20',
    diasAtraso: 10,
    atribuicaoPendenteId: null,
    protocoloEtapaPendenteId: null,
    tipoTarefaPendenteId: null,
    turnoPendenteId: null,
    quantidadeInicial: 500,
    perdas: 0,
    taxa: 0,
    ...extra,
  };
}

describe('RF-66: o que se pode fazer com o que pede providência', () => {
  it('a etapa do protocolo se marca já preenchida ou se registra como feita', () => {
    const p = providenciaDoLote(lote({ protocoloEtapaPendenteId: 'e1', tipoTarefaPendenteId: 't1', turnoPendenteId: 'm1' }), 'Limpeza, atrasada 10 dias', SEMANA);
    expect(p).toMatchObject({
      titulo: 'L-012 · Ipê-amarelo',
      detalhe: 'Limpeza, atrasada 10 dias',
      prazo: '2026-09-20',
      origem: {
        tipo: 'etapa',
        loteId: 'l1',
        etapaId: 'e1',
        lancarHref: `/producao/agenda/nova?semana=${SEMANA}&etapa=e1&lote=l1&tipo=t1&turno=m1`,
        registrarHref: '/producao/agenda/registrar?etapa=e1&lote=l1&tipo=t1&turno=m1',
      },
    });
  });

  it('a tarefa lançada e não confirmada não se lança de novo: remarca-se, trazida para a semana de lançar', () => {
    expect(providenciaDoLote(lote({ atribuicaoPendenteId: 'a1' }), null, SEMANA)?.origem).toEqual({
      tipo: 'tarefa',
      atribuicaoId: 'a1',
      marcarHref: `/producao/agenda/a1/editar?semana=${SEMANA}&voltar=agenda`,
    });
  });

  it('sem origem conhecida não há ação', () => {
    expect(providenciaDoLote(lote(), null, SEMANA)).toBeNull();
  });

  it('a sugestão do protocolo abre as mesmas ações, e o turno da etapa vai junto', () => {
    const s: Sugestao = {
      loteEtapaId: 'e2',
      loteId: 'l2',
      loteCodigo: 'L-020',
      especie: 'Cedro',
      canteiro: 'A-3',
      rotulo: 'Classificar',
      tipoTarefaId: 't2',
      tipoTarefa: 'Classificação',
      turnoId: 'm1',
      vencimento: '2026-10-01',
      situacao: 'atencao',
      diasAtraso: 0,
    };
    expect(providenciaDaSugestao(s, SEMANA)).toMatchObject({
      titulo: 'Classificar · L-020',
      detalhe: 'Cedro · A-3',
      prazo: '2026-10-01',
      origem: { tipo: 'etapa', loteId: 'l2', etapaId: 'e2' },
    });
  });

  it('sem turno, o lançamento não leva o parâmetro', () => {
    expect(lancarDaEtapa(SEMANA, { etapaId: 'e', loteId: 'l', tipoTarefaId: 't', turnoId: null })).not.toContain('turno=');
  });

  it('o registro da etapa feita não depende da semana aberta', () => {
    expect(registrarDaEtapa({ etapaId: 'e', loteId: 'l', tipoTarefaId: 't', turnoId: null })).toBe('/producao/agenda/registrar?etapa=e&lote=l&tipo=t');
  });

  it('o novo prazo conta do prazo que ainda não chegou, e só com dias válidos', () => {
    expect(prazoAdiado('2026-09-20', 7, '2026-09-15')).toBe('2026-09-27');
    expect(prazoAdiado('2026-09-20', 7, '2026-09-20')).toBe('2026-09-27');
    expect(prazoAdiado('2026-09-20', 0, '2026-09-15')).toBeNull();
    expect(prazoAdiado('2026-09-20', Number.NaN, '2026-09-15')).toBeNull();
    expect(prazoAdiado(null, 7, '2026-09-15')).toBeNull();
  });

  it('o prazo que já passou adia contando de hoje: um dia que já foi não tira o atraso', () => {
    expect(prazoAdiado('2026-10-01', 1, '2026-10-05')).toBe('2026-10-06');
  });

  it('os dias do adiamento: inteiros de 1 a 90', () => {
    expect(parseDiasAdiamento(' 7 ')).toEqual({ value: 7 });
    expect(parseDiasAdiamento('90')).toEqual({ value: 90 });
    for (const ruim of ['', '0', '-3', '2.5', '91', 'sete']) expect(parseDiasAdiamento(ruim)).toHaveProperty('error');
  });

  it('RN-63: o motor soma o adiamento ao vencimento, como a visão', () => {
    const limpeza = { dias: 90, intervaloDias: 90, alertaLigado: true, janelaAvisoPct: null };
    const estado = { dataAncora: '2026-01-10', ultimaExecucaoEm: '2026-09-15', ocorrencias: 1 };
    expect(vencimentoDaEtapa(limpeza, estado, null)).toBe('2026-12-14');
    expect(vencimentoDaEtapa(limpeza, { ...estado, diasAdiados: 15 }, null)).toBe('2026-12-29');
  });
});

describe('RF-66: para onde vai a tarefa alterada', () => {
  it('vinda do "Marcar na agenda", volta para a agenda do dia novo, sem abrir a ficha', () => {
    expect(destinoAposAlterar('a1', '2026-10-07', 'agenda')).toBe('/producao?dia=2026-10-07&feito=alterada');
  });

  it('a alteração comum volta para a ficha', () => {
    expect(destinoAposAlterar('a1', '2026-10-07', null)).toBe('/producao/agenda/a1?feito=alterada');
    expect(destinoAposAlterar('a1', '2026-10-07', '')).toBe('/producao/agenda/a1?feito=alterada');
  });
});
