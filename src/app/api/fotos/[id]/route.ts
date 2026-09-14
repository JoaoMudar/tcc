import pool from '@/lib/db';
import { findFoto } from '@/lib/fotos';
import { can } from '@/lib/permissions';
import { isUuid } from '@/lib/uuid';
import { getCurrentSession } from '@/lib/auth/session';

/**
 * Foto da espécie lida de `especies_fotos`. O id nunca muda de conteúdo (foto
 * nova é linha nova), então o navegador pode guardar para sempre; `private`
 * porque só quem entrou no sistema vê.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/fotos/[id]'>) {
  const session = await getCurrentSession();
  if (!session) return new Response(null, { status: 401 });
  if (!can(session.perfil, 'especies', 'L')) return new Response(null, { status: 403 });

  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response(null, { status: 400 });

  const foto = await findFoto(pool, id);
  if (!foto) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(foto.conteudo), {
    headers: {
      'Content-Type': foto.tipoConteudo,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
