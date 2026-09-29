import { desenharIcone } from '@/lib/icone';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** O iPhone recorta os cantos sozinho: o desenho vai sem arredondar. */
export default function AppleIcon() {
  return desenharIcone(180, true);
}
