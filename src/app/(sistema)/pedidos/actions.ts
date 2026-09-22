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

/** Teto do que é pedido de verdade: a maior lista já vista no viveiro tem dezenas de linhas. */
const MAX_ITENS_POR_ENVIO = 200;

/**
 * Os itens chegam como listas paralelas: uma posição por linha da tela.
 *
 * **Sem preço**: ele é digitado depois da conferência (`definirPrecosAction`).
 * O item genérico chega com `item_generico` marcado e sem espécie: é o "500
 * mudas nativas" que a gerência resolve escolhendo as espécies (T8.7).
 */
function lerItens(formData: FormData): { error: string } | { value: pedidos.NovoItem[] } {
  const especies = formData.getAll('item_especie').map(String);
  // Antes de abrir transação: milhares de INSERT seguram conexão do pool (SEC-006)
  if (especies.length > MAX_ITENS_POR_ENVIO) {
    return { error: `O pedido aceita até ${MAX_ITENS_POR_ENVIO} itens por vez. Divida em mais de um envio.` };
  }
  const recipientes = formData.getAll('item_recipiente').map(String);
  const quantidades = formData.getAll('item_quantidade').map(String);
  const alturas = formData.getAll('item_altura').map(String);
  const genericos = formData.getAll('item_generico').map(String);
  const especificacoes = formData.getAll('item_especificacao').map(String);
  const itens: pedidos.NovoItem[] = [];

  for (let i = 0; i < especies.length; i++) {
    const generico = genericos[i] === '1';
    // Linha em branco é linha que a pessoa abriu e não usou, e não erro
    if (!generico && !especies[i] && !recipientes[i] && !quantidades[i]?.trim() && !alturas[i]?.trim()) continue;
    const posicao = `item ${i + 1}`;
    if (!generico && !isUuid(especies[i])) return { error: `Escolha a espécie do ${posicao}.` };
    if (!isUuid(recipientes[i])) return { error: `Escolha o recipiente do ${posicao}.` };
    const quantidade = pedidos.parseQuantidadeItem(quantidades[i] ?? '');
    if ('error' in quantidade) return { error: `No ${posicao}: ${quantidade.error.toLowerCase()}` };
    const altura = pedidos.parseAltura(alturas[i] ?? '');
    if ('error' in altura) return { error: `No ${posicao}: ${altura.error.toLowerCase()}` };
    const especificacao = pedidos.parseObservacoesPedido(especificacoes[i] ?? '');
    if ('error' in especificacao) return { error: `No ${posicao}: a especificação é longa demais.` };
    itens.push({
      especieId: generico ? null : especies[i],
      recipienteId: recipientes[i],
      quantidade: quantidade.value,
      alturaM: altura.value,
      precoCentavos: null,
      generico,
      especificacao: generico ? especificacao.value : null,
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

  let numero: number;
  try {
    ({ numero } = await withTransaction(pool, (client) =>
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
  // Volta para a carteira, e não para a ficha: quem registra pedido no celular
  // costuma registrar o seguinte, e a lista é de onde ele parte. O aviso do que
  // acabou de acontecer vai no toque que some sozinho.
  redirect(`/pedidos?feito=criado&numero=${numero}`);
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

/** RF-57: a quantidade e a altura mudam enquanto o pedido é rascunho. O preço vem depois da conferência. */
export async function atualizarItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('pedidos', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  const itemId = formText(formData, 'item_id');
  if (!isUuid(pedidoId) || !isUuid(itemId)) return { error: 'Item inválido.' };
  const fields = { quantidade: formText(formData, 'quantidade'), altura: formText(formData, 'altura') };
  const quantidade = pedidos.parseQuantidadeItem(fields.quantidade);
  if ('error' in quantidade) return { error: quantidade.error, fields };
  const altura = pedidos.parseAltura(fields.altura);
  if ('error' in altura) return { error: altura.error, fields };

  try {
    await withTransaction(pool, (client) =>
      pedidos.atualizarItem(client, pedidoId, itemId, { quantidade: quantidade.value, alturaM: altura.value }),
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

/**
 * T8.6, RN-53: a mudança de fase que a tela ofereceu, conferida de novo aqui. O
 * guard do D4 diz que este perfil mexe na situação do pedido; `mudarSituacao`
 * diz se esta fase, saindo desta situação, é dele (D4 §3.2).
 */
export async function transicionarPedidoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('confirmacao_pedido', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  const para = formText(formData, 'para');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };
  if (!pedidos.isSituacaoPedido(para)) return { error: 'Fase inválida.' };

  try {
    const { numero } = await withTransaction(pool, (client) =>
      pedidos.mudarSituacao(client, pedidoId, para, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
    revalidarPedidos(pedidoId);
    return { success: `Pedido ${numero}: ${pedidos.SITUACOES_PEDIDO[para].toLowerCase()}.` };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

/**
 * RF-55: os preços do pedido conferido, em listas paralelas como o resto do
 * projeto. O guard é `confirmacao_pedido`, o mesmo da aprovação; quem não é
 * chefia é recusado dentro de `definirPrecos`.
 */
export async function definirPrecosAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('confirmacao_pedido', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };

  const itens = formData.getAll('preco_item_id').map(String);
  const valores = formData.getAll('preco_valor').map(String);
  const linhas: { itemId: string; precoCentavos: number }[] = [];

  for (const [indice, itemId] of itens.entries()) {
    if (!isUuid(itemId)) return { error: 'Item inválido.' };
    const texto = (valores[indice] ?? '').trim();
    // Campo em branco é item que a chefia ainda não precificou, e não erro: ela
    // salva o que já sabe e volta. A aprovação é que exige todos.
    if (texto === '') continue;
    const preco = pedidos.parsePreco(texto);
    if ('error' in preco) return { error: `No item ${indice + 1}: ${preco.error.toLowerCase()}` };
    linhas.push({ itemId, precoCentavos: preco.value });
  }
  if (linhas.length === 0) return { error: 'Informe ao menos um preço.' };

  try {
    await withTransaction(pool, (client) =>
      pedidos.definirPrecos(client, pedidoId, linhas, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarPedidos(pedidoId);
  return { success: linhas.length === 1 ? 'Preço salvo.' : `${linhas.length} preços salvos.` };
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

/** T8.5: o motivo é opcional, e fica na observação do histórico. */
export async function cancelarPedidoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('confirmacao_pedido', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };
  const motivo = pedidos.parseObservacoesPedido(formText(formData, 'motivo'));
  if ('error' in motivo) return { error: 'O motivo pode ter até 500 caracteres.' };

  try {
    const { numero } = await withTransaction(pool, (client) =>
      pedidos.cancelarPedido(client, pedidoId, { perfil: user.perfil, usuarioId: user.usuarioId }, motivo.value),
    );
    revalidarPedidos(pedidoId);
    return { success: `Pedido ${numero} cancelado. O registro continua aqui.` };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
