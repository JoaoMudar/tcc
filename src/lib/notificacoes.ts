import type { Perfil } from './perfis';
import type { SituacaoPedido } from './pedidos-rotulos';
import type { Db } from './sql';

/**
 * O aviso no celular quando o pedido muda de mão. São três passagens, e só
 * elas: as outras mudanças de situação acontecem com quem já está com o pedido.
 *
 * - cadastrado (novo, ou reenviado pela chefia): a gerência confere;
 * - verificado: a chefia (e o admin) fecha preço e aprova;
 * - aprovado: a gerência separa.
 */
export interface AvisoDoPedido {
  titulo: string;
  corpo: string;
  perfis: readonly Perfil[];
}

const PASSAGENS: Partial<Record<SituacaoPedido, { titulo: string; acao: string; perfis: readonly Perfil[] }>> = {
  cadastrado: { titulo: '🌱 Pedido novo na área!', acao: 'verificação', perfis: ['gerencia'] },
  verificado: { titulo: '🔎 Conferência pronta!', acao: 'finalização', perfis: ['admin', 'chefia'] },
  aprovado: { titulo: '📦 Hora de separar!', acao: 'separação', perfis: ['gerencia'] },
};

/** `null` quando a situação nova não passa o pedido para outro perfil. */
export function avisoDoPedido(situacao: SituacaoPedido, cliente: string): AvisoDoPedido | null {
  const passagem = PASSAGENS[situacao];
  if (!passagem) return null;
  return {
    titulo: passagem.titulo,
    corpo: `Pedido de ${cliente.trim()} foi liberado para ${passagem.acao}!`,
    perfis: passagem.perfis,
  };
}

export interface InscricaoPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

const MAX_CAMPO = 2048;

/** O que o navegador devolve em `PushSubscription.toJSON()`, conferido campo a campo. */
export function parseInscricao(value: unknown): InscricaoPush | null {
  if (typeof value !== 'object' || value === null) return null;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > MAX_CAMPO) return null;
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  if (!p256dh || !auth || p256dh.length > MAX_CAMPO || auth.length > MAX_CAMPO) return null;
  return { endpoint, p256dh, auth };
}

/** O aparelho que se inscreve de novo, ou com outra pessoa, troca de dono em vez de duplicar. */
export async function salvarInscricao(db: Db, usuarioId: string, inscricao: InscricaoPush): Promise<void> {
  await db.query(
    `INSERT INTO inscricoes_push (usuario_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE
        SET usuario_id = EXCLUDED.usuario_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [usuarioId, inscricao.endpoint, inscricao.p256dh, inscricao.auth],
  );
}

/** Só a do próprio usuário: o endpoint sozinho não basta para apagar a de outro. */
export async function removerInscricao(db: Db, usuarioId: string, endpoint: string): Promise<void> {
  await db.query('DELETE FROM inscricoes_push WHERE usuario_id = $1 AND endpoint = $2', [usuarioId, endpoint]);
}

/** O serviço de push disse que o endereço morreu (404, 410). */
export async function apagarInscricaoExpirada(db: Db, endpoint: string): Promise<void> {
  await db.query('DELETE FROM inscricoes_push WHERE endpoint = $1', [endpoint]);
}

/** Aparelhos de quem tem um destes perfis e está ativo, menos os de quem fez a mudança. */
export async function listInscricoesPorPerfis(
  db: Db,
  perfis: readonly Perfil[],
  excetoUsuarioId: string | null,
): Promise<InscricaoPush[]> {
  const { rows } = await db.query<InscricaoPush>(
    `SELECT i.endpoint, i.p256dh, i.auth
       FROM inscricoes_push i
       JOIN usuarios u ON u.id = i.usuario_id
      WHERE u.ativo AND u.perfil = ANY($1::perfil_usuario[])
        AND ($2::uuid IS NULL OR u.id <> $2::uuid)`,
    [perfis, excetoUsuarioId],
  );
  return rows;
}

/** Nome do cliente do pedido, para o texto do aviso. */
export async function clienteDoPedido(db: Db, pedidoId: string): Promise<string | null> {
  const { rows } = await db.query<{ cliente: string }>(
    `SELECT c.nome AS cliente
       FROM pedidos p
       JOIN cadastro.pessoas c ON c.id = p.cliente_id
      WHERE p.id = $1`,
    [pedidoId],
  );
  return rows[0]?.cliente ?? null;
}
