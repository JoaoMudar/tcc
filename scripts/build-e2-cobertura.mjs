// Gera a tabela de cobertura do E2 a partir dos próprios casos de teste.
//
// A tabela era escrita à mão e, no histórico do projeto, passou a divergir dos
// casos que dizia resumir. Aqui ela é derivada: cada caso é atribuído à seção em
// que está, e os requisitos vêm da coluna Requisito de cada linha.
//
//   node scripts/build-e2-cobertura.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { leia } from './leia.mjs';

const E2 = 'docs/engenharia/E-qualidade/E2-casos-de-teste-de-aceite.md';
const B2 = 'docs/engenharia/B-requisitos/B2-especificacao-requisitos.md';

const e2 = leia(E2);
const b2 = leia(B2);

// Prioridade de cada RF, para saber quais "deve ter" ficaram sem caso.
const prioridade = new Map();
for (const linha of b2.split('\n')) {
  const m = linha.match(/^\| \*\*(RF-\d+)\*\* \|(.*)$/);
  if (!m) continue;
  const cols = m[2].split('|').map((c) => c.trim());
  prioridade.set(m[1], cols[2]);
}

// Percorre o E2 acumulando, por seção, os casos e os requisitos que eles citam.
const secoes = [];
let atual = null;
let dentroDaCobertura = false;

for (const linha of e2.split('\n')) {
  if (/^## \d+\. Cobertura/.test(linha)) dentroDaCobertura = true;
  if (dentroDaCobertura) continue;

  const cab = linha.match(/^#{2,3} (?:\d+(?:\.\d+)*\.? )?(.+)$/);
  if (cab && !/^\d+\. (Níveis|Como ler)/.test(cab[1])) {
    atual = { titulo: cab[1].trim(), casos: [], rfs: new Set(), rnfs: new Set() };
    secoes.push(atual);
    continue;
  }

  const caso = linha.match(/^\| \*\*(TA-\d+)\*\* \| ([^|]*) \|/);
  if (caso && atual) {
    atual.casos.push(caso[1]);
    for (const rf of caso[2].match(/RF-\d+/g) || []) atual.rfs.add(rf);
    for (const rnf of caso[2].match(/RNF-\d+/g) || []) atual.rnfs.add(rnf);
  }
}

const comCaso = new Set();
for (const s of secoes) for (const rf of s.rfs) comCaso.add(rf);

const deveTerSemCaso = [...prioridade.entries()]
  .filter(([id, p]) => p === 'D' && !comCaso.has(id))
  .map(([id]) => id);
const outrosSemCaso = [...prioridade.entries()]
  .filter(([id, p]) => p !== 'D' && !comCaso.has(id))
  .map(([id]) => id);

const totalDeveTer = [...prioridade.values()].filter((p) => p === 'D').length;
const cobertosDeveTer = totalDeveTer - deveTerSemCaso.length;

function ordena(ids) {
  return [...ids].sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
}

const comCasos = secoes.filter((s) => s.casos.length > 0);
const totalCasos = comCasos.reduce((n, s) => n + s.casos.length, 0);

const linhas = [
  '## 9. Cobertura',
  '',
  '> Tabela **gerada** por `scripts/build-e2-cobertura.mjs` a partir dos casos acima.',
  '> Não editar à mão: acrescente ou remova o caso, e rode o script.',
  '',
  '| Subsistema | Casos | Requisitos cobertos |',
  '|---|---:|---|',
  ...comCasos.map((s) => {
    const ids = [...ordena(s.rfs), ...ordena(s.rnfs)];
    return `| ${s.titulo} | ${s.casos.length} | ${ids.join(', ') || '-'} |`;
  }),
  `| **Total** | **${totalCasos}** | **${cobertosDeveTer} dos ${totalDeveTer} requisitos de prioridade *deve ter*** |`,
  '',
];

if (deveTerSemCaso.length > 0) {
  linhas.push(
    `**${deveTerSemCaso.length} requisitos *deve ter* sem caso próprio:** ${ordena(deveTerSemCaso).join(', ')}.`,
    'Ausência de cobertura em requisito de prioridade *deve ter* é defeito de especificação, não do',
    'teste: ou o caso é escrito, ou a cobertura indireta é declarada aqui.',
    ''
  );
} else {
  linhas.push('**Todos os requisitos de prioridade *deve ter* têm caso de aceite.**', '');
}

if (outrosSemCaso.length > 0) {
  linhas.push(
    `**Sem caso, por prioridade inferior a *deve ter*:** ${ordena(outrosSemCaso).join(', ')}.`,
    'É decisão declarada em §1, não omissão.',
    ''
  );
}

const re = /^## \d+\. Cobertura[\s\S]*?(?=^## \d+\. Registro)/m;
if (!re.test(e2)) throw new Error('nao achei a secao de cobertura');
writeFileSync(E2, e2.replace(re, linhas.join('\n') + '\n'));

console.log(`E2: ${totalCasos} casos em ${comCasos.length} secoes.`);
console.log(`Deve ter sem caso (${deveTerSemCaso.length}): ${ordena(deveTerSemCaso).join(', ') || '-'}`);
console.log(`Outros sem caso (${outrosSemCaso.length}): ${ordena(outrosSemCaso).join(', ') || '-'}`);
