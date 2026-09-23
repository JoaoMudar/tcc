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

/**
 * T8.10: a conferência de disponibilidade, uma action por gesto da tela.
 *
 * **O guard é `verificacao_pedido`, e não `pedidos`** (D4 §3.2): a gerência
 * escreve o que conferiu no pátio sem poder mexer em quantidade, preço ou item,
 * que continuam da chefia.
 */

function revalidar(pedidoId: string) {
  revalidatePath('/pedidos');
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath(`/pedidos/${pedidoId}/verificar`);
}

const ESTADOS = ['disponivel', 'parcial', 'indisponivel'] as const;

function isEstado(value: string): value is pedidos.EstadoDisponibilidade {
  return (ESTADOS as readonly string[]).includes(value);
}

/** Abre a conferência. Idempotente no servidor: reabrir a tela não é erro. */
export async function iniciarVerificacaoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('verificacao_pedido', 'C');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };

  try {
    await withTransaction(pool, (client) =>
      pedidos.iniciarVerificacao(client, pedidoId, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(pedidoId);
  return { success: 'Conferência aberta.' };
}

/**
 * A resposta de um item, gravada no toque do botão. A tela não tem "Salvar" por
 * item: quem está no pátio com o celular na mão responde e segue andando.
 */
export async function marcarDisponibilidadeAction(_previous: FormState, formData: FormData): Promise<FormState> {
  // 'C' como em `iniciarVerificacaoAction`: responder o primeiro item abre a
  // conferência, e quem responde precisa poder abri-la.
  const user = await requirePermission('verificacao_pedido', 'C');
  const pedidoId = formText(formData, 'pedido_id');
  const itemId = formText(formData, 'item_id');
  const estado = formText(formData, 'estado');
  if (!isUuid(pedidoId) || !isUuid(itemId)) return { error: 'Item inválido.' };
  if (!isEstado(estado)) return { error: 'Resposta inválida.' };

  const extras: { quantidade?: number | null; recipienteId?: string | null; observacoes?: string | null } = {};

  // Quantas e em que recipiente: o parcial sempre diz, e o item que chegou sem
  // quantidade ou sem recipiente também. Quem exige o quê é `resolveDisponibilidade`
  if (estado !== 'indisponivel') {
    const quantidade = pedidos.parseQuantidadeOpcional(formText(formData, 'quantidade'));
    if ('error' in quantidade) return { error: quantidade.error };
    const recipienteId = formText(formData, 'recipiente_id');
    if (recipienteId !== '' && !isUuid(recipienteId)) return { error: 'Escolha o recipiente em que a muda está.' };
    extras.quantidade = quantidade.value;
    extras.recipienteId = recipienteId || null;
  }

  const observacoes = pedidos.parseObservacoesPedido(formText(formData, 'observacoes'));
  if ('error' in observacoes) return { error: 'A observação pode ter até 500 caracteres.' };
  extras.observacoes = observacoes.value;

  try {
    await withTransaction(pool, (client) =>
      pedidos.marcarDisponibilidade(client, pedidoId, itemId, estado, { perfil: user.perfil, usuarioId: user.usuarioId }, extras),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(pedidoId);
  return { success: 'Resposta gravada.' };
}

/**
 * "Salvar e continuar depois": a observação sem a resposta. Anotar "ver com o
 * Gilberto" num item não pode marcá-lo como conferido.
 */
export async function salvarObservacoesAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('verificacao_pedido', 'C');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };

  const itens = formData.getAll('item_id').map(String);
  const textos = formData.getAll('observacoes').map(String);
  const linhas: { itemId: string; observacoes: string | null }[] = [];

  for (const [indice, itemId] of itens.entries()) {
    if (!isUuid(itemId)) return { error: 'Item inválido.' };
    const observacoes = pedidos.parseObservacoesPedido(textos[indice] ?? '');
    if ('error' in observacoes) return { error: 'A observação pode ter até 500 caracteres.' };
    linhas.push({ itemId, observacoes: observacoes.value });
  }

  try {
    await withTransaction(pool, (client) =>
      pedidos.salvarObservacoesVerificacao(client, pedidoId, linhas, {
        perfil: user.perfil,
        usuarioId: user.usuarioId,
      }),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(pedidoId);
  return { success: 'Anotações salvas. Você pode continuar depois.' };
}

/**
 * A composição do item genérico. As linhas chegam como listas paralelas, uma
 * posição por linha da tela, como no cadastro do pedido.
 */
export async function definirComposicaoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('verificacao_pedido', 'C');
  const pedidoId = formText(formData, 'pedido_id');
  const itemPaiId = formText(formData, 'item_pai_id');
  if (!isUuid(pedidoId) || !isUuid(itemPaiId)) return { error: 'Item inválido.' };

  const especies = formData.getAll('composicao_especie').map(String);
  const recipientes = formData.getAll('composicao_recipiente').map(String);
  const quantidades = formData.getAll('composicao_quantidade').map(String);
  const linhas: pedidos.LinhaComposicao[] = [];

  for (let i = 0; i < especies.length; i++) {
    // Linha em branco é linha que a pessoa abriu e não usou, e não erro
    if (!especies[i] && !recipientes[i] && !quantidades[i]?.trim()) continue;
    const posicao = `linha ${i + 1}`;
    if (!isUuid(especies[i])) return { error: `Escolha a espécie da ${posicao}.` };
    if (!isUuid(recipientes[i])) return { error: `Escolha o recipiente da ${posicao}.` };
    const quantidade = pedidos.parseQuantidadeItem(quantidades[i] ?? '');
    if ('error' in quantidade) return { error: `Na ${posicao}: ${quantidade.error.toLowerCase()}` };
    linhas.push({ especieId: especies[i], recipienteId: recipientes[i], quantidade: quantidade.value });
  }

  try {
    await withTransaction(pool, (client) =>
      pedidos.definirComposicaoGenerico(client, pedidoId, itemPaiId, linhas, {
        perfil: user.perfil,
        usuarioId: user.usuarioId,
      }),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(pedidoId);
  return { success: 'Composição definida.' };
}

/** Fecha a conferência e devolve o pedido à chefia. Recusa se faltar item. */
export async function concluirVerificacaoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('verificacao_pedido', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };

  try {
    await withTransaction(pool, (client) =>
      pedidos.concluirVerificacao(client, pedidoId, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(pedidoId);
  redirect(`/pedidos/${pedidoId}?feito=verificado`);
}
