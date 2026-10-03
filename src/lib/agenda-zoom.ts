import { diaUtilAnterior, proximoDiaUtil, somaDias } from './datas';

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

/**
 * Os dias que a grade desenha, dentro dos dias úteis da semana. O dia fica no
 * meio da janela, presa nas pontas da semana; sábado e domingo caem na sexta.
 */
export function diasDaJanela(zoom: Zoom, dia: string, diasUteis: readonly string[]): string[] {
  if (zoom === 'semana' || diasUteis.length === 0) return [...diasUteis];
  const largura = Math.min(LARGURA[zoom], diasUteis.length);
  const achado = diasUteis.indexOf(dia);
  const indice = achado >= 0 ? achado : dia < diasUteis[0] ? 0 : diasUteis.length - 1;
  const inicio = Math.max(0, Math.min(indice - Math.floor(largura / 2), diasUteis.length - largura));
  return diasUteis.slice(inicio, inicio + largura);
}

/** O dia para onde a seta leva: 7 dias na semana, e dias úteis nos zooms menores. */
export function passoDoZoom(zoom: Zoom, dia: string, direcao: 1 | -1): string {
  if (zoom === 'semana') return somaDias(dia, 7 * direcao);
  let destino = dia;
  for (let i = 0; i < LARGURA[zoom]; i++) destino = direcao > 0 ? proximoDiaUtil(destino) : diaUtilAnterior(destino);
  return destino;
}

/** Aproximar (1) ou afastar (-1), preso nas pontas. */
export function zoomVizinho(zoom: Zoom, sentido: 1 | -1): Zoom {
  const indice = Math.max(0, Math.min(ZOOMS.indexOf(zoom) + sentido, ZOOMS.length - 1));
  return ZOOMS[indice];
}
