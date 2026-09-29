import 'server-only';

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
