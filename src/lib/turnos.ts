import type { Pool } from 'pg';

type Db = Pick<Pool, 'query'>;

export interface Turno {
  id: string;
  nome: string;
  /** `HH:MM`, já sem os segundos que o Postgres devolve em `time`. */
  inicio: string;
  fim: string;
  ativo: boolean;
}

export interface TurnoFields {
  inicio: string;
  fim: string;
}

const HORA_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

/** Minutos desde a meia-noite, ou `null` se não for hora válida. */
export function parseHora(texto: string): number | null {
  const match = HORA_PATTERN.exec(texto.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Valida os horários do formulário. O CHECK `fim > inicio` do banco é a segunda barreira. */
export function parseTurnoFields(input: { inicio: string; fim: string }): { error: string } | { value: TurnoFields } {
  const inicio = parseHora(input.inicio);
  const fim = parseHora(input.fim);
  if (inicio === null || fim === null) return { error: 'Informe o início e o fim no formato 07:30.' };
  if (fim <= inicio) return { error: 'O fim do turno precisa ser depois do início.' };
  return { value: { inicio: input.inicio.trim().slice(0, 5), fim: input.fim.trim().slice(0, 5) } };
}

export function parseNomeTurno(texto: string): { error: string } | { value: string } {
  const nome = texto.trim().toLowerCase();
  if (nome.length < 2 || nome.length > 30) return { error: 'O nome do turno precisa ter de 2 a 30 caracteres.' };
  return { value: nome };
}

/** A duração é derivada, fim menos início, e não campo (C8). */
export function duracaoMinutos(turno: Pick<Turno, 'inicio' | 'fim'>): number {
  const inicio = parseHora(turno.inicio);
  const fim = parseHora(turno.fim);
  if (inicio === null || fim === null) return 0;
  return Math.max(0, fim - inicio);
}

/** Jornada padrão da agenda: a soma dos turnos em uso (RF-08). */
export function jornadaDiaria(turnos: readonly Pick<Turno, 'inicio' | 'fim' | 'ativo'>[]): number {
  return turnos.filter((turno) => turno.ativo).reduce((total, turno) => total + duracaoMinutos(turno), 0);
}

/** 510 → "8h30". */
export function formatDuracao(minutos: number): string {
  return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`;
}

const NOMES_EXIBIDOS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

/** O banco guarda o nome sem acento (`manha`); a tela mostra "Manhã". */
export function turnoLabel(nome: string): string {
  return NOMES_EXIBIDOS[nome] ?? nome.charAt(0).toUpperCase() + nome.slice(1);
}

export function duplicateMessage(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, constraint } = error as { code?: string; constraint?: string };
  if (code === '23505' && constraint === 'turnos_trabalho_nome_key') return 'Já existe turno com esse nome.';
  return null;
}

const SELECT_TURNO = `
  SELECT id, nome, to_char(inicio, 'HH24:MI') AS inicio, to_char(fim, 'HH24:MI') AS fim, ativo
    FROM turnos_trabalho`;

export async function listTurnos(db: Db): Promise<Turno[]> {
  const { rows } = await db.query<Turno>(`${SELECT_TURNO} ORDER BY inicio, nome`);
  return rows;
}

export async function insertTurno(db: Db, input: TurnoFields & { nome: string }): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'INSERT INTO turnos_trabalho (nome, inicio, fim) VALUES ($1, $2, $3) RETURNING id',
    [input.nome, input.inicio, input.fim],
  );
  return rows[0].id;
}

/** Sem exclusão (D4 não dá `E`): o turno que sai de uso é desativado, e a agenda antiga continua apontando para ele. */
export async function updateTurno(
  db: Db,
  id: string,
  changes: TurnoFields & { ativo: boolean },
): Promise<'ok' | 'nao_encontrado'> {
  const { rowCount } = await db.query(
    'UPDATE turnos_trabalho SET inicio = $2, fim = $3, ativo = $4 WHERE id = $1',
    [id, changes.inicio, changes.fim, changes.ativo],
  );
  return rowCount ? 'ok' : 'nao_encontrado';
}
