// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../rotas-ors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../rotas-ors')>()),
  geocodificarTexto: vi.fn(),
  otimizarOrdem: vi.fn(),
}));

const { MapaIndisponivel, geocodificarTexto, otimizarOrdem } = await import('../rotas-ors');
const { sugerirRota } = await import('../viagens');

const VIAGEM = 'aaaaaaaa-0000-4000-8000-000000000001';

interface Linha {
  id: string;
  pedidoId: string | null;
  logradouro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  enderecoId?: string | null;
  enderecoAvulso?: string | null;
  lat?: number | null;
  lng?: number | null;
  naoAchado?: boolean;
}

let partida: { partidaLat: number | null; partidaLng: number | null };
let linhas: Linha[];

const client = { query: vi.fn(), release: vi.fn() };
const mockPool = { query: vi.fn(), connect: vi.fn(async () => client) };
/** O que `sugerirRota` usa do pool: `query` e `connect`, com o cliente falso. */
const pool = mockPool as unknown as Parameters<typeof sugerirRota>[0];

function responder(sql: unknown) {
  const texto = String(sql);
  if (texto.includes('FROM viagens v WHERE v.id')) {
    return {
      rows: [
        {
          id: VIAGEM,
          data: '2026-10-02',
          partidaDescricao: 'Agrolândia, SC',
          ...partida,
          situacao: 'roteirizando',
          sugerirOrdem: true,
          distanciaM: null,
          duracaoS: null,
        },
      ],
      rowCount: 1,
    };
  }
  if (texto.includes('FROM viagens_paradas vp')) {
    return {
      rows: linhas.map((linha) => ({
        logradouro: null,
        cidade: null,
        uf: null,
        enderecoId: null,
        enderecoAvulso: null,
        lat: null,
        lng: null,
        naoAchado: false,
        ...linha,
      })),
      rowCount: linhas.length,
    };
  }
  if (texto.startsWith('SELECT id FROM viagens_paradas')) {
    return { rows: linhas.map((linha) => ({ id: linha.id })), rowCount: linhas.length };
  }
  return { rows: [], rowCount: 1 };
}

/** A ordem que `salvarOrdem` gravou, parada por parada. */
function ordemGravada(): string[] {
  return client.query.mock.calls
    .filter(([sql]) => String(sql).startsWith('UPDATE viagens_paradas SET ordem'))
    .sort(([, a], [, b]) => a[1] - b[1])
    .map(([, params]) => params[0]);
}

function gravou(trecho: string) {
  return [...mockPool.query.mock.calls, ...client.query.mock.calls].filter(([sql]) => String(sql).includes(trecho));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPool.query.mockImplementation(async (sql: unknown) => responder(sql));
  client.query.mockImplementation(async (sql: unknown) => responder(sql));
  partida = { partidaLat: -27.4, partidaLng: -49.8 };
  linhas = [
    { id: 'p-situada', pedidoId: 'ped-1', lat: -27.2, lng: -49.6 },
    { id: 'p-a-achar', pedidoId: 'ped-2', logradouro: 'Rua XV, 10', cidade: 'Rio do Sul', uf: 'SC', enderecoId: 'end-2' },
    { id: 'p-sem-endereco', pedidoId: 'ped-3' },
    { id: 'avulsa', pedidoId: null },
  ];
});

describe('sugerirRota', () => {
  it('geocodifica o que falta, guarda no endereço e grava a ordem da API', async () => {
    vi.mocked(geocodificarTexto).mockResolvedValue({ lat: -27.21, lng: -49.64 });
    vi.mocked(otimizarOrdem).mockResolvedValue({ ordem: ['p-a-achar', 'p-situada'], distanciaM: 50_000, duracaoS: 3600 });

    await expect(sugerirRota(pool, VIAGEM)).resolves.toBeNull();

    expect(geocodificarTexto).toHaveBeenCalledTimes(1);
    expect(geocodificarTexto).toHaveBeenCalledWith('Rua XV, 10, Rio do Sul, SC');
    const cache = gravou('UPDATE cadastro.pessoas_enderecos');
    expect(cache).toHaveLength(1);
    expect(cache[0][1]).toEqual(['end-2', -27.21, -49.64]);

    // O que a API não situou vai para o fim, na ordem em que estava
    expect(ordemGravada()).toEqual(['p-a-achar', 'p-situada', 'p-sem-endereco', 'avulsa']);
    const rota = gravou('UPDATE viagens SET sugerir_ordem = false');
    expect(rota[0][1]).toEqual([VIAGEM, 50_000, 3600]);
  });

  it('endereço que a API não acha fica guardado como procurado, e a parada vai para o fim', async () => {
    vi.mocked(geocodificarTexto).mockResolvedValue(null);
    vi.mocked(otimizarOrdem).mockResolvedValue({ ordem: ['p-situada'], distanciaM: 1000, duracaoS: 60 });

    await expect(sugerirRota(pool, VIAGEM)).resolves.toBeNull();
    expect(gravou('UPDATE cadastro.pessoas_enderecos')[0][1]).toEqual(['end-2', null, null]);
    expect(ordemGravada()).toEqual(['p-situada', 'p-a-achar', 'p-sem-endereco', 'avulsa']);
  });

  it('endereço já procurado e não achado não gasta outra consulta', async () => {
    linhas[1].naoAchado = true;
    vi.mocked(otimizarOrdem).mockResolvedValue({ ordem: ['p-situada'], distanciaM: 1000, duracaoS: 60 });
    await sugerirRota(pool, VIAGEM);
    expect(geocodificarTexto).not.toHaveBeenCalled();
  });

  it('API fora do ar: mantém a ordem e avisa', async () => {
    vi.mocked(geocodificarTexto).mockRejectedValue(new MapaIndisponivel('sem resposta'));

    await expect(sugerirRota(pool, VIAGEM)).resolves.toBe('mapa_indisponivel');
    expect(ordemGravada()).toEqual([]);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it('sem chave: mantém a ordem e avisa', async () => {
    vi.mocked(geocodificarTexto).mockResolvedValue({ lat: -27.21, lng: -49.64 });
    vi.mocked(otimizarOrdem).mockRejectedValue(new MapaIndisponivel('sem chave'));

    await expect(sugerirRota(pool, VIAGEM)).resolves.toBe('mapa_indisponivel');
    expect(ordemGravada()).toEqual([]);
  });

  it('saída que o mapa não acha: avisa sem pedir ordem', async () => {
    partida = { partidaLat: null, partidaLng: null };
    vi.mocked(geocodificarTexto).mockResolvedValueOnce(null);

    await expect(sugerirRota(pool, VIAGEM)).resolves.toBe('saida_nao_achada');
    expect(otimizarOrdem).not.toHaveBeenCalled();
  });

  it('a saída achada fica guardada na viagem', async () => {
    partida = { partidaLat: null, partidaLng: null };
    linhas = [{ id: 'p-situada', pedidoId: 'ped-1', lat: -27.2, lng: -49.6 }];
    vi.mocked(geocodificarTexto).mockResolvedValueOnce({ lat: -27.41, lng: -49.82 });
    vi.mocked(otimizarOrdem).mockResolvedValue({ ordem: ['p-situada'], distanciaM: 1000, duracaoS: 60 });

    await sugerirRota(pool, VIAGEM);
    expect(gravou('SET partida_lat')[0][1]).toEqual([VIAGEM, -27.41, -49.82]);
    expect(otimizarOrdem).toHaveBeenCalledWith({ lat: -27.41, lng: -49.82 }, [{ id: 'p-situada', lat: -27.2, lng: -49.6 }]);
  });
});
