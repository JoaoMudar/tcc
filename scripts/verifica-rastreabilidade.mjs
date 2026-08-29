// Confere que os identificadores citados existem e que os definidos são citados.
//
// A matriz B5 existe para revelar lacunas, mas só as revela se alguém a ler linha
// a linha. Este script faz a parte mecânica: conjunto definido contra conjunto
// citado, nos dois sentidos, para RF, RNF, RN, UC, TA, IND e RE.
//
//   node scripts/verifica-rastreabilidade.mjs
//
// Sai com código 1 se houver referência órfã, para poder rodar antes de commitar.

import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const ARQUIVOS = globSync([
  'docs/**/*.md',
  'docs/**/*.html',
  'docs/**/*.mmd',
  'migrations/*.sql',
  'plans/*.md',
  '*.md',
]);

// Onde cada família de identificador é DEFINIDA, e com que padrão de linha.
const FONTES = {
  RF: { arquivo: 'docs/engenharia/B-requisitos/B2-especificacao-requisitos.md', re: /^\| \*\*(RF-\d+)\*\* \|/ },
  RNF: { arquivo: 'docs/engenharia/B-requisitos/B2-especificacao-requisitos.md', re: /^\| \*\*(RNF-\d+)\*\* \|/ },
  RN: { arquivo: 'docs/engenharia/B-requisitos/B3-regras-de-negocio.md', re: /^\| \*\*(RN-\d+)\*\* \| .* \| (?:Fato|Restrição|Derivação|Acionamento) \|/ },
  UC: { arquivo: 'docs/engenharia/C-modelagem/C1-diagrama-casos-de-uso.md', re: /^\| \*\*(UC-\d+)\*\* \|/ },
  TA: { arquivo: 'docs/engenharia/E-qualidade/E2-casos-de-teste-de-aceite.md', re: /^\| \*\*(TA-\d+)\*\* \|/ },
  IND: { arquivo: 'docs/engenharia/G-gestao/G2-fichas-de-indicadores.md', re: /^#+ .*\b(IND-\d+)\b/ },
  RE: { arquivo: 'docs/engenharia/A-fundacao/A1-documento-de-visao.md', re: /^\| \*\*(RE-\d+)\*\* \|/ },
};

const definidos = {};
for (const [familia, { arquivo, re }] of Object.entries(FONTES)) {
  definidos[familia] = new Set();
  let texto;
  try {
    texto = readFileSync(arquivo, 'utf8');
  } catch {
    console.log(`  (${familia}: ${arquivo} nao existe, familia ignorada)`);
    continue;
  }
  for (const linha of texto.split('\n')) {
    const m = linha.match(re);
    if (m) definidos[familia].add(m[1]);
  }
}

// Varre tudo procurando citações.
const citados = {};
for (const familia of Object.keys(FONTES)) citados[familia] = new Map();
const reCitacao = /\b(RNF|RF|RN|UC|TA|IND|RE)-(\d+)\b/g;

// Registros históricos citam, de propósito, identificadores que já não existem: é o
// que os torna registro. Reescrevê-los para satisfazer esta conferência os
// transformaria em ficção retroativa.
const REGISTROS_HISTORICOS = ['auditoria-divergencias.md'];

for (const arquivo of ARQUIVOS) {
  if (arquivo.includes('node_modules')) continue;
  if (REGISTROS_HISTORICOS.some((h) => arquivo.endsWith(h))) continue;
  const texto = readFileSync(arquivo, 'utf8');
  for (const m of texto.matchAll(reCitacao)) {
    const id = `${m[1]}-${m[2]}`;
    if (!citados[m[1]].has(id)) citados[m[1]].set(id, new Set());
    citados[m[1]].get(id).add(arquivo);
  }
}

let falhas = 0;
console.log('=== Referencias orfas: citadas mas nao definidas ===');
for (const familia of Object.keys(FONTES)) {
  if (definidos[familia].size === 0) continue;
  const orfas = [...citados[familia].keys()].filter((id) => !definidos[familia].has(id));
  if (orfas.length === 0) {
    console.log(`  ${familia}: nenhuma. (${definidos[familia].size} definidos)`);
    continue;
  }
  falhas += orfas.length;
  console.log(`  ${familia}: ${orfas.length} orfas (${definidos[familia].size} definidos)`);
  for (const id of orfas.sort()) {
    console.log(`    ${id}  <- ${[...citados[familia].get(id)].join(', ')}`);
  }
}

console.log('\n=== Definidos que ninguem cita fora do proprio arquivo de origem ===');
for (const familia of Object.keys(FONTES)) {
  if (definidos[familia].size === 0) continue;
  const sos = [...definidos[familia]].filter((id) => {
    const onde = citados[familia].get(id);
    return !onde || [...onde].every((a) => a === FONTES[familia].arquivo);
  });
  console.log(`  ${familia}: ${sos.length ? sos.sort().join(', ') : 'nenhum'}`);
}

process.exit(falhas > 0 ? 1 : 0);
