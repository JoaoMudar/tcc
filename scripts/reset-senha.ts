/**
 * npm run db:reset-senha -- --login joao
 *
 * Senha esquecida sem outro admin para resetar pela tela: gera uma provisória,
 * mostrada uma única vez, desbloqueia a conta, encerra as sessões e pede a troca
 * no próximo acesso. É o mesmo efeito do "Definir senha provisória" de Usuários.
 */
import { parseArgs } from 'node:util';
import { loadEnvConfig } from '@next/env';
import { createPool } from '../src/lib/db-pool';
import { generatePassword, hashPassword } from '../src/lib/auth/password';
import { deleteOtherSessions } from '../src/lib/auth/session-store';
import { findUserForLogin, updatePassword } from '../src/lib/auth/user-store';
import { validateLogin } from '../src/lib/usuarios';

loadEnvConfig(process.cwd());

async function main() {
  const { values } = parseArgs({ options: { login: { type: 'string' } } });
  const login = (values.login ?? '').trim().toLowerCase();
  const loginProblem = validateLogin(login);
  if (loginProblem) throw new Error(`--login: ${loginProblem}`);

  const pool = createPool(process.env.DATABASE_URL);
  let senha: string;
  try {
    const usuario = await findUserForLogin(pool, login);
    if (!usuario) throw new Error(`Usuário não encontrado: ${login}`);
    if (!usuario.ativo) throw new Error(`${login} está desativado: reative pela tela Usuários antes.`);
    senha = generatePassword({ login });
    // updatePassword também zera as tentativas e o bloqueio
    await updatePassword(pool, usuario.id, await hashPassword(senha), true);
    await deleteOtherSessions(pool, usuario.id, null);
  } finally {
    await pool.end();
  }

  console.log(`Senha de ${login} redefinida.`);
  console.log(`Senha provisória (mostrada só agora): ${senha}`);
  console.log('No próximo acesso o sistema pede a troca da senha.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
