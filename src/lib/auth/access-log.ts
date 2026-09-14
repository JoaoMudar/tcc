import type { Pool } from 'pg';

type Db = Pick<Pool, 'query'>;

export interface LoginEventRow {
  id: string;
  loginTentado: string;
  sucesso: boolean;
  ip: string | null;
  agenteUsuario: string | null;
  criadoEm: Date;
  usuarioNome: string | null;
}

export interface LoginEventFilter {
  usuarioId?: string;
  login?: string;
  sucesso?: boolean;
  limit?: number;
}

/** Consulta o registro de acessos (RF-04), do mais recente para o mais antigo. */
export async function listLoginEvents(db: Db, filter: LoginEventFilter = {}): Promise<LoginEventRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    conditions.push(sql.replace('?', `$${params.length}`));
  };

  if (filter.usuarioId) add('e.usuario_id = ?', filter.usuarioId);
  if (filter.login) add('e.login_tentado = ?', filter.login);
  if (filter.sucesso !== undefined) add('e.sucesso = ?', filter.sucesso);
  params.push(Math.min(Math.max(filter.limit ?? 100, 1), 500));

  const { rows } = await db.query<LoginEventRow>(
    `SELECT e.id, e.login_tentado AS "loginTentado", e.sucesso, e.ip, e.agente_usuario AS "agenteUsuario",
            e.criado_em AS "criadoEm", u.nome_exibicao AS "usuarioNome"
       FROM eventos_login e
       LEFT JOIN usuarios u ON u.id = e.usuario_id
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY e.criado_em DESC
      LIMIT $${params.length}`,
    params,
  );
  return rows;
}
