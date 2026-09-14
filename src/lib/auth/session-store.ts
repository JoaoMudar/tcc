import type { Pool } from 'pg';
import type { Perfil } from '../permissions';

type Db = Pick<Pool, 'query'>;

/** A sessão válida e o usuário dono dela. */
export interface SessionUser {
  sessaoId: string;
  usuarioId: string;
  login: string;
  nomeExibicao: string;
  perfil: Perfil;
  deveTrocarSenha: boolean;
  expiraEm: Date;
  ultimoUsoEm: Date;
}

export interface SessionRow {
  id: string;
  ip: string | null;
  agenteUsuario: string | null;
  criadoEm: Date;
  ultimoUsoEm: Date;
}

export async function insertSession(
  db: Db,
  input: { usuarioId: string; tokenHash: string; expiraEm: Date; ip: string | null; agenteUsuario: string | null },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessoes (usuario_id, token_hash, expira_em, ip, agente_usuario)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.usuarioId, input.tokenHash, input.expiraEm, input.ip, input.agenteUsuario],
  );
  return rows[0].id;
}

/** Só vale a sessão não vencida de usuário ativo. */
export async function findSessionByTokenHash(db: Db, tokenHash: string, now: Date): Promise<SessionUser | null> {
  const { rows } = await db.query<SessionUser>(
    `SELECT s.id AS "sessaoId", s.usuario_id AS "usuarioId", u.login, u.nome_exibicao AS "nomeExibicao",
            u.perfil, u.deve_trocar_senha AS "deveTrocarSenha", s.expira_em AS "expiraEm",
            s.ultimo_uso_em AS "ultimoUsoEm"
       FROM sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = $1 AND s.expira_em > $2 AND u.ativo`,
    [tokenHash, now],
  );
  return rows[0] ?? null;
}

export async function touchSession(db: Db, sessaoId: string, expiraEm: Date, now: Date): Promise<void> {
  await db.query('UPDATE sessoes SET expira_em = $2, ultimo_uso_em = $3 WHERE id = $1', [sessaoId, expiraEm, now]);
}

export async function deleteSessionByTokenHash(db: Db, tokenHash: string): Promise<void> {
  await db.query('DELETE FROM sessoes WHERE token_hash = $1', [tokenHash]);
}

/** Encerra uma sessão do próprio usuário: o id sozinho não basta. */
export async function deleteUserSession(db: Db, usuarioId: string, sessaoId: string): Promise<boolean> {
  const result = await db.query('DELETE FROM sessoes WHERE id = $1 AND usuario_id = $2', [sessaoId, usuarioId]);
  return (result.rowCount ?? 0) > 0;
}

/** Encerra todas as sessões do usuário, menos a indicada (null encerra todas). */
export async function deleteOtherSessions(db: Db, usuarioId: string, keepSessaoId: string | null): Promise<number> {
  const result = await db.query(
    'DELETE FROM sessoes WHERE usuario_id = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)',
    [usuarioId, keepSessaoId],
  );
  return result.rowCount ?? 0;
}

export async function deleteExpiredSessions(db: Db, usuarioId: string, now: Date): Promise<void> {
  await db.query('DELETE FROM sessoes WHERE usuario_id = $1 AND expira_em <= $2', [usuarioId, now]);
}

export async function listActiveSessions(db: Db, usuarioId: string, now: Date): Promise<SessionRow[]> {
  const { rows } = await db.query<SessionRow>(
    `SELECT id, ip, agente_usuario AS "agenteUsuario", criado_em AS "criadoEm", ultimo_uso_em AS "ultimoUsoEm"
       FROM sessoes
      WHERE usuario_id = $1 AND expira_em > $2
      ORDER BY ultimo_uso_em DESC`,
    [usuarioId, now],
  );
  return rows;
}
