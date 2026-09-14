import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath, loginRedirectPath } from '@/lib/auth/route-rules';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session-config';

/**
 * Checagem otimista (D4 §4, nível da rota): só olha se há cookie, sem ir ao
 * banco. Quem decide de verdade é o guard no servidor (requireUser e
 * requirePermission), porque cookie existir não quer dizer sessão válida.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname, search } = request.nextUrl;

  if (!token) {
    if (isPublicPath(pathname)) return NextResponse.next();
    return NextResponse.redirect(new URL(loginRedirectPath(pathname, search), request.url));
  }

  const response = NextResponse.next();
  // Renova a validade do cookie no uso. Só em GET: numa Server Action o
  // próprio action pode estar apagando o cookie (sair), e não se pode desfazer isso.
  if (request.method === 'GET') {
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt)$).*)'],
};
