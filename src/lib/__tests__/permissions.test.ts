// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCESS_MATRIX, type Recurso, can } from '../permissions';

// A documentação fica fora do repositório público: no CI o D4 não existe, e a conferência
// célula a célula só roda na máquina que tem a pasta docs/.
const D4 = path.join(process.cwd(), 'docs/engenharia/D-arquitetura/D4-matriz-rbac.md');
const TEM_D4 = existsSync(D4);

/** Lê a tabela do D4 §2: rótulo e as letras de chefia, gerência e administrador. */
function readD4Matrix(): Map<string, [string, string, string]> {
  const doc = readFileSync(D4, 'utf8');
  const section = doc.slice(doc.indexOf('## 2. Matriz'), doc.indexOf('## 3.'));
  const rows = new Map<string, [string, string, string]>();
  for (const line of section.split('\n')) {
    if (!line.startsWith('| **')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 4 || cells.slice(1).every((c) => c === '')) continue; // títulos de área
    const label = cells[0].replace(/\*/g, '').replace(/[¹²³⁴]/g, '').trim();
    const letters = cells.slice(1).map((c) => c.replace(/[*\s-]/g, '')) as [string, string, string];
    rows.set(label, letters);
  }
  return rows;
}

describe.skipIf(!TEM_D4)('ACCESS_MATRIX x D4 §2', () => {
  const doc = TEM_D4 ? readD4Matrix() : new Map<string, [string, string, string]>();

  it('tem exatamente os 27 recursos do documento', () => {
    expect(doc.size).toBe(27);
    expect(Object.values(ACCESS_MATRIX).map((r) => r.label).sort()).toEqual([...doc.keys()].sort());
  });

  it.each(Object.entries(ACCESS_MATRIX))('%s confere célula a célula', (_key, rule) => {
    expect([rule.chefia, rule.gerencia, rule.admin]).toEqual(doc.get(rule.label));
  });
});

describe('can', () => {
  it('TA-03: a gerência lê pedido para executar as fases dela, e não cadastra nem altera item', () => {
    expect(can('gerencia', 'pedidos', 'L')).toBe(true);
    expect(can('gerencia', 'pedidos', 'C')).toBe(false);
    expect(can('gerencia', 'pedidos', 'A')).toBe(false);
    expect(can('gerencia', 'pedidos', 'E')).toBe(false);
    expect(can('gerencia', 'confirmacao_pedido', 'A')).toBe(true);
    expect(can('chefia', 'pedidos', 'C')).toBe(true);
  });

  it('TA-08: gerência lê parâmetro e não altera', () => {
    expect(can('gerencia', 'parametros', 'L')).toBe(true);
    expect(can('gerencia', 'parametros', 'A')).toBe(false);
    expect(can('chefia', 'parametros', 'A')).toBe(true);
  });

  it('D4 §3.5: nenhum perfil de negócio administra usuário', () => {
    for (const op of ['C', 'L', 'A', 'E'] as const) {
      expect(can('chefia', 'usuarios', op)).toBe(false);
      expect(can('gerencia', 'usuarios', op)).toBe(false);
    }
  });

  it('D4 §3.1: gerência não vê dado fiscal', () => {
    expect(can('gerencia', 'dados_fiscais', 'L')).toBe(false);
    expect(can('gerencia', 'pessoas', 'L')).toBe(true);
  });

  it('D4 §1.1: admin tem acesso irrestrito, além da própria coluna', () => {
    expect(ACCESS_MATRIX.tipos_tarefa.admin).toBe('L');
    for (const recurso of Object.keys(ACCESS_MATRIX) as Recurso[]) {
      for (const op of ['C', 'L', 'A', 'E'] as const) expect(can('admin', recurso, op)).toBe(true);
    }
  });
});
