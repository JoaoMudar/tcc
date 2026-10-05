import { nomeEspecieSql } from './lotes';
import type { Db } from './sql';

/** Uma faixa do estoque: os lotes abertos de um par espécie e recipiente que têm a mesma altura. */
export interface SaldoDisponivel {
  especieId: string;
  especie: string;
  recipienteId: string;
  recipiente: string;
  /** Altura medida dos lotes da faixa, em metros. Nula é "ainda não medida". */
  alturaM: number | null;
  quantidade: number;
  lotes: number;
}

/**
 * T4.10, RF-43, RN-06: o estoque disponível por espécie, recipiente e altura,
 * somado de **todos** os lotes abertos, em qualquer fase. Não há muda "pronta":
 * toda muda do viveiro está à venda. Não é estoque digitado: perda e venda já
 * saíram do saldo de cada lote. É o que o item de pedido lê (RF-56), a cada consulta.
 */
export async function saldoDisponivel(
  db: Db,
  filtro: { especieId?: string | null; recipienteId?: string | null } = {},
): Promise<SaldoDisponivel[]> {
  const { rows } = await db.query<SaldoDisponivel>(
    `SELECT l.especie_id AS "especieId", ${nomeEspecieSql('e')} AS especie,
            l.recipiente_id AS "recipienteId", r.nome AS recipiente,
            l.altura_m::float8 AS "alturaM",
            SUM(l.quantidade_atual)::int AS quantidade, COUNT(*)::int AS lotes
       FROM lotes l
       JOIN especies e ON e.id = l.especie_id
       JOIN recipientes r ON r.id = l.recipiente_id
      WHERE l.encerrado_em IS NULL
        AND ($1::uuid IS NULL OR l.especie_id = $1)
        AND ($2::uuid IS NULL OR l.recipiente_id = $2)
      GROUP BY l.especie_id, e.id, l.recipiente_id, r.nome, r.volume_litros, l.altura_m
      ORDER BY especie, r.volume_litros NULLS LAST, r.nome, l.altura_m NULLS LAST`,
    [filtro.especieId ?? null, filtro.recipienteId ?? null],
  );
  return rows;
}
