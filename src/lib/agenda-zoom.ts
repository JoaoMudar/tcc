import { somaDias } from './datas';
import { diasDaSemana, inicioDaSemana } from './semanas';

/**
 * O zoom do Gantt da semana: quantos dias a grade mostra de uma vez. A semana
 * continua sendo a unidade dos dados; o zoom só recorta a janela dentro dela, e
 * as setas andam no passo dele.
 */
export type Zoom = 'semana' | '3dias' | 'dia';

/** Do mais afastado ao mais próximo: é a ordem do seletor e da roda. */
export const ZOOMS: readonly Zoom[] = ['semana', '3dias', 'dia'];

export const ROTULO_ZOOM: Record<Zoom, string> = { semana: 'Semana', '3dias': '3 dias', dia: 'Dia' };

/** O cookie que guarda o zoom: o servidor o lê, e a grade nasce no zoom certo. */
export const COOKIE_ZOOM = 'agenda_zoom';

export function lerZoom(texto: string | undefined): Zoom {
  return ZOOMS.find((zoom) => zoom === texto) ?? 'semana';
}

/** Quantos dias cada zoom mostra. */
const LARGURA: Record<Zoom, number> = { semana: 5, '3dias': 3, dia: 1 };

/** Onde a janela começa, em dias desde a segunda: o dia escolhido, encostando no domingo. */
function inicioDaJanela(zoom: Zoom, indice: number, total: number): number {
  if (zoom === 'semana') return 0;
  return Math.max(0, Math.min(indice, total - Math.min(LARGURA[zoom], total)));
}

/**
 * Os dias que a grade desenha, dentro dos dias da semana (segunda a domingo).
 * A semana mostra só os dias úteis; o 3 dias começa no dia escolhido, preso na
 * semana (sexta, sábado e domingo mostram os três), e o Dia mostra só ele.
 */
export function diasDaJanela(zoom: Zoom, dia: string, diasSemana: readonly string[]): string[] {
  if (diasSemana.length === 0) return [];
  const largura = Math.min(LARGURA[zoom], diasSemana.length);
  const achado = diasSemana.indexOf(dia);
  const indice = achado >= 0 ? achado : dia < diasSemana[0] ? 0 : diasSemana.length - 1;
  const inicio = inicioDaJanela(zoom, indice, diasSemana.length);
  return diasSemana.slice(inicio, inicio + largura);
}

/** Último início possível do 3 dias: sexta, para a janela terminar no domingo. */
const ULTIMO_INICIO_3DIAS = 7 - LARGURA['3dias'];

/**
 * O dia para onde a seta leva: 7 dias na semana, 1 no Dia. O 3 dias anda de
 * janela em janela, sem sair da semana no meio: segunda, quinta, sexta, e a
 * segunda seguinte; para trás, o caminho inverso cai na sexta da semana anterior.
 */
export function passoDoZoom(zoom: Zoom, dia: string, direcao: 1 | -1): string {
  if (zoom === 'semana') return somaDias(dia, 7 * direcao);
  if (zoom === 'dia') return somaDias(dia, direcao);
  const segunda = inicioDaSemana(dia);
  const atual = inicioDaJanela(zoom, diasDaSemana(segunda).indexOf(dia), 7);
  if (direcao > 0) return atual === ULTIMO_INICIO_3DIAS ? somaDias(segunda, 7) : somaDias(segunda, Math.min(atual + 3, ULTIMO_INICIO_3DIAS));
  return atual === 0 ? somaDias(segunda, -7 + ULTIMO_INICIO_3DIAS) : somaDias(segunda, Math.max(atual - 3, 0));
}

/** Aproximar (1) ou afastar (-1), preso nas pontas. */
export function zoomVizinho(zoom: Zoom, sentido: 1 | -1): Zoom {
  const indice = Math.max(0, Math.min(ZOOMS.indexOf(zoom) + sentido, ZOOMS.length - 1));
  return ZOOMS[indice];
}
