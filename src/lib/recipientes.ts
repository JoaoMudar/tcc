import { type Db, violatedConstraint } from './sql';

export interface Recipiente {
  id: string;
  nome: string;
  volumeLitros: number | null;
  /** Peso do recipiente cheio, com substrato e muda (RN-65). */
  pesoKg: number | null;
  ativo: boolean;
}

export interface RecipienteFields {
  nome: string;
  volumeLitros: number | null;
  /** Ausente é "sem peso", como no cadastro antigo. */
  pesoKg?: number | null;
}

/** Número decimal opcional com vírgula, até 999,999: cabe em NUMERIC(6,3). */
function lerDecimal(texto: string): number | null | 'invalido' {
  const limpo = texto.trim();
  if (limpo === '') return null;
  if (!/^\d{1,3}([.,]\d{1,3})?$/.test(limpo)) return 'invalido';
  const numero = Number(limpo.replace(',', '.'));
  return numero > 0 ? numero : 'invalido';
}

/**
 * Nome obrigatório; volume em litros e peso cheio em kg opcionais, aceitando
 * vírgula (RF-11). O peso é o do recipiente cheio de substrato, com a muda: é
 * ele que soma o peso da carga na aprovação (RN-65).
 */
export function parseRecipienteFields(input: {
  nome: string;
  volume: string;
  peso?: string;
}): { error: string } | { value: RecipienteFields } {
  const nome = input.nome.trim();
  if (nome.length < 2 || nome.length > 60) return { error: 'O nome do recipiente precisa ter de 2 a 60 caracteres.' };

  const volumeLitros = lerDecimal(input.volume);
  if (volumeLitros === 'invalido') return { error: 'O volume é em litros, maior que zero, como 0,9 ou 12.' };
  const pesoKg = lerDecimal(input.peso ?? '');
  if (pesoKg === 'invalido') return { error: 'O peso é em kg, maior que zero, como 0,35 ou 4,5.' };
  return { value: { nome, volumeLitros, pesoKg } };
}

/** 0.35 → "0,35 kg". */
export function formatPeso(kg: number | null): string {
  if (kg === null) return '';
  return `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`;
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
    `SELECT id, nome, volume_litros::float8 AS "volumeLitros", peso_kg::float8 AS "pesoKg", ativo
       FROM recipientes
      ORDER BY ativo DESC, volume_litros NULLS LAST, nome`,
  );
  return rows;
}

export async function insertRecipiente(db: Db, input: RecipienteFields): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'INSERT INTO recipientes (nome, volume_litros, peso_kg) VALUES ($1, $2, $3) RETURNING id',
    [input.nome, input.volumeLitros, input.pesoKg ?? null],
  );
  return rows[0].id;
}

/** Sem exclusão física: lote e pedido antigos continuam apontando para o recipiente fora de uso. */
export async function updateRecipiente(
  db: Db,
  id: string,
  changes: RecipienteFields & { ativo: boolean },
): Promise<'ok' | 'nao_encontrado'> {
  const { rowCount } = await db.query(
    'UPDATE recipientes SET nome = $2, volume_litros = $3, peso_kg = $4, ativo = $5 WHERE id = $1',
    [id, changes.nome, changes.volumeLitros, changes.pesoKg ?? null, changes.ativo],
  );
  return rowCount ? 'ok' : 'nao_encontrado';
}
