import 'server-only';
import type { SugestaoDeEndereco } from './rotas';

/**
 * P14: o cliente do OpenRouteService, a API de mapas da viagem de entrega.
 *
 * **O planejamento nunca trava por causa do mapa.** Sem chave, com a API fora do
 * ar ou lenta, as funções lançam `MapaIndisponivel`, e quem chama mantém a ordem
 * atual com um aviso. A chave fica só no servidor (`ORS_API_KEY`).
 */

const BASE = 'https://api.openrouteservice.org';
const TEMPO_LIMITE_MS = 8000;

export class MapaIndisponivel extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'MapaIndisponivel';
  }
}

export interface Coordenada {
  lat: number;
  lng: number;
}

function chave(): string {
  const valor = process.env.ORS_API_KEY?.trim();
  if (!valor) throw new MapaIndisponivel('sem chave');
  return valor;
}

async function pedir(url: string, init: RequestInit = {}): Promise<unknown> {
  let resposta: Response;
  try {
    resposta = await fetch(url, { ...init, signal: AbortSignal.timeout(TEMPO_LIMITE_MS), cache: 'no-store' });
  } catch {
    throw new MapaIndisponivel('sem resposta');
  }
  if (!resposta.ok) throw new MapaIndisponivel(`HTTP ${resposta.status}`);
  try {
    return await resposta.json();
  } catch {
    throw new MapaIndisponivel('resposta ilegível');
  }
}

/** Seis casas: cerca de 10 cm, e é o que a coluna guarda. */
function arredonda(valor: number): number {
  return Math.round(valor * 1e6) / 1e6;
}

/**
 * O endereço em texto vira coordenada (`/geocode/search`), só no Brasil.
 * `null` é "a API respondeu e não achou", diferente de estar fora do ar.
 */
export async function geocodificarTexto(texto: string): Promise<Coordenada | null> {
  const busca = new URLSearchParams({ api_key: chave(), text: texto, 'boundary.country': 'BR', size: '1' });
  const corpo = (await pedir(`${BASE}/geocode/search?${busca.toString()}`)) as {
    features?: { geometry?: { coordinates?: [number, number] } }[];
  };
  const coordenadas = corpo.features?.[0]?.geometry?.coordinates;
  if (!coordenadas || !Number.isFinite(coordenadas[0]) || !Number.isFinite(coordenadas[1])) return null;
  return { lng: arredonda(coordenadas[0]), lat: arredonda(coordenadas[1]) };
}

/** Agrolândia (SC): a busca prefere o que fica perto do viveiro, sem excluir o resto. */
const FOCO = { lat: '-27.4086', lng: '-49.8219' };

interface FeatureDoMapa {
  properties?: { label?: string; name?: string; layer?: string };
  geometry?: { coordinates?: [number, number] };
}

/**
 * O número da casa no texto digitado: um termo só de dígitos (com letra
 * opcional, como "300A"). O CEP (`89185-000`) tem hífen e fica de fora.
 */
export function numeroDaCasa(texto: string): string | null {
  return texto.split(/[\s,]+/).find((termo) => /^\d{1,5}[a-z]?$/i.test(termo)) ?? null;
}

async function consultarLugares(rota: 'autocomplete' | 'search', texto: string): Promise<FeatureDoMapa[]> {
  const busca = new URLSearchParams({
    api_key: chave(),
    text: texto,
    'boundary.country': 'BR',
    'focus.point.lat': FOCO.lat,
    'focus.point.lon': FOCO.lng,
    size: '5',
  });
  const corpo = (await pedir(`${BASE}/geocode/${rota}?${busca.toString()}`)) as { features?: FeatureDoMapa[] };
  return corpo.features ?? [];
}

/**
 * A lista que aparece enquanto se digita um endereço (`/geocode/autocomplete`),
 * só no Brasil. Escolher uma linha já traz a coordenada, e o endereço não
 * precisa ser procurado de novo na hora de sugerir a ordem.
 *
 * O autocomplete não sabe cair para a rua: com um número que a base não tem
 * (quase todos, no interior), volta vazio. Aí a busca completa (`/geocode/search`)
 * acha a rua, e o número digitado entra no rótulo para não se perder na escolha.
 */
export async function sugerirEnderecos(texto: string): Promise<SugestaoDeEndereco[]> {
  let features = await consultarLugares('autocomplete', texto);
  if (features.length === 0) features = await consultarLugares('search', texto);

  const numero = numeroDaCasa(texto);
  const vistos = new Set<string>();
  return features.flatMap((feature) => {
    const { label, name, layer } = feature.properties ?? {};
    const coordenadas = feature.geometry?.coordinates;
    if (!label || !coordenadas || !Number.isFinite(coordenadas[0]) || !Number.isFinite(coordenadas[1])) return [];
    const comNumero =
      numero && layer === 'street' && name && label.startsWith(name) && !name.includes(numero)
        ? `${name}, ${numero}${label.slice(name.length)}`
        : label;
    if (vistos.has(comNumero)) return [];
    vistos.add(comNumero);
    return [{ rotulo: comNumero, lng: arredonda(coordenadas[0]), lat: arredonda(coordenadas[1]) }];
  });
}

export interface RotaOtimizada {
  /** Os `id` das paradas, na ordem da rota. As que a API não encaixou ficam de fora. */
  ordem: string[];
  distanciaM: number | null;
  duracaoS: number | null;
}

/**
 * A melhor ordem a partir da partida (`/optimization`, o VROOM do ORS). Rota
 * aberta: o caminhão sai do viveiro e a sugestão termina na última entrega.
 */
export async function otimizarOrdem(
  partida: Coordenada,
  paradas: readonly (Coordenada & { id: string })[],
): Promise<RotaOtimizada> {
  if (paradas.length === 0) return { ordem: [], distanciaM: 0, duracaoS: 0 };

  // O VROOM quer id numérico: a posição na lista faz a ponte
  const corpo = (await pedir(`${BASE}/optimization`, {
    method: 'POST',
    headers: { Authorization: chave(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobs: paradas.map((parada, indice) => ({ id: indice + 1, location: [parada.lng, parada.lat] })),
      vehicles: [{ id: 1, profile: 'driving-car', start: [partida.lng, partida.lat] }],
      options: { g: true },
    }),
  })) as {
    routes?: { steps?: { type?: string; id?: number; job?: number }[]; distance?: number; duration?: number }[];
  };

  const rota = corpo.routes?.[0];
  if (!rota?.steps) throw new MapaIndisponivel('sem rota');
  const ordem = rota.steps
    .filter((passo) => passo.type === 'job')
    .map((passo) => paradas[(passo.id ?? passo.job ?? 0) - 1]?.id)
    .filter((id): id is string => id !== undefined);

  return {
    ordem,
    distanciaM: typeof rota.distance === 'number' ? Math.round(rota.distance) : null,
    duracaoS: typeof rota.duration === 'number' ? Math.round(rota.duration) : null,
  };
}

/**
 * P17: a distância de carro entre dois pontos (`/v2/directions/driving-car`),
 * em metros. É a base da sugestão de frete (RN-64).
 */
export async function distanciaDeCarro(origem: Coordenada, destino: Coordenada): Promise<number> {
  const busca = new URLSearchParams({
    api_key: chave(),
    start: `${origem.lng},${origem.lat}`,
    end: `${destino.lng},${destino.lat}`,
  });
  const corpo = (await pedir(`${BASE}/v2/directions/driving-car?${busca.toString()}`)) as {
    features?: { properties?: { summary?: { distance?: number } } }[];
  };
  const distancia = corpo.features?.[0]?.properties?.summary?.distance;
  if (typeof distancia !== 'number' || !Number.isFinite(distancia)) throw new MapaIndisponivel('sem rota');
  return Math.round(distancia);
}

/** O endereço achado para um ponto, nos campos do cadastro. */
export interface EnderecoDoPonto {
  logradouro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
}

/**
 * P17: o ponto vira endereço (`/geocode/reverse`). Serve à localização colada
 * do WhatsApp, que chega só com a coordenada. `null` é "a API não achou nada".
 */
export async function enderecoDoPonto(ponto: Coordenada): Promise<EnderecoDoPonto | null> {
  const busca = new URLSearchParams({
    api_key: chave(),
    'point.lat': String(ponto.lat),
    'point.lon': String(ponto.lng),
    'boundary.country': 'BR',
    size: '1',
  });
  const corpo = (await pedir(`${BASE}/geocode/reverse?${busca.toString()}`)) as {
    features?: {
      properties?: {
        name?: string;
        street?: string;
        housenumber?: string;
        locality?: string;
        localadmin?: string;
        county?: string;
        region_a?: string;
        postalcode?: string;
      };
    }[];
  };
  const lugar = corpo.features?.[0]?.properties;
  if (!lugar) return null;
  const logradouro = lugar.street ? [lugar.street, lugar.housenumber].filter(Boolean).join(', ') : (lugar.name ?? null);
  const uf = lugar.region_a && /^[A-Z]{2}$/i.test(lugar.region_a) ? lugar.region_a.toUpperCase() : null;
  return {
    logradouro,
    cidade: lugar.locality ?? lugar.localadmin ?? lugar.county ?? null,
    uf,
    cep: lugar.postalcode ?? null,
  };
}
