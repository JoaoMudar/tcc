// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * RNF-08: alvo de toque de pelo menos 44 px. O `Button` já nasce com
 * `min-h-touch`; o que escapa é o `<button>` escrito à mão, com altura fixa
 * pequena ou texto miúdo. Este teste lê o código e acusa o botão pequeno sem
 * alvo mínimo declarado: `min-h-11`/`min-h-touch`, `h-11`, ou a área ampliada
 * por `after:-inset-*` (o botão dentro da barra da grade, que não pode crescer).
 */

function* arquivos(dir: string): Generator<string> {
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome !== '__tests__') yield* arquivos(caminho);
    } else if (caminho.endsWith('.tsx')) yield caminho;
  }
}

const BOTAO = /<button\b[\s\S]{0,800}?className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
const PEQUENO = /(^|\s)h-(?:[1-9]|10)(\s|$)|text-\[11px\]|leading-4|(^|\s)px-1(\s|$)/;
const ALVO = /min-h-touch|min-h-11|min-h-12|after:-inset|(^|\s)h-11(\s|$)|(^|\s)h-12(\s|$)|size-11/;

describe('RNF-08: alvo de toque', () => {
  const fontes = [...arquivos(path.join(process.cwd(), 'src'))];

  it('o teste de fato lê os componentes', () => {
    expect(fontes.length).toBeGreaterThan(20);
  });

  it('nenhum <button> pequeno sem alvo mínimo de 44 px', () => {
    const pequenos: string[] = [];
    for (const arquivo of fontes) {
      for (const m of readFileSync(arquivo, 'utf8').matchAll(BOTAO)) {
        const classe = m[1] ?? m[2];
        if (PEQUENO.test(classe) && !ALVO.test(classe)) {
          pequenos.push(`${path.relative(process.cwd(), arquivo)}: ${classe.slice(0, 60)}`);
        }
      }
    }
    expect(pequenos).toEqual([]);
  });
});
