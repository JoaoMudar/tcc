import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { withTransaction } from '../transaction';
import {
  countActiveAdmins,
  duplicateMessage,
  findUsuario,
  insertUsuario,
  listPessoasDisponiveis,
  listUsuarios,
  saveUsuarioChanges,
} from '../usuarios';

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `tu${randomUUID().slice(0, 6)}`;
let n = 0;

async function criar(perfil: 'admin' | 'chefia' | 'gerencia', pessoaId: string | null = null) {
  n += 1;
  return insertUsuario(pool, {
    login: `${prefixo}_${n}`,
    nomeExibicao: `Teste ${n}`,
    perfil,
    senhaHash: 'scrypt$1$1$1$x$y',
    pessoaId,
  });
}

const salvar = (id: string, changes: Parameters<typeof saveUsuarioChanges>[2]) =>
  withTransaction(pool, (client) => saveUsuarioChanges(client, id, changes));

beforeEach(async () => {
  // Cada teste começa sem admin nenhum: a regra do último admin conta o banco inteiro
  await pool.query("DELETE FROM usuarios WHERE perfil = 'admin'");
});

afterAll(async () => {
  await pool.query("DELETE FROM usuarios WHERE login LIKE $1 || '%'", [prefixo]);
  await pool.query("DELETE FROM cadastro.pessoas WHERE nome LIKE $1 || '%'", [prefixo]);
  await pool.end();
});

describe('usuarios contra Postgres real', () => {
  it('nasce com troca de senha obrigatória (RF-02) e aparece na busca', async () => {
    const id = await criar('gerencia');
    expect(await findUsuario(pool, id)).toMatchObject({ perfil: 'gerencia', ativo: true, deveTrocarSenha: true });
    expect((await listUsuarios(pool, prefixo)).map((u) => u.id)).toContain(id);
  });

  it('login repetido vira mensagem própria', async () => {
    const id = await criar('chefia');
    const usuario = await findUsuario(pool, id);
    const error = await insertUsuario(pool, {
      login: usuario!.login,
      nomeExibicao: 'Outro',
      perfil: 'chefia',
      senhaHash: 'x',
      pessoaId: null,
    }).catch((e: unknown) => e);
    expect(duplicateMessage(error)).toBe('Já existe usuário com esse login.');
  });

  it('não deixa rebaixar nem desativar o último admin', async () => {
    const unico = await criar('admin');
    expect(await countActiveAdmins(pool)).toBe(1);
    const base = { nomeExibicao: 'Admin', pessoaId: null };
    expect(await salvar(unico, { ...base, perfil: 'chefia', ativo: true })).toBe('ultimo_admin');
    expect(await salvar(unico, { ...base, perfil: 'admin', ativo: false })).toBe('ultimo_admin');

    await criar('admin');
    expect(await salvar(unico, { ...base, perfil: 'chefia', ativo: true })).toBe('ok');
    expect((await findUsuario(pool, unico))?.perfil).toBe('chefia');
  });

  it('desativar encerra as sessões na hora', async () => {
    await criar('admin');
    const id = await criar('gerencia');
    await pool.query(
      "INSERT INTO sessoes (usuario_id, token_hash, expira_em) VALUES ($1, $2, NOW() + interval '1 day')",
      [id, `hash-${randomUUID()}`],
    );
    expect(await salvar(id, { nomeExibicao: 'Fora', perfil: 'gerencia', ativo: false, pessoaId: null })).toBe('ok');
    const { rows } = await pool.query('SELECT 1 FROM sessoes WHERE usuario_id = $1', [id]);
    expect(rows).toHaveLength(0);
  });

  it('usuário inexistente', async () => {
    expect(await salvar(randomUUID(), { nomeExibicao: 'X', perfil: 'chefia', ativo: true, pessoaId: null })).toBe(
      'nao_encontrado',
    );
  });

  it('pessoa com usuário sai da lista de vínculo, menos para o próprio usuário', async () => {
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO cadastro.pessoas (tipo, nome) VALUES ('pf', $1) RETURNING id",
      [`${prefixo} Débora`],
    );
    const pessoaId = rows[0].id;
    expect((await listPessoasDisponiveis(pool, null)).map((p) => p.id)).toContain(pessoaId);

    const id = await criar('gerencia', pessoaId);
    expect((await listPessoasDisponiveis(pool, null)).map((p) => p.id)).not.toContain(pessoaId);
    expect((await listPessoasDisponiveis(pool, id)).map((p) => p.id)).toContain(pessoaId);

    const error = await criar('chefia', pessoaId).catch((e: unknown) => e);
    expect(duplicateMessage(error)).toBe('Essa pessoa já tem um usuário.');
  });
});
