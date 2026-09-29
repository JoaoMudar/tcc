import { formatQuantidade } from './lotes-rotulos';
import { formatAltura } from './pedidos-rotulos';

/**
 * P14: o que a viagem de entrega calcula sem banco nem rede. Fica fora de
 * `viagens.ts` para a tela poder usar: o link do Google Maps é refeito a cada
 * arraste, no celular, sem ida ao servidor.
 */

export const SITUACOES_VIAGEM = {
  montando: 'Carga',
  roteirizando: 'Rota',
  carregando: 'Carregamento',
  pronta: 'Pronta',
} as const;

export type SituacaoViagem = keyof typeof SITUACOES_VIAGEM;

export function isSituacaoViagem(valor: string): valor is SituacaoViagem {
  return Object.hasOwn(SITUACOES_VIAGEM, valor);
}

/** O que a sugestão de ordem devolve quando não deu: vai na URL, e a tela traduz. */
export const AVISOS_DA_ROTA = {
  mapa_indisponivel: 'Mapa indisponível agora. A ordem ficou como estava.',
  saida_nao_achada: 'O endereço de saída não foi achado no mapa. A ordem ficou como estava.',
} as const;

export type AvisoDaRota = keyof typeof AVISOS_DA_ROTA;

export function isAvisoDaRota(valor: string | undefined): valor is AvisoDaRota {
  return valor !== undefined && Object.hasOwn(AVISOS_DA_ROTA, valor);
}

/** Uma linha da lista que aparece enquanto se digita o endereço, como no Google Maps. */
export interface SugestaoDeEndereco {
  rotulo: string;
  lat: number;
  lng: number;
}

/**
 * A coordenada que veio do formulário, junto com o endereço escolhido na lista.
 * Qualquer coisa fora do mapa vale como ausente: o endereço em texto ainda é
 * procurado depois, como era antes da lista existir.
 */
export function lerCoordenada(lat: string, lng: string): { lat: number; lng: number } | null {
  if (lat.trim() === '' || lng.trim() === '') return null;
  const [y, x] = [Number(lat), Number(lng)];
  if (!Number.isFinite(y) || !Number.isFinite(x) || Math.abs(y) > 90 || Math.abs(x) > 180) return null;
  return { lat: y, lng: x };
}

/** Um ponto no mapa: pela coordenada, quando a API a achou, ou pelo texto. */
export interface PontoDaRota {
  lat: number | null;
  lng: number | null;
  endereco: string | null;
}

/** `Ipê-amarelo · 300 · 1,20 m`: o item em uma linha, sem o que ele não tem. */
export function resumoDoItem(item: { especie: string; quantidade: number | null; alturaM: number | null }): string {
  return [
    item.especie,
    item.quantidade === null ? null : formatQuantidade(item.quantidade),
    item.alturaM === null ? null : formatAltura(item.alturaM),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** O endereço do cadastro em uma linha, como a API de mapas e o Google o leem. */
export function enderecoEmTexto(endereco: {
  logradouro: string | null;
  cidade: string | null;
  uf: string | null;
}): string | null {
  const partes = [endereco.logradouro, endereco.cidade, endereco.uf].map((p) => p?.trim()).filter(Boolean);
  return partes.length > 0 ? partes.join(', ') : null;
}

/**
 * **A ordem de pôr no caminhão é a inversa da rota.** A última entrega vai
 * primeiro, para o fundo; a primeira vai por último, perto da porta. A parada
 * avulsa não tem item, e fica de fora.
 */
export function ordemDeCarregamento<T extends { pedidoId: string | null }>(paradas: readonly T[]): T[] {
  return paradas.filter((parada) => parada.pedidoId !== null).reverse();
}

/** O Google Maps aceita a origem, o destino e no máximo 9 pontos no meio. */
const PARADAS_POR_LINK = 10;

function pontoEmTexto(ponto: PontoDaRota): string | null {
  if (ponto.lat !== null && ponto.lng !== null) return `${ponto.lat},${ponto.lng}`;
  return ponto.endereco?.trim() || null;
}

function urlDoTrecho(origem: string, destinos: readonly string[]): string {
  const busca = new URLSearchParams({ api: '1', origin: origem, destination: destinos[destinos.length - 1] });
  if (destinos.length > 1) busca.set('waypoints', destinos.slice(0, -1).join('|'));
  busca.set('travelmode', 'driving');
  return `https://www.google.com/maps/dir/?${busca.toString()}`;
}

/**
 * O trajeto na ordem da tela, para abrir no Google Maps. Não usa chave e
 * funciona com a API de rotas fora do ar: cada ponto vai pela coordenada ou,
 * sem ela, pelo endereço em texto. O que não tem endereço fica de fora.
 *
 * Com mais de 10 paradas, devolve mais de um link: o segundo parte da 10ª.
 */
export function linkGoogleMaps(partida: PontoDaRota, paradas: readonly PontoDaRota[]): string[] {
  const origem = pontoEmTexto(partida);
  const destinos = paradas.map(pontoEmTexto).filter((ponto): ponto is string => ponto !== null);
  if (!origem || destinos.length === 0) return [];

  const links: string[] = [];
  let saida = origem;
  for (let inicio = 0; inicio < destinos.length; inicio += PARADAS_POR_LINK) {
    const trecho = destinos.slice(inicio, inicio + PARADAS_POR_LINK);
    links.push(urlDoTrecho(saida, trecho));
    saida = trecho[trecho.length - 1];
  }
  return links;
}

/** `cerca de 42 km · 1 h 05 min`, ou `cerca de 900 m · 12 min`. */
export function formatDistancia(distanciaM: number, duracaoS: number | null): string {
  const distancia = distanciaM < 1000 ? `${distanciaM} m` : `${Math.round(distanciaM / 1000)} km`;
  if (duracaoS === null) return `cerca de ${distancia}`;
  const minutos = Math.round(duracaoS / 60);
  const tempo =
    minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
  return `cerca de ${distancia} · ${tempo}`;
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** 2026-10-02 → `sexta, 02/10`. Lido em UTC, como `somaDias`, para o fuso não trocar o dia. */
export function formatDiaDaViagem(iso: string): string {
  const dia = DIAS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  return `${dia}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * A ordem sugerida posta sobre as paradas: as que a API ordenou vêm primeiro, na
 * ordem dela, e as que ela não pôde situar vão para o fim, na ordem em que
 * estavam, para a pessoa posicioná-las à mão.
 */
export function aplicarOrdemSugerida(atual: readonly string[], sugerida: readonly string[]): string[] {
  const conhecidas = new Set(atual);
  const primeiro = sugerida.filter((id) => conhecidas.has(id));
  const vistas = new Set(primeiro);
  return [...primeiro, ...atual.filter((id) => !vistas.has(id))];
}

/** Move um item da lista de uma posição para outra, como o arraste faz. */
export function moverNaLista<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) return [...lista];
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return nova;
}
