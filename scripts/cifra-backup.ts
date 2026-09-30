/**
 * npm run backup:cifrar   -- <cópia.dump> <cópia.dump.cifrado>
 * npm run backup:decifrar -- <cópia.dump.cifrado> <cópia.dump>
 *
 * A frase vem de BACKUP_PASSPHRASE, nunca de argumento: argumento fica no
 * histórico do terminal e na lista de processos. Ver src/lib/cifra-backup.ts.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { cifrar, decifrar } from '../src/lib/cifra-backup';

async function main() {
  const [modo, entrada, saida] = process.argv.slice(2);
  if (!['cifrar', 'decifrar'].includes(modo) || !entrada || !saida) {
    throw new Error('Uso: cifra-backup.ts cifrar|decifrar <entrada> <saída>');
  }
  const frase = process.env.BACKUP_PASSPHRASE;
  if (!frase) throw new Error('Defina BACKUP_PASSPHRASE com a frase do backup.');

  const dados = await readFile(entrada);
  const resultado = modo === 'cifrar' ? cifrar(dados, frase) : decifrar(dados, frase);
  await writeFile(saida, resultado, { mode: 0o600 });
  console.log(`${modo === 'cifrar' ? 'Cifrado' : 'Decifrado'}: ${saida} (${(resultado.length / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
