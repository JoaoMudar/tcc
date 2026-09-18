// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/session', () => ({ getCurrentSession: vi.fn() }));
vi.mock('@/lib/db', () => ({ default: { query: vi.fn() } }));

const { getCurrentSession } = await import('@/lib/auth/session');
const { default: pool } = await import('@/lib/db');
const { GET } = await import('../route');

const ID = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1]);

function chamar(id: string) {
  return GET(new Request(`http://localhost/api/fotos/${id}`), { params: Promise.resolve({ id }) } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/fotos/[id]', () => {
  it('sem sessão: 401, sem ir ao banco', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    expect((await chamar(ID)).status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('id que não é uuid: 400', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({ perfil: 'gerencia' } as never);
    expect((await chamar("1' OR '1")).status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('foto inexistente: 404', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({ perfil: 'gerencia' } as never);
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
    expect((await chamar(ID)).status).toBe(404);
  });

  it('devolve os bytes com o tipo do banco e cache privado', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({ perfil: 'chefia' } as never);
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ tipoConteudo: 'image/jpeg', conteudo: JPEG }] } as never);
    const response = await chamar(ID);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Cache-Control')).toContain('private');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(JPEG);
  });
});
