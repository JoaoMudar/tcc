import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * T10.1: a cópia do banco sai cifrada antes de deixar a máquina que a gerou. O
 * repositório é público, e o artefato do GitHub Actions de repositório público
 * pode ser baixado por qualquer conta logada: a cópia leva CPF, endereço e
 * senha em resumo (E4 §1), e só pode viajar ilegível.
 *
 * AES-256-GCM com chave derivada da frase por scrypt. O GCM autentica: frase
 * errada ou arquivo corrompido falham na decifração, em vez de devolver lixo que
 * o pg_restore tentaria restaurar. Feito em Node, e não com gpg, para o mesmo
 * código cifrar no Actions e decifrar no Windows sem instalar nada.
 *
 * Formato: MAGICO (6) | sal (16) | iv (12) | etiqueta (16) | texto cifrado.
 */

const MAGICO = Buffer.from('VMBK1\n');
const SAL = 16;
const IV = 12;
const ETIQUETA = 16;
const CABECALHO = MAGICO.length + SAL + IV + ETIQUETA;
export const FRASE_MINIMA = 20;

function chave(frase: string, sal: Buffer): Buffer {
  if (frase.length < FRASE_MINIMA) throw new Error(`A frase do backup precisa de ao menos ${FRASE_MINIMA} caracteres.`);
  return scryptSync(frase, sal, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export function cifrar(dados: Buffer, frase: string): Buffer {
  const sal = randomBytes(SAL);
  const iv = randomBytes(IV);
  const cifra = createCipheriv('aes-256-gcm', chave(frase, sal), iv);
  const corpo = Buffer.concat([cifra.update(dados), cifra.final()]);
  return Buffer.concat([MAGICO, sal, iv, cifra.getAuthTag(), corpo]);
}

export function decifrar(arquivo: Buffer, frase: string): Buffer {
  if (arquivo.length < CABECALHO || !arquivo.subarray(0, MAGICO.length).equals(MAGICO)) {
    throw new Error('Este arquivo não é uma cópia cifrada do viveiro.');
  }
  let pos = MAGICO.length;
  const sal = arquivo.subarray(pos, (pos += SAL));
  const iv = arquivo.subarray(pos, (pos += IV));
  const etiqueta = arquivo.subarray(pos, (pos += ETIQUETA));
  const decifra = createDecipheriv('aes-256-gcm', chave(frase, sal), iv);
  decifra.setAuthTag(etiqueta);
  try {
    return Buffer.concat([decifra.update(arquivo.subarray(pos)), decifra.final()]);
  } catch {
    throw new Error('Não foi possível decifrar: a frase está errada ou o arquivo está corrompido.');
  }
}
