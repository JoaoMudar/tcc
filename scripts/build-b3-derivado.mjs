// Gera as seções derivadas do B3 a partir das fontes que mandam nelas.
//
//   Seção 4 (RF -> RN)  : invertida da coluna "RF originados" do catálogo, B3 §3.
//   Seção 7 (apêndice)  : texto integral dos RF e RNF, copiado do B2.
//
// As duas seções são derivadas: escrevê-las à mão foi o que produziu, no histórico
// do projeto, contagens que não batiam com o próprio catálogo. Rodar depois de
// alterar B2 §2/§3 ou B3 §3.
//
//   node scripts/build-b3-derivado.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { leia } from './leia.mjs';

const B2 = 'docs/engenharia/B-requisitos/B2-especificacao-requisitos.md';
const B3 = 'docs/engenharia/B-requisitos/B3-regras-de-negocio.md';

const b2 = leia(B2);
const b3 = leia(B3);

// ---------------------------------------------------------------- B2: os requisitos
// Linha de RF:  | **RF-10** | texto | ator | prior | origem | verificação |
// Linha de RNF: | **RNF-01** | texto | origem | verificação |
const rf = [];
const rnf = [];
for (const line of b2.split('\n')) {
  const m = line.match(/^\| \*\*(RNF-\d+|RF-\d+)\*\* \|(.*)$/);
  if (!m) continue;
  const cols = m[2].split('|').map((c) => c.trim());
  // A tabela de RNF tem uma coluna a menos que a de RF (nao tem ator nem
  // prioridade): a origem e a coluna 1, e nao a 2. Com o indice errado, as 27
  // linhas da §7.2 saiam com o cabecalho "Origem" e o conteudo de "Verificacao".
  if (m[1].startsWith('RNF-')) rnf.push({ id: m[1], texto: cols[0], origem: cols[1] });
  else rf.push({ id: m[1], texto: cols[0], prior: cols[2], origem: cols[3] });
}

// ---------------------------------------------------------------- B3 §3: as regras
// Linha de RN: | **RN-01** | enunciado | tipo | documentada | RF originados | RNF |
const origem = new Map(rf.map((r) => [r.id, []]));
const regras = [];
for (const line of b3.split('\n')) {
  const m = line.match(/^\| \*\*(RN-\d+)\*\* \|(.*)$/);
  if (!m) continue;
  const cols = m[2].split('|').map((c) => c.trim());
  regras.push({ id: m[1], tipo: cols[1] });
  for (const alvo of (cols[3] || '').match(/RF-\d+/g) || []) {
    if (!origem.has(alvo)) {
      console.error(`AVISO: ${m[1]} aponta para ${alvo}, que nao existe no B2.`);
      continue;
    }
    origem.get(alvo).push(m[1]);
  }
}

// ---------------------------------------------------------------- seção 4
const semRegra = rf.filter((r) => origem.get(r.id).length === 0);
const s4 = [
  '## 4. Rastreabilidade inversa: requisito funcional → regra que o origina',
  '',
  `Os ${rf.length} requisitos funcionais de \`B2\`. ${porExtenso(semRegra.length)} não decorrem de regra de`,
  'negócio e estão justificados na seção 6.',
  '',
  '| RF | Regras que o originam |',
  '|---|---|',
  ...rf.map((r) => `| ${r.id} | ${origem.get(r.id).join(', ') || '-'} |`),
  '',
].join('\n');

// ---------------------------------------------------------------- seção 7
const s7 = [
  '## 7. Apêndice: texto integral dos requisitos',
  '',
  'Transcrito de [`B2`](B2-especificacao-requisitos.md) para que a geração das tabelas do trabalho',
  'não dependa de abrir outro arquivo. **Não editar aqui**: a fonte é o `B2`.',
  '',
  '### 7.1 Requisitos funcionais',
  '',
  '| RF | Texto | Prior. | Origem |',
  '|---|---|---|---|',
  ...rf.map((r) => `| ${r.id} | ${r.texto} | ${r.prior} | ${r.origem} |`),
  '',
  '### 7.2 Requisitos não funcionais',
  '',
  '| RNF | Texto | Origem |',
  '|---|---|---|',
  ...rnf.map((r) => `| ${r.id} | ${r.texto} | ${r.origem} |`),
  '',
].join('\n');

function porExtenso(n) {
  const nomes = ['Nenhum', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez'];
  return nomes[n] ?? String(n);
}

// Substitui a seção inteira, delimitada pelo cabeçalho seguinte. O marcador só
// existe na primeira geração; a partir daí o alvo é a própria seção já escrita.
function trocaSecao(texto, marcador, inicio, fim, conteudo) {
  if (texto.includes(marcador)) return texto.replace(marcador, conteudo.trimEnd());
  const re = new RegExp(`^${inicio}[\\s\\S]*?(?=^${fim})`, 'm');
  if (!re.test(texto)) throw new Error(`Nao achei a secao "${inicio}" para substituir.`);
  return texto.replace(re, conteudo);
}

let saida = b3;
saida = trocaSecao(saida, '<!-- SECAO-4-PLACEHOLDER -->', '## 4\\. Rastreabilidade inversa', '## 5\\. ', s4);
saida = trocaSecao(saida, '<!-- SECAO-7-PLACEHOLDER -->', '## 7\\. Apêndice', '## 8\\. ', s7);

writeFileSync(B3, saida);
console.log(`B3: ${rf.length} RF, ${rnf.length} RNF, ${regras.length} RN.`);
console.log(`RF sem regra de negocio (${semRegra.length}): ${semRegra.map((r) => r.id).join(', ')}`);
const orfas = regras.filter((r) => ![...origem.values()].flat().includes(r.id));
console.log(`RN que nao originam RF nenhum (${orfas.length}): ${orfas.map((r) => r.id).join(', ') || '-'}`);
