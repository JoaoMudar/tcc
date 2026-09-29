// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapaIndisponivel, geocodificarTexto, otimizarOrdem } from '../rotas-ors';

const fetchMock = vi.fn();

function responde(corpo: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(corpo), { status }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('ORS_API_KEY', 'chave-de-teste');
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('geocodificarTexto', () => {
  it('devolve lat e lng (a API manda lng primeiro), só no Brasil', async () => {
    responde({ features: [{ geometry: { coordinates: [-49.6431234, -27.2141234] } }] });
    await expect(geocodificarTexto('Rua XV, Rio do Sul, SC')).resolves.toEqual({ lat: -27.214123, lng: -49.643123 });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/geocode/search');
    expect(url.searchParams.get('text')).toBe('Rua XV, Rio do Sul, SC');
    expect(url.searchParams.get('boundary.country')).toBe('BR');
  });

  it('endereço que a API não acha é null, e não erro', async () => {
    responde({ features: [] });
    await expect(geocodificarTexto('lugar nenhum')).resolves.toBeNull();
  });

  it('sem chave, nem chega a consultar', async () => {
    vi.stubEnv('ORS_API_KEY', '');
    await expect(geocodificarTexto('Ibirama')).rejects.toBeInstanceOf(MapaIndisponivel);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('API fora do ar ou recusando é MapaIndisponivel', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(geocodificarTexto('Ibirama')).rejects.toBeInstanceOf(MapaIndisponivel);
    responde({ error: 'quota' }, 429);
    await expect(geocodificarTexto('Ibirama')).rejects.toBeInstanceOf(MapaIndisponivel);
  });
});

describe('otimizarOrdem', () => {
  const partida = { lat: -27.4, lng: -49.8 };
  const paradas = [
    { id: 'a', lat: -27.2, lng: -49.6 },
    { id: 'b', lat: -27.0, lng: -49.5 },
    { id: 'c', lat: -26.9, lng: -48.6 },
  ];

  it('traduz os passos da rota de volta para as paradas', async () => {
    responde({
      routes: [
        {
          steps: [{ type: 'start' }, { type: 'job', id: 2 }, { type: 'job', id: 3 }, { type: 'job', id: 1 }],
          distance: 123456.7,
          duration: 7200.4,
        },
      ],
    });
    await expect(otimizarOrdem(partida, paradas)).resolves.toEqual({
      ordem: ['b', 'c', 'a'],
      distanciaM: 123457,
      duracaoS: 7200,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/optimization$/);
    const corpo = JSON.parse(String(init.body));
    expect(corpo.vehicles[0].start).toEqual([-49.8, -27.4]);
    expect(corpo.jobs[0]).toEqual({ id: 1, location: [-49.6, -27.2] });
    expect(init.headers.Authorization).toBe('chave-de-teste');
  });

  it('sem parada, não consulta', async () => {
    await expect(otimizarOrdem(partida, [])).resolves.toEqual({ ordem: [], distanciaM: 0, duracaoS: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resposta sem rota é MapaIndisponivel', async () => {
    responde({ routes: [] });
    await expect(otimizarOrdem(partida, paradas)).rejects.toBeInstanceOf(MapaIndisponivel);
  });
});
