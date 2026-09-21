'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import * as pedidos from '@/lib/pedidos';
import { withTransaction } from '@/lib/transaction';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

function revalidarPedidos(id?: string) {
  revalidatePath('/pedidos');
  if (id) revalidatePath(`/pedidos/${id}`);
}

/** Os itens chegam como listas paralelas: uma posição por linha da tela. */
function lerItens(formData: FormData): { error: string } | { value: pedidos.NovoItem[] } {
  const especies = formData.getAll('item_especie').map(String);
  const recipientes = formData.getAll('item_recipiente').map(String);
  const quantidades = formData.getAll('item_quantidade').map(String);
  const precos = formData.getAll('item_preco').map(String);
  const itens: pedidos.NovoItem[] = [];

  for (let i = 0; i < especies.length; i++) {
    // Linha em branco é linha que a pessoa abriu e não usou, e não erro
    if (!especies[i] && !recipientes[i] && !quantidades[i]?.trim() && !precos[i]?.trim()) continue;
    const posicao = `item ${i + 1}`;
    if (!isUuid(especies[i])) return { error: `Escolha a espécie do ${posicao}.` };
    if (!isUuid(recipientes[i])) return { error: `Escolha o recipiente do ${posicao}.` };
    const quantidade = pedidos.parseQuantidadeItem(quantidades[i] ?? '');
    if ('error' in quantidade) return { error: `No ${posicao}: ${quantidade.error.toLowerCase()}` };
    const preco = pedidos.parsePreco(precos[i] ?? '');
    if ('error' in preco) return { error: `No ${posicao}: ${preco.error.toLowerCase()}` };
    itens.push({
      especieId: especies[i],
      recipienteId: recipientes[i],
      quantidade: quantidade.value,
      precoCentavos: preco.value,
    });
  }

  if (itens.length === 0) return { error: 'O pedido precisa de ao menos um item.' };
  return { value: itens };
}

/** T8.1, RF-54, RF-55, UC-31: cliente, canal e itens com preço digitado. Nasce em rascunho. */
export async function criarPedidoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('pedidos', 'C');
  const fields = {
    cliente_id: formText(formData, 'cliente_id'),
    canal: formText(formData, 'canal'),
    data_entrega: formText(formData, 'data_entrega'),
    observacoes: formText(formData, 'observacoes'),
  };
  if (!isUuid(fields.cliente_id)) return { error: 'Escolha o cliente.', fields };
  if (!pedidos.isCanalVenda(fields.canal)) return { error: 'Escolha o canal de venda.', fields };
  const canal = fields.canal;
  const dataEntrega = pedidos.parseDataEntrega(fields.data_entrega);
  if ('error' in dataEntrega) return { error: dataEntrega.error, fields };
  const observacoes = pedidos.parseObservacoesPedido(fields.observacoes);
  if ('error' in observacoes) return { error: observacoes.error, fields };
  const itens = lerItens(formData);
  if ('error' in itens) return { error: itens.error, fields };

  let id: string;
  try {
    ({ id } = await withTransaction(pool, (client) =>
      pedidos.criarPedido(client, {
        clienteId: fields.cliente_id,
        canal,
        dataEntrega: dataEntrega.value,
        observacoes: observacoes.value,
        itens: itens.value,
        criadoPor: user.usuarioId,
      }),
    ));
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }

  revalidarPedidos();
  redirect(`/pedidos/${id}?feito=criado`);
}

/** Um item só, acrescentado ao pedido que ainda é rascunho (RF-57). */
export async function adicionarItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('pedidos', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };
  const itens = lerItens(formData);
  if ('error' in itens) return { error: itens.error };

  try {
    await withTransaction(pool, (client) => pedidos.adicionarItem(client, pedidoId, itens.value[0]));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarPedidos(pedidoId);
  return { success: 'Item acrescentado.' };
}

/** RF-55, RF-57: quantidade e preço mudam enquanto o pedido é rascunho, e não depois. */
export async function atualizarItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('pedidos', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  const itemId = formText(formData, 'item_id');
  if (!isUuid(pedidoId) || !isUuid(itemId)) return { error: 'Item inválido.' };
  const fields = { quantidade: formText(formData, 'quantidade'), preco: formText(formData, 'preco') };
  const quantidade = pedidos.parseQuantidadeItem(fields.quantidade);
  if ('error' in quantidade) return { error: quantidade.error, fields };
  const preco = pedidos.parsePreco(fields.preco);
  if ('error' in preco) return { error: preco.error, fields };

  try {
    await withTransaction(pool, (client) =>
      pedidos.atualizarItem(client, pedidoId, itemId, { quantidade: quantidade.value, precoCentavos: preco.value }),
    );
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }
  revalidarPedidos(pedidoId);
  return { success: 'Item alterado.' };
}

export async function removerItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('pedidos', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  const itemId = formText(formData, 'item_id');
  if (!isUuid(pedidoId) || !isUuid(itemId)) return { error: 'Item inválido.' };

  try {
    await withTransaction(pool, (client) => pedidos.removerItem(client, pedidoId, itemId));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarPedidos(pedidoId);
  return { success: 'Item removido.' };
}

/** T8.3, RF-57: confirmar trava os itens. O guard é o do D4, `confirmacao_pedido`. */
export async function confirmarPedidoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('confirmacao_pedido', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };

  try {
    const { numero } = await withTransaction(pool, (client) =>
      pedidos.confirmarPedido(client, pedidoId, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
    revalidarPedidos(pedidoId);
    return { success: `Pedido ${numero} aprovado. Os itens não mudam mais.` };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

export async function cancelarPedidoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('confirmacao_pedido', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };

  try {
    const { numero } = await withTransaction(pool, (client) =>
      pedidos.cancelarPedido(client, pedidoId, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
    revalidarPedidos(pedidoId);
    return { success: `Pedido ${numero} cancelado. O registro continua aqui.` };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
