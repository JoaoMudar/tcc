'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as cargas from '@/lib/cargas';
import { isDataIso } from '@/lib/datas';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import { lerEnderecoDeEntrega } from '@/lib/endereco-entrega-form';
import { type AvisoDaRota, type SugestaoDeEndereco, lerCoordenada } from '@/lib/rotas';
import { MapaIndisponivel, sugerirEnderecos } from '@/lib/rotas-ors';
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

/**
 * P17: os passos do cabeçalho. Voltar vai direto à etapa tocada; avançar é o
 * botão da própria etapa ("Confirmar carga", "Iniciar carregamento"), com as
 * mesmas conferências, e por isso só a etapa seguinte avança.
 */
export async function irParaEtapaAction(previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  const viagem = lerViagem(formData);
  const para = formText(formData, 'para');
  const atual = formText(formData, 'atual');
  if (!viagem) return { error: 'Viagem inválida.' };

  if (para === 'roteirizando' && atual === 'montando') return confirmarCargaAction(previous, formData);
  if (para === 'carregando' && atual === 'roteirizando') return iniciarCarregamentoAction(previous, formData);
  if (para !== 'montando' && para !== 'roteirizando') return { error: 'Etapa inválida.' };

  try {
    await withTransaction(pool, (client) => viagens.voltarEtapa(client, viagem.viagemId, para));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(viagem.data);
  return {};
}

/** A lista que abre enquanto se digita um endereço. Mapa fora do ar é lista vazia: o texto livre continua valendo. */
export async function buscarEnderecosAction(texto: string): Promise<SugestaoDeEndereco[]> {
  await requirePermission('cargas_pedido', 'A');
  const busca = typeof texto === 'string' ? texto.trim() : '';
  if (busca.length < 3 || busca.length > 200) return [];
  try {
    return await sugerirEnderecos(busca);
  } catch (error) {
    if (error instanceof MapaIndisponivel) return [];
    throw error;
  }
}

function coordenadaDoForm(formData: FormData) {
  return lerCoordenada(formText(formData, 'lat'), formText(formData, 'lng'));
}

/**
 * P17: o endereço de entrega que falta, completado tocando no cliente da Tela
 * 2. A leitura do form é a mesma do frete do pedido (`lerEnderecoDeEntrega`).
 */
export async function salvarEnderecoEntregaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('cargas_pedido', 'A');
  const viagem = lerViagem(formData);
  const clienteId = formText(formData, 'cliente_id');
  if (!viagem || !isUuid(clienteId)) return { error: 'Cliente inválido.' };
  const lido = await lerEnderecoDeEntrega(formData);
  if ('error' in lido) return lido;

  try {
    await withTransaction(pool, (client) =>
      viagens.salvarEnderecoDeEntrega(client, viagem.viagemId, clienteId, lido.endereco),
    );
  } catch (error) {
    return { error: toUserMessage(error), fields: lido.fields };
  }
  revalidar(viagem.data);
  return { success: 'Endereço salvo.' };
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
    // Só o endereço digitado traz coordenada: as duas bases são procuradas pelo texto
    const coordenada = escolha === 'outro' ? coordenadaDoForm(formData) : null;
    await withTransaction(pool, (client) => viagens.definirPartida(client, viagem.viagemId, descricao, coordenada));
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
      viagens.adicionarParada(client, viagem.viagemId, descricao, endereco || null, coordenadaDoForm(formData)),
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

/**
 * "Iniciar carregamento": as cargas nascem, e a Tela 3 abre. Voltar dali não
 * as desfaz (P17): ao avançar de novo, o pedido segue com as que já tem.
 */
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
    await withTransaction(pool, (client) =>
      viagens.concluirViagem(client, viagem.viagemId, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidar(viagem.data);
  return {};
}
