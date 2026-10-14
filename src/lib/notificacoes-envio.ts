import 'server-only';
import webpush from 'web-push';
import pool from './db';
import {
  apagarInscricaoExpirada,
  avisoDoPedido,
  clienteDoPedido,
  listInscricoesPorPerfis,
} from './notificacoes';
import type { SituacaoPedido } from './pedidos-rotulos';

/**
 * As chaves VAPID identificam o servidor perante o serviço de push. Sem elas o
 * aviso simplesmente não sai: o sistema funciona igual, só sem o celular tocar.
 * Gere com `npx web-push generate-vapid-keys`.
 */
export function chavePublicaVapid(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

let configurado: boolean | null = null;

function configurar(): boolean {
  if (configurado !== null) return configurado;
  const publica = chavePublicaVapid();
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return (configurado = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@viveiromudar.com.br', publica, privada);
  return (configurado = true);
}

/**
 * Avisa quem recebe a vez do pedido. Roda depois da resposta (`after`), e nunca
 * lança: aviso que não chegou não pode desfazer o pedido que já foi gravado.
 */
export async function avisarPedido(pedidoId: string, situacao: SituacaoPedido, autorId: string | null): Promise<void> {
  try {
    if (!configurar()) return;
    const cliente = await clienteDoPedido(pool, pedidoId);
    if (!cliente) return;
    const aviso = avisoDoPedido(situacao, cliente);
    if (!aviso) return;
    const inscricoes = await listInscricoesPorPerfis(pool, aviso.perfis, autorId);
    const carga = JSON.stringify({
      titulo: aviso.titulo,
      corpo: aviso.corpo,
      url: `/pedidos/${pedidoId}`,
      // Mesmo pedido, um aviso só na bandeja: o novo substitui o anterior
      tag: `pedido-${pedidoId}`,
    });

    await Promise.all(
      inscricoes.map(async (inscricao) => {
        try {
          await webpush.sendNotification(
            { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
            carga,
            { TTL: 60 * 60 * 24 },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await apagarInscricaoExpirada(pool, inscricao.endpoint);
        }
      }),
    );
  } catch (error) {
    console.error('[push] aviso do pedido não enviado', error);
  }
}
