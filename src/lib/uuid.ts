const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida identificador vindo de formulário antes de ele chegar ao SQL (evita o 22P02 do Postgres). */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
