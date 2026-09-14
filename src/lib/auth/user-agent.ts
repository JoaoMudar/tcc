/**
 * Nome do aparelho que a pessoa reconhece ("Chrome, Android"), a partir do
 * user agent. Serve para achar o celular perdido na lista de sessões (E4 A-03).
 */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Aparelho desconhecido';

  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /SamsungBrowser/.test(userAgent)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS/.test(userAgent)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(userAgent)
            ? 'Chrome'
            : /Safari\//.test(userAgent)
              ? 'Safari'
              : 'Navegador';

  // Ordem importa: Android diz Linux, e iPhone diz "like Mac OS X"
  const system = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(userAgent)
      ? 'iPhone'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Macintosh|Mac OS X/.test(userAgent)
          ? 'Mac'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;

  return system ? `${browser}, ${system}` : browser;
}
