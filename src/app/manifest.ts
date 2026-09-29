import type { MetadataRoute } from 'next';
import { COR_FUNDO, COR_MARCA } from '@/lib/icone';

/** T9.1, RNF-23: instalar pelo navegador, sem loja de aplicativos. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Viveiro Mudar',
    short_name: 'Viveiro',
    description: 'Gestão do viveiro: cadastros, produção e pedidos.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: COR_MARCA,
    background_color: COR_FUNDO,
    icons: [
      { src: '/icones/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icones/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icones/512-maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
