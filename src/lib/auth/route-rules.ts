/** Rotas abertas sem sessão. Todo o resto exige login (RF-01). */
export const PUBLIC_PATHS: readonly string[] = ['/login'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Destino depois do login. Só aceita caminho interno: sem isso, um link
 * `/login?next=https://golpe` levaria o usuário para fora do sistema.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (isPublicPath(value.split('?')[0])) return '/';
  return value;
}

/** Endereço de login que devolve a pessoa para onde ela ia. */
export function loginRedirectPath(pathname: string, search: string): string {
  if (pathname === '/') return '/login';
  return `/login?next=${encodeURIComponent(pathname + search)}`;
}
