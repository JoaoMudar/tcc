import { inflateRawSync } from 'node:zlib';

/**
 * Leitor mínimo de zip, só o que o arquivo Darwin Core do IPT usa: entradas
 * guardadas ou comprimidas com deflate, sem zip64. Evita uma dependência para
 * abrir um arquivo duas vezes por ano.
 */
export function lerZip(buffer: Buffer): Map<string, () => Buffer> {
  const fim = acharFimDoDiretorio(buffer);
  const total = buffer.readUInt16LE(fim + 10);
  let p = buffer.readUInt32LE(fim + 16);
  const entradas = new Map<string, () => Buffer>();

  for (let i = 0; i < total; i++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) throw new Error('Zip corrompido: diretório central inválido.');
    const metodo = buffer.readUInt16LE(p + 10);
    const comprimido = buffer.readUInt32LE(p + 20);
    const tamanhoNome = buffer.readUInt16LE(p + 28);
    const tamanhoExtra = buffer.readUInt16LE(p + 30);
    const tamanhoComentario = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const nome = buffer.toString('utf8', p + 46, p + 46 + tamanhoNome);
    if (comprimido === 0xffffffff || local === 0xffffffff) throw new Error(`Zip64 não suportado (${nome}).`);

    entradas.set(nome, () => {
      if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error(`Zip corrompido: cabeçalho de ${nome}.`);
      const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const dados = buffer.subarray(inicio, inicio + comprimido);
      if (metodo === 0) return Buffer.from(dados);
      if (metodo === 8) return inflateRawSync(dados);
      throw new Error(`Compressão ${metodo} não suportada (${nome}).`);
    });
    p += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }
  return entradas;
}

function acharFimDoDiretorio(buffer: Buffer): number {
  // O registro final tem 22 bytes mais um comentário de até 64 KiB
  for (let p = buffer.length - 22; p >= Math.max(0, buffer.length - 22 - 0xffff); p--) {
    if (buffer.readUInt32LE(p) === 0x06054b50) return p;
  }
  throw new Error('O arquivo não é um zip.');
}
