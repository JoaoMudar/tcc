import { ImageResponse } from 'next/og';

export const COR_MARCA = '#166534';
export const COR_FUNDO = '#ffffff';

/** Tamanhos servidos em `/icones/<nome>`; o maskable deixa a margem que o Android recorta. */
export const ICONES = {
  '192': { tamanho: 192, maskable: false },
  '512': { tamanho: 512, maskable: false },
  '512-maskable': { tamanho: 512, maskable: true },
} as const;

export type NomeIcone = keyof typeof ICONES;

export function isNomeIcone(valor: string): valor is NomeIcone {
  return Object.hasOwn(ICONES, valor);
}

/**
 * Folha branca sobre o verde da marca, desenhada no servidor (RNF-23). Gerar
 * por código evita binário no repositório, e a cor sai da mesma constante do tema.
 */
export function desenharIcone(tamanho: number, maskable = false): ImageResponse {
  // A zona segura do maskable é o círculo de 80% do lado
  const folha = Math.round(tamanho * (maskable ? 0.5 : 0.66));
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COR_MARCA,
          borderRadius: maskable ? 0 : Math.round(tamanho * 0.2),
        }}
      >
        <svg width={folha} height={folha} viewBox="0 0 64 64">
          <path d="M52 8C28 8 12 22 12 42c0 4 1 8 3 11 3-12 11-22 24-28-11 8-18 17-21 30 3 1 6 1 9 1 20 0 29-18 25-48z" fill={COR_FUNDO} />
        </svg>
      </div>
    ),
    { width: tamanho, height: tamanho },
  );
}
