/**
 * Reduz a foto no navegador antes do envio. A foto do celular tem vários MB, e
 * a Server Action aceita 1 MB: reduzida a 1024 px, ela fica perto de 150 KB e
 * ocupa pouco no banco (e no backup).
 */

export const FOTO_MAX_LADO = 1024;

export function dimensoesReduzidas(largura: number, altura: number, maxLado = FOTO_MAX_LADO) {
  const escala = Math.min(1, maxLado / Math.max(largura, altura));
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

export async function reduzFoto(file: File, maxLado = FOTO_MAX_LADO): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height, maxLado);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponível');
  context.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const gerar = (tipo: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, tipo, 0.82));
  const webp = await gerar('image/webp');
  if (webp?.type === 'image/webp') return webp;
  // Navegador que não gera WEBP devolve PNG pesado: JPEG fica menor
  const jpeg = await gerar('image/jpeg');
  if (!jpeg) throw new Error('Não foi possível gerar a imagem');
  return jpeg;
}
