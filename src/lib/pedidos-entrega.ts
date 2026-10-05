import type { PoolClient } from 'pg';
import type { EnderecoDeEntrega } from './pessoas';
import type { Coordenada } from './rotas-ors';
import type { Db } from './sql';

/**
 * P19: o destino do pedido. O cliente pode pedir para entregar num lugar
 * diferente a cada pedido, e o endereço gravado no pedido **tem prioridade**
 * sobre o do cadastro, sem substituí-lo. Sem destino próprio, vale o primeiro
 * endereço de entrega do cliente, como antes.
 *
 * O frete e a rota da viagem leem o destino por aqui, e nenhum dos dois grava
 * mais no cadastro do cliente: só a coordenada achada pelo mapa, quando o
 * destino é o do cadastro, volta para lá, para não consultar de novo.
 */

/**
 * O destino efetivo, como `e`, para quem já tem o pedido como `p`. Colunas:
 * `id` (o endereço do cadastro; nulo quando o destino é do pedido), `proprio`,
 * `logradouro`, `cidade`, `uf`, `cep`, `lat`, `lng` e `geocodificado_em`.
 * Com `p` nulo (a parada avulsa da viagem), não acha nada.
 */
export const ENDERECO_DO_PEDIDO = `LEFT JOIN LATERAL (
         SELECT d.id, d.proprio, d.logradouro, d.cidade, d.uf, d.cep, d.lat, d.lng, d.geocodificado_em
           FROM (SELECT NULL::uuid AS id, true AS proprio, p.entrega_logradouro AS logradouro,
                        p.entrega_cidade AS cidade, p.entrega_uf AS uf, p.entrega_cep AS cep,
                        p.entrega_lat AS lat, p.entrega_lng AS lng,
                        p.entrega_geocodificado_em AS geocodificado_em, 0 AS prioridade, NULL::timestamptz AS criado_em
                  WHERE p.entrega_logradouro IS NOT NULL
                 UNION ALL
                 SELECT x.id, false, x.logradouro, x.cidade, x.uf, x.cep, x.lat, x.lng, x.geocodificado_em,
                        1, x.criado_em
                   FROM cadastro.pessoas_enderecos x
                  WHERE x.pessoa_id = p.cliente_id AND x.tipo = 'entrega') d
          ORDER BY d.prioridade, d.criado_em, d.id
          LIMIT 1) e ON true`;

/** Onde a coordenada achada pelo mapa fica guardada. */
export interface OndeGuardar {
  pedidoId: string;
  /** O destino é o do pedido. */
  proprio: boolean;
  /** O endereço do cadastro, quando o destino é o do cliente. */
  enderecoId: string | null;
}

/**
 * Guarda a coordenada achada (ou o "procurado e não achado", com `ponto` nulo)
 * onde o destino mora: no pedido, ou no endereço do cadastro do cliente.
 */
export async function guardarCoordenada(db: Db, onde: OndeGuardar, ponto: Coordenada | null): Promise<void> {
  if (onde.proprio) {
    await db.query(
      'UPDATE pedidos SET entrega_lat = $2, entrega_lng = $3, entrega_geocodificado_em = NOW() WHERE id = $1',
      [onde.pedidoId, ponto?.lat ?? null, ponto?.lng ?? null],
    );
  } else if (onde.enderecoId) {
    await db.query('UPDATE cadastro.pessoas_enderecos SET lat = $2, lng = $3, geocodificado_em = NOW() WHERE id = $1', [
      onde.enderecoId,
      ponto?.lat ?? null,
      ponto?.lng ?? null,
    ]);
  }
}

/**
 * Grava o destino no pedido. **Nunca toca o cadastro do cliente.** Com o ponto
 * (escolhido na lista, ou a localização colada do WhatsApp), a coordenada vai
 * junto; sem ele, a coordenada e o "não achado" do texto anterior caem, e a
 * sugestão procura o texto novo.
 */
export async function gravarEnderecoDoPedido(
  client: Pick<PoolClient, 'query'>,
  pedidoId: string,
  endereco: EnderecoDeEntrega,
): Promise<void> {
  const { logradouro, cidade, uf, cep, ponto } = endereco;
  await client.query(
    `UPDATE pedidos
        SET entrega_logradouro = $2, entrega_cidade = $3, entrega_uf = $4, entrega_cep = $5,
            entrega_lat = $6, entrega_lng = $7,
            entrega_geocodificado_em = CASE WHEN $6::numeric IS NULL THEN NULL ELSE NOW() END
      WHERE id = $1`,
    [pedidoId, logradouro, cidade, uf, cep, ponto?.lat ?? null, ponto?.lng ?? null],
  );
}
