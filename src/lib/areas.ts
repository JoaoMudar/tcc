import { type Db, isForeignKeyViolation, violatedConstraint } from './sql';

export interface Canteiro {
  id: string;
  numero: number;
  capacidade: number | null;
}

export interface Area {
  id: string;
  letra: string;
  nome: string | null;
  canteiros: Canteiro[];
}

/** A área é uma letra, como a equipe já fala no viveiro (RF-13). */
export function parseLetra(text: string): { error: string } | { value: string } {
  const letra = text.trim().toUpperCase();
  if (!/^[A-Z]$/.test(letra)) return { error: 'A área é identificada por uma letra, de A a Z.' };
  return { value: letra };
}

export function parseNomeArea(text: string): { error: string } | { value: string | null } {
  const nome = text.trim();
  if (nome.length > 60) return { error: 'O nome da área pode ter até 60 caracteres.' };
  return { value: nome || null };
}

export function parseNumeroCanteiro(text: string): { error: string } | { value: number } {
  const texto = text.trim();
  const numero = Number(texto);
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(numero) || numero < 1 || numero > 9999) {
    return { error: 'O número do canteiro precisa ser um número inteiro a partir de 1.' };
  }
  return { value: numero };
}

/** Capacidade é opcional: existe para avisar, não para recusar lote. */
export function parseCapacidade(text: string): { error: string } | { value: number | null } {
  const texto = text.trim();
  if (texto === '') return { value: null };
  const numero = Number(texto);
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(numero) || numero < 1 || numero > 1_000_000) {
    return { error: 'A capacidade precisa ser um número inteiro de mudas, ou ficar em branco.' };
  }
  return { value: numero };
}

export function duplicateAreaMessage(error: unknown, letra: string): string | null {
  return violatedConstraint(error, '23505') === 'areas_letra_key' ? `A área ${letra} já existe.` : null;
}

export function duplicateCanteiroMessage(error: unknown, numero: number, letra: string | null): string | null {
  if (violatedConstraint(error, '23505') !== 'canteiros_numero_unico_na_area') return null;
  return `O canteiro ${numero} já existe na área ${letra ?? 'escolhida'}. Escolha outro número.`;
}

export function emUsoMessage(error: unknown, oQue: string): string | null {
  return isForeignKeyViolation(error) ? `${oQue} tem lote ou tarefa ligada e não pode ser excluído.` : null;
}

export async function listAreas(db: Db): Promise<Area[]> {
  const { rows } = await db.query<Area>(
    `SELECT a.id, a.letra, a.nome,
            COALESCE(
              json_agg(json_build_object('id', c.id, 'numero', c.numero, 'capacidade', c.capacidade) ORDER BY c.numero)
                FILTER (WHERE c.id IS NOT NULL),
              '[]'
            ) AS canteiros
       FROM areas a
       LEFT JOIN canteiros c ON c.area_id = a.id
      GROUP BY a.id
      ORDER BY a.letra`,
  );
  return rows;
}

export async function findLetraDaArea(db: Db, areaId: string): Promise<string | null> {
  const { rows } = await db.query<{ letra: string }>('SELECT letra FROM areas WHERE id = $1', [areaId]);
  return rows[0]?.letra ?? null;
}

export async function insertArea(db: Db, input: { letra: string; nome: string | null }): Promise<string> {
  const { rows } = await db.query<{ id: string }>('INSERT INTO areas (letra, nome) VALUES ($1, $2) RETURNING id', [
    input.letra,
    input.nome,
  ]);
  return rows[0].id;
}

/**
 * A chave de `canteiros` apaga em cascata com a área: excluir área com canteiro
 * levaria os canteiros junto sem ninguém ver. Por isso a área só sai vazia.
 */
export async function deleteArea(db: Db, id: string): Promise<'ok' | 'nao_encontrado' | 'tem_canteiros'> {
  const { rows } = await db.query<{ excluida: boolean; canteiros: number }>(
    `WITH alvo AS (SELECT id, (SELECT COUNT(*)::int FROM canteiros WHERE area_id = $1) AS canteiros FROM areas WHERE id = $1),
          apagada AS (DELETE FROM areas WHERE id IN (SELECT id FROM alvo WHERE canteiros = 0) RETURNING id)
     SELECT EXISTS (SELECT 1 FROM apagada) AS excluida, canteiros FROM alvo`,
    [id],
  );
  if (rows.length === 0) return 'nao_encontrado';
  return rows[0].excluida ? 'ok' : 'tem_canteiros';
}

/** `null` quando a área não existe. */
export async function insertCanteiro(
  db: Db,
  input: { areaId: string; numero: number; capacidade: number | null },
): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO canteiros (area_id, numero, capacidade)
     SELECT id, $2, $3 FROM areas WHERE id = $1
     RETURNING id`,
    [input.areaId, input.numero, input.capacidade],
  );
  return rows[0]?.id ?? null;
}

export async function deleteCanteiro(db: Db, id: string): Promise<'ok' | 'nao_encontrado'> {
  const { rowCount } = await db.query('DELETE FROM canteiros WHERE id = $1', [id]);
  return rowCount ? 'ok' : 'nao_encontrado';
}
