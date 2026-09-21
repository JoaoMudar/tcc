import type { PoolClient } from 'pg';
import { isDataIso, somaDias } from './datas';
import { UserError } from './errors';
import { nomeEspecieSql } from './lotes';
import { lerQuantidade } from './lotes-rotulos';
import type { Perfil } from './perfis';
import {
  type CanalVenda,
  SITUACOES_PEDIDO,
  type SituacaoPedido,
  centavosParaSql,
  isCanalVenda,
  podeTransicionar,
} from './pedidos-rotulos';
import type { Db } from './sql';
import { isUuid } from './uuid';

export {
  CANAIS_VENDA,
  CANAL_PADRAO,
  DONO_SITUACAO,
  SITUACOES_PEDIDO,
  TRANSICOES,
  formatMoeda,
  isCanalVenda,
  isSituacaoPedido,
  parsePreco,
  podeTransicionar,
  totalItem,
  totalPedido,
  transicoesDe,
  type CanalVenda,
  type SituacaoPedido,
  type Transicao,
} from './pedidos-rotulos';

type Client = Pick<PoolClient, 'query'>;

const MAX_QUANTIDADE = 10_000_000;

export function parseQuantidadeItem(text: string): { error: string } | { value: number } {
  const numero = lerQuantidade(text);
  if (numero === null || numero < 1 || numero > MAX_QUANTIDADE) {
    return { error: 'A quantidade precisa ser um número inteiro de mudas, maior que zero.' };
  }
  return { value: numero };
}

export function parseDataEntrega(text: string): { error: string } | { value: string | null } {
  const texto = text.trim();
  if (texto === '') return { value: null };
  if (!isDataIso(texto)) return { error: 'A data de entrega é inválida.' };
  return { value: texto };
}

export function parseObservacoesPedido(text: string): { error: string } | { value: string | null } {
  const texto = text.trim();
  if (texto.length > 500) return { error: 'A observação pode ter até 500 caracteres.' };
  return { value: texto || null };
}

export interface FiltroPedidos {
  de: string;
  ate: string;
  clienteId: string | null;
  canal: CanalVenda | null;
}

export const PERIODO_PADRAO_DIAS = 90;

/** RF-58: o filtro vem do endereço, e o que não for válido cai no padrão, os últimos 90 dias. */
export function parseFiltroPedidos(
  params: { de?: string; ate?: string; cliente?: string; canal?: string },
  hoje: string,
): FiltroPedidos {
  const ate = params.ate && isDataIso(params.ate) ? params.ate : hoje;
  const de = params.de && isDataIso(params.de) ? params.de : somaDias(ate, -PERIODO_PADRAO_DIAS);
  return {
    de: de <= ate ? de : ate,
    ate: de <= ate ? ate : de,
    clienteId: isUuid(params.cliente) ? params.cliente : null,
    canal: params.canal && isCanalVenda(params.canal) ? params.canal : null,
  };
}

export interface NovoItem {
  especieId: string;
  recipienteId: string;
  quantidade: number;
  precoCentavos: number;
}

export interface ItemPedido extends NovoItem {
  id: string;
  especie: string;
  nomeCientifico: string;
  recipiente: string;
}

export interface PedidoResumo {
  id: string;
  numero: number;
  clienteId: string;
  cliente: string;
  canal: CanalVenda;
  situacao: SituacaoPedido;
  criadoEm: Date;
  dataEntrega: string | null;
  itens: number;
  totalCentavos: number;
}

export interface FichaPedido extends Omit<PedidoResumo, 'itens' | 'totalCentavos'> {
  clienteTelefone: string | null;
  observacoes: string | null;
  criadoPor: string;
  itens: ItemPedido[];
}

/**
 * O total vem somado no SQL, em centavos: a lista mostra dezenas de pedidos, e
 * carregar os itens de cada um só para somar seria uma consulta por linha.
 */
const TOTAL_SQL = `COALESCE((SELECT SUM(ROUND(i.preco_unitario * 100) * i.quantidade)
                               FROM pedidos_itens i WHERE i.pedido_id = p.id), 0)::bigint`;

/**
 * RF-58: pedidos do período, com cliente e canal opcionais. O período é o dia do
 * registro **no fuso do viveiro**: `criado_em` é UTC, e depois das 21h o pedido
 * de hoje cairia no filtro de amanhã.
 */
export async function listPedidos(db: Db, filtro: FiltroPedidos): Promise<PedidoResumo[]> {
  const { rows } = await db.query<Omit<PedidoResumo, 'totalCentavos'> & { totalCentavos: string }>(
    `SELECT p.id, p.numero_pedido AS numero, p.cliente_id AS "clienteId", c.nome AS cliente,
            p.canal_venda AS canal, p.situacao, p.criado_em AS "criadoEm",
            to_char(p.data_entrega, 'YYYY-MM-DD') AS "dataEntrega",
            (SELECT COUNT(*)::int FROM pedidos_itens i WHERE i.pedido_id = p.id) AS itens,
            ${TOTAL_SQL} AS "totalCentavos"
       FROM pedidos p
       JOIN cadastro.pessoas c ON c.id = p.cliente_id
      WHERE (p.criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2
        AND ($3::uuid IS NULL OR p.cliente_id = $3)
        AND ($4::text IS NULL OR p.canal_venda = $4)
      ORDER BY p.numero_pedido DESC
      LIMIT 300`,
    [filtro.de, filtro.ate, filtro.clienteId, filtro.canal],
  );
  // `bigint` volta do `pg` como texto, para não perder precisão que aqui não existe
  return rows.map((row) => ({ ...row, totalCentavos: Number(row.totalCentavos) }));
}

export async function findPedido(db: Db, id: string): Promise<FichaPedido | null> {
  const { rows } = await db.query<Omit<FichaPedido, 'itens'>>(
    `SELECT p.id, p.numero_pedido AS numero, p.cliente_id AS "clienteId", c.nome AS cliente,
            c.telefone AS "clienteTelefone", p.canal_venda AS canal, p.situacao, p.criado_em AS "criadoEm",
            to_char(p.data_entrega, 'YYYY-MM-DD') AS "dataEntrega", p.observacoes,
            u.nome_exibicao AS "criadoPor"
       FROM pedidos p
       JOIN cadastro.pessoas c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = p.criado_por
      WHERE p.id = $1`,
    [id],
  );
  if (!rows[0]) return null;
  return { ...rows[0], itens: await listItens(db, id) };
}

export async function listItens(db: Db, pedidoId: string): Promise<ItemPedido[]> {
  const { rows } = await db.query<ItemPedido>(
    `SELECT i.id, i.especie_id AS "especieId", ${nomeEspecieSql('e')} AS especie,
            e.nome_cientifico AS "nomeCientifico", i.recipiente_id AS "recipienteId", r.nome AS recipiente,
            i.quantidade, ROUND(i.preco_unitario * 100)::int AS "precoCentavos"
       FROM pedidos_itens i
       JOIN especies e ON e.id = i.especie_id
       JOIN recipientes r ON r.id = i.recipiente_id
      WHERE i.pedido_id = $1
      -- Ordem de leitura, e não de digitação: os itens do mesmo pedido entram na
      -- mesma transação e compartilham a hora de criação, que por isso não os
      -- desempata. Sem critério estável o pedido apareceria numa ordem a cada
      -- consulta; por espécie e recipiente ele fica agrupado como quem confere
      -- uma venda espera ler, e o identificador fecha o desempate.
      ORDER BY especie, r.nome, i.criado_em, i.id`,
    [pedidoId],
  );
  return rows;
}

/** Clientes para a lista fechada do pedido: quem tem o papel ativo (RN-45). */
export async function listClientes(db: Db): Promise<{ id: string; nome: string }[]> {
  const { rows } = await db.query<{ id: string; nome: string }>(
    `SELECT p.id, p.nome
       FROM cadastro.pessoas p
      WHERE p.ativa
        AND EXISTS (SELECT 1 FROM cadastro.pessoas_papeis x
                     WHERE x.pessoa_id = p.id AND x.ativo AND x.papel = 'cliente')
      ORDER BY p.nome
      LIMIT 500`,
  );
  return rows;
}

interface PedidoTravado {
  id: string;
  numero: number;
  situacao: SituacaoPedido;
}

/** `SELECT ... FOR UPDATE`: duas alterações no mesmo pedido esperam uma pela outra. */
async function travarPedido(client: Client, pedidoId: string): Promise<PedidoTravado> {
  const { rows } = await client.query<PedidoTravado>(
    'SELECT id, numero_pedido AS numero, situacao FROM pedidos WHERE id = $1 FOR UPDATE',
    [pedidoId],
  );
  if (!rows[0]) throw new UserError('Pedido não encontrado.');
  return rows[0];
}

/**
 * RF-57: **a trava do item é do servidor**. Esconder o botão na tela não impede
 * o formulário reenviado, e é o registro do que foi vendido que está protegido.
 *
 * O item só muda enquanto o pedido está em `cadastrado`. Depois disso a gerência
 * já apurou disponibilidade em cima dele, e mexer por esta porta faria a
 * apuração mentir: a alteração passa pela edição da chefia, que devolve o pedido
 * à conferência (T8.10).
 */
function exigirCadastrado(pedido: PedidoTravado): void {
  if (pedido.situacao === 'cadastrado') return;
  throw new UserError(
    `O pedido ${pedido.numero} está em ${SITUACOES_PEDIDO[pedido.situacao].toLowerCase()}, e o item não muda mais.`,
  );
}

async function inserirItens(client: Client, pedidoId: string, itens: readonly NovoItem[]): Promise<void> {
  for (const item of itens) {
    await client.query(
      `INSERT INTO pedidos_itens (pedido_id, especie_id, recipiente_id, quantidade, preco_unitario)
       VALUES ($1, $2, $3, $4, $5)`,
      [pedidoId, item.especieId, item.recipienteId, item.quantidade, centavosParaSql(item.precoCentavos)],
    );
  }
}

export interface NovoPedido {
  clienteId: string;
  canal: CanalVenda;
  dataEntrega: string | null;
  observacoes: string | null;
  itens: readonly NovoItem[];
  criadoPor: string;
}

/**
 * T8.1, RF-54, UC-31: o pedido nasce em rascunho, com número sequencial do banco
 * e ao menos um item. Pedido e itens entram na mesma transação: pedido sem item
 * nenhum seria um número gasto à toa.
 */
export async function criarPedido(client: Client, input: NovoPedido): Promise<{ id: string; numero: number }> {
  if (input.itens.length === 0) throw new UserError('O pedido precisa de ao menos um item.');
  const { rows } = await client.query<{ id: string; numero: number }>(
    `INSERT INTO pedidos (cliente_id, canal_venda, data_entrega, observacoes, criado_por)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, numero_pedido AS numero`,
    [input.clienteId, input.canal, input.dataEntrega, input.observacoes, input.criadoPor],
  );
  await inserirItens(client, rows[0].id, input.itens);
  // O nascimento do pedido é a primeira linha do histórico, e é a única sem
  // situação anterior. Sem ela a ficha abriria contando a história pela metade.
  await client.query(
    `INSERT INTO pedidos_historico (pedido_id, situacao_anterior, situacao_nova, alterado_por)
     VALUES ($1, NULL, 'cadastrado', $2)`,
    [rows[0].id, input.criadoPor],
  );
  return rows[0];
}

/** RF-57: item novo só entra em pedido que ainda é rascunho. */
export async function adicionarItem(client: Client, pedidoId: string, item: NovoItem): Promise<void> {
  exigirCadastrado(await travarPedido(client, pedidoId));
  await inserirItens(client, pedidoId, [item]);
}

export async function atualizarItem(
  client: Client,
  pedidoId: string,
  itemId: string,
  valores: { quantidade: number; precoCentavos: number },
): Promise<void> {
  exigirCadastrado(await travarPedido(client, pedidoId));
  const { rowCount } = await client.query(
    'UPDATE pedidos_itens SET quantidade = $3, preco_unitario = $4 WHERE id = $2 AND pedido_id = $1',
    [pedidoId, itemId, valores.quantidade, centavosParaSql(valores.precoCentavos)],
  );
  if (!rowCount) throw new UserError('Item não encontrado neste pedido.');
}

export async function removerItem(client: Client, pedidoId: string, itemId: string): Promise<void> {
  exigirCadastrado(await travarPedido(client, pedidoId));
  const { rowCount } = await client.query('DELETE FROM pedidos_itens WHERE id = $2 AND pedido_id = $1', [pedidoId, itemId]);
  if (!rowCount) throw new UserError('Item não encontrado neste pedido.');
}

/** Quem está mudando o pedido: o perfil decide se pode, o usuário assina (RN-52). */
export interface AutorDaMudanca {
  perfil: Perfil;
  usuarioId: string;
}

/**
 * T8.6: **a única porta que escreve `pedidos.situacao`**. Trava a linha, confere
 * a transição contra `TRANSICOES` e grava o histórico na mesma transação.
 *
 * Não é trigger de propósito: trigger não conhece o usuário, e toda linha do
 * histórico precisa de autor. É a mesma razão que faz `registrarMovimento` ser
 * a porta única do lote.
 */
export async function mudarSituacao(
  client: Client,
  pedidoId: string,
  para: SituacaoPedido,
  autor: AutorDaMudanca,
  observacoes: string | null = null,
): Promise<{ numero: number; de: SituacaoPedido }> {
  const pedido = await travarPedido(client, pedidoId);
  if (!podeTransicionar(pedido.situacao, para, autor.perfil)) {
    throw new UserError(
      `O pedido ${pedido.numero} está em ${SITUACOES_PEDIDO[pedido.situacao].toLowerCase()}, ` +
        `e não pode passar a ${SITUACOES_PEDIDO[para].toLowerCase()}.`,
    );
  }
  await client.query('UPDATE pedidos SET situacao = $2 WHERE id = $1', [pedidoId, para]);
  await client.query(
    `INSERT INTO pedidos_historico (pedido_id, situacao_anterior, situacao_nova, alterado_por, observacoes)
     VALUES ($1, $2, $3, $4, $5)`,
    [pedidoId, pedido.situacao, para, autor.usuarioId, observacoes],
  );
  return { numero: pedido.numero, de: pedido.situacao };
}

export interface LinhaHistorico {
  situacaoAnterior: SituacaoPedido | null;
  situacaoNova: SituacaoPedido;
  alteradoPor: string;
  observacoes: string | null;
  criadoEm: Date;
}

/**
 * Separado de `findPedido` de propósito: a ficha é aberta o tempo todo, e o
 * histórico só interessa a quem for olhá-lo.
 */
export async function listHistorico(db: Db, pedidoId: string): Promise<LinhaHistorico[]> {
  const { rows } = await db.query<LinhaHistorico>(
    `SELECT h.situacao_anterior AS "situacaoAnterior", h.situacao_nova AS "situacaoNova",
            u.nome_exibicao AS "alteradoPor", h.observacoes, h.criado_em AS "criadoEm"
       FROM pedidos_historico h
       JOIN usuarios u ON u.id = h.alterado_por
      WHERE h.pedido_id = $1
      ORDER BY h.criado_em, h.id`,
    [pedidoId],
  );
  return rows;
}

/**
 * RF-57: aprovar exige ao menos um item, que é a pós-condição do UC-31, porque
 * pedido sem item não registra venda nenhuma.
 */
export async function confirmarPedido(
  client: Client,
  pedidoId: string,
  autor: AutorDaMudanca,
): Promise<{ numero: number }> {
  const { rows } = await client.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM pedidos_itens WHERE pedido_id = $1', [
    pedidoId,
  ]);
  if (rows[0].n === 0) throw new UserError('Acrescente ao menos um item antes de aprovar o pedido.');
  return mudarSituacao(client, pedidoId, 'aprovado', autor);
}

/**
 * Cancelar não apaga, e os itens ficam como estavam.
 *
 * **O pronto para envio também cancela, e é a decisão de 21/09/2026**: sem essa
 * seta, a venda que cai depois de pronta não teria como ser registrada, e o
 * pedido ficaria para sempre afirmando uma entrega que não houve.
 */
export async function cancelarPedido(
  client: Client,
  pedidoId: string,
  autor: AutorDaMudanca,
): Promise<{ numero: number }> {
  return mudarSituacao(client, pedidoId, 'cancelado', autor);
}
