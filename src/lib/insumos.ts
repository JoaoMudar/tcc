import type { Db } from './sql';

export type CategoriaInsumo = 'substrato' | 'adubo' | 'defensivo' | 'recipiente' | 'outros';

/** O enum `categoria_insumo`, com o nome da tela. */
export const CATEGORIA_INSUMO_LABELS: Record<CategoriaInsumo, string> = {
  substrato: 'Substrato',
  adubo: 'Adubo',
  defensivo: 'Defensivo',
  recipiente: 'Recipiente',
  outros: 'Outros',
};

/** Unidade é lista fechada (RNF-02): texto livre daria "kg", "Kg" e "quilo" para a mesma coisa. */
export const UNIDADES_MEDIDA = ['litro', 'mililitro', 'quilo', 'grama', 'unidade', 'saco', 'metro cúbico'] as const;

export interface Insumo {
  id: string;
  nome: string;
  categoria: CategoriaInsumo;
  unidadeMedida: string;
  ativo: boolean;
}

export interface InsumoFields {
  nome: string;
  categoria: CategoriaInsumo;
  unidadeMedida: string;
}

export function parseInsumoFields(input: {
  nome: string;
  categoria: string;
  unidadeMedida: string;
}): { error: string } | { value: InsumoFields } {
  const nome = input.nome.trim();
  if (nome.length < 2 || nome.length > 80) return { error: 'O nome do insumo precisa ter de 2 a 80 caracteres.' };
  if (!(input.categoria in CATEGORIA_INSUMO_LABELS)) return { error: 'Escolha a categoria.' };
  if (!(UNIDADES_MEDIDA as readonly string[]).includes(input.unidadeMedida)) return { error: 'Escolha a unidade de medida.' };
  return { value: { nome, categoria: input.categoria as CategoriaInsumo, unidadeMedida: input.unidadeMedida } };
}

export async function listInsumos(db: Db): Promise<Insumo[]> {
  const { rows } = await db.query<Insumo>(
    `SELECT id, nome, categoria, unidade_medida AS "unidadeMedida", ativo
       FROM insumos
      ORDER BY ativo DESC, categoria, nome`,
  );
  return rows;
}

export async function insertInsumo(db: Db, input: InsumoFields): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'INSERT INTO insumos (nome, categoria, unidade_medida) VALUES ($1, $2, $3) RETURNING id',
    [input.nome, input.categoria, input.unidadeMedida],
  );
  return rows[0].id;
}

export async function updateInsumo(
  db: Db,
  id: string,
  changes: InsumoFields & { ativo: boolean },
): Promise<'ok' | 'nao_encontrado'> {
  const { rowCount } = await db.query(
    'UPDATE insumos SET nome = $2, categoria = $3, unidade_medida = $4, ativo = $5 WHERE id = $1',
    [id, changes.nome, changes.categoria, changes.unidadeMedida, changes.ativo],
  );
  return rowCount ? 'ok' : 'nao_encontrado';
}
