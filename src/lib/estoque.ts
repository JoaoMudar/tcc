import { nomeEspecieSql } from './lotes';
import type { Db } from './sql';

export interface SaldoPronto {
  especieId: string;
  especie: string;
  recipienteId: string;
  recipiente: string;
  quantidade: number;
  lotes: number;
}

/**
 * T4.10, RF-43: muda pronta por espécie e recipiente, somada dos lotes abertos na
 * fase `pronto`. Não é estoque digitado: perda e venda já saíram do saldo de cada
 * lote. É o número que o item de pedido lê (T8.2), a cada consulta.
 */
export async function saldoPronto(
  db: Db,
  filtro: { especieId?: string | null; recipienteId?: string | null } = {},
): Promise<SaldoPronto[]> {
  const { rows } = await db.query<SaldoPronto>(
    `SELECT l.especie_id AS "especieId", ${nomeEspecieSql('e')} AS especie,
            l.recipiente_id AS "recipienteId", r.nome AS recipiente,
            SUM(l.quantidade_atual)::int AS quantidade, COUNT(*)::int AS lotes
       FROM lotes l
       JOIN especies e ON e.id = l.especie_id
       JOIN recipientes r ON r.id = l.recipiente_id
      WHERE l.encerrado_em IS NULL AND l.fase = 'pronto'
        AND ($1::uuid IS NULL OR l.especie_id = $1)
        AND ($2::uuid IS NULL OR l.recipiente_id = $2)
      GROUP BY l.especie_id, e.id, l.recipiente_id, r.nome, r.volume_litros
      ORDER BY especie, r.volume_litros NULLS LAST, r.nome`,
    [filtro.especieId ?? null, filtro.recipienteId ?? null],
  );
  return rows;
}
