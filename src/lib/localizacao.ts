import { lerCoordenada } from './rotas';

/**
 * P17: a localização que o cliente manda pelo WhatsApp, colada como texto.
 *
 * O WhatsApp não manda um formato só. No Android, a localização fixa chega
 * como link do Google Maps (`maps.google.com/maps?q=-27.21%2C-49.64`); no
 * iPhone, às vezes como link do Apple Maps (`maps.apple.com/?ll=...`). Quem
 * abre o ponto no Maps e compartilha manda o link longo (`.../@-27.21,-49.64,17z`)
 * ou o curto (`maps.app.goo.gl/...`), e quem copia o número manda só o par.
 *
 * Esta função lê o que dá para ler sem rede. O link curto não traz o ponto:
 * `ehLinkCurto` o reconhece, e o servidor segue o redirecionamento.
 */

export interface Ponto {
  lat: number;
  lng: number;
}

const NUMERO = String.raw`-?\d{1,3}(?:\.\d+)?`;
/** "-27.2141, -49.6431", com espaço, vírgula ou ponto e vírgula entre os dois. */
const PAR = new RegExp(String.raw`(${NUMERO})\s*[,;]\s*(${NUMERO})`);
/** O "@-27.21,-49.64" do link longo do Google Maps. */
const ARROBA = new RegExp(String.raw`@(${NUMERO}),(${NUMERO})`);
/** O "!3d-27.21!4d-49.64" do link de lugar do Google Maps: é o ponto do lugar, e vale mais que o @. */
const LUGAR = new RegExp(String.raw`!3d(${NUMERO})!4d(${NUMERO})`);

/** Os parâmetros que carregam o ponto, na ordem em que se confia neles. */
const PARAMETROS = ['q', 'query', 'll', 'sll', 'daddr', 'destination', 'center'];

function ponto(lat: string, lng: string): Ponto | null {
  const lido = lerCoordenada(lat, lng);
  // (0, 0) é o golfo da Guiné: é o link quebrado, e não o cliente
  if (!lido || (lido.lat === 0 && lido.lng === 0)) return null;
  return { lat: Math.round(lido.lat * 1e6) / 1e6, lng: Math.round(lido.lng * 1e6) / 1e6 };
}

function doPar(texto: string): Ponto | null {
  const achado = PAR.exec(texto);
  return achado ? ponto(achado[1], achado[2]) : null;
}

function daUrl(url: URL): Ponto | null {
  const lugar = LUGAR.exec(decodeURIComponent(url.href));
  if (lugar) return ponto(lugar[1], lugar[2]);
  for (const nome of PARAMETROS) {
    const valor = url.searchParams.get(nome);
    if (valor) {
      const achado = doPar(valor.replace(/^loc:/i, ''));
      if (achado) return achado;
    }
  }
  const arroba = ARROBA.exec(decodeURIComponent(url.pathname));
  return arroba ? ponto(arroba[1], arroba[2]) : null;
}

/** O ponto que o texto colado traz, ou `null` se ele não traz nenhum que se leia sem rede. */
export function lerLocalizacao(texto: string): Ponto | null {
  const limpo = texto.trim();
  if (limpo === '' || limpo.length > 2000) return null;

  const geo = /^geo:(-?[\d.]+),(-?[\d.]+)/i.exec(limpo);
  if (geo) return ponto(geo[1], geo[2]);

  const link = /https?:\/\/\S+/i.exec(limpo);
  if (link) {
    try {
      return daUrl(new URL(link[0]));
    } catch {
      return null;
    }
  }
  return doPar(limpo);
}

/** Os encurtadores do Google Maps. Só eles são seguidos: o servidor não busca endereço qualquer. */
const HOSTS_CURTOS = new Set(['maps.app.goo.gl', 'goo.gl']);

/** O link curto que só o servidor consegue abrir, já validado. */
export function linkCurto(texto: string): URL | null {
  const link = /https?:\/\/\S+/i.exec(texto.trim());
  if (!link) return null;
  try {
    const url = new URL(link[0]);
    if (url.protocol !== 'https:' || !HOSTS_CURTOS.has(url.hostname)) return null;
    if (url.hostname === 'goo.gl' && !url.pathname.startsWith('/maps')) return null;
    return url;
  } catch {
    return null;
  }
}

/** Os domínios do Google Maps, por extenso: padrão aberto deixaria passar `google.com.qualquer.coisa`. */
const HOSTS_DO_MAPS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'google.com.br',
  'www.google.com.br',
  'maps.google.com.br',
]);

/** Os destinos que o link curto pode apontar: o próprio Google Maps. */
export function ehDestinoDoMaps(url: URL): boolean {
  return url.protocol === 'https:' && (HOSTS_CURTOS.has(url.hostname) || HOSTS_DO_MAPS.has(url.hostname));
}

/** "-27.214100, -49.643100", para mostrar o ponto e para o link "ver no mapa". */
export function pontoEmTexto(ponto: Ponto): string {
  return `${ponto.lat.toFixed(6)}, ${ponto.lng.toFixed(6)}`;
}

export function linkDoPonto(ponto: Ponto): string {
  return `https://www.google.com/maps/search/?api=1&query=${ponto.lat},${ponto.lng}`;
}
