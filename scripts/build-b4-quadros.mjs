// Gera os quadros do TCC a partir de B2, B3 e A1.
//
// O B4 sempre foi transcrição: no histórico do projeto ele ficou dois meses defasado
// da fonte, porque transcrever à mão é o que produz defasagem. Aqui ele é gerado.
// A única coisa mantida à mão é o **nome curto** de cada requisito, que só existe
// neste artefato: B2 tem o enunciado, não um nome.
//
//   node scripts/build-b4-quadros.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { leia } from './leia.mjs';

const A1 = 'docs/engenharia/A-fundacao/A1-documento-de-visao.md';
const B2 = 'docs/engenharia/B-requisitos/B2-especificacao-requisitos.md';
const B3 = 'docs/engenharia/B-requisitos/B3-regras-de-negocio.md';
const B4 = 'docs/engenharia/B-requisitos/B4-quadros-tcc.md';

// ---------------------------------------------------------------- nomes dos requisitos
const NOME = {
  'RF-01': 'Autenticação por identificador e senha',
  'RF-02': 'Troca de senha no primeiro acesso',
  'RF-03': 'Encerramento da própria sessão',
  'RF-04': 'Registro das tentativas de autenticação',
  'RF-05': 'Criação de usuário e atribuição de perfil',
  'RF-06': 'Verificação de permissão a cada operação',
  'RF-07': 'Consulta e encerramento de sessões ativas',
  'RF-08': 'Manutenção do período de trabalho',
  'RF-09': 'Manutenção dos parâmetros de operação',
  'RF-10': 'Cadastro e busca de espécie',
  'RF-11': 'Cadastro de recipiente',
  'RF-12': 'Cadastro de insumo',
  'RF-13': 'Cadastro de área e canteiro',
  'RF-14': 'Identidade única de pessoa com múltiplos papéis',
  'RF-15': 'Cadastro rápido de cliente',
  'RF-16': 'Cadastro completo de cliente',
  'RF-17': 'Validação de CPF e CNPJ',
  'RF-18': 'Busca de pessoa',
  'RF-19': 'Cadastro de fornecedor',
  'RF-20': 'Cadastro de funcionário',
  'RF-21': 'Catálogo de tipos de tarefa e formulário que ele comanda',
  'RF-22': 'Protocolo de atividades por recipiente',
  'RF-23': 'Evento de referência da etapa',
  'RF-24': 'Alerta e janela de aviso por etapa',
  'RF-25': 'Tempo de etapa customizado por espécie',
  'RF-26': 'Montagem da agenda da semana',
  'RF-27': 'Cópia da semana e tarefa recorrente',
  'RF-28': 'Situação da semana',
  'RF-29': 'Confirmação da tarefa realizada',
  'RF-30': 'Área ou canteiro da tarefa sem lote',
  'RF-31': 'Tarefa não confirmada assumida no fechamento',
  'RF-32': 'Criação de lote',
  'RF-33': 'Ocupação do viveiro e encerramento do lote',
  'RF-34': 'Repicagem com lote de origem',
  'RF-35': 'Histórico de movimentos do lote',
  'RF-36': 'Recusa de saldo negativo',
  'RF-37': 'Registro de perda, contagem e venda sobre o lote',
  'RF-38': 'Perda com causa em lista fechada',
  'RF-39': 'Contagem física do lote',
  'RF-40': 'Divisão de lote',
  'RF-41': 'Listagem de perdas com filtro',
  'RF-42': 'Taxa de mortalidade e destaque no mapa',
  'RF-43': 'Quantidade de muda pronta disponível',
  'RF-44': 'Mapa do viveiro com áreas, canteiros e lotes',
  'RF-45': 'Situação do lote e tarefa pendente que a determina',
  'RF-46': 'Atribuição do protocolo ao lote na criação',
  'RF-47': 'Geração das ordens do protocolo na agenda',
  'RF-48': 'Avanço de fase por etapa sequencial',
  'RF-49': 'Contagem a partir da execução real',
  'RF-50': 'Uma ocorrência em aberto por etapa',
  'RF-51': 'Ficha do lote com etapas e vencimentos',
  'RF-52': 'Etapa em atenção e em atraso',
  'RF-53': 'Encerramento do protocolo do lote',
  'RF-54': 'Registro de pedido com cliente, canal e itens',
  'RF-55': 'Preço unitário informado no item',
  'RF-56': 'Saldo disponível ao lado do item',
  'RF-57': 'Situação do pedido',
  'RF-58': 'Listagem de pedidos com filtro',
  'RF-59': 'Disponibilidade conferida item a item',
  'RF-60': 'Composição do item pedido sem espécie',
  'RF-61': 'Cargas do pedido e separação dos itens',
  'RF-62': 'Dia de carregar e calendário de entregas',
};

// ---------------------------------------------------------------- leitura
const a1 = leia(A1);
const b2 = leia(B2);
const b3 = leia(B3);

// Converte o enunciado de engenharia em frase de quadro: sem negrito, terminada em ponto.
function frase(texto) {
  let s = texto.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}

// Regras, por área.
const areas = [];
let areaAtual = null;
for (const linha of b3.split('\n')) {
  const cab = linha.match(/^### 3\.\d+ Área [A-Z]: (.+)$/);
  if (cab) {
    areaAtual = { titulo: cab[1].trim(), regras: [] };
    areas.push(areaAtual);
    continue;
  }
  const m = linha.match(/^\| \*\*(RN-\d+)\*\* \|(.*)$/);
  if (!m || !areaAtual) continue;
  const cols = m[2].split('|').map((c) => c.trim());
  if (!['Fato', 'Restrição', 'Derivação', 'Acionamento'].includes(cols[1])) continue;
  areaAtual.regras.push({ id: m[1], enunciado: frase(cols[0]), tipo: cols[1], rfs: cols[3] });
}

// Requisitos.
const rf = [];
const rnf = [];
for (const linha of b2.split('\n')) {
  const m = linha.match(/^\| \*\*(RNF-\d+|RF-\d+)\*\* \|(.*)$/);
  if (!m) continue;
  const cols = m[2].split('|').map((c) => c.trim());
  if (m[1].startsWith('RNF-')) rnf.push({ id: m[1], texto: frase(cols[0]), origem: cols[1] });
  else rf.push({ id: m[1], texto: frase(cols[0]), origem: cols[3] });
}

// RF -> RN, invertido do catálogo.
const regraDe = new Map();
for (const a of areas) {
  for (const r of a.regras) {
    for (const id of r.rfs.match(/RF-\d+/g) || []) {
      if (!regraDe.has(id)) regraDe.set(id, []);
      regraDe.get(id).push(r.id);
    }
  }
}

// Restrições de A1 §9.
const restricoes = [];
for (const linha of a1.split('\n')) {
  const m = linha.match(/^\| \*\*(RE-\d+)\*\* \| ([^|]*) \| ([^|]*) \|/);
  if (m) restricoes.push({ id: m[1], texto: frase(m[2]), origem: m[3].trim() });
}
// RNF originados por cada RE, lidos da coluna Origem do B2.
const rnfDeRestricao = new Map(restricoes.map((r) => [r.id, []]));
for (const r of rnf) {
  for (const re of r.origem.match(/RE-\d+/g) || []) {
    if (rnfDeRestricao.has(re)) rnfDeRestricao.get(re).push(r.id);
  }
}

// ---------------------------------------------------------------- montagem
const out = [];
const FONTE = 'Fonte: Elaborado pelo autor (2026).';
let n = 0;

function quadro(titulo, cabecalho, linhas) {
  n++;
  out.push(`## Quadro ${n} – ${titulo}`, '', cabecalho.join('\n'), ...linhas, '', FONTE, '');
}

out.push(
  '# B4: Quadros de regras de negócio e requisitos',
  '',
  '> **Artefato:** Quadros formatados para o texto do TCC · **Bloco:** B, Engenharia de requisitos',
  '> **Destino no TCC:** Apêndice D, Quadros de regras de negócio e requisitos',
  '> **Arquivo gerado** por `scripts/build-b4-quadros.mjs`, a partir de [`B2`](B2-especificacao-requisitos.md),',
  '> [`B3`](B3-regras-de-negocio.md) e [`A1`](../A-fundacao/A1-documento-de-visao.md) §9.',
  '> **Não editar à mão:** altere a fonte e rode o script.',
  '',
  '---',
  '',
  '## Como usar',
  '',
  'Este arquivo existe por uma razão de formato, não de conteúdo: os artefatos `B2` e `B3` são',
  'documentos de engenharia, com colunas de tipo, origem, prioridade e verificação que não cabem',
  'no corpo do trabalho. Os quadros abaixo são a **redução desses artefatos ao que vai impresso**:',
  'duas ou quatro colunas, prontos para colar no Word como tabela.',
  '',
  '**A numeração dos quadros mudou com a redução de escopo.** Eram treze, e passaram a ser dez:',
  'os quadros de custeio, precificação e financeiro deixaram de ter conteúdo. Quem já citou o',
  'número antigo no corpo do texto precisa reconferir.',
  '',
  'O parser espera `## Quadro N – Título`, a tabela markdown logo abaixo e a linha `Fonte: …` em',
  'seguida. O script gera exatamente esse formato.',
  '',
  '---',
  '',
  '# Quadros: regras de negócio',
  ''
);

for (const a of areas) {
  quadro(
    `Regras de negócio da área de ${a.titulo.toLowerCase()}`,
    ['| Código | Descrição |', '|---|---|'],
    a.regras.map((r) => `| ${r.id} | ${r.enunciado} |`)
  );
}

const total = areas.reduce((s, a) => s + a.regras.length, 0);
quadro(
  'Distribuição das regras de negócio por área do domínio',
  ['| Área | Regras | Quantidade |', '|---|---|---:|'],
  [
    ...areas.map((a) => `| ${a.titulo} | ${a.regras.map((r) => r.id).join(', ')} | ${a.regras.length} |`),
    `| **Total** | | **${total}** |`,
  ]
);

out.push('---', '', '# Quadros: requisitos', '');

quadro(
  'Requisitos funcionais e as regras de negócio que os originam',
  ['| Código | Nome | Descrição | Código RN |', '|---|---|---|---|'],
  rf.map((r) => `| ${r.id} | ${NOME[r.id] || '**FALTA NOME**'} | ${r.texto} | ${(regraDe.get(r.id) || []).join(', ') || '–'} |`)
);

quadro(
  'Requisitos não funcionais',
  ['| Código | Descrição | Origem |', '|---|---|---|'],
  rnf.map((r) => `| ${r.id} | ${r.texto} | ${r.origem} |`)
);

quadro(
  'Restrições do projeto e os requisitos não funcionais que originam',
  ['| Código | Descrição | Origem | Requisitos originados |', '|---|---|---|---|'],
  restricoes.map((r) => `| ${r.id} | ${r.texto} | ${r.origem} | ${rnfDeRestricao.get(r.id).join(', ') || '–'} |`)
);

// Síntese por origem.
const origens = { OP: 'Observação participante', EN: 'Entrevista', AD: 'Análise documental', DOM: 'Estudo do domínio', LEG: 'Exigência legal', ORG: 'Política do projeto' };
const contaRF = {};
const contaRNF = {};
for (const r of rf) for (const o of Object.keys(origens)) if (new RegExp(`\\b${o}\\b`).test(r.origem)) contaRF[o] = (contaRF[o] || 0) + 1;
for (const r of rnf) for (const o of Object.keys(origens)) if (new RegExp(`\\b${o}\\b`).test(r.origem)) contaRNF[o] = (contaRNF[o] || 0) + 1;
const somaRF = Object.values(contaRF).reduce((a, b) => a + b, 0);
const somaRNF = Object.values(contaRNF).reduce((a, b) => a + b, 0);

quadro(
  'Síntese da origem dos requisitos do sistema',
  ['| Origem | RF: Qtd. | RF: % | RNF: Qtd. | RNF: % |', '|---|---:|---:|---:|---:|'],
  [
    ...Object.entries(origens).map(([sigla, nome]) => {
      const a = contaRF[sigla] || 0;
      const b = contaRNF[sigla] || 0;
      const pa = somaRF ? ((a / somaRF) * 100).toFixed(1) : '0,0';
      const pb = somaRNF ? ((b / somaRNF) * 100).toFixed(1) : '0,0';
      return `| ${nome} (${sigla}) | ${a} | ${String(pa).replace('.', ',')} | ${b} | ${String(pb).replace('.', ',')} |`;
    }),
    `| **Total de menções** | **${somaRF}** | | **${somaRNF}** | |`,
  ]
);

out.push(
  '> **A soma das menções excede o número de requisitos**, e é esperado: um requisito pode ter mais',
  '> de uma origem, e a coluna do `B2` é multivalorada. O percentual é sobre o total de menções, não',
  '> sobre o de requisitos.',
  ''
);

writeFileSync(B4, out.join('\n'));

const semNome = rf.filter((r) => !NOME[r.id]).map((r) => r.id);
console.log(`B4: ${n} quadros, ${total} regras, ${rf.length} RF, ${rnf.length} RNF, ${restricoes.length} RE.`);
if (semNome.length) console.error(`AVISO: sem nome no mapa: ${semNome.join(', ')}`);
