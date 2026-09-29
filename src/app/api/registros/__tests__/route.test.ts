// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/auth/session-store';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getCurrentSession: vi.fn() }));
vi.mock('@/lib/registros-campo', () => ({ processarRegistro: vi.fn() }));

const { getCurrentSession } = await import('@/lib/auth/session');
const { processarRegistro } = await import('@/lib/registros-campo');
const { revalidatePath } = await import('next/cache');
const { POST } = await import('../route');

const CHAVE = '9d0e2f6a-7b8c-4d1a-8e0f-3a7b8c9d0e1f';
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

function pedido(corpo: unknown, tipo = 'application/json'): Request {
  return new Request('http://localhost/api/registros', {
    method: 'POST',
    headers: { 'Content-Type': tipo },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  });
}

const VALIDO = { chave: CHAVE, tipo: 'perda', campos: { lote_id: 'l1', quantidade: '5', causa: 'seca' } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentSession).mockResolvedValue(GERENCIA);
});

describe('POST /api/registros (T9.3)', () => {
  it('sem sessão, ou com a senha provisória, responde 401 sem processar', async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);
    expect((await POST(pedido(VALIDO))).status).toBe(401);
    vi.mocked(getCurrentSession).mockResolvedValueOnce({ ...GERENCIA, deveTrocarSenha: true });
    expect((await POST(pedido(VALIDO))).status).toBe(401);
    expect(processarRegistro).not.toHaveBeenCalled();
  });

  it.each([
    ['sem ser JSON', pedido('chave=1', 'application/x-www-form-urlencoded'), 415],
    ['JSON quebrado', pedido('{', 'application/json'), 400],
    ['chave que não é identificador', pedido({ ...VALIDO, chave: '1' }), 400],
    ['tipo fora da lista', pedido({ ...VALIDO, tipo: 'venda' }), 400],
    ['campo que não é texto', pedido({ ...VALIDO, campos: { quantidade: 5 } }), 400],
  ])('recusa %s', async (_caso, req, status) => {
    expect((await POST(req)).status).toBe(status);
    expect(processarRegistro).not.toHaveBeenCalled();
  });

  it('perfil sem permissão responde 403', async () => {
    vi.mocked(processarRegistro).mockResolvedValue({ status: 'proibido' });
    const r = await POST(pedido(VALIDO));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: 'Seu perfil não permite esta operação.' });
  });

  it('recusado responde 422 com a mensagem e os campos', async () => {
    vi.mocked(processarRegistro).mockResolvedValue({ status: 'recusado', error: 'Saldo insuficiente.', fields: { quantidade: '5' } });
    const r = await POST(pedido(VALIDO));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ error: 'Saldo insuficiente.', fields: { quantidade: '5' } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('gravado responde 200, com o autor da sessão, e revalida a produção', async () => {
    vi.mocked(processarRegistro).mockResolvedValue({ status: 'gravado', success: 'Perda registrada.', repetido: false });
    const r = await POST(pedido(VALIDO));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ success: 'Perda registrada.', repetido: false });
    expect(processarRegistro).toHaveBeenCalledWith('perda', CHAVE, VALIDO.campos, GERENCIA);
    expect(revalidatePath).toHaveBeenCalledWith('/producao', 'layout');
  });

  it('falha inesperada propaga, e vira 500 para a fila tentar de novo', async () => {
    vi.mocked(processarRegistro).mockRejectedValue(new Error('conexão caiu'));
    await expect(POST(pedido(VALIDO))).rejects.toThrow('conexão caiu');
  });
});
