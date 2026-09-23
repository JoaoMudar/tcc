/**
 * O motor do protocolo: vencimento e situação de cada etapa do lote, derivados a
 * cada leitura e **nunca gravados** (RN-40). Sem SQL e sem `pg`, para o
 * navegador poder receber (RNF-11, TA-60) e para a prova de mesa poder testá-lo
 * sem banco.
 *
 * **A visão `lotes_etapas_vencimento` calcula o mesmo, em SQL.** Ela existe para
 * a consulta em lote (o mapa, a lista de sugestões) não trazer linha por linha
 * para a aplicação; estas funções existem para a ficha do lote e para o teste.
 * Os dois lados têm de dar o mesmo número, e a duplicação é o preço: mexeu num,
 * mexa no outro. A conferência dos dois contra os mesmos casos entra com
 * `protocolo.db.test.ts`, na tarefa que materializa `lotes_etapas` (T6.5).
 *
 * A aritmética de data vem toda de `datas.ts`, nunca do `CURRENT_DATE` do banco:
 * o Neon roda em UTC e depois das 21h já está no dia seguinte.
 */

import { somaDias } from './datas';
import type { SituacaoEtapa } from './protocolo-rotulos';

/** O que a etapa declara no protocolo. */
export interface EtapaDoProtocolo {
  dias: number;
  intervaloDias: number | null;
  alertaLigado: boolean;
  /** Percentual próprio; nulo usa o de Configurações (RN-35). */
  janelaAvisoPct: number | null;
}

/** O que o lote já viveu naquela etapa. São fatos, e só fatos. */
export interface EstadoDaEtapa {
  /** Nula: a âncora ainda não ocorreu, e a etapa não vence nada. */
  dataAncora: string | null;
  /** Data real da execução anterior, nunca a planejada (RN-32). */
  ultimaExecucaoEm: string | null;
  ocorrencias: number;
}

/** O que a espécie sobrescreve, quando sobrescreve (RN-36). */
export interface TempoDaEspecie {
  dias: number | null;
  intervaloDias: number | null;
}

/**
 * O tempo que vale para a próxima ocorrência: o da espécie quando ela o declara,
 * senão o da etapa; `dias` na primeira ocorrência e `intervaloDias` nas
 * seguintes. Nulo quando a etapa sequencial já ocorreu, porque ela não tem
 * próxima.
 */
export function diasEfetivos(
  etapa: EtapaDoProtocolo,
  estado: Pick<EstadoDaEtapa, 'ocorrencias'>,
  especie: TempoDaEspecie | null,
): number | null {
  if (estado.ocorrencias === 0) return especie?.dias ?? etapa.dias;
  return especie?.intervaloDias ?? etapa.intervaloDias;
}

/**
 * RN-40: conta da execução real quando já houve uma, e da âncora quando nunca
 * houve. **Âncora não resolvida não vence nada**, e o nulo é informação: é o
 * estado de "classificar pós-germinação" enquanto o plantio não foi concluído.
 */
export function vencimentoDaEtapa(
  etapa: EtapaDoProtocolo,
  estado: EstadoDaEtapa,
  especie: TempoDaEspecie | null,
): string | null {
  const partida = estado.ultimaExecucaoEm ?? estado.dataAncora;
  if (partida === null) return null;
  const dias = diasEfetivos(etapa, estado, especie);
  if (dias === null) return null;
  return somaDias(partida, dias);
}

/** Dias de aviso: percentual do tempo efetivo, truncado. 20% de 90 dias são 18. */
export function diasDeAviso(
  etapa: EtapaDoProtocolo,
  estado: Pick<EstadoDaEtapa, 'ocorrencias'>,
  especie: TempoDaEspecie | null,
  janelaPadraoPct: number,
): number {
  const dias = diasEfetivos(etapa, estado, especie);
  if (dias === null) return 0;
  return Math.floor((dias * (etapa.janelaAvisoPct ?? janelaPadraoPct)) / 100);
}

/**
 * RF-52. `sem_alerta` na etapa que não avisa, e ela não recebe cor nenhuma, nem
 * verde: etapa diária colorida deixaria o viveiro inteiro em atraso toda manhã
 * (RN-35, TA-37). Nulo quando a etapa não vence nada.
 */
export function situacaoDaEtapa(
  etapa: EtapaDoProtocolo,
  estado: EstadoDaEtapa,
  especie: TempoDaEspecie | null,
  janelaPadraoPct: number,
  hoje: string,
): SituacaoEtapa | null {
  const vencimento = vencimentoDaEtapa(etapa, estado, especie);
  if (vencimento === null) return null;
  if (!etapa.alertaLigado) return 'sem_alerta';

  if (hoje > vencimento) return 'atraso';
  const aviso = diasDeAviso(etapa, estado, especie, janelaPadraoPct);
  return hoje >= somaDias(vencimento, -aviso) ? 'atencao' : 'em_dia';
}

/**
 * RN-33: a pendência é uma só, e o que muda é a idade dela. Etapa vencida há
 * cinco meses tem cinco meses de atraso, e não cinco pendências (RF-50, TA-42).
 * Zero quando está em dia ou quando não vence nada.
 */
export function diasDeAtraso(
  etapa: EtapaDoProtocolo,
  estado: EstadoDaEtapa,
  especie: TempoDaEspecie | null,
  hoje: string,
): number {
  const vencimento = vencimentoDaEtapa(etapa, estado, especie);
  if (vencimento === null || hoje <= vencimento) return 0;
  const umDia = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${vencimento}T00:00:00Z`)) / umDia);
}
