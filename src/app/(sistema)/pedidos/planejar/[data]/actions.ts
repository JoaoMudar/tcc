'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as cargas from '@/lib/cargas';
import { isDataIso } from '@/lib/datas';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import type { AvisoDaRota } from '@/lib/rotas';
import { withTransaction } from '@/lib/transaction';
import { isUuid } from '@/lib/uuid';
import * as viagens from '@/lib/viagens';
import { requirePermission } from '@/lib/auth/guards';

/**
 * P14: a rotina "Planejar pedido". O guard é `cargas_pedido`, o mesmo do
 * "Organizar cargas": quem planeja a viagem é quem separa.
 *
 * **Toda ação grava na hora**, e nenhuma tem botão "Salvar" por trás: a tela
 * volta do servidor já com o que foi gravado, e sair no meio não perde nada.
 */

function caminho(data: string): string {
  return `/pedidos/planejar/${data}`;
}

function revalidar(data: string) {
  revalidatePath('/pedidos');
  revalidatePath(caminho(data));
}

/** A tela lê o aviso da URL: a action que o gera já trocou de etapa, e o estado dela some. */
function voltarComAviso(data: string, aviso: AvisoDaRota | null): never {
  redirect(aviso ? `${caminho(data)}?aviso=${aviso}` : caminho(data));
}

function lerViagem(formData: FormData): { data: string; viagemId: string } | null {
  const data = formText(formData, 'data');
  const viagemId = formText(formData, 'viagem_id');
  return isDataIso(data) && isUuid(viagemId) ? { data, viagemId } : null;
}

/** Tela 1: tocar num pedido o põe na carga e grava a data de entrega. */
export async function adicionarPedidoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('cargas_pedido', 'C');
  const data = formText(formData, 'data');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isDataIso(data) || !isUuid(pedidoId)) return { error: 'Pedido inválido.' };

  try {
    await withTransaction(pool, (client) =>
      viagens.adicionarPedido(client, data, pedidoId, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidar(data);
  return {};
}

export async function tirarPedidoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  const viagem = lerViagem(formData);
  const pedidoId = formText(formData, 'pedido_id');
  if (!viagem || !isUuid(pedidoId)) return { error: 'Pedido inválido.' };

  try {
    await withTransaction(pool, (client) => viagens.tirarPedido(client, viagem.viagemId, pedidoId));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(viagem.data);
  return {};
}

/**
 * "Confirmar carga": vai à Tela 2 e, se as entregas mudaram desde a última vez,
 * pede a ordem à API. A ordem arrumada a mão não é refeita ao voltar.
 */
export async function confirmarCargaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  const viagem = lerViagem(formData);
  if (!viagem) return { error: 'Viagem inválida.' };

  let aviso: AvisoDaRota | null = null;
  try {
    const atual = await withTransaction(pool, (client) =>
      viagens.mudarEtapa(client, viagem.viagemId, 'roteirizando'),
    );
    if (atual.sugerirOrdem) aviso = await viagens.sugerirRota(pool, viagem.viagemId);
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(viagem.data);
  voltarComAviso(viagem.data, aviso);
}

/** A seta de voltar da Tela 2: a carga reabre, e a ordem fica guardada. */
export async function voltarParaCargaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  const viagem = lerViagem(formData);
  if (!viagem) return { error: 'Viagem inválida.' };

  try {
    await withTransaction(pool, (client) => viagens.mudarEtapa(client, viagem.viagemId, 'montando'));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(viagem.data);
  return {};
}

/** A saída: Agrolândia, Itapema (de Configurações) ou um endereço digitado. */
export async function definirPartidaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  const viagem = lerViagem(formData);
  if (!viagem) return { error: 'Viagem inválida.' };

  const escolha = formText(formData, 'partida');
  let aviso: AvisoDaRota | null = null;
  try {
    const base = await viagens.partidasBase(pool);
    const descricao =
      escolha === 'agrolandia' ? base.agrolandia : escolha === 'itapema' ? base.itapema : formText(formData, 'endereco');
    await withTransaction(pool, (client) => viagens.definirPartida(client, viagem.viagemId, descricao));
    const atual = await viagens.findViagem(pool, viagem.viagemId);
    if (atual?.sugerirOrdem) aviso = await viagens.sugerirRota(pool, viagem.viagemId);
  } catch (error) {
    return { error: toUserMessage(error), fields: { endereco: formText(formData, 'endereco') } };
  }
  revalidar(viagem.data);
  voltarComAviso(viagem.data, aviso);
}

export async function sugerirOrdemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  const viagem = lerViagem(formData);
  if (!viagem) return { error: 'Viagem inválida.' };

  let aviso: AvisoDaRota | null;
  try {
    aviso = await viagens.sugerirRota(pool, viagem.viagemId);
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(viagem.data);
  voltarComAviso(viagem.data, aviso);
}

/** Ao soltar o arraste ou tocar numa seta: a ordem inteira, como a tela a vê. */
export async function salvarOrdemAction(data: string, viagemId: string, paradaIds: string[]): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  if (!isDataIso(data) || !isUuid(viagemId) || !Array.isArray(paradaIds) || !paradaIds.every(isUuid)) {
    return { error: 'Ordem inválida.' };
  }

  try {
    await withTransaction(pool, (client) => viagens.salvarOrdem(client, viagemId, paradaIds));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(data);
  return {};
}

export async function adicionarParadaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  const viagem = lerViagem(formData);
  if (!viagem) return { error: 'Viagem inválida.' };
  const descricao = formText(formData, 'descricao');
  const endereco = formText(formData, 'endereco');

  try {
    await withTransaction(pool, (client) =>
      viagens.adicionarParada(client, viagem.viagemId, descricao, endereco || null),
    );
  } catch (error) {
    return { error: toUserMessage(error), fields: { descricao, endereco } };
  }
  revalidar(viagem.data);
  return {};
}

export async function removerParadaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  const viagem = lerViagem(formData);
  const paradaId = formText(formData, 'parada_id');
  if (!viagem || !isUuid(paradaId)) return { error: 'Parada inválida.' };

  try {
    await withTransaction(pool, (client) => viagens.removerParada(client, viagem.viagemId, paradaId));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(viagem.data);
  return {};
}

/** "Iniciar carregamento": as cargas nascem, e a Tela 3 abre. Dali só se sai. */
export async function iniciarCarregamentoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('cargas_pedido', 'C');
  const viagem = lerViagem(formData);
  if (!viagem) return { error: 'Viagem inválida.' };

  try {
    await withTransaction(pool, (client) =>
      viagens.iniciarCarregamento(client, viagem.viagemId, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(viagem.data);
  voltarComAviso(viagem.data, null);
}

/** A contagem de um item. Grava o valor final, e não inverte o atual (T8.13). */
export async function marcarItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  const data = formText(formData, 'data');
  const cargaItemId = formText(formData, 'carga_item_id');
  if (!isDataIso(data) || !isUuid(cargaItemId)) return { error: 'Item inválido.' };
  const separado = formText(formData, 'separado') === 'sim';

  try {
    await withTransaction(pool, (client) => cargas.marcarItemSeparado(client, cargaItemId, separado));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(data);
  return {};
}

/** "Carga pronta": fecha as cargas de todos os pedidos da viagem. */
export async function concluirViagemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('cargas_pedido', 'A');
  const viagem = lerViagem(formData);
  if (!viagem) return { error: 'Viagem inválida.' };

  try {
    const { pedidos } = await withTransaction(pool, (client) =>
      viagens.concluirViagem(client, viagem.viagemId, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
    revalidar(viagem.data);
    return {
      success:
        pedidos === 1 ? 'Carga pronta. O pedido ficou pronto para envio.' : `Carga pronta. ${pedidos} pedidos ficaram prontos para envio.`,
    };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
