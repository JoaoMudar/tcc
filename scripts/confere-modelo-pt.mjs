// Confere as figuras em portugues de `modelo-dados-pt` contra o C6.
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
//   node scripts/confere-modelo-pt.mjs
//
// Sai com codigo 1 se alguma aresta existir de um lado so.

import { readFileSync, globSync } from 'node:fs';

const C6 = 'docs/engenharia/C-modelagem/C6-modelo-entidade-relacionamento.md';
const MMD = 'docs/engenharia/modelo-dados-pt/mmd/';

// Tabela de correspondencia do README de `modelo-dados-pt`. O esquema `cadastro` entra
// sem qualificacao porque e assim que o C6 desenha.
const PT = {
  users: 'usuarios', sessions: 'sessoes', login_events: 'eventos_login', settings: 'parametros',
  species: 'especies', species_popular_names: 'especies_nomes_populares',
  species_photos: 'especies_fotos', containers: 'recipientes', inputs: 'insumos',
  parties: 'pessoas', party_roles: 'pessoas_papeis', addresses: 'pessoas_enderecos',
  task_types: 'tipos_tarefa', areas: 'areas', beds: 'canteiros', work_shifts: 'turnos_trabalho',
  protocols: 'protocolos', protocol_steps: 'protocolos_etapas',
  species_protocol_overrides: 'especies_protocolos_tempos',
  week_plans: 'semanas', assignments: 'atribuicoes', assignment_members: 'atribuicoes_participantes',
  batches: 'lotes', batch_movements: 'movimentos_lote', batch_protocol_steps: 'lotes_etapas',
  orders: 'pedidos', order_items: 'pedidos_itens',
};

// Aresta de leitura, e nao de chave estrangeira: mora no conceitual do C6 (§2) e aparece
// na figura logica do pedido porque e o que o trabalho existe para demonstrar.
const SO_NA_FIGURA = new Set(['lotes o{ pedidos_itens']);

// `A ||--o{ B : "rotulo"` -> "A o{ B". O rotulo fica de fora: ele e prosa, e diverge
// entre as duas fontes por acento (o C6 usa, as figuras nao).
function arestas(texto) {
  const achadas = new Set();
  for (const linha of texto.split('\n')) {
    const m = linha.match(/^\s*(\w+)\s*\|\|--(o\{|o\|)\s*(\w+)\s*:/);
    if (m) achadas.add(`${PT[m[1]] ?? m[1]} ${m[2]} ${PT[m[3]] ?? m[3]}`);
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
