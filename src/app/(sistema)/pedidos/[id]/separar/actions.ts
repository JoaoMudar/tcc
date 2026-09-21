'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import * as cargas from '@/lib/cargas';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import { lerQuantidade } from '@/lib/lotes-rotulos';
import type { LinhaCarga } from '@/lib/pedidos-rotulos';
import { withTransaction } from '@/lib/transaction';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

/**
 * T8.14: organizar as viagens e contar o que vai em cada uma.
 *
 * O guard é `cargas_pedido` (D4 §3.2): a gerência organiza e conta sem poder
 * mexer em item, quantidade ou preço, que continuam da chefia.
 */

function revalidar(pedidoId: string) {
  revalidatePath('/pedidos');
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath(`/pedidos/${pedidoId}/separar`);
}

/** "Cabe em uma viagem": uma carga com tudo, na quantidade cheia. */
export async function criarCargaUnicaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('cargas_pedido', 'C');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };

  try {
    await withTransaction(pool, (client) =>
      cargas.criarCargaUnica(client, pedidoId, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(pedidoId);
  return { success: 'Carga organizada. Pode começar a separar.' };
}

/**
 * A divisão em viagens. A grade da tela envia três listas paralelas, uma
 * posição por célula: a carga a que a célula pertence, o item e a quantidade.
 */
export async function criarCargasAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('cargas_pedido', 'C');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };

  const indices = formData.getAll('carga_indice').map(String);
  const itens = formData.getAll('item_id').map(String);
  const quantidades = formData.getAll('quantidade').map(String);

  const porCarga = new Map<number, LinhaCarga[]>();
  for (let i = 0; i < indices.length; i++) {
    const indice = Number(indices[i]);
    if (!Number.isInteger(indice) || indice < 0) return { error: 'Carga inválida.' };
    if (!isUuid(itens[i])) return { error: 'Item inválido.' };

    // Célula em branco é zero: a pessoa apagou o campo em vez de digitar 0
    const texto = quantidades[i]?.trim() ?? '';
    const quantidade = texto === '' ? 0 : lerQuantidade(texto);
    if (quantidade === null || quantidade < 0) {
      return { error: 'A quantidade da carga precisa ser um número inteiro, zero ou mais.' };
    }

    const linhas = porCarga.get(indice) ?? [];
    linhas.push({ itemId: itens[i], quantidade });
    porCarga.set(indice, linhas);
  }

  if (porCarga.size === 0) return { error: 'Divida o pedido em ao menos uma carga.' };
  const lista = [...porCarga.entries()].sort(([a], [b]) => a - b).map(([, linhas]) => linhas);

  try {
    await withTransaction(pool, (client) =>
      cargas.criarCargas(client, pedidoId, lista, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(pedidoId);
  return { success: 'Cargas organizadas. Pode começar a separar.' };
}

/**
 * A contagem de um item. Grava o valor final que a tela mandou, e não inverte o
 * atual: o toque repetido pela conexão ruim do galpão chega ao mesmo resultado.
 */
export async function marcarItemSeparadoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  const cargaItemId = formText(formData, 'carga_item_id');
  if (!isUuid(pedidoId) || !isUuid(cargaItemId)) return { error: 'Item inválido.' };
  const separado = formText(formData, 'separado') === 'sim';

  try {
    await withTransaction(pool, (client) => cargas.marcarItemSeparado(client, cargaItemId, separado));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(pedidoId);
  return { success: separado ? 'Item separado.' : 'Marcação desfeita.' };
}

/** Fecha a carga, e o pedido quando ela for a última. */
export async function concluirCargaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('cargas_pedido', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  const cargaId = formText(formData, 'carga_id');
  if (!isUuid(pedidoId) || !isUuid(cargaId)) return { error: 'Carga inválida.' };

  try {
    const { numero, pedidoPronto } = await withTransaction(pool, (client) =>
      cargas.concluirCarga(client, cargaId, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
    revalidar(pedidoId);
    return { success: pedidoPronto ? 'Pedido pronto para envio!' : `Carga ${numero} pronta.` };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
