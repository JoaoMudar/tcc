import { getCurrentSession } from '@/lib/auth/session';
import { FORBIDDEN_MESSAGE } from '@/lib/auth/guards';
import { can } from '@/lib/permissions';
import { MapaIndisponivel, sugerirEnderecos } from '@/lib/rotas-ors';

const MINIMO = 3;
const MAXIMO = 200;

/**
 * As sugestões do campo de endereço (`CampoEndereco`), enquanto se digita.
 *
 * **Rota, e não Server Action**: o Next roda as actions do navegador uma por
 * vez, e cada uma passa pelo roteador da página. Digitando um endereço longo,
 * as buscas se enfileiravam e a tela da rota travava. Aqui cada busca é um
 * `fetch` comum, que o campo cancela quando a pessoa continua digitando.
 *
 * Quem digita endereço é quem planeja a viagem ou quem fecha o frete do pedido.
 * Mapa fora do ar é lista vazia: o texto livre continua valendo.
 */
export async function GET(request: Request) {
  // Guard da rota: sessão e permissão no servidor, como em toda Server Action (RF-03)
  const session = await getCurrentSession();
  if (!session || session.deveTrocarSenha) {
    return Response.json({ error: 'Sua sessão terminou. Entre de novo.' }, { status: 401 });
  }
  if (!can(session.perfil, 'cargas_pedido', 'A') && !can(session.perfil, 'confirmacao_pedido', 'A')) {
    return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
  }

  const busca = (new URL(request.url).searchParams.get('q') ?? '').trim();
  if (busca.length < MINIMO || busca.length > MAXIMO) return Response.json([]);
  try {
    return Response.json(await sugerirEnderecos(busca));
  } catch (error) {
    if (error instanceof MapaIndisponivel) return Response.json([]);
    throw error;
  }
}
