// Renderiza os mapas de rotina de `docs/rotinas/img/*.mmd` para PNG.
//
// A COR MORA NO .mmd; O CINZA MORA NO .png. Os arquivos-fonte usam verde, amarelo e
// vermelho, que é o que faz sentido num preview de Mermaid, na tela. Este script
// troca essa paleta por uma escala de cinza numa cópia temporária, renderiza e joga
// a cópia fora: o que vai para o repositório e para o TCC é o cinza, que sobrevive à
// impressão em preto e branco, e o que se edita continua colorido.
//
// As três classes de status chamam-se `ok`, `meio` e `falta` em todos os diagramas.
// Quem acrescentar um mapa deve usar os mesmos nomes, senão o script não encontra o
// que trocar. A largura também mora aqui, uma só para todos: antes disso cada mapa
// tinha sido gerado com um `-w` diferente, e regerar com o valor errado reescalava a
// figura sem ninguém perceber.
//
//   node scripts/render-mapas.mjs                    # todos
//   node scripts/render-mapas.mjs mapa-2-producao    # só um

import { readFileSync, writeFileSync, readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIR = 'docs/rotinas/img';
const LARGURA = 1400;

// Cor da fonte -> cinza do PNG, por classe de status.
const CINZA = [
  [/fill:#dcfce7,stroke:#16a34a/g, 'fill:#e8e8e8,stroke:#4a4a4a'],
  [/fill:#fef3c7,stroke:#d97706/g, 'fill:#f2f2f2,stroke:#6e6e6e'],
  [/fill:#fee2e2,stroke:#dc2626/g, 'fill:#fbfbfb,stroke:#8c8c8c'],
];

const pedidos = process.argv.slice(2);
const fontes = readdirSync(DIR)
  .filter((f) => f.endsWith('.mmd'))
  .filter((f) => pedidos.length === 0 || pedidos.includes(f.replace('.mmd', '')));

if (fontes.length === 0) {
  console.error('Nenhum .mmd correspondente. Nomes disponiveis:');
  for (const f of readdirSync(DIR).filter((f) => f.endsWith('.mmd'))) console.error(`  ${f.replace('.mmd', '')}`);
  process.exit(1);
}

const temp = mkdtempSync(join(tmpdir(), 'mapas-'));

for (const fonte of fontes) {
  const nome = fonte.replace('.mmd', '');
  let conteudo = readFileSync(`${DIR}/${fonte}`, 'utf8');
  for (const [de, para] of CINZA) conteudo = conteudo.replace(de, para);

  const copia = join(temp, fonte);
  writeFileSync(copia, conteudo);

  execFileSync(
    'npx',
    ['-y', '@mermaid-js/mermaid-cli', '-i', copia, '-o', `${DIR}/${nome}.png`, '-w', String(LARGURA), '-b', 'white'],
    { stdio: 'ignore', shell: process.platform === 'win32' }
  );
  console.log(`ok ${nome}`);
}

rmSync(temp, { recursive: true, force: true });
