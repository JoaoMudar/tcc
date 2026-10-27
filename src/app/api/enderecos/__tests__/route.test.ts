// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/auth/session-store';

vi.mock('@/lib/auth/session', () => ({ getCurrentSession: vi.fn() }));
vi.mock('@/lib/rotas-ors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rotas-ors')>()),
  sugerirEnderecos: vi.fn(),
}));

const { getCurrentSession } = await import('@/lib/auth/session');
const { MapaIndisponivel, sugerirEnderecos } = await import('@/lib/rotas-ors');
const { GET } = await import('../route');

const GERENCIA: SessionUser = {
  sessaoId: 's1',
  usuarioId: 'u1',
  login: 'x',
  nomeExibicao: 'X',
  perfil: 'gerencia',
  deveTrocarSenha: false,
  expiraEm: new Date(),
  ultimoUsoEm: new Date(),
};

const POSTO = { rotulo: 'Posto Ipiranga, Rio do Sul, SC', lat: -27.2, lng: -49.6 };

function buscar(texto: string) {
  return GET(new Request(`http://localhost/api/enderecos?q=${encodeURIComponent(texto)}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentSession).mockResolvedValue(GERENCIA);
  vi.mocked(sugerirEnderecos).mockResolvedValue([POSTO]);
});

describe('GET /api/enderecos', () => {
  it('devolve as sugestões do mapa', async () => {
    const resposta = await buscar('  posto rio ');
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual([POSTO]);
    expect(sugerirEnderecos).toHaveBeenCalledWith('posto rio');
  });

  it('sem sessão é 401, e não consulta o mapa', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    expect((await buscar('posto rio')).status).toBe(401);
    expect(sugerirEnderecos).not.toHaveBeenCalled();
  });

  it('quem ainda precisa trocar a senha também não busca', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({ ...GERENCIA, deveTrocarSenha: true });
    expect((await buscar('posto rio')).status).toBe(401);
  });

  it('texto curto ou longo demais é lista vazia, sem consultar o mapa', async () => {
    expect(await (await buscar('po')).json()).toEqual([]);
    expect(await (await buscar('x'.repeat(201))).json()).toEqual([]);
    expect(sugerirEnderecos).not.toHaveBeenCalled();
  });

  it('mapa fora do ar é lista vazia, e não erro', async () => {
    vi.mocked(sugerirEnderecos).mockRejectedValue(new MapaIndisponivel('sem chave'));
    const resposta = await buscar('Rio do Sul');
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual([]);
  });
});
