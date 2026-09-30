/**
 * npm run backup:restaurar -- --arquivo <cópia.dump.cifrado>
 *
 * O destino, um banco VAZIO, vem de DESTINO_DATABASE_URL (ou de --destino). Por
 * variável é melhor: a URL leva a senha, e o npm ecoa os argumentos no terminal.
 *
 * O teste de restauração do E6 §5, cronometrado. Decifra a cópia (frase em
 * BACKUP_PASSPHRASE), restaura num banco novo com pg_restore, confere as
 * contagens e o saldo dos lotes (E6 §4 passos 3 e 6) e imprime o tempo gasto,
 * que é o número que confirma ou refuta o RTO de 8 horas.
 *
 * Recusa restaurar por cima: o destino tem de estar vazio, e não pode ser o
 * banco da DATABASE_URL (E6 §4 passo 2, "sem sobrescrever a existente").
 *
 * O pg_restore tem de ser da versão do Neon (18) ou mais novo: o de versão
 * anterior não lê a cópia. Dois jeitos:
 *   - RESTAURO_DOCKER=<contêiner>: roda o pg_restore dentro de um contêiner
 *     postgres:18, que também é o banco de destino. Não exige instalar nada.
 *   - sem ela: PG_BIN, ou a instalação padrão do Postgres 18 ou 17 no Windows,
 *     ou o PATH.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadEnvConfig } from '@next/env';
import { decifrar } from '../src/lib/cifra-backup';
import { createPool } from '../src/lib/db-pool';
import { conferirIntegridade, relatorioIntegridade } from '../src/lib/manutencao';
import { getMigrationStatus } from '../src/lib/migrations/runner';

loadEnvConfig(process.cwd());

function pgRestore(): string {
  const nome = process.platform === 'win32' ? 'pg_restore.exe' : 'pg_restore';
  const candidatos = [process.env.PG_BIN, 'C:\\Program Files\\PostgreSQL\\18\\bin', 'C:\\Program Files\\PostgreSQL\\17\\bin'].filter(
    Boolean,
  ) as string[];
  for (const dir of candidatos) {
    const caminho = path.join(dir, nome);
    if (existsSync(caminho)) return caminho;
  }
  return nome;
}

const SEM_DONO = ['--no-owner', '--no-privileges'];

/** Roda o pg_restore; com RESTAURO_DOCKER, dentro do contêiner, contra o banco dele. */
function restaurar(dump: string, destino: string) {
  const conteiner = process.env.RESTAURO_DOCKER;
  if (!conteiner) return spawnSync(pgRestore(), [...SEM_DONO, `--dbname=${destino}`, dump], { encoding: 'utf8' });

  const url = new URL(destino);
  const copia = spawnSync('docker', ['cp', dump, `${conteiner}:/tmp/restauro.dump`], { encoding: 'utf8' });
  if (copia.error || copia.status !== 0) throw new Error(`docker cp falhou: ${copia.error?.message ?? copia.stderr.trim()}`);
  const banco = url.pathname.slice(1) || 'postgres';
  const args = ['exec', conteiner, 'pg_restore', ...SEM_DONO, '-U', decodeURIComponent(url.username), '-d', banco, '/tmp/restauro.dump'];
  const resultado = spawnSync('docker', args, { encoding: 'utf8' });
  spawnSync('docker', ['exec', conteiner, 'rm', '-f', '/tmp/restauro.dump']);
  return resultado;
}

function mesmoBanco(a: string, b: string | undefined): boolean {
  if (!b) return false;
  const [x, y] = [new URL(a), new URL(b)];
  return x.hostname === y.hostname && x.port === y.port && x.pathname === y.pathname;
}

async function main() {
  const inicio = Date.now();
  const { values } = parseArgs({ options: { arquivo: { type: 'string' }, destino: { type: 'string' } } });
  const arquivo = values.arquivo;
  const destino = values.destino ?? process.env.DESTINO_DATABASE_URL;
  if (!arquivo || !destino) throw new Error('Uso: --arquivo <cópia>, com DESTINO_DATABASE_URL apontando para um banco vazio');
  if (mesmoBanco(destino, process.env.DATABASE_URL)) {
    throw new Error('O destino é o banco da DATABASE_URL. Restaure num banco novo, nunca por cima do que está em uso.');
  }

  const pool = createPool(destino);
  let dump = arquivo;
  try {
    const { rows } = await pool.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema IN ('public', 'cadastro')",
    );
    if (rows[0].n > 0) throw new Error(`O banco de destino já tem ${rows[0].n} tabela(s). Crie um banco vazio para a restauração.`);

    if (arquivo.endsWith('.cifrado')) {
      const frase = process.env.BACKUP_PASSPHRASE;
      if (!frase) throw new Error('Defina BACKUP_PASSPHRASE com a frase do backup.');
      dump = path.join(tmpdir(), `viveiro-restauracao-${process.pid}.dump`);
      await writeFile(dump, decifrar(await readFile(arquivo), frase), { mode: 0o600 });
      console.log('Cópia decifrada.');
    }

    // Sem dono nem permissão: os papéis do Neon não existem no banco de destino
    const restauracao = restaurar(dump, destino);
    if (restauracao.error) throw new Error(`pg_restore não encontrado (${restauracao.error.message}). Defina PG_BIN ou RESTAURO_DOCKER.`);
    if (/unsupported version/i.test(restauracao.stderr)) {
      throw new Error('O pg_restore é mais velho que a cópia. Use o Postgres 18 (PG_BIN) ou um contêiner postgres:18 (RESTAURO_DOCKER).');
    }
    if (restauracao.status !== 0) {
      // O pg_restore sai com erro também por aviso ignorável; quem decide é a conferência abaixo
      console.warn(`pg_restore terminou com código ${restauracao.status}:\n${restauracao.stderr.trim()}`);
    }
    console.log('Restauração terminada. Conferindo...\n');

    const integridade = await conferirIntegridade(pool);
    console.log(relatorioIntegridade(integridade));
    const migrations = await getMigrationStatus(pool, path.join(process.cwd(), 'migrations'));
    console.log(
      migrations.pending.length === 0
        ? '\nMigrations: a cópia está na versão do código.'
        : `\nMigrations pendentes na cópia (aplique com DATABASE_URL apontando para ela): ${migrations.pending.join(', ')}`,
    );

    const segundos = Math.round((Date.now() - inicio) / 1000);
    const tempo = segundos < 120 ? `${segundos} s` : `${(segundos / 60).toFixed(1)} min`;
    console.log(`\nTempo da restauração: ${tempo} (RTO declarado: 8 h).`);
    console.log('Falta o passo 4 do E6: contar à mão três canteiros e comparar com o saldo dos lotes.');
    if (integridade.divergentes.length > 0) process.exitCode = 1;
  } finally {
    await pool.end();
    if (dump !== arquivo) await rm(dump, { force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
