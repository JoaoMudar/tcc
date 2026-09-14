import { type Db, violatedConstraint } from './sql';

export interface Recipiente {
  id: string;
  nome: string;
  volumeLitros: number | null;
  ativo: boolean;
}

export interface RecipienteFields {
  nome: string;
  volumeLitros: number | null;
}

/** Nome obrigatório; volume em litros opcional, aceitando vírgula (RF-11). Cabe em NUMERIC(6,3). */
export function parseRecipienteFields(input: { nome: string; volume: string }): { error: string } | { value: RecipienteFields } {
  const nome = input.nome.trim();
  if (nome.length < 2 || nome.length > 60) return { error: 'O nome do recipiente precisa ter de 2 a 60 caracteres.' };

  const texto = input.volume.trim();
  if (texto === '') return { value: { nome, volumeLitros: null } };
  if (!/^\d{1,3}([.,]\d{1,3})?$/.test(texto)) return { error: 'O volume é em litros, como 0,9 ou 12.' };
  const volumeLitros = Number(texto.replace(',', '.'));
  if (volumeLitros <= 0) return { error: 'O volume precisa ser maior que zero.' };
  return { value: { nome, volumeLitros } };
}

/** 0.9 → "0,9 L"; 0.055 → "55 mL". */
export function formatVolume(litros: number | null): string {
  if (litros === null) return '';
  if (litros < 1) {
    const ml = Math.round(litros * 1000);
    return ml % 100 === 0 ? `${String(litros).replace('.', ',')} L` : `${ml} mL`;
  }
  return `${String(litros).replace('.', ',')} L`;
}

export function duplicateMessage(error: unknown): string | null {
  return violatedConstraint(error, '23505') === 'recipientes_nome_key' ? 'Já existe recipiente com esse nome.' : null;
}

export async function listRecipientes(db: Db): Promise<Recipiente[]> {
  const { rows } = await db.query<Recipiente>(
    `SELECT id, nome, volume_litros::float8 AS "volumeLitros", ativo
       FROM recipientes
      ORDER BY ativo DESC, volume_litros NULLS LAST, nome`,
  );
  return rows;
}

export async function insertRecipiente(db: Db, input: RecipienteFields): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'INSERT INTO recipientes (nome, volume_litros) VALUES ($1, $2) RETURNING id',
    [input.nome, input.volumeLitros],
  );
  return rows[0].id;
}

/** Sem exclusão física: lote e pedido antigos continuam apontando para o recipiente fora de uso. */
export async function updateRecipiente(
  db: Db,
  id: string,
  changes: RecipienteFields & { ativo: boolean },
): Promise<'ok' | 'nao_encontrado'> {
  const { rowCount } = await db.query('UPDATE recipientes SET nome = $2, volume_litros = $3, ativo = $4 WHERE id = $1', [
    id,
    changes.nome,
    changes.volumeLitros,
    changes.ativo,
  ]);
  return rowCount ? 'ok' : 'nao_encontrado';
}
