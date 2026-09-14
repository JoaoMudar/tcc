/**
 * Reconstrói, a partir do texto das migrations, quais tabelas e colunas o
 * banco deveria ter. Serve ao teste que compara isso com information_schema
 * (divida-tecnica §3): pega a migration registrada que não aplicou nada.
 *
 * Cobre o que as migrations deste projeto usam: CREATE TABLE, ALTER TABLE
 * (ADD, DROP e RENAME COLUMN, RENAME TO) e DROP TABLE.
 */

export type DeclaredSchema = Map<string, Set<string>>;

/** Divide em comandos por `;`, respeitando strings, identificadores e corpos $$. */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const rest = sql.slice(i);

    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      current += ' ';
      continue;
    }
    const dollar = /^\$[A-Za-z_]*\$/.exec(rest);
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch && sql[j + 1] === ch) j += 2;
        else if (sql[j] === ch) break;
        else j++;
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

/** Divide por vírgula de nível zero (fora de parênteses e de aspas). */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function unquote(identifier: string): string {
  return identifier.startsWith('"') ? identifier.slice(1, -1) : identifier.toLowerCase();
}

function qualify(name: string): string {
  const parts = name.split('.').map(unquote);
  return parts.length === 1 ? `public.${parts[0]}` : `${parts[0]}.${parts[1]}`;
}

const IDENT = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)`;
const QUALIFIED = `(${IDENT}(?:\\.${IDENT})?)`;
const TABLE_CONSTRAINT = /^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN|EXCLUDE|LIKE)\b/i;

function firstIdentifier(text: string): string {
  const match = new RegExp(`^${IDENT}`).exec(text.trim());
  if (!match) throw new Error(`Identificador não reconhecido em: ${text.slice(0, 60)}`);
  return unquote(match[0]);
}

function applyCreateTable(schema: DeclaredSchema, statement: string): boolean {
  const match = new RegExp(
    `^CREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${QUALIFIED}\\s*\\(`,
    'i',
  ).exec(statement);
  if (!match) return false;
  const table = qualify(match[1]);
  const bodyStart = match[0].length;
  const bodyEnd = statement.lastIndexOf(')');
  const columns = new Set<string>();
  for (const item of splitTopLevel(statement.slice(bodyStart, bodyEnd))) {
    if (!TABLE_CONSTRAINT.test(item)) columns.add(firstIdentifier(item));
  }
  // IF NOT EXISTS sobre tabela já declarada não altera nada
  if (!schema.has(table)) schema.set(table, columns);
  return true;
}

function applyAlterTable(schema: DeclaredSchema, statement: string): boolean {
  const match = new RegExp(
    `^ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?${QUALIFIED}\\s+`,
    'i',
  ).exec(statement);
  if (!match) return false;
  let table = qualify(match[1]);
  const columns = schema.get(table);
  if (!columns) throw new Error(`ALTER TABLE sobre tabela não declarada: ${table}`);

  for (const action of splitTopLevel(statement.slice(match[0].length))) {
    let m: RegExpExecArray | null;
    if ((m = /^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(.*)$/is.exec(action))) {
      if (!TABLE_CONSTRAINT.test(m[1])) columns.add(firstIdentifier(m[1]));
    } else if ((m = /^DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?(.*)$/is.exec(action))) {
      columns.delete(firstIdentifier(m[1]));
    } else if ((m = new RegExp(`^RENAME\\s+TO\\s+(${IDENT})`, 'i').exec(action))) {
      const renamed = `${table.split('.')[0]}.${unquote(m[1])}`;
      schema.delete(table);
      schema.set(renamed, columns);
      table = renamed;
    } else if (
      (m = new RegExp(`^RENAME\\s+(?:COLUMN\\s+)?(${IDENT})\\s+TO\\s+(${IDENT})`, 'i').exec(action)) &&
      !/^RENAME\s+CONSTRAINT/i.test(action)
    ) {
      columns.delete(unquote(m[1]));
      columns.add(unquote(m[2]));
    }
    // ADD CONSTRAINT, ALTER COLUMN, SET/DROP DEFAULT e afins não mudam colunas
  }
  return true;
}

function applyDropTable(schema: DeclaredSchema, statement: string): boolean {
  const match = /^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(.*?)(?:\s+(?:CASCADE|RESTRICT))?$/is.exec(statement);
  if (!match) return false;
  for (const name of splitTopLevel(match[1])) schema.delete(qualify(name));
  return true;
}

/** Recebe o conteúdo das migrations já na ordem de aplicação. */
export function parseDeclaredSchema(migrations: string[]): DeclaredSchema {
  const schema: DeclaredSchema = new Map();
  for (const sql of migrations) {
    for (const statement of splitStatements(sql)) {
      const normalized = statement.replace(/\s+/g, ' ');
      if (applyCreateTable(schema, normalized)) continue;
      if (applyAlterTable(schema, normalized)) continue;
      applyDropTable(schema, normalized);
    }
  }
  return schema;
}
