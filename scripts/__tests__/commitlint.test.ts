// @vitest-environment node
import { readFileSync } from 'node:fs';
import load from '@commitlint/load';
import lint from '@commitlint/lint';
import { describe, expect, it } from 'vitest';

/** RNF-22: a regra, o hook que a aplica no commit e o passo do CI que a aplica de novo. */
describe('mensagem de commit (RNF-22)', () => {
  const confere = async (mensagem: string) => {
    const { rules, parserPreset } = await load({}, { cwd: process.cwd() });
    return lint(mensagem, rules, parserPreset ? { parserOpts: parserPreset.parserOpts as never } : {});
  };

  it('aceita o Conventional Commits em português, com acento e escopo', async () => {
    expect((await confere('feat(custeio): adiciona cálculo de custo')).valid).toBe(true);
    expect((await confere('fix(cadastros): grava o autor de espécie\n\nCorpo.\n\nCo-Authored-By: X <x@y.z>')).valid).toBe(true);
  });

  it('recusa mensagem sem tipo e tipo fora da lista', async () => {
    expect((await confere('arrumei umas coisas')).valid).toBe(false);
    expect((await confere('ajuste: muda o botão')).valid).toBe(false);
  });

  it('o hook commit-msg roda o commitlint sobre a mensagem', () => {
    expect(readFileSync('.githooks/commit-msg', 'utf8')).toMatch(/commitlint --edit "\$1"/);
  });

  it('o CI confere os commits do pull request com o histórico inteiro', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toMatch(/fetch-depth: 0/);
    expect(ci).toMatch(/commitlint --from \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  });
});
