import type { Pool } from 'pg';

type Db = Pick<Pool, 'query'>;

export interface LoginUserRow {
  id: string;
  login: string;
  senhaHash: string;
  ativo: boolean;
  tentativas: number;
  bloqueadoAte: Date | null;
  deveTrocarSenha: boolean;
}

export async function findUserForLogin(db: Db, login: string): Promise<LoginUserRow | null> {
  const { rows } = await db.query<LoginUserRow>(
    `SELECT id, login, senha_hash AS "senhaHash", ativo, tentativas_login_falhas AS tentativas,
            bloqueado_ate AS "bloqueadoAte", deve_trocar_senha AS "deveTrocarSenha"
       FROM usuarios WHERE login = $1`,
    [login],
  );
  return rows[0] ?? null;
}

/** RF-04: toda tentativa, com origem e aparelho. Usuário nulo quando o login não existe. */
export async function recordLoginEvent(
  db: Db,
  event: { usuarioId: string | null; loginTentado: string; sucesso: boolean; ip: string | null; agenteUsuario: string | null },
): Promise<void> {
  await db.query(
    `INSERT INTO eventos_login (usuario_id, login_tentado, sucesso, ip, agente_usuario)
     VALUES ($1, $2, $3, $4, $5)`,
    [event.usuarioId, event.loginTentado, event.sucesso, event.ip, event.agenteUsuario],
  );
}

/** Falhas recentes vindas desta origem, para barrar varredura de senha entre vários logins. */
export async function countRecentFailuresByIp(db: Db, ip: string, desde: Date): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    'SELECT COUNT(*)::int AS total FROM eventos_login WHERE ip = $1 AND NOT sucesso AND criado_em > $2',
    [ip, desde],
  );
  return rows[0].total;
}

export async function saveFailure(db: Db, usuarioId: string, tentativas: number, bloqueadoAte: Date | null): Promise<void> {
  await db.query('UPDATE usuarios SET tentativas_login_falhas = $2, bloqueado_ate = $3 WHERE id = $1', [
    usuarioId,
    tentativas,
    bloqueadoAte,
  ]);
}

export async function resetFailures(db: Db, usuarioId: string): Promise<void> {
  await db.query(
    `UPDATE usuarios SET tentativas_login_falhas = 0, bloqueado_ate = NULL
      WHERE id = $1 AND (tentativas_login_falhas <> 0 OR bloqueado_ate IS NOT NULL)`,
    [usuarioId],
  );
}

/** Grava a senha nova e zera o bloqueio. `deveTrocar` é true quando o admin define a provisória. */
export async function updatePassword(db: Db, usuarioId: string, senhaHash: string, deveTrocar: boolean): Promise<void> {
  await db.query(
    `UPDATE usuarios
        SET senha_hash = $2, deve_trocar_senha = $3, tentativas_login_falhas = 0, bloqueado_ate = NULL
      WHERE id = $1`,
    [usuarioId, senhaHash, deveTrocar],
  );
}
