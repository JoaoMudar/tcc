import type { PoolClient } from 'pg';
import { UserError } from './errors';
import { nomeEspecieSql } from './lotes';
import { type AutorDaMudanca, type PedidoTravado, mudarSituacao, travarPedido } from './pedidos';
import { SITUACOES_PEDIDO, type SituacaoCarga, type LinhaCarga, validarDivisaoCargas } from './pedidos-rotulos';
import type { Db } from './sql';

/**
 * T8.13: a contagem para carregar. **Uma carga é uma viagem do caminhão**, e o
 * pedido de 5.000 mudas que não cabe de uma vez vira duas ou três, cada uma
 * separada e conferida por inteiro antes de sair.
 *
 * Fica fora de `pedidos.ts` pela mesma razão que `estoque.ts` ficou fora de
 * `lotes.ts`: é um assunto próprio, que lê o pedido e não o altera, a não ser
 * pela situação, que continua passando por `mudarSituacao`.
 */

type Client = Pick<PoolClient, 'query'>;

export interface ItemDaCarga {
  id: string;
  itemId: string;
  especie: string;
  recipiente: string;
  /** Altura pedida, em metros: quem separa no pátio procura pelo tamanho também. */
  alturaM: number | null;
  quantidade: number;
  separado: boolean;
}

export interface Carga {
  id: string;
  numero: number;
  situacao: SituacaoCarga;
  observacoes: string | null;
  itens: ItemDaCarga[];
}

/**
 * **Item real é o que vai no caminhão.** O pai genérico nunca entra em carga:
 * ele é o que o cliente pediu ("500 mudas nativas"), e quem se separa são os
 * filhos que a gerência escolheu na conferência, que não são genéricos.
 */
async function itensReais(client: Client, pedidoId: string) {
  const { rows } = await client.query<{ id: string; quantidade: number; especie: string }>(
    `SELECT i.id, i.quantidade, ${nomeEspecieSql('e')} AS especie
       FROM pedidos_itens i
       LEFT JOIN especies e ON e.id = i.especie_id
       JOIN recipientes r ON r.id = i.recipiente_id
      WHERE i.pedido_id = $1 AND i.generico = false
      ORDER BY especie NULLS LAST, r.nome, i.criado_em, i.id`,
    [pedidoId],
  );
  return rows;
}

/** Carga só nasce de pedido aprovado: antes disso não há o que separar. */
function exigirAprovado(pedido: PedidoTravado): void {
  if (pedido.situacao === 'aprovado') return;
  throw new UserError(
    `O pedido ${pedido.numero} está em ${SITUACOES_PEDIDO[pedido.situacao].toLowerCase()}, e ainda não se organiza em cargas.`,
  );
}

async function inserirCarga(
  client: Client,
  pedidoId: string,
  numero: number,
  linhas: readonly LinhaCarga[],
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    'INSERT INTO pedidos_cargas (pedido_id, numero_carga) VALUES ($1, $2) RETURNING id',
    [pedidoId, numero],
  );
  for (const linha of linhas) {
    await client.query(
      'INSERT INTO pedidos_cargas_itens (carga_id, item_id, quantidade) VALUES ($1, $2, $3)',
      [rows[0].id, linha.itemId, linha.quantidade],
    );
  }
  return rows[0].id;
}

/** T8.13: "Cabe em uma viagem". Uma carga com tudo, na quantidade cheia. */
export async function criarCargaUnica(
  client: Client,
  pedidoId: string,
  autor: AutorDaMudanca,
): Promise<{ cargaId: string; numero: number }> {
  const pedido = await travarPedido(client, pedidoId);
  exigirAprovado(pedido);

  const itens = await itensReais(client, pedidoId);
  if (itens.length === 0) throw new UserError('Este pedido não tem item para separar.');

  const cargaId = await inserirCarga(
    client,
    pedidoId,
    1,
    itens.map((item) => ({ itemId: item.id, quantidade: item.quantidade })),
  );
  await mudarSituacao(client, pedidoId, 'separando', autor, 'Uma carga só.');
  return { cargaId, numero: pedido.numero };
}

/**
 * T8.13: a divisão em viagens.
 *
 * **A soma de cada item tem de fechar** (`validarDivisaoCargas`): muda que não
 * entrou em carga nenhuma é muda que ninguém vai separar, e o caminhão sai sem
 * ela sem que nada avise.
 *
 * Carga que ficou sem item é descartada e as demais são **renumeradas**: abrir
 * uma carga a mais e não usá-la é o caminho normal de quem ainda está decidindo
 * quantas viagens serão, e deixar um buraco na numeração faria a tela falar de
 * "carga 3" onde só há duas.
 */
export async function criarCargas(
  client: Client,
  pedidoId: string,
  cargas: readonly (readonly LinhaCarga[])[],
  autor: AutorDaMudanca,
): Promise<{ criadas: number }> {
  const pedido = await travarPedido(client, pedidoId);
  exigirAprovado(pedido);

  const itens = await itensReais(client, pedidoId);
  if (itens.length === 0) throw new UserError('Este pedido não tem item para separar.');

  const validada = validarDivisaoCargas(
    itens.map((item) => ({ id: item.id, quantidade: item.quantidade, nome: item.especie })),
    cargas,
  );
  if ('error' in validada) throw new UserError(validada.error);

  const usadas = cargas
    .map((carga) => carga.filter((linha) => linha.quantidade > 0))
    .filter((carga) => carga.length > 0);
  if (usadas.length === 0) throw new UserError('Nenhuma carga ficou com item.');

  for (const [indice, linhas] of usadas.entries()) {
    await inserirCarga(client, pedidoId, indice + 1, linhas);
  }
  await mudarSituacao(client, pedidoId, 'separando', autor, `Dividido em ${usadas.length} carga(s).`);
  return { criadas: usadas.length };
}

/**
 * T8.13: a contagem de um item numa carga.
 *
 * **Grava o valor final, e não inverte o atual**, que é o que a deixa
 * idempotente: o toque repetido pela conexão ruim do galpão chega ao mesmo
 * resultado, e é o que vai permitir a fila offline um dia.
 *
 * A condição do `WHERE` é a trava: carga já pronta e pedido fora da separação
 * não aceitam marcação, e zero linhas afetadas é erro, e não silêncio.
 */
export async function marcarItemSeparado(client: Client, cargaItemId: string, separado: boolean): Promise<void> {
  const { rowCount } = await client.query(
    `UPDATE pedidos_cargas_itens SET separado = $2
      WHERE id = $1
        AND carga_id IN (SELECT c.id
                           FROM pedidos_cargas c
                           JOIN pedidos p ON p.id = c.pedido_id
                          WHERE c.situacao <> 'pronto' AND p.situacao = 'separando')`,
    [cargaItemId, separado],
  );
  if (!rowCount) {
    throw new UserError('Este item não pode mais ser marcado: a carga já está pronta ou o pedido saiu da separação.');
  }
}

interface CargaTravada {
  pedidoId: string;
  numero: number;
  situacao: SituacaoCarga;
  situacaoPedido: string;
}

/**
 * T8.13: fecha a carga, e o pedido quando ela for a última.
 *
 * As três recusas são deliberadas, e duas delas existem porque a versão
 * anterior desta rotina não as tinha: carga já pronta não fecha de novo, pedido
 * fora da separação não fecha carga nenhuma, e carga com item por contar não
 * fecha. Sem elas, `concluirCarga` levaria o pedido a pronto para envio mais de
 * uma vez.
 */
export async function concluirCarga(
  client: Client,
  cargaId: string,
  autor: AutorDaMudanca,
): Promise<{ numero: number; pedidoPronto: boolean }> {
  const { rows } = await client.query<CargaTravada>(
    `SELECT c.pedido_id AS "pedidoId", c.numero_carga AS numero, c.situacao,
            p.situacao AS "situacaoPedido"
       FROM pedidos_cargas c
       JOIN pedidos p ON p.id = c.pedido_id
      WHERE c.id = $1
        FOR UPDATE OF c`,
    [cargaId],
  );
  if (!rows[0]) throw new UserError('Carga não encontrada.');
  const carga = rows[0];

  if (carga.situacao === 'pronto') throw new UserError(`A carga ${carga.numero} já está pronta.`);
  if (carga.situacaoPedido !== 'separando') throw new UserError('Este pedido não está em separação.');

  const { rows: pendentes } = await client.query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM pedidos_cargas_itens WHERE carga_id = $1 AND separado = false',
    [cargaId],
  );
  if (pendentes[0].n > 0) {
    throw new UserError(
      pendentes[0].n === 1
        ? 'Ainda há um item por separar nesta carga.'
        : `Ainda há ${pendentes[0].n} itens por separar nesta carga.`,
    );
  }

  await client.query("UPDATE pedidos_cargas SET situacao = 'pronto' WHERE id = $1", [cargaId]);

  const { rows: faltam } = await client.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM pedidos_cargas WHERE pedido_id = $1 AND situacao <> 'pronto'",
    [carga.pedidoId],
  );
  const pedidoPronto = faltam[0].n === 0;
  if (pedidoPronto) {
    await mudarSituacao(client, carga.pedidoId, 'pronto_envio', autor, 'Todas as cargas foram separadas.');
  }
  return { numero: carga.numero, pedidoPronto };
}

/** T8.13: as cargas do pedido, com o que vai em cada uma. */
export async function listCargas(db: Db, pedidoId: string): Promise<Carga[]> {
  const { rows: cargas } = await db.query<Omit<Carga, 'itens'>>(
    `SELECT id, numero_carga AS numero, situacao, observacoes
       FROM pedidos_cargas
      WHERE pedido_id = $1
      ORDER BY numero_carga`,
    [pedidoId],
  );
  if (cargas.length === 0) return [];

  const { rows: itens } = await db.query<ItemDaCarga & { cargaId: string }>(
    `SELECT ci.id, ci.carga_id AS "cargaId", ci.item_id AS "itemId", ci.quantidade, ci.separado,
            COALESCE(${nomeEspecieSql('e')}, 'Espécie não definida') AS especie, r.nome AS recipiente,
            i.altura_m::float8 AS "alturaM"
       FROM pedidos_cargas_itens ci
       JOIN pedidos_cargas c ON c.id = ci.carga_id
       JOIN pedidos_itens i ON i.id = ci.item_id
       LEFT JOIN especies e ON e.id = i.especie_id
       JOIN recipientes r ON r.id = i.recipiente_id
      WHERE c.pedido_id = $1
      ORDER BY especie, r.nome, ci.id`,
    [pedidoId],
  );

  return cargas.map((carga) => ({
    ...carga,
    itens: itens.filter((item) => item.cargaId === carga.id),
  }));
}

export interface PedidoNoCalendario {
  id: string;
  numero: number;
  cliente: string;
  dataEntrega: string;
  situacao: string;
  cargas: number;
  prontas: number;
}

/**
 * T8.15: o que há para entregar no período, com o progresso de cargas. Uma
 * consulta só para o mês inteiro do calendário: uma por dia seriam trinta.
 */
export async function pedidosDoPeriodo(db: Db, de: string, ate: string): Promise<PedidoNoCalendario[]> {
  const { rows } = await db.query<PedidoNoCalendario>(
    `SELECT p.id, p.numero_pedido AS numero, c.nome AS cliente,
            to_char(p.data_entrega, 'YYYY-MM-DD') AS "dataEntrega", p.situacao,
            COUNT(DISTINCT l.id)::int AS cargas,
            COUNT(DISTINCT l.id) FILTER (WHERE l.situacao = 'pronto')::int AS prontas
       FROM pedidos p
       JOIN cadastro.pessoas c ON c.id = p.cliente_id
       LEFT JOIN pedidos_cargas l ON l.pedido_id = p.id
      WHERE p.data_entrega BETWEEN $1 AND $2
        AND p.situacao IN ('aprovado', 'separando', 'pronto_envio')
      GROUP BY p.id, c.nome
      ORDER BY p.data_entrega, p.numero_pedido`,
    [de, ate],
  );
  return rows;
}
