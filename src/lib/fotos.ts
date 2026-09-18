import type { Db } from './sql';
import { isUuid } from './uuid';

/**
 * Foto da espécie como linha de `especies_fotos`, nunca em disco: o sistema de
 * arquivos da Vercel é somente leitura e some a cada implantação.
 */

export type TipoImagem = 'image/webp' | 'image/jpeg' | 'image/png';

/** O navegador reduz a foto antes de enviar; o limite de 1 MB da Server Action é a barreira de fora. */
export const FOTO_MAX_BYTES = 900_000;

const FOTO_URL = /^\/api\/fotos\/([0-9a-f-]{36})$/i;

/** O tipo lido dos bytes, e não do nome do arquivo nem do que o navegador declarou. */
export function detectImageType(bytes: Uint8Array): TipoImagem | null {
  const starts = (sig: number[], offset = 0) => sig.every((byte, i) => bytes[offset + i] === byte);
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  return null;
}

export function fotoUrl(id: string): string {
  return `/api/fotos/${id}`;
}

export function fotoIdFromUrl(url: string | null): string | null {
  const id = url ? FOTO_URL.exec(url)?.[1] : undefined;
  return id && isUuid(id) ? id : null;
}

/** Arquivo do formulário: ausente ou vazio é "sem foto nova". */
export async function readFotoFile(
  value: FormDataEntryValue | null,
): Promise<{ error: string } | { value: { tipo: TipoImagem; conteudo: Buffer } | null }> {
  if (!value || typeof value === 'string' || value.size === 0) return { value: null };
  if (value.size > FOTO_MAX_BYTES) return { error: 'A foto é grande demais. Tente outra, ou tire de novo.' };
  const conteudo = Buffer.from(await value.arrayBuffer());
  const tipo = detectImageType(conteudo);
  if (!tipo) return { error: 'O arquivo não é uma foto. Use JPG, PNG ou WEBP.' };
  return { value: { tipo, conteudo } };
}

export async function insertFoto(db: Db, foto: { tipo: TipoImagem; conteudo: Buffer }): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'INSERT INTO especies_fotos (tipo_conteudo, conteudo) VALUES ($1, $2) RETURNING id',
    [foto.tipo, foto.conteudo],
  );
  return rows[0].id;
}

export async function findFoto(db: Db, id: string): Promise<{ tipoConteudo: string; conteudo: Buffer } | null> {
  const { rows } = await db.query<{ tipoConteudo: string; conteudo: Buffer }>(
    'SELECT tipo_conteudo AS "tipoConteudo", conteudo FROM especies_fotos WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

export async function deleteFoto(db: Db, id: string): Promise<void> {
  await db.query('DELETE FROM especies_fotos WHERE id = $1', [id]);
}
