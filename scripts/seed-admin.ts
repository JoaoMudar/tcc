/**
 * npm run db:seed-admin -- --login joao --nome "João"
 *
 * Cria o primeiro administrador, com troca de senha no primeiro acesso. Recusa
 * se já existe admin: os seguintes se criam pela tela de usuários.
 * A senha vem de SEED_ADMIN_SENHA ou é gerada e mostrada uma única vez.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { loadEnvConfig } from '@next/env';
import { createPool } from '../src/lib/db-pool';
import { hashPassword, validateNewPassword } from '../src/lib/auth/password';
import { countActiveAdmins, insertUsuario, validateLogin } from '../src/lib/usuarios';

loadEnvConfig(process.cwd());

function generatePassword(login: string, nome: string): string {
  for (;;) {
    const senha = randomBytes(9).toString('base64url');
    if (!validateNewPassword(senha, { login, nome })) return senha;
  }
}

async function main() {
  const { values } = parseArgs({ options: { login: { type: 'string' }, nome: { type: 'string' } } });
  const login = (values.login ?? '').trim().toLowerCase();
  const nome = (values.nome ?? '').trim();

  const loginProblem = validateLogin(login);
  if (loginProblem) throw new Error(`--login: ${loginProblem}`);
  if (nome.length < 2) throw new Error('--nome: informe o nome, ex.: --nome "João"');

  const informada = process.env.SEED_ADMIN_SENHA;
  if (informada) {
    const problem = validateNewPassword(informada, { login, nome });
    if (problem) throw new Error(`SEED_ADMIN_SENHA: ${problem}`);
  }
  const senha = informada || generatePassword(login, nome);

  const pool = createPool(process.env.DATABASE_URL);
  try {
    if ((await countActiveAdmins(pool)) > 0) {
      throw new Error('Já existe administrador ativo. Crie os próximos usuários pela tela Usuários.');
    }
    await insertUsuario(pool, { login, nomeExibicao: nome, perfil: 'admin', senhaHash: await hashPassword(senha), pessoaId: null });
  } finally {
    await pool.end();
  }

  console.log(`Administrador criado: ${login}`);
  if (!informada) console.log(`Senha provisória (mostrada só agora): ${senha}`);
  console.log('No primeiro acesso o sistema pede a troca da senha.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
