'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import { isOrigemFrete } from '@/lib/frete';
import * as pedidos from '@/lib/pedidos';
import { lerEnderecoDeEntrega } from '@/lib/endereco-entrega-form';
import { AVISOS_DO_FRETE, salvarEnderecoDoPedido, sugestaoDeFrete } from '@/lib/pedidos-frete';
import type { SugestaoDeEndereco } from '@/lib/rotas';
import { MapaIndisponivel, sugerirEnderecos } from '@/lib/rotas-ors';
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
 * **Sem preço**: ele é digitado depois da conferência (`negociarItensAction`).
 * O item genérico chega com `item_generico` marcado e sem espécie: é o "500
 * mudas nativas" que a gerência resolve escolhendo as espécies (T8.7).
 *
 * **Recipiente e quantidade são opcionais** (RF-54): o cliente que pergunta
 * "tem ipê?" não disse nenhum dos dois, e a conferência responde. O que se
 * exige é saber o que foi pedido: a espécie, ou a descrição no genérico.
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
    const recipienteId = recipientes[i] ? recipientes[i] : null;
    if (recipienteId !== null && !isUuid(recipienteId)) return { error: `O recipiente do ${posicao} é inválido.` };
    const quantidade = pedidos.parseQuantidadeOpcional(quantidades[i] ?? '');
    if ('error' in quantidade) return { error: `No ${posicao}: ${quantidade.error.toLowerCase()}` };
    const altura = pedidos.parseAltura(alturas[i] ?? '');
    if ('error' in altura) return { error: `No ${posicao}: ${altura.error.toLowerCase()}` };
    const especificacao = pedidos.parseObservacoesPedido(especificacoes[i] ?? '');
    if ('error' in especificacao) return { error: `No ${posicao}: a observação é longa demais.` };
    itens.push({
      especieId: generico ? null : especies[i],
      recipienteId,
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

/** O item gravado devolve o id: a grade da ficha continua editando a mesma linha. */
export interface ItemSalvoState extends FormState {
  itemId?: string;
}

/** Um item só, acrescentado ao pedido que ainda é rascunho (RF-57). */
export async function adicionarItemAction(_previous: ItemSalvoState, formData: FormData): Promise<ItemSalvoState> {
  await requirePermission('pedidos', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };
  const itens = lerItens(formData);
  if ('error' in itens) return { error: itens.error };

  let itemId: string;
  try {
    itemId = await withTransaction(pool, (client) => pedidos.adicionarItem(client, pedidoId, itens.value[0]));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarPedidos(pedidoId);
  return { success: 'Item acrescentado.', itemId };
}

/**
 * RF-57: recipiente, quantidade e altura mudam enquanto o pedido é orçamento. O
 * preço vem depois da conferência. O recipiente só muda quando o campo vem no
 * formulário, e vazio é "o cliente não disse o tamanho". A espécie, do mesmo
 * jeito: só quando `item_generico` vem, e é a grade da ficha que o manda.
 */
export async function atualizarItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('pedidos', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  const itemId = formText(formData, 'item_id');
  if (!isUuid(pedidoId) || !isUuid(itemId)) return { error: 'Item inválido.' };
  const fields = { quantidade: formText(formData, 'quantidade'), altura: formText(formData, 'altura') };
  const quantidade = pedidos.parseQuantidadeOpcional(fields.quantidade);
  if ('error' in quantidade) return { error: quantidade.error, fields };
  const altura = pedidos.parseAltura(fields.altura);
  if ('error' in altura) return { error: altura.error, fields };
  let recipienteId: string | null | undefined;
  if (formData.has('recipiente')) {
    const texto = formText(formData, 'recipiente');
    if (texto !== '' && !isUuid(texto)) return { error: 'Recipiente inválido.', fields };
    recipienteId = texto || null;
  }
  let identidade: pedidos.IdentidadeItem | undefined;
  if (formData.has('item_generico')) {
    const generico = formText(formData, 'item_generico') === '1';
    const especieId = formText(formData, 'item_especie');
    if (!generico && !isUuid(especieId)) return { error: 'Escolha a espécie do item.', fields };
    const especificacao = pedidos.parseObservacoesPedido(formText(formData, 'item_especificacao'));
    if ('error' in especificacao) return { error: 'A observação é longa demais.', fields };
    identidade = { generico, especieId: generico ? null : especieId, especificacao: especificacao.value };
  }

  try {
    await withTransaction(pool, (client) =>
      pedidos.atualizarItem(client, pedidoId, itemId, {
        quantidade: quantidade.value,
        alturaM: altura.value,
        ...(recipienteId === undefined ? {} : { recipienteId }),
        ...(identidade ? { identidade } : {}),
      }),
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
 * RF-55: a negociação do pedido conferido (preço, quantidade e recipiente de
 * cada item), em listas paralelas como o resto do projeto. O guard é
 * `confirmacao_pedido`, o mesmo da aprovação; quem não é chefia é recusado
 * dentro de `negociarItens`.
 *
 * Campo em branco é o que a chefia ainda não fechou, e não erro: ela salva o
 * que já sabe e volta. A aprovação é que exige todos.
 */
export async function negociarItensAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('confirmacao_pedido', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };

  const itens = formData.getAll('negociar_item_id').map(String);
  const precos = formData.getAll('negociar_preco').map(String);
  const quantidades = formData.getAll('negociar_quantidade').map(String);
  const recipientes = formData.getAll('negociar_recipiente').map(String);
  const linhas: pedidos.LinhaNegociacao[] = [];

  for (const [indice, itemId] of itens.entries()) {
    if (!isUuid(itemId)) return { error: 'Item inválido.' };
    const posicao = `item ${indice + 1}`;

    const textoPreco = (precos[indice] ?? '').trim();
    const preco = textoPreco === '' ? null : pedidos.parsePreco(textoPreco);
    if (preco && 'error' in preco) return { error: `No ${posicao}: ${preco.error.toLowerCase()}` };

    // Zero é "tirar o item", e por isso não passa pelo parse do cadastro, que o recusa
    const textoQuantidade = (quantidades[indice] ?? '').trim();
    let quantidade: number | null = null;
    if (textoQuantidade === '0') quantidade = 0;
    else if (textoQuantidade !== '') {
      const lida = pedidos.parseQuantidadeItem(textoQuantidade);
      if ('error' in lida) return { error: `No ${posicao}: ${lida.error.toLowerCase()}` };
      quantidade = lida.value;
    }

    const recipienteId = (recipientes[indice] ?? '').trim() || null;
    if (recipienteId !== null && !isUuid(recipienteId)) return { error: `No ${posicao}: recipiente inválido.` };

    if (preco === null && quantidade === null && recipienteId === null) continue;
    linhas.push({ itemId, precoCentavos: preco ? preco.value : null, quantidade, recipienteId });
  }
  if (linhas.length === 0) return { error: 'Informe ao menos um preço.' };

  let removidos: number;
  try {
    ({ removidos } = await withTransaction(pool, (client) =>
      pedidos.negociarItens(client, pedidoId, linhas, { perfil: user.perfil, usuarioId: user.usuarioId }),
    ));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarPedidos(pedidoId);
  if (removidos > 0) return { success: removidos === 1 ? 'Item tirado do pedido.' : `${removidos} itens tirados do pedido.` };
  return { success: 'Negociação salva.' };
}

/**
 * P18: o suplente vira linha do pedido, com quantidade e preço a digitar. O
 * guard é o da negociação, que é onde a chefia descobre que vai faltar.
 */
export async function usarSuplenteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('confirmacao_pedido', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  const itemId = formText(formData, 'item_id');
  if (!isUuid(pedidoId) || !isUuid(itemId)) return { error: 'Item inválido.' };
  try {
    await withTransaction(pool, (client) =>
      pedidos.usarSuplente(client, pedidoId, itemId, { perfil: user.perfil, usuarioId: user.usuarioId }),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarPedidos(pedidoId);
  return { success: 'O recipiente virou linha do pedido: digite a quantidade e o preço.' };
}

/**
 * RN-64: o frete combinado, gravado enquanto se digita, como o preço dos itens.
 * Em branco é "sem frete". O guard é o da negociação.
 */
export async function salvarFreteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('confirmacao_pedido', 'A');
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };
  const textoOrigem = formText(formData, 'frete_origem');
  if (textoOrigem !== '' && !isOrigemFrete(textoOrigem)) return { error: 'Origem do frete inválida.' };
  const textoFrete = formText(formData, 'frete').trim();
  let centavos: number | null = null;
  if (textoFrete !== '' && textoFrete !== '0' && textoFrete !== '0,00') {
    const lido = pedidos.parsePreco(textoFrete);
    if ('error' in lido) return { error: 'O frete precisa ser um valor como 84,00.' };
    centavos = lido.value;
  }

  try {
    await withTransaction(pool, (client) =>
      pedidos.salvarFrete(
        client,
        pedidoId,
        { centavos, origem: textoOrigem === '' ? null : textoOrigem },
        { perfil: user.perfil, usuarioId: user.usuarioId },
      ),
    );
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarPedidos(pedidoId);
  return { success: 'Frete salvo.' };
}

/**
 * RN-64: a sugestão de frete pela distância. Não grava o frete: devolve o
 * valor para a chefia ver, e é ela quem o aceita ou digita outro.
 */
export async function sugerirFreteAction(
  pedidoId: string,
  origem: string,
): Promise<
  | { error: string; falta?: { endereco: string | null } }
  | { centavos: number; distanciaKm: number }
> {
  const user = await requirePermission('confirmacao_pedido', 'A');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };
  if (!isOrigemFrete(origem)) return { error: 'Origem do frete inválida.' };
  if (user.perfil === 'gerencia') return { error: 'O frete do pedido é digitado pela chefia.' };
  try {
    const sugestao = await sugestaoDeFrete(pool, pedidoId, origem);
    if (!('aviso' in sugestao)) return sugestao;
    const error = AVISOS_DO_FRETE[sugestao.aviso];
    return 'endereco' in sugestao ? { error, falta: { endereco: sugestao.endereco } } : { error };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

/** A lista de endereços do modal do frete, com a permissão do pedido. Mapa fora do ar é lista vazia. */
export async function buscarEnderecosDoPedidoAction(texto: string): Promise<SugestaoDeEndereco[]> {
  await requirePermission('confirmacao_pedido', 'A');
  const busca = typeof texto === 'string' ? texto.trim() : '';
  if (busca.length < 3 || busca.length > 200) return [];
  try {
    return await sugerirEnderecos(busca);
  } catch (error) {
    if (error instanceof MapaIndisponivel) return [];
    throw error;
  }
}

/** P17: o endereço de entrega que faltou para sugerir o frete, sem sair do pedido. */
export async function salvarEnderecoDoPedidoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('confirmacao_pedido', 'A');
  if (user.perfil === 'gerencia') return { error: 'O frete do pedido é digitado pela chefia.' };
  const pedidoId = formText(formData, 'pedido_id');
  if (!isUuid(pedidoId)) return { error: 'Pedido inválido.' };
  const lido = await lerEnderecoDeEntrega(formData);
  if ('error' in lido) return lido;

  try {
    await withTransaction(pool, (client) => salvarEnderecoDoPedido(client, pedidoId, lido.endereco));
  } catch (error) {
    return { error: toUserMessage(error), fields: lido.fields };
  }
  revalidarPedidos(pedidoId);
  return { success: 'Endereço salvo.' };
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
