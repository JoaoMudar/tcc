import { ICONES, desenharIcone, isNomeIcone } from '@/lib/icone';

/** Ícones do manifest (T9.1). Públicos: o navegador os busca sem cookie. */
export async function GET(_request: Request, ctx: RouteContext<'/icones/[tamanho]'>) {
  const { tamanho } = await ctx.params;
  if (!isNomeIcone(tamanho)) return new Response(null, { status: 404 });
  const { tamanho: lado, maskable } = ICONES[tamanho];
  return desenharIcone(lado, maskable);
}

// Os três tamanhos saem prontos do build, e qualquer outro nome é 404 sem passar pela função
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONES).map((tamanho) => ({ tamanho }));
}
