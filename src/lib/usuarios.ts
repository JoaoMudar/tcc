import type { Pool, PoolClient } from 'pg';
import { type Perfil, SEM_PESSOA, parsePerfil } from './perfis';
import { isUuid } from './uuid';

type Db = Pick<Pool, 'query'>;

export { SEM_PESSOA };
export const LOGIN_PATTERN = /^[a-z0-9._-]{3,32}$/;

export interface UsuarioResumo {
  id: string;
  login: string;
  nomeExibicao: string;
  perfil: Perfil;
  ativo: boolean;
  deveTrocarSenha: boolean;
  bloqueadoAte: Date | null;
  pessoaId: string | null;
  pessoaNome: string | null;
}

export interface UsuarioChanges {
  nomeExibicao: string;
  perfil: Perfil;
  ativo: boolean;
  pessoaId: string | null;
}

export function validateLogin(login: string): string | null {
  return LOGIN_PATTERN.test(login)
    ? null
    : 'O usuário deve ter de 3 a 32 caracteres: letras minúsculas sem acento, números, ponto, hífen ou sublinhado.';
}

/** Valida nome, perfil e pessoa vindos do formulário. Devolve a mensagem, ou os valores prontos. */
export function parseUsuarioFields(input: {
  nomeExibicao: string;
  perfil: string;
  pessoaId: string;
}): { error: string } | { value: Omit<UsuarioChanges, 'ativo'> } {
  const nomeExibicao = input.nomeExibicao.trim();
  if (nomeExibicao.length < 2 || nomeExibicao.length > 80) {
    return { error: 'O nome precisa ter de 2 a 80 caracteres.' };
  }
  const perfil = parsePerfil(input.perfil);
  if (!perfil) return { error: 'Escolha o perfil.' };
  if (input.pessoaId !== SEM_PESSOA && input.pessoaId !== '' && !isUuid(input.pessoaId)) {
    return { error: 'Pessoa inválida. Escolha da lista.' };
  }
  const pessoaId = isUuid(input.pessoaId) ? input.pessoaId : null;
  return { value: { nomeExibicao, perfil, pessoaId } };
}

/** Mensagem específica para os dois únicos que `usuarios` tem. */
export function duplicateMessage(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, constraint } = error as { code?: string; constraint?: string };
  if (code !== '23505') return null;
  if (constraint === 'usuarios_login_key') return 'Já existe usuário com esse login.';
  if (constraint === 'usuarios_uma_credencial_por_pessoa') return 'Essa pessoa já tem um usuário.';
  return null;
}

/** Tirar o perfil de admin, ou desativar, o único admin ativo deixaria o sistema sem ninguém para destravá-lo. */
export function wouldRemoveLastAdmin(
  current: { perfil: Perfil; ativo: boolean },
  next: { perfil: Perfil; ativo: boolean },
  otherActiveAdmins: number,
): boolean {
  const wasAdmin = current.perfil === 'admin' && current.ativo;
  const staysAdmin = next.perfil === 'admin' && next.ativo;
  return wasAdmin && !staysAdmin && otherActiveAdmins === 0;
}

export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const SELECT_USUARIO = `
  SELECT u.id, u.login, u.nome_exibicao AS "nomeExibicao", u.perfil, u.ativo,
         u.deve_trocar_senha AS "deveTrocarSenha", u.bloqueado_ate AS "bloqueadoAte",
         u.pessoa_id AS "pessoaId", p.nome AS "pessoaNome"
    FROM usuarios u
    LEFT JOIN cadastro.pessoas p ON p.id = u.pessoa_id`;

export async function listUsuarios(db: Db, busca = ''): Promise<UsuarioResumo[]> {
  const termo = busca.trim();
  const { rows } = await db.query<UsuarioResumo>(
    `${SELECT_USUARIO}
      WHERE $1 = '' OR u.login ILIKE '%' || $2 || '%' OR u.nome_exibicao ILIKE '%' || $2 || '%'
      ORDER BY u.ativo DESC, u.nome_exibicao`,
    [termo, escapeLike(termo)],
  );
  return rows;
}

export async function findUsuario(db: Db, id: string): Promise<UsuarioResumo | null> {
  const { rows } = await db.query<UsuarioResumo>(`${SELECT_USUARIO} WHERE u.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Nasce com `deve_trocar_senha` (padrão da tabela): a provisória só vale até o primeiro acesso (RF-02). */
export async function insertUsuario(
  db: Db,
  input: { login: string; nomeExibicao: string; perfil: Perfil; senhaHash: string; pessoaId: string | null },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, perfil, senha_hash, pessoa_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.login, input.nomeExibicao, input.perfil, input.senhaHash, input.pessoaId],
  );
  return rows[0].id;
}

export async function countActiveAdmins(db: Db): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    "SELECT COUNT(*)::int AS total FROM usuarios WHERE perfil = 'admin' AND ativo",
  );
  return rows[0].total;
}

/**
 * Grava as alterações dentro da transação do chamador. Trava os admins ativos
 * e o alvo, para duas alterações simultâneas não derrubarem juntas o último admin.
 * Desativar encerra as sessões na hora.
 */
export async function saveUsuarioChanges(
  client: PoolClient,
  id: string,
  changes: UsuarioChanges,
): Promise<'ok' | 'nao_encontrado' | 'ultimo_admin'> {
  const { rows } = await client.query<{ id: string; perfil: Perfil; ativo: boolean }>(
    `SELECT id, perfil, ativo FROM usuarios WHERE (perfil = 'admin' AND ativo) OR id = $1 FOR UPDATE`,
    [id],
  );
  const current = rows.find((row) => row.id === id);
  if (!current) return 'nao_encontrado';
  const otherAdmins = rows.filter((row) => row.id !== id && row.perfil === 'admin' && row.ativo).length;
  if (wouldRemoveLastAdmin(current, changes, otherAdmins)) return 'ultimo_admin';

  await client.query(
    'UPDATE usuarios SET nome_exibicao = $2, perfil = $3, ativo = $4, pessoa_id = $5 WHERE id = $1',
    [id, changes.nomeExibicao, changes.perfil, changes.ativo, changes.pessoaId],
  );
  if (!changes.ativo) await client.query('DELETE FROM sessoes WHERE usuario_id = $1', [id]);
  return 'ok';
}

/** Pessoas ativas que ainda não têm usuário (ou que já são deste usuário). */
export async function listPessoasDisponiveis(db: Db, usuarioId: string | null): Promise<{ id: string; nome: string }[]> {
  const { rows } = await db.query<{ id: string; nome: string }>(
    `SELECT p.id, p.nome
       FROM cadastro.pessoas p
      WHERE p.ativa
        AND NOT EXISTS (
          SELECT 1 FROM usuarios u
           WHERE u.pessoa_id = p.id AND ($1::uuid IS NULL OR u.id <> $1::uuid)
        )
      ORDER BY p.nome
      LIMIT 500`,
    [usuarioId],
  );
  return rows;
}
