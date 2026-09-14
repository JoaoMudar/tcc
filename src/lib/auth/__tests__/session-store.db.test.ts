import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { attemptLogin } from '../login';
import { hashPassword } from '../password';
import {
  deleteOtherSessions,
  deleteUserSession,
  findSessionByTokenHash,
  insertSession,
  listActiveSessions,
} from '../session-store';
import { generateSessionToken, hashToken } from '../tokens';

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const login = `teste_${randomUUID().slice(0, 8)}`;
const SENHA = 'Canteiro-A3-tubete';
let usuarioId: string;

const now = () => new Date();
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

async function newSession(expiraEm = inDays(30)) {
  const token = generateSessionToken();
  const id = await insertSession(pool, {
    usuarioId,
    tokenHash: hashToken(token),
    expiraEm,
    ip: '10.0.0.1',
    agenteUsuario: 'Mozilla/5.0 (Linux; Android 14) Chrome/128',
  });
  return { id, token };
}

beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, senha_hash, perfil, deve_trocar_senha)
     VALUES ($1, 'Teste', $2, 'gerencia', false) RETURNING id`,
    [login, await hashPassword(SENHA)],
  );
  usuarioId = rows[0].id;
});

beforeEach(async () => {
  await pool.query('DELETE FROM sessoes WHERE usuario_id = $1', [usuarioId]);
  await pool.query(
    'UPDATE usuarios SET ativo = true, tentativas_login_falhas = 0, bloqueado_ate = NULL WHERE id = $1',
    [usuarioId],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM eventos_login WHERE login_tentado = $1', [login]);
  await pool.query('DELETE FROM usuarios WHERE id = $1', [usuarioId]);
  await pool.end();
});

describe('sessões contra Postgres real', () => {
  it('acha a sessão pelo hash do token, com o perfil; o token não está no banco (RNF-09)', async () => {
    const { token } = await newSession();
    const session = await findSessionByTokenHash(pool, hashToken(token), now());
    expect(session).toMatchObject({ usuarioId, login, perfil: 'gerencia', deveTrocarSenha: false });
    const { rows } = await pool.query('SELECT token_hash FROM sessoes WHERE usuario_id = $1', [usuarioId]);
    expect(rows[0].token_hash).not.toBe(token);
    expect(await findSessionByTokenHash(pool, hashToken(generateSessionToken()), now())).toBeNull();
  });

  it('sessão vencida e usuário desativado não valem', async () => {
    const vencida = await newSession(new Date(Date.now() - 1000));
    expect(await findSessionByTokenHash(pool, hashToken(vencida.token), now())).toBeNull();

    const ativa = await newSession();
    await pool.query('UPDATE usuarios SET ativo = false WHERE id = $1', [usuarioId]);
    expect(await findSessionByTokenHash(pool, hashToken(ativa.token), now())).toBeNull();
  });

  it('TA-04: encerra as outras e mantém a atual', async () => {
    const atual = await newSession();
    const outra = await newSession();
    const terceira = await newSession();
    expect(await listActiveSessions(pool, usuarioId, now())).toHaveLength(3);

    expect(await deleteUserSession(pool, usuarioId, outra.id)).toBe(true);
    expect(await findSessionByTokenHash(pool, hashToken(outra.token), now())).toBeNull();

    expect(await deleteOtherSessions(pool, usuarioId, atual.id)).toBe(1);
    expect(await findSessionByTokenHash(pool, hashToken(terceira.token), now())).toBeNull();
    expect(await findSessionByTokenHash(pool, hashToken(atual.token), now())).not.toBeNull();
  });

  it('não encerra sessão de outro usuário pelo id', async () => {
    const minha = await newSession();
    expect(await deleteUserSession(pool, randomUUID(), minha.id)).toBe(false);
  });
});

describe('login contra Postgres real', () => {
  const tentar = (senha: string, quando = now()) =>
    attemptLogin(pool, { login, senha, ip: '10.0.0.2', agenteUsuario: 'Chrome', now: quando });

  it('cinco falhas bloqueiam, o bloqueio persiste, e vencido deixa entrar e zera', async () => {
    for (let i = 0; i < 4; i++) expect((await tentar('errada')).ok).toBe(false);
    const quinta = await tentar('errada');
    expect(quinta).toMatchObject({ ok: false, message: expect.stringContaining('bloqueado') });

    const { rows } = await pool.query('SELECT bloqueado_ate FROM usuarios WHERE id = $1', [usuarioId]);
    expect(rows[0].bloqueado_ate).not.toBeNull();
    expect((await tentar(SENHA)).ok).toBe(false);

    const depois = new Date(Date.now() + 16 * 60_000);
    expect(await tentar(SENHA, depois)).toEqual({ ok: true, usuarioId, deveTrocarSenha: false });
    const reset = await pool.query('SELECT tentativas_login_falhas, bloqueado_ate FROM usuarios WHERE id = $1', [
      usuarioId,
    ]);
    expect(reset.rows[0]).toEqual({ tentativas_login_falhas: 0, bloqueado_ate: null });
  });

  it('TA-05: toda tentativa fica registrada, com origem e aparelho', async () => {
    await pool.query('DELETE FROM eventos_login WHERE login_tentado = $1', [login]);
    await tentar('errada');
    await tentar(SENHA);
    const { rows } = await pool.query(
      'SELECT sucesso, ip, agente_usuario FROM eventos_login WHERE login_tentado = $1 ORDER BY criado_em',
      [login],
    );
    expect(rows).toEqual([
      { sucesso: false, ip: '10.0.0.2', agente_usuario: 'Chrome' },
      { sucesso: true, ip: '10.0.0.2', agente_usuario: 'Chrome' },
    ]);
  });
});
