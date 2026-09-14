// Confere as figuras de `modelo-dados-pt` contra o C6.
//
// O `modelo-dados-pt` e fonte separada, renderizada a mao: nenhum gerador passa por
// ele. Duas divisoes de figura, no historico deste projeto, perderam relacionamentos
// em silencio, e a conferencia que o README mandava fazer era somar `grep -c '||--'`
// e comparar com o C6.
//
// ESSA CONTA NUNCA FECHA, e por isso ninguem a rodava. As figuras sao um recorte mais
// fino que os quatro diagramas logicos do C6, e aresta que cruza a fronteira de duas
// figuras aparece nas duas: `atribuicoes produz movimentos_lote` esta em fig14 e em
// fig15. A soma das figuras e sempre maior. O que tem de bater e o CONJUNTO.
//
// Ate a renomeacao do modelo para portugues, este script tambem traduzia os nomes do
// C6 antes de comparar. Nao traduz mais: os dois lados escrevem o mesmo nome.
//
//   node scripts/confere-modelo-pt.mjs
//
// Sai com codigo 1 se alguma aresta existir de um lado so.

import { readFileSync, globSync } from 'node:fs';

const C6 = 'docs/engenharia/C-modelagem/C6-modelo-entidade-relacionamento.md';
const MMD = 'docs/engenharia/modelo-dados-pt/mmd/';

// Aresta de leitura, e nao de chave estrangeira: mora no conceitual do C6 (§2) e aparece
// na figura logica do pedido porque e o que o trabalho existe para demonstrar.
const SO_NA_FIGURA = new Set(['lotes o{ pedidos_itens']);

// `A ||--o{ B : "rotulo"` -> "A o{ B". O rotulo fica de fora: ele e prosa, e diverge
// entre as duas fontes por acento (o C6 usa, as figuras nao).
function arestas(texto) {
  const achadas = new Set();
  for (const linha of texto.split('\n')) {
    const m = linha.match(/^\s*(\w+)\s*\|\|--(o\{|o\|)\s*(\w+)\s*:/);
    if (m) achadas.add(`${m[1]} ${m[2]} ${m[3]}`);
  }
  return achadas;
}

const c6 = readFileSync(C6, 'utf8');
const logico = c6.split('### 3.1')[1]?.split('\n## 4.')[0];
if (!logico) {
  console.error('Nao achei as secoes 3.1 a 3.4 no C6. O documento mudou de estrutura?');
  process.exit(1);
}

const noC6 = arestas(logico);

const noMmd = new Set();
for (const arquivo of globSync(`${MMD}fig{08,09,1?}-*.mmd`).sort()) {
  for (const a of arestas(readFileSync(arquivo, 'utf8'))) noMmd.add(a);
}

const soNoMmd = [...noMmd].filter((a) => !noC6.has(a) && !SO_NA_FIGURA.has(a)).sort();
const soNoC6 = [...noC6].filter((a) => !noMmd.has(a)).sort();

console.log(`C6 secoes 3.1-3.4: ${noC6.size} arestas distintas`);
console.log(`figuras fig08-fig17: ${noMmd.size} arestas distintas`);

if (soNoMmd.length) {
  console.log('\n=== Desenhadas na figura e ausentes do C6 ===');
  for (const a of soNoMmd) console.log(`  ${a}`);
}
if (soNoC6.length) {
  console.log('\n=== No C6 e ausentes de toda figura ===');
  console.log('(e a perda silenciosa de relacionamento que este script existe para pegar)');
  for (const a of soNoC6) console.log(`  ${a}`);
}

if (!soNoMmd.length && !soNoC6.length) {
  console.log('\nOs dois lados desenham o mesmo modelo.');
  process.exit(0);
}
process.exit(1);
