// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * RF-06 e RNF-11 cobrados estaticamente: toda Server Action exportada chama um
 * guard. Action sem guard é endpoint público, e ninguém percebe olhando a tela.
 */

// Exceções declaradas, uma a uma, com o motivo no próprio arquivo
const PUBLIC_ACTIONS = new Set(['src/app/login/actions.ts#login', 'src/app/(sistema)/actions.ts#logout']);

const GUARD = /await\s+(requirePermission|requirePageAccess|requireUser)\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function serverActionFiles(): string[] {
  return sourceFiles(path.join(process.cwd(), 'src')).filter((file) =>
    /^\s*(\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*['"]use server['"]/.test(readFileSync(file, 'utf8')),
  );
}

/** Pedaço de cada `export async function`, até a próxima exportação. */
function exportedActions(source: string): { name: string; body: string }[] {
  const matches = [...source.matchAll(/export\s+async\s+function\s+(\w+)/g)];
  return matches.map((match, i) => ({
    name: match[1],
    body: source.slice(match.index, matches[i + 1]?.index ?? source.length),
  }));
}

describe('Server Actions', () => {
  const files = serverActionFiles();

  it('existem, e o teste de fato as encontra', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('só exportam funções assíncronas', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/export\s+(const|let|function\s)/);
    }
  });

  it('toda action chama um guard, salvo as exceções declaradas', () => {
    const unguarded: string[] = [];
    for (const file of files) {
      const relative = path.relative(process.cwd(), file).split(path.sep).join('/');
      for (const action of exportedActions(readFileSync(file, 'utf8'))) {
        const id = `${relative}#${action.name}`;
        if (!PUBLIC_ACTIONS.has(id) && !GUARD.test(action.body)) unguarded.push(id);
      }
    }
    expect(unguarded).toEqual([]);
  });

  it('as exceções ainda existem (lista não apodrece)', () => {
    const found = new Set(
      files.flatMap((file) => {
        const relative = path.relative(process.cwd(), file).split(path.sep).join('/');
        return exportedActions(readFileSync(file, 'utf8')).map((a) => `${relative}#${a.name}`);
      }),
    );
    for (const id of PUBLIC_ACTIONS) expect(found.has(id), id).toBe(true);
  });
});
