// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseDeclaredSchema, splitStatements, splitTopLevel } from '../declared-schema';

const columnsOf = (schema: Map<string, Set<string>>, table: string) =>
  [...(schema.get(table) ?? [])].sort();

describe('splitStatements', () => {
  it('não quebra dentro de corpo $$, string nem comentário', () => {
    const sql = `
      -- comentário; com ponto e vírgula
      CREATE FUNCTION f() RETURNS TRIGGER AS $$
      BEGIN NEW.x = 1; RETURN NEW; END;
      $$ LANGUAGE plpgsql;
      INSERT INTO t VALUES ('a;b');
      /* bloco; */ SELECT 1
    `;
    const statements = splitStatements(sql);
    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain('RETURN NEW; END;');
    expect(statements[1]).toContain("'a;b'");
  });
});

describe('splitTopLevel', () => {
  it('ignora vírgula dentro de parênteses', () => {
    expect(splitTopLevel("a NUMERIC(10,2), b TEXT CHECK (b IN ('x','y')), c INT")).toEqual([
      'a NUMERIC(10,2)',
      "b TEXT CHECK (b IN ('x','y'))",
      'c INT',
    ]);
  });
});

describe('parseDeclaredSchema', () => {
  it('lê CREATE TABLE com schema, constraints de tabela e tipos com vírgula', () => {
    const schema = parseDeclaredSchema([
      `CREATE SCHEMA cadastro;
       CREATE TABLE cadastro.pessoas (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         nome TEXT NOT NULL,
         saldo NUMERIC(12,2) CHECK (saldo >= 0),
         "Documento" TEXT,
         CONSTRAINT pessoas_nome_uk UNIQUE (nome),
         FOREIGN KEY (id) REFERENCES outra(id)
       );
       CREATE TABLE areas (id UUID, letra CHAR(1), PRIMARY KEY (id));`,
    ]);
    expect(columnsOf(schema, 'cadastro.pessoas')).toEqual(['Documento', 'id', 'nome', 'saldo']);
    expect(columnsOf(schema, 'public.areas')).toEqual(['id', 'letra']);
  });

  it('aplica ALTER TABLE na ordem das migrations', () => {
    const schema = parseDeclaredSchema([
      'CREATE TABLE atribuicoes (id UUID, turno TEXT, antiga TEXT);',
      `ALTER TABLE atribuicoes
         ADD COLUMN hora_inicio TIME,
         ADD COLUMN IF NOT EXISTS hora_fim TIME;
       ALTER TABLE atribuicoes ADD CONSTRAINT x CHECK (hora_fim > hora_inicio);
       ALTER TABLE atribuicoes DROP COLUMN antiga;
       ALTER TABLE atribuicoes RENAME COLUMN turno TO periodo;`,
    ]);
    expect(columnsOf(schema, 'public.atribuicoes')).toEqual(['hora_fim', 'hora_inicio', 'id', 'periodo']);
  });

  it('acompanha RENAME TO e DROP TABLE', () => {
    const schema = parseDeclaredSchema([
      'CREATE TABLE velha (id INT); CREATE TABLE descartada (id INT);',
      'ALTER TABLE velha RENAME TO nova; DROP TABLE IF EXISTS descartada CASCADE;',
    ]);
    expect([...schema.keys()]).toEqual(['public.nova']);
  });

  it('falha ruidosamente com ALTER sobre tabela desconhecida', () => {
    expect(() => parseDeclaredSchema(['ALTER TABLE fantasma ADD COLUMN x INT;'])).toThrow(
      'não declarada',
    );
  });
});
