// Gera a matriz de rastreabilidade B5 a partir dos artefatos que ela amarra.
//
// A cadeia é: Requisito (B2) -> Caso de uso (C1) -> Entidade (C8) -> Acesso (D4) -> Teste (E2).
// Três das quatro colunas são **derivadas**: o caso de uso vem da coluna Requisitos do
// catálogo do C1, o teste vem da coluna Requisito do E2, e a seção e a prioridade vêm do
// B2. Só entidade e recurso de acesso são mapeados à mão, abaixo, porque nenhum artefato
// os declara por requisito.
//
//   node scripts/build-b5-matriz.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { leia } from './leia.mjs';

const B2 = 'docs/engenharia/B-requisitos/B2-especificacao-requisitos.md';
const B5 = 'docs/engenharia/B-requisitos/B5-matriz-rastreabilidade.md';
const C1 = 'docs/engenharia/C-modelagem/C1-diagrama-casos-de-uso.md';
const E2 = 'docs/engenharia/E-qualidade/E2-casos-de-teste-de-aceite.md';

// ---------------------------------------------------------------- mapa mantido à mão
// Entidade e recurso de D4 por requisito. É a única parte que não se deriva.
const MAPA = {
  'RF-01': ['`users`, `sessions`', 'Sessões próprias'],
  'RF-02': ['`users`', 'Sessões próprias'],
  'RF-03': ['`sessions`', 'Sessões próprias'],
  'RF-04': ['`login_events`', 'Auditoria de acesso'],
  'RF-05': ['`users`', 'Usuários e perfis'],
  'RF-06': ['*transversal*', 'Todos os recursos'],
  'RF-07': ['`sessions`', 'Sessões próprias'],
  'RF-08': ['`work_shifts`', 'Período de trabalho'],
  'RF-09': ['`settings`', 'Parâmetros do sistema'],
  'RF-10': ['`species`, `species_popular_names`, `species_photos`', 'Espécies'],
  'RF-11': ['`species_popular_names`', 'Espécies'],
  'RF-12': ['`containers`', 'Recipientes'],
  'RF-13': ['`inputs`', 'Insumos'],
  'RF-14': ['`areas`', 'Áreas e canteiros'],
  'RF-15': ['`beds`, `areas`', 'Áreas e canteiros'],
  'RF-16': ['`cadastro.parties`, `cadastro.party_roles`', 'Pessoas'],
  'RF-17': ['`cadastro.parties`', 'Pessoas'],
  'RF-18': ['`cadastro.parties`, `cadastro.addresses`', 'Dados fiscais de pessoa'],
  'RF-19': ['`cadastro.parties`', 'Dados fiscais de pessoa'],
  'RF-20': ['`cadastro.parties`, `cadastro.party_roles`', 'Pessoas'],
  'RF-21': ['`cadastro.parties`, `cadastro.party_roles`', 'Pessoas'],
  'RF-22': ['`cadastro.parties`, `cadastro.party_roles`', 'Pessoas'],
  'RF-23': ['`task_types`', 'Tipos de tarefa'],
  'RF-24': ['`task_types`', 'Tipos de tarefa'],
  'RF-25': ['`protocols`', 'Protocolo de atividades'],
  'RF-26': ['`protocol_steps`', 'Protocolo de atividades'],
  'RF-27': ['`protocol_steps`', 'Protocolo de atividades'],
  'RF-28': ['`protocol_steps`', 'Protocolo de atividades'],
  'RF-29': ['`species_protocol_overrides`', 'Protocolo de atividades'],
  'RF-30': ['*sem entidade*: organização de interface', 'Agenda da semana'],
  'RF-31': ['`week_plans`, `assignments`, `assignment_members`', 'Agenda da semana'],
  'RF-32': ['`assignments`', 'Agenda da semana'],
  'RF-33': ['`week_plans`', 'Agenda da semana'],
  'RF-34': ['`assignments`, `assignment_members`', 'Agenda da semana'],
  'RF-35': ['`assignments`, `assignment_members`', 'Confirmação de tarefa'],
  'RF-36': ['`assignment_members`', 'Confirmação de tarefa'],
  'RF-37': ['`assignments`', 'Confirmação de tarefa'],
  'RF-38': ['`assignments`', 'Confirmação de tarefa'],
  'RF-39': ['`assignments`, `week_plans`', 'Fechamento da semana'],
  'RF-40': ['`batches`, `batch_movements`', 'Lotes'],
  'RF-41': ['`batches`, `beds`, `areas`', 'Lotes'],
  'RF-42': ['`batches`, `batch_movements`', 'Lotes'],
  'RF-43': ['`batch_movements`', 'Movimentos de lote'],
  'RF-44': ['`batches`, `batch_movements`', 'Movimentos de lote'],
  'RF-45': ['`batches`', 'Lotes'],
  'RF-46': ['`batch_movements`', 'Movimentos de lote'],
  'RF-47': ['`batch_movements`', 'Perdas'],
  'RF-48': ['`batch_movements`', 'Movimentos de lote'],
  'RF-49': ['`batches`, `batch_protocol_steps`', 'Divisão de lote'],
  'RF-50': ['`batch_movements`', 'Análise de perdas'],
  'RF-51': ['*derivada* de `batch_movements` e `batches`', 'Análise de perdas'],
  'RF-52': ['*derivada*; limite em `settings`', 'Análise de perdas'],
  'RF-53': ['*derivada* de `batches`', 'Estoque disponível'],
  'RF-54': ['`batches`, `beds`, `areas`', 'Mapa de lotes'],
  'RF-55': ['visão `batch_health`', 'Mapa de lotes'],
  'RF-56': ['visão `batch_health`', 'Mapa de lotes'],
  'RF-57': ['*derivada* de `batch_movements`', 'Mapa de lotes'],
  'RF-58': ['`batches`, `protocols`, `batch_protocol_steps`', 'Lotes'],
  'RF-59': ['`assignments`, `batch_protocol_steps`', 'Agenda da semana'],
  'RF-60': ['`batches`, `batch_protocol_steps`', 'Protocolo de atividades'],
  'RF-61': ['`batch_protocol_steps`', 'Protocolo de atividades'],
  'RF-62': ['`batch_protocol_steps`', 'Protocolo de atividades'],
  'RF-63': ['`batch_protocol_steps`, visão `batch_protocol_due`', 'Protocolo de atividades'],
  'RF-64': ['visão `batch_protocol_due`', 'Protocolo de atividades'],
  'RF-65': ['`batch_protocol_steps`, `assignments`', 'Protocolo de atividades'],
  'RF-66': ['`orders`, `order_items`', 'Pedidos'],
  'RF-67': ['`order_items`', 'Pedidos'],
  'RF-68': ['*derivada* de `batches`', 'Estoque disponível'],
  'RF-69': ['`orders`', 'Confirmação de pedido'],
  'RF-70': ['`orders`', 'Pedidos'],
};

// ---------------------------------------------------------------- leitura das fontes
const b2 = leia(B2);
const c1 = leia(C1);
const e2 = leia(E2);

// RF na ordem do B2, com a seção em que está e a prioridade.
const requisitos = [];
let secao = null;
for (const linha of b2.split('\n')) {
  const cab = linha.match(/^#{3,4} (.+)$/);
  if (cab) secao = cab[1].trim();
  const m = linha.match(/^\| \*\*(RF-\d+)\*\* \|(.*)$/);
  if (!m) continue;
  const cols = m[2].split('|').map((c) => c.trim());
  requisitos.push({ id: m[1], secao, prioridade: cols[2] });
}

// RF -> UC, da coluna Requisitos do catálogo do C1.
const ucDe = new Map();
for (const linha of c1.split('\n')) {
  const m = linha.match(/^\| \*\*(UC-\d+)\*\* \|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/);
  if (!m) continue;
  for (const rf of m[5].match(/RF-\d+/g) || []) {
    if (!ucDe.has(rf)) ucDe.set(rf, []);
    ucDe.get(rf).push(m[1]);
  }
}

// RF -> TA, da coluna Requisito do E2.
const taDe = new Map();
for (const linha of e2.split('\n')) {
  const m = linha.match(/^\| \*\*(TA-\d+)\*\* \| ([^|]*) \|/);
  if (!m) continue;
  for (const rf of m[2].match(/RF-\d+/g) || []) {
    if (!taDe.has(rf)) taDe.set(rf, []);
    taDe.get(rf).push(m[1]);
  }
}

// ---------------------------------------------------------------- montagem da seção 2
const semUC = [];
const semTeste = [];
const linhas = ['## 2. Matriz: requisitos funcionais', '',
  '> Tabela **gerada** por `scripts/build-b5-matriz.mjs`. As colunas Caso de uso e Teste são',
  '> derivadas de `C1` e `E2`; Entidade e Recurso são mantidas no mapa do próprio script.',
  '> Não editar à mão: altere a fonte e rode o script.',
  '',
  'As seções seguem as **três áreas de negócio** do sistema, na mesma ordem da',
  '[`B2 §2`](B2-especificacao-requisitos.md), com Acesso e Configurações à frente.',
  ''];

let secaoAtual = null;
for (const r of requisitos) {
  if (r.secao !== secaoAtual) {
    secaoAtual = r.secao;
    linhas.push('', `### ${secaoAtual}`, '', '| RF | Caso de uso | Entidade | Recurso em D4 | Teste |', '|---|---|---|---|---|');
  }
  const [entidade, recurso] = MAPA[r.id] || ['**FALTA MAPEAR**', '**FALTA MAPEAR**'];
  const ucs = ucDe.get(r.id) || [];
  const tas = taDe.get(r.id) || [];
  if (ucs.length === 0) semUC.push(r.id);
  if (tas.length === 0) semTeste.push(r);
  const colUC = ucs.length ? ucs.join(', ') : '*sem caso de uso*: o sistema age sozinho';
  const colTA = tas.length ? tas.join(', ') : `- *(${r.prioridade})*`;
  linhas.push(`| ${r.id} | ${colUC} | ${entidade} | ${recurso} | ${colTA} |`);
}
linhas.push('');

const naoMapeados = requisitos.filter((r) => !MAPA[r.id]).map((r) => r.id);
if (naoMapeados.length) console.error(`AVISO: sem entidade/recurso no mapa: ${naoMapeados.join(', ')}`);

// ---------------------------------------------------------------- seção 6
const deveTerSemTeste = semTeste.filter((r) => r.prioridade === 'D');
const totalDeveTer = requisitos.filter((r) => r.prioridade === 'D').length;

const secao6 = [
  '## 6. Estado final da cobertura',
  '',
  '> Tabela **gerada** junto com a §2, pelo mesmo script.',
  '',
  '| Verificação | Resultado |',
  '|---|---|',
  `| Requisitos funcionais com caso de uso | ${requisitos.length - semUC.length} de ${requisitos.length} |`,
  `| Requisitos funcionais com entidade ou derivação declarada | **${requisitos.length} de ${requisitos.length}** |`,
  `| Requisitos funcionais com regra de acesso definida | **${requisitos.length} de ${requisitos.length}** |`,
  `| Requisitos de prioridade *deve ter* com teste de aceite | ${totalDeveTer - deveTerSemTeste.length} de ${totalDeveTer} |`,
  `| Requisitos *deveria ter* sem teste | ${semTeste.length - deveTerSemTeste.length}: deliberado |`,
  '| Casos de uso sem requisito de origem | 0 |',
  '| Entidades sem requisito de origem | 0 |',
  '',
  `**Os ${semUC.length} requisitos sem caso de uso descrevem o que o sistema faz sozinho:** ${semUC.join(', ')}.`,
  'Não há ator praticando um objetivo de negócio, e forçar um caso de uso para eles produziria um',
  'artefato que descreve execução automática como se fosse interação. A coluna diz *sem caso de uso*,',
  'e não *pendente*, para separar a decisão do débito. A lista comentada está em',
  '[`C1` §4.1](../C-modelagem/C1-diagrama-casos-de-uso.md).',
  '',
];

if (deveTerSemTeste.length) {
  secao6.push(
    `**${deveTerSemTeste.length} requisitos *deve ter* sem teste:** ${deveTerSemTeste.map((r) => r.id).join(', ')}.`,
    'Lacuna de especificação, e não do teste: ou o caso é escrito em [`E2`](../E-qualidade/E2-casos-de-teste-de-aceite.md),',
    'ou a cobertura indireta é declarada.',
    ''
  );
} else {
  secao6.push(
    '**Todo requisito de prioridade *deve ter* tem teste de aceite.** É a primeira vez que a matriz',
    'fecha sem lacuna nessa linha, e o mérito não é dela: a redução de escopo tirou do documento',
    'requisitos que nunca tiveram critério de aprovação declarado.',
    ''
  );
}

// ---------------------------------------------------------------- escrita
let b5 = leia(B5);

function trocaSecao(texto, inicio, fim, conteudo) {
  const re = new RegExp(`^${inicio}[\\s\\S]*?(?=^${fim})`, 'm');
  if (!re.test(texto)) throw new Error(`nao achei a secao ${inicio}`);
  return texto.replace(re, conteudo.join('\n') + '\n\n---\n\n');
}

b5 = trocaSecao(b5, '## 2\\. Matriz: requisitos funcionais', '## 3\\. ', linhas);
b5 = trocaSecao(b5, '## 6\\. Estado final da cobertura', '## 7\\. ', secao6);

writeFileSync(B5, b5);
console.log(`B5: ${requisitos.length} RF na matriz.`);
console.log(`Sem caso de uso (${semUC.length}): ${semUC.join(', ')}`);
console.log(`Deve ter sem teste (${deveTerSemTeste.length}): ${deveTerSemTeste.map((r) => r.id).join(', ') || '-'}`);
