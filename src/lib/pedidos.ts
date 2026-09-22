import type { PoolClient } from 'pg';
import { isDataIso, somaDias } from './datas';
import { UserError } from './errors';
import { nomeEspecieSql } from './lotes';
import { lerQuantidade } from './lotes-rotulos';
import type { Perfil } from './perfis';
import {
  type CanalVenda,
  type EstadoDisponibilidade,
  type LinhaComposicao,
  SITUACOES_PEDIDO,
  type SituacaoPedido,
  centavosParaSql,
  isCanalVenda,
  podeTransicionar,
  resolveDisponibilidade,
  validarComposicaoGenerico,
} from './pedidos-rotulos';
import type { Db } from './sql';
import { isUuid } from './uuid';

export {
  CANAIS_VENDA,
  CANAL_PADRAO,
  DONO_SITUACAO,
  ROTULO_URGENCIA,
  SITUACOES_PEDIDO,
  TRANSICOES,
  formatMoeda,
  formatTotal,
  isCanalVenda,
  isSituacaoPedido,
  parsePreco,
  podeTransicionar,
  resolveDisponibilidade,
  totalItem,
  totalPedido,
  transicoesDe,
  urgenciaPedido,
  validarComposicaoGenerico,
  validarDivisaoCargas,
  type CanalVenda,
  type EstadoDisponibilidade,
  type LinhaComposicao,
  type SituacaoPedido,
  type Transicao,
  type Urgencia,
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
  /** Nulo só no item genérico, que é o único que chega sem espécie escolhida. */
  especieId: string | null;
  recipienteId: string;
  quantidade: number;
  /** Nulo no cadastro: o preço é digitado depois da conferência (RN-50). */
  precoCentavos: number | null;
  generico?: boolean;
  /** O que o cliente pediu, em texto. Só no genérico. */
  especificacao?: string | null;
  /** Espécies que o cliente aceita no genérico. Vazio é "qualquer uma". */
  especiesPermitidas?: readonly string[];
}

export interface ItemPedido extends NovoItem {
  id: string;
  especie: string | null;
  nomeCientifico: string | null;
  recipiente: string;

  /** Verificação (T8.10). `disponivel` nulo é "a gerência ainda não conferiu". */
  disponivel: boolean | null;
  quantidadeDisponivel: number | null;
  recipienteDisponivelId: string | null;
  recipienteDisponivel: string | null;
  observacoesDisponibilidade: string | null;

  generico: boolean;
  itemPaiId: string | null;
  especificacao: string | null;
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
  /** Nulo enquanto algum item de topo não tiver preço. */
  totalCentavos: number | null;
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
 *
 * **Só os itens de topo somam**, como em `totalPedido`: o filho do genérico
 * herda o preço do pai e contar os dois dobraria a venda.
 *
 * **Falta um preço, o total é nulo.** Somar só os precificados anunciaria na
 * carteira uma venda menor que a verdadeira; a tela diz "a definir" no lugar.
 */
const TOTAL_SQL = `CASE
  WHEN EXISTS (SELECT 1 FROM pedidos_itens i
                WHERE i.pedido_id = p.id AND i.item_pai_id IS NULL AND i.preco_unitario IS NULL)
  THEN NULL
  ELSE COALESCE((SELECT SUM(ROUND(i.preco_unitario * 100) * i.quantidade)
                   FROM pedidos_itens i WHERE i.pedido_id = p.id AND i.item_pai_id IS NULL), 0)
END::bigint`;

/**
 * RF-58: pedidos do período, com cliente e canal opcionais. O período é o dia do
 * registro **no fuso do viveiro**: `criado_em` é UTC, e depois das 21h o pedido
 * de hoje cairia no filtro de amanhã.
 */
export async function listPedidos(db: Db, filtro: FiltroPedidos): Promise<PedidoResumo[]> {
  const { rows } = await db.query<Omit<PedidoResumo, 'totalCentavos'> & { totalCentavos: string | null }>(
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
  return rows.map((row) => ({ ...row, totalCentavos: row.totalCentavos === null ? null : Number(row.totalCentavos) }));
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
            i.quantidade, ROUND(i.preco_unitario * 100)::int AS "precoCentavos",
            i.disponivel, i.quantidade_disponivel AS "quantidadeDisponivel",
            i.recipiente_disponivel_id AS "recipienteDisponivelId", rd.nome AS "recipienteDisponivel",
            i.observacoes_disponibilidade AS "observacoesDisponibilidade",
            i.generico, i.item_pai_id AS "itemPaiId", i.especificacao
       FROM pedidos_itens i
       -- LEFT: o item genérico não tem espécie até a gerência compor
       LEFT JOIN especies e ON e.id = i.especie_id
       JOIN recipientes r ON r.id = i.recipiente_id
       LEFT JOIN recipientes rd ON rd.id = i.recipiente_disponivel_id
       -- O pai só existe para ordenar: o filho precisa sair logo abaixo dele
       LEFT JOIN pedidos_itens pai ON pai.id = i.item_pai_id
       LEFT JOIN especies pe ON pe.id = pai.especie_id
       LEFT JOIN recipientes pr ON pr.id = pai.recipiente_id
      WHERE i.pedido_id = $1
      -- Ordem de leitura, e não de digitação: os itens do mesmo pedido entram na
      -- mesma transação e compartilham a hora de criação, que por isso não os
      -- desempata. Sem critério estável o pedido apareceria numa ordem a cada
      -- consulta; por espécie e recipiente ele fica agrupado como quem confere
      -- uma venda espera ler, e o identificador fecha o desempate.
      --
      -- O FILHO ORDENA PELO PAI, e não por si: a composição do genérico tem de
      -- sair embaixo do item que ela compõe. Como o pai genérico não tem espécie,
      -- ele e os filhos dele caem juntos no NULLS LAST, e o identificador do pai
      -- os mantém no mesmo bloco.
      ORDER BY (CASE WHEN i.item_pai_id IS NULL THEN ${nomeEspecieSql('e')} ELSE ${nomeEspecieSql('pe')} END) NULLS LAST,
               (CASE WHEN i.item_pai_id IS NULL THEN r.nome ELSE pr.nome END) NULLS LAST,
               COALESCE(i.item_pai_id, i.id),
               (i.item_pai_id IS NOT NULL),
               especie NULLS LAST, r.nome, i.criado_em, i.id`,
    [pedidoId],
  );
  return rows;
}

/** As espécies que o cliente aceita num item genérico. Lista vazia é "qualquer uma". */
export async function listEspeciesPermitidas(db: Db, itemId: string): Promise<string[]> {
  const { rows } = await db.query<{ especieId: string }>(
    'SELECT especie_id AS "especieId" FROM pedidos_itens_especies_permitidas WHERE item_id = $1',
    [itemId],
  );
  return rows.map((row) => row.especieId);
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

export interface PedidoTravado {
  id: string;
  numero: number;
  situacao: SituacaoPedido;
}

/** `SELECT ... FOR UPDATE`: duas alterações no mesmo pedido esperam uma pela outra. */
export async function travarPedido(client: Client, pedidoId: string): Promise<PedidoTravado> {
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
    const generico = item.generico ?? false;
    if (generico && item.especieId) throw new UserError('O item genérico é o que não tem espécie escolhida.');
    if (!generico && !item.especieId) throw new UserError('Escolha a espécie do item.');

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO pedidos_itens (pedido_id, especie_id, recipiente_id, quantidade, preco_unitario, generico, especificacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        pedidoId,
        generico ? null : item.especieId,
        item.recipienteId,
        item.quantidade,
        item.precoCentavos === null ? null : centavosParaSql(item.precoCentavos),
        generico,
        generico ? (item.especificacao ?? null) : null,
      ],
    );

    // Sem nenhuma linha aqui, qualquer espécie serve: é o caso comum, e é por
    // isso que o escopo é representado pela ausência (T8.7).
    for (const especieId of generico ? (item.especiesPermitidas ?? []) : []) {
      await client.query(
        'INSERT INTO pedidos_itens_especies_permitidas (item_id, especie_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [rows[0].id, especieId],
      );
    }
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

/**
 * RF-57: a quantidade do item, enquanto o pedido é rascunho. **O preço não
 * passa por aqui**: ele é digitado depois da conferência, por `definirPrecos`.
 */
export async function atualizarItem(
  client: Client,
  pedidoId: string,
  itemId: string,
  valores: { quantidade: number },
): Promise<void> {
  exigirCadastrado(await travarPedido(client, pedidoId));
  const { rowCount } = await client.query(
    'UPDATE pedidos_itens SET quantidade = $3 WHERE id = $2 AND pedido_id = $1',
    [pedidoId, itemId, valores.quantidade],
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

/** As situações em que o preço pode ser digitado: depois da conferência, antes da aprovação. */
const PRECIFICAVEIS: readonly SituacaoPedido[] = ['verificado', 'pendente_alteracao'];

/**
 * RF-55, RN-50: **o preço é digitado depois da conferência**, e não no cadastro.
 *
 * Quem registra o pedido está no meio de uma conversa e anota espécie,
 * recipiente e quantidade; o valor se fecha quando a gerência já disse o que
 * existe no pátio, porque é a conferência que diz quantas mudas serão vendidas
 * e em que recipiente. Fora dessas duas situações a porta é fechada pela mesma
 * razão de `exigirCadastrado`: o aprovado é o registro do que foi vendido.
 *
 * **O filho do item genérico recebe o preço do pai**, e não um seu: as 500 mudas
 * foram vendidas por aquele preço, e a composição só diz quais espécies as
 * atendem. O total do pedido soma apenas os itens de topo (`totalPedido`).
 */
export async function definirPrecos(
  client: Client,
  pedidoId: string,
  linhas: readonly { itemId: string; precoCentavos: number }[],
  autor: AutorDaMudanca,
): Promise<void> {
  const pedido = await travarPedido(client, pedidoId);
  if (!PRECIFICAVEIS.includes(pedido.situacao)) {
    throw new UserError(
      `O pedido ${pedido.numero} está em ${SITUACOES_PEDIDO[pedido.situacao].toLowerCase()}, ` +
        'e o preço se digita depois da conferência.',
    );
  }
  // O valor da venda é da chefia (D4 §3.2), como o resto do recurso `pedidos`:
  // a gerência responde o que existe no pátio, e não por quanto se vende.
  if (autor.perfil === 'gerencia') {
    throw new UserError('O preço do pedido é digitado pela chefia.');
  }

  for (const linha of linhas) {
    const { rowCount } = await client.query(
      `UPDATE pedidos_itens SET preco_unitario = $3
        WHERE pedido_id = $1 AND (id = $2 OR item_pai_id = $2)`,
      [pedidoId, linha.itemId, centavosParaSql(linha.precoCentavos)],
    );
    if (!rowCount) throw new UserError('Item não encontrado neste pedido.');
  }
}

/**
 * T8.11, RF-57: aprovar exige ao menos um item, que é a pós-condição do UC-31,
 * porque pedido sem item não registra venda nenhuma.
 *
 * **A aprovação consome o que a gerência apurou**, e é o que faz a etapa
 * seguinte ser simples: o item indisponível sai do pedido, e o parcial passa a
 * valer pela quantidade e pelo recipiente que existem de verdade. Quem for
 * separar a carga nunca vê "tem 300 das 500": vê 300, que é o que vai no
 * caminhão. A alternativa seria arrastar a apuração até o galpão e pedir que
 * quem está contando faça a conta de novo.
 */
export async function confirmarPedido(
  client: Client,
  pedidoId: string,
  autor: AutorDaMudanca,
  opcoes: { precisaNota?: boolean | null } = {},
): Promise<{ numero: number; removidos: number; ajustados: number }> {
  // Indisponível é `disponivel = false` com quantidade zero (T8.7)
  const apagados = await client.query(
    'DELETE FROM pedidos_itens WHERE pedido_id = $1 AND disponivel = false AND quantidade_disponivel = 0',
    [pedidoId],
  );
  const removidos = apagados.rowCount ?? 0;

  // Parcial é `disponivel = false` com quantidade maior que zero, e o recipiente
  // conferido pode ser outro: quem manda é o que a gerência achou no pátio.
  //
  // **O item deixa de ser parcial ao ser consumido**, e por isso as três colunas
  // da conferência são limpas na mesma linha. Não é arrumação: parcial quer
  // dizer "tem menos do que o pedido pede", e depois da aprovação o pedido pede
  // exatamente o que existe. Manter `quantidade_disponivel` igual a `quantidade`
  // afirmaria uma falta que já não há, e é o que o CHECK
  // `pedidos_itens_disponibilidade_coerente` recusa gravar.
  const trocados = await client.query(
    `UPDATE pedidos_itens
        SET quantidade = quantidade_disponivel,
            recipiente_id = COALESCE(recipiente_disponivel_id, recipiente_id),
            disponivel = true,
            quantidade_disponivel = NULL,
            recipiente_disponivel_id = NULL
      WHERE pedido_id = $1 AND disponivel = false AND quantidade_disponivel > 0`,
    [pedidoId],
  );
  const ajustados = trocados.rowCount ?? 0;

  const { rows } = await client.query<{ n: number; semPreco: number }>(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE preco_unitario IS NULL)::int AS "semPreco"
       FROM pedidos_itens WHERE pedido_id = $1 AND item_pai_id IS NULL`,
    [pedidoId],
  );
  if (rows[0].n === 0) {
    throw new UserError(
      removidos > 0
        ? 'Não sobrou item disponível neste pedido. Cancele o pedido ou peça alteração à gerência.'
        : 'Acrescente ao menos um item antes de aprovar o pedido.',
    );
  }

  // Aprovar é registrar a venda, e venda sem valor não é registro nenhum. É
  // esta checagem que sustenta o preço opcional na coluna (migration
  // 20260922000001): nulo é "ainda não precificado", e não chega ao aprovado.
  if (rows[0].semPreco > 0) {
    throw new UserError(
      rows[0].semPreco === 1
        ? 'Falta o preço de um item. Informe os preços antes de aprovar o pedido.'
        : `Faltam os preços de ${rows[0].semPreco} itens. Informe-os antes de aprovar o pedido.`,
    );
  }

  // A pergunta da nota acontece na aprovação, e é só aqui que a coluna ganha
  // valor: nulo continua sendo "ninguém respondeu" (migration 20260921000001).
  if (opcoes.precisaNota !== undefined) {
    await client.query('UPDATE pedidos SET precisa_nota = $2 WHERE id = $1', [pedidoId, opcoes.precisaNota]);
  }

  const resumo =
    removidos + ajustados > 0 ? `${removidos} item(ns) removido(s), ${ajustados} ajustado(s) pela conferência.` : null;
  const { numero } = await mudarSituacao(client, pedidoId, 'aprovado', autor, resumo);
  return { numero, removidos, ajustados };
}

/**
 * Cancelar não apaga, e os itens ficam como estavam.
 *
 * **O pronto para envio também cancela, e é a decisão de 21/09/2026**: sem essa
 * seta, a venda que cai depois de pronta não teria como ser registrada, e o
 * pedido ficaria para sempre afirmando uma entrega que não houve.
 *
 * O motivo é opcional e vai para a observação do histórico (T8.5): cancelamento
 * é a única saída que não volta atrás, e daqui a um mês "por que este pedido foi
 * cancelado?" não tem outra resposta no sistema.
 */
export async function cancelarPedido(
  client: Client,
  pedidoId: string,
  autor: AutorDaMudanca,
  motivo: string | null = null,
): Promise<{ numero: number }> {
  return mudarSituacao(client, pedidoId, 'cancelado', autor, motivo);
}

// ------------------------------------------------------------
// Verificação de disponibilidade (T8.10)
// ------------------------------------------------------------

/**
 * Marcar item é escrever o que alguém foi ao pátio conferir.
 *
 * **Responder o primeiro item abre a conferência**, na mesma transação da
 * resposta: quem tocou "Tem tudo" começou a conferir, e pedir um toque antes
 * disso só rendia um erro que não era de ninguém. A abertura continua sendo
 * gesto de pessoa, e não efeito de abrir a tela, e por isso o histórico ganha a
 * linha com autor como sempre ganhou.
 *
 * De qualquer outra situação a escrita é recusada: o aprovado já consumiu a
 * apuração, e regravá-la faria o pedido discordar de si mesmo.
 */
async function abrirOuExigirVerificacao(
  client: Client,
  pedidoId: string,
  autor: AutorDaMudanca,
): Promise<PedidoTravado> {
  const pedido = await travarPedido(client, pedidoId);
  if (pedido.situacao === 'verificando') return pedido;
  if (pedido.situacao === 'cadastrado') {
    await mudarSituacao(client, pedidoId, 'verificando', autor);
    return { ...pedido, situacao: 'verificando' };
  }
  throw new UserError(
    `O pedido ${pedido.numero} está em ${SITUACOES_PEDIDO[pedido.situacao].toLowerCase()}, e a conferência não está aberta.`,
  );
}

/**
 * T8.10: abre a conferência. **É idempotente de propósito**: a tela a chama toda
 * vez que é aberta, e a gerência abre, sai para olhar o canteiro e volta. De
 * qualquer outra situação devolve sem mudar nada, em vez de recusar, porque
 * reabrir uma tela não é erro de ninguém.
 */
export async function iniciarVerificacao(
  client: Client,
  pedidoId: string,
  autor: AutorDaMudanca,
): Promise<{ numero: number; iniciada: boolean }> {
  const pedido = await travarPedido(client, pedidoId);
  if (pedido.situacao !== 'cadastrado') return { numero: pedido.numero, iniciada: false };
  const { numero } = await mudarSituacao(client, pedidoId, 'verificando', autor);
  return { numero, iniciada: true };
}

interface ItemParaVerificar {
  quantidade: number;
  generico: boolean;
}

/** T8.10: a resposta da gerência sobre um item específico, gravada na hora. */
export async function marcarDisponibilidade(
  client: Client,
  pedidoId: string,
  itemId: string,
  estado: EstadoDisponibilidade,
  autor: AutorDaMudanca,
  extras: { quantidade?: number | null; recipienteId?: string | null; observacoes?: string | null } = {},
): Promise<void> {
  await abrirOuExigirVerificacao(client, pedidoId, autor);

  // `AND pedido_id` em toda escrita de item: impede que o identificador de um
  // item de outro pedido, reenviado no formulário, escreva onde não devia.
  const { rows } = await client.query<ItemParaVerificar>(
    'SELECT quantidade, generico FROM pedidos_itens WHERE id = $2 AND pedido_id = $1',
    [pedidoId, itemId],
  );
  if (!rows[0]) throw new UserError('Item não encontrado neste pedido.');
  if (rows[0].generico) {
    throw new UserError('O item genérico se resolve escolhendo as espécies, e não por disponível ou indisponível.');
  }

  const resolvida = resolveDisponibilidade(estado, rows[0].quantidade, extras);
  if ('error' in resolvida) throw new UserError(resolvida.error);
  const { disponivel, quantidadeDisponivel, recipienteDisponivelId } = resolvida.value;

  await client.query(
    `UPDATE pedidos_itens
        SET disponivel = $3, quantidade_disponivel = $4, recipiente_disponivel_id = $5,
            observacoes_disponibilidade = $6
      WHERE id = $2 AND pedido_id = $1`,
    [pedidoId, itemId, disponivel, quantidadeDisponivel, recipienteDisponivelId, extras.observacoes ?? null],
  );
}

/**
 * T8.10: a observação sem a resposta, que é o "Salvar e continuar depois". A
 * gerência anota "ver com o Gilberto" num item que ainda não conferiu, e isso
 * não pode marcá-lo como respondido.
 */
export async function salvarObservacoesVerificacao(
  client: Client,
  pedidoId: string,
  linhas: readonly { itemId: string; observacoes: string | null }[],
  autor: AutorDaMudanca,
): Promise<void> {
  await abrirOuExigirVerificacao(client, pedidoId, autor);
  for (const linha of linhas) {
    await client.query('UPDATE pedidos_itens SET observacoes_disponibilidade = $3 WHERE id = $2 AND pedido_id = $1', [
      pedidoId,
      linha.itemId,
      linha.observacoes,
    ]);
  }
}

/**
 * T8.10: a composição do item genérico. Apaga os filhos anteriores e grava os
 * novos, porque recompor é decidir de novo, e não acrescentar: somar os antigos
 * com os novos passaria da quantidade do pai na segunda tentativa.
 *
 * **O escopo é conferido aqui, e não só na busca da tela**: a lista de espécies
 * oferecidas é conveniência, a recusa é a regra.
 */
export async function definirComposicaoGenerico(
  client: Client,
  pedidoId: string,
  itemPaiId: string,
  linhas: readonly LinhaComposicao[],
  autor: AutorDaMudanca,
): Promise<void> {
  await abrirOuExigirVerificacao(client, pedidoId, autor);

  const { rows } = await client.query<{ quantidade: number; preco: string; generico: boolean }>(
    'SELECT quantidade, preco_unitario AS preco, generico FROM pedidos_itens WHERE id = $2 AND pedido_id = $1 FOR UPDATE',
    [pedidoId, itemPaiId],
  );
  if (!rows[0]) throw new UserError('Item não encontrado neste pedido.');
  if (!rows[0].generico) throw new UserError('Este item já tem espécie escolhida, e não se compõe.');

  const { rows: escopo } = await client.query<{ especieId: string }>(
    'SELECT especie_id AS "especieId" FROM pedidos_itens_especies_permitidas WHERE item_id = $1',
    [itemPaiId],
  );
  const validada = validarComposicaoGenerico(
    rows[0].quantidade,
    linhas,
    escopo.map((linha) => linha.especieId),
  );
  if ('error' in validada) throw new UserError(validada.error);

  await client.query('DELETE FROM pedidos_itens WHERE item_pai_id = $2 AND pedido_id = $1', [pedidoId, itemPaiId]);

  for (const linha of validada.value) {
    // O filho herda o preço do pai: foi por aquele preço que as 500 mudas foram
    // vendidas, e o filho não é uma venda nova. O total do pedido soma só os
    // itens de topo, e é o que impede a venda de contar duas vezes (`totalPedido`).
    await client.query(
      `INSERT INTO pedidos_itens
         (pedido_id, especie_id, recipiente_id, quantidade, preco_unitario, generico, item_pai_id, disponivel)
       VALUES ($1, $2, $3, $4, $5, false, $6, true)`,
      [pedidoId, linha.especieId, linha.recipienteId, linha.quantidade, rows[0].preco, itemPaiId],
    );
  }

  // O pai fica respondido, e é assim que ele deixa de ser pendência na conclusão
  await client.query(
    `UPDATE pedidos_itens
        SET disponivel = true, quantidade_disponivel = NULL, recipiente_disponivel_id = NULL
      WHERE id = $2 AND pedido_id = $1`,
    [pedidoId, itemPaiId],
  );
}

interface ResumoVerificacao {
  pendentes: number;
  total: number;
  disponiveis: number;
  genericos: number;
}

/**
 * T8.10: fecha a conferência e devolve o pedido à chefia.
 *
 * **Não se envia pela metade**: item sem resposta é item que ninguém foi olhar,
 * e deixar passar faria a chefia aprovar sobre uma apuração incompleta, que é
 * justamente o que a etapa existe para evitar.
 */
export async function concluirVerificacao(
  client: Client,
  pedidoId: string,
  autor: AutorDaMudanca,
): Promise<{ numero: number; resumo: string }> {
  const { rows } = await client.query<ResumoVerificacao>(
    `SELECT COUNT(*) FILTER (WHERE disponivel IS NULL)::int          AS pendentes,
            COUNT(*)::int                                            AS total,
            COUNT(*) FILTER (WHERE disponivel AND NOT generico)::int AS disponiveis,
            COUNT(*) FILTER (WHERE generico)::int                    AS genericos
       FROM pedidos_itens
      WHERE pedido_id = $1 AND item_pai_id IS NULL`,
    [pedidoId],
  );
  const { pendentes, total, disponiveis, genericos } = rows[0];
  if (total === 0) throw new UserError('Este pedido não tem item nenhum para conferir.');
  if (pendentes > 0) {
    throw new UserError(
      pendentes === 1 ? 'Ainda há um item sem resposta.' : `Ainda há ${pendentes} itens sem resposta.`,
    );
  }

  const resumo =
    genericos > 0
      ? `${disponiveis} de ${total} disponíveis, ${genericos} genérico(s) definido(s).`
      : `${disponiveis} de ${total} disponíveis.`;
  const { numero } = await mudarSituacao(client, pedidoId, 'verificado', autor, resumo);
  return { numero, resumo };
}
