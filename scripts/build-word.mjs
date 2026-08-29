// Gera `docs/engenharia/word/` a partir dos artefatos de `docs/engenharia/`.
//
// A pasta é a entrega para o Word, na ordem do Capítulo 4. Nada nela se edita: o
// que se edita é o artefato de origem, e este script refaz a pasta.
//
// O que ele faz com cada arquivo:
//   1. troca o `# Título` do artefato pelo título da seção do TCC;
//   2. troca o bloco de citação de cabeçalho por uma nota de origem;
//   3. concatena as fontes múltiplas (4.4 é C1+C2, 4.6 é D1+D3, 4.7 é D4+E4+E5+E6);
//   4. substitui cada bloco ```mermaid por uma imagem com legenda ABNT, e **renderiza
//      o PNG correspondente**, numerando as figuras em sequência contínua ao longo do
//      capítulo.
//
//   node scripts/build-word.mjs            # tudo, inclusive as figuras
//   node scripts/build-word.mjs --sem-img  # só o texto, sem chamar o mermaid-cli
//
// As figuras do Capítulo 4.5 saem do Mermaid do C6. Para o trabalho impresso, elas são
// **substituídas à mão** pelas figuras em português de `modelo-dados-pt/`, que são o
// mesmo modelo com nomes em português e recortes que cabem na mancha. O README de lá
// explica a troca e o deslocamento de numeração que ela causa.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ENG = 'docs/engenharia';
const OUT = `${ENG}/word`;
const IMG = `${OUT}/img`;
const SEM_IMG = process.argv.includes('--sem-img');

// destino -> { titulo, fontes[] }
const CAPITULO = [
  ['4.1-visao-geral-da-solucao', '4.1 Visão geral da solução', ['A-fundacao/A1-documento-de-visao.md']],
  ['4.2-requisitos', '4.2 Requisitos do sistema', ['B-requisitos/B2-especificacao-requisitos.md']],
  ['4.3-regras-de-negocio', '4.3 Regras de negócio', ['B-requisitos/B3-regras-de-negocio.md']],
  ['4.4-modelagem-do-sistema', '4.4 Modelagem do sistema', ['C-modelagem/C1-diagrama-casos-de-uso.md', 'C-modelagem/C2-especificacao-casos-de-uso.md']],
  ['4.5-modelagem-de-dados', '4.5 Modelagem de dados', ['C-modelagem/C6-modelo-entidade-relacionamento.md']],
  ['4.6-arquitetura', '4.6 Arquitetura da solução', ['D-arquitetura/D1-arquitetura-c4.md', 'D-arquitetura/D3-diagrama-implantacao.md']],
  ['4.7-seguranca-e-controle-de-acesso', '4.7 Segurança e controle de acesso', ['D-arquitetura/D4-matriz-rbac.md', 'E-qualidade/E4-modelagem-de-ameacas.md', 'E-qualidade/E5-mapeamento-lgpd.md', 'E-qualidade/E6-plano-backup-recuperacao.md']],
  ['4.8-verificacao-e-validacao', '4.8 Verificação e validação', ['F-ux/F3-plano-avaliacao-usabilidade.md']],
  ['4.9-indicadores-de-desempenho', '4.9 Indicadores de desempenho', ['G-gestao/G2-fichas-de-indicadores.md']],
  ['4.10-rastreabilidade', '4.10 Rastreabilidade', ['B-requisitos/B5-matriz-rastreabilidade.md']],
];

const FORA_DO_CAPITULO = [
  ['cap2-acrescimos-referencial', 'Capítulo 2.5, Acréscimos ao referencial teórico', ['E-qualidade/E5-E6-referencial-cap2.md']],
  ['cap3-analise-de-riscos', 'Capítulo 3, Análise de riscos do projeto', ['E-qualidade/E3-analise-de-riscos.md']],
];

const APENDICES = [
  ['apendice-A-glossario', 'Apêndice A, Glossário do domínio', ['A-fundacao/A2-glossario-dominio.md']],
  ['apendice-B-dicionario-de-dados', 'Apêndice B, Dicionário de dados', ['C-modelagem/C8-dicionario-de-dados.md']],
  ['apendice-C-casos-de-teste', 'Apêndice C, Casos de teste de aceite', ['E-qualidade/E2-casos-de-teste-de-aceite.md']],
  ['apendice-D-quadros', 'Apêndice D, Quadros de regras de negócio e requisitos', ['B-requisitos/B4-quadros-tcc.md']],
];

// Remove o `# Título` e o bloco de citação de cabeçalho do artefato.
function corpo(caminho) {
  const linhas = readFileSync(`${ENG}/${caminho}`, 'utf8').split('\r\n').join('\n').split('\n');
  let i = 0;
  while (i < linhas.length && !linhas[i].startsWith('# ')) i++;
  i++; // pula o título
  while (i < linhas.length && linhas[i].trim() === '') i++;
  // Os blocos de citação iniciais são metadados de engenharia, e não vão para o TCC.
  while (i < linhas.length && linhas[i].startsWith('>')) {
    while (i < linhas.length && linhas[i].startsWith('>')) i++;
    while (i < linhas.length && linhas[i].trim() === '') i++;
  }
  // O separador que costuma vir logo depois do cabeçalho também sai.
  if (linhas[i] === '---') {
    i++;
    while (i < linhas.length && linhas[i].trim() === '') i++;
  }
  return linhas.slice(i).join('\n').trimEnd();
}

// Legenda da figura: o cabeçalho mais próximo acima do diagrama.
function legendaDe(linhas, ate) {
  for (let i = ate; i >= 0; i--) {
    const m = linhas[i].match(/^#{2,4} (?:\d+(?:\.\d+)*\.? )?(.+)$/);
    if (m) return m[1].trim();
  }
  return 'Diagrama';
}

// Só limpa as figuras quando vai mesmo renderizá-las: `--sem-img` existe para
// refazer o texto rápido, e apagar os PNG nesse caminho deixaria a pasta quebrada.
if (!SEM_IMG) rmSync(IMG, { recursive: true, force: true });
mkdirSync(IMG, { recursive: true });

let figura = 0;
const pendentes = [];
const gerados = [];

function gera([nome, titulo, fontes]) {
  const partes = fontes.map(corpo).join('\n\n---\n\n');
  const linhas = partes.split('\n');
  const saida = [];

  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].trim() !== '```mermaid') {
      saida.push(linhas[i]);
      continue;
    }
    const inicio = i;
    const fonte = [];
    i++;
    while (i < linhas.length && linhas[i].trim() !== '```') fonte.push(linhas[i++]);

    figura++;
    const legenda = legendaDe(linhas, inicio - 1);
    const arquivo = `${nome}-fig${String(figura).padStart(2, '0')}.png`;
    pendentes.push({ arquivo, fonte: fonte.join('\n') });

    saida.push(
      `![Figura ${figura}: ${legenda}](img/${arquivo})`,
      '',
      `**Figura ${figura}**: ${legenda}. Fonte: elaborado pelo autor (2026).`
    );
  }

  const texto = [
    `# ${titulo}`,
    '',
    `> Gerado a partir de ${fontes.map((f) => `\`${f}\``).join(', ')}.`,
    '> **Não edite este arquivo**: edite o artefato de origem e rode `node scripts/build-word.mjs`.',
    '',
    saida.join('\n').trimEnd(),
    '',
  ].join('\n');

  writeFileSync(`${OUT}/${nome}.md`, texto);
  gerados.push(nome);
}

for (const item of CAPITULO) gera(item);
for (const item of FORA_DO_CAPITULO) gera(item);
for (const item of APENDICES) gera(item);

// ---------------------------------------------------------------- figuras
if (!SEM_IMG) {
  for (const { arquivo, fonte } of pendentes) {
    const tmp = `${IMG}/.tmp.mmd`;
    writeFileSync(tmp, fonte);
    execFileSync('npx', ['-y', '@mermaid-js/mermaid-cli', '-i', tmp, '-o', `${IMG}/${arquivo}`, '-w', '1400', '-b', 'white'], {
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    rmSync(tmp);
    console.log(`figura ${arquivo}`);
  }
}

// ---------------------------------------------------------------- como montar
const ordem = CAPITULO.map(([nome, titulo], i) => `${i + 1}. \`${nome}.md\` → **${titulo}**`);
writeFileSync(
  `${OUT}/00-como-montar.md`,
  `# Como montar o TCC a partir desta pasta

> **Pasta gerada automaticamente.** Não edite nada aqui, edite o artefato de origem em
> \`docs/engenharia/\` e rode \`node scripts/build-word.mjs\`. Qualquer edição feita nesta pasta é
> perdida na próxima geração.

Gerado a partir dos artefatos vigentes · ${gerados.length} arquivos · ${figura} figuras.

## Ordem de colagem no Capítulo 4

${ordem.join('\n')}

## Fora do Capítulo 4

- \`cap2-acrescimos-referencial.md\` → Capítulo 2.5, Acréscimos ao referencial teórico
- \`cap3-analise-de-riscos.md\` → Capítulo 3, Análise de riscos do projeto

> **\`cap2-acrescimos-referencial.md\` deve ser colado antes do Capítulo 4.** Os artefatos de LGPD e
> de backup apresentam, nos resultados, conteúdo que o referencial atual não fundamenta. Sem esse
> acréscimo, o Capítulo 4 afirma o que o Capítulo 2 não sustenta.
>
> **Análise de riscos não pertence ao Capítulo 4.** É elemento de metodologia: cabe como seção
> nova no Capítulo 3.

## Apêndices

${APENDICES.map(([nome, titulo]) => `- \`${nome}.md\` → ${titulo}`).join('\n')}

Estes quatro são longos demais para o corpo do texto. A recomendação é apresentar, no capítulo,
uma amostra de duas ou três tabelas e remeter ao apêndice para o restante.

## Figuras

Todas em \`img/\`, numeradas em sequência contínua (Figura 1 a Figura ${figura}) e já referenciadas
no texto de cada arquivo, com legenda no padrão ABNT abaixo da imagem.

> **As figuras da seção 4.5 são substituídas à mão.** As que este script gera saem do Mermaid do
> \`C6\`, com nomes de tabela em inglês. Para o trabalho impresso, use as de
> [\`modelo-dados-pt/img/\`](../modelo-dados-pt/img/), que são o mesmo modelo com nomes em português
> e recortes que cabem na mancha de 16 x 24 cm. São doze no lugar das do C6, e o
> [\`README\`](../modelo-dados-pt/README.md) de lá traz a fonte útil medida de cada uma e o
> deslocamento de numeração que a troca causa nas seções seguintes.

Ao colar no Word:

1. Insira a imagem por **Inserir → Imagens → Este dispositivo**, apontando para o arquivo em \`img/\`.
2. Aplique **Inserir legenda** na figura, para que o Word mantenha a numeração automática e permita
   gerar a lista de figuras. A legenda já está escrita no texto, use-a como conteúdo.
3. Confira a largura: as imagens foram geradas a 1400 px e devem ser reduzidas à largura da mancha
   de texto.

> A **Lista de Figuras** do trabalho passa a ser obrigatória: o próprio modelo indica que a lista é
> exigida acima de cinco figuras.

## Tabelas

As tabelas vêm em Markdown. Ao colar no Word, o formato mais confiável é:

1. Copiar a tabela do arquivo \`.md\`.
2. No Word, colar como **texto sem formatação**.
3. Selecionar o bloco e usar **Inserir → Tabela → Converter texto em tabela**, com \`|\` como
   separador.
4. Remover a linha de traços (\`|---|---|\`), que é sintaxe do Markdown e não conteúdo.

Alternativa mais rápida, se houver Pandoc instalado: converter o arquivo inteiro com
\`pandoc arquivo.md -o arquivo.docx\` e copiar do resultado.

## Conferência antes de entregar

- [ ] Numeração das figuras contínua e coerente com a Lista de Figuras
- [ ] Figuras da seção 4.5 trocadas pelas de \`modelo-dados-pt/\`, e a numeração seguinte ajustada
- [ ] Todas as tabelas cabem na largura da página, sem corte
- [ ] Figuras legíveis em escala de cinza, caso a impressão seja monocromática
- [ ] Referência da Lei nº 13.709/2018 inserida na seção REFERÊNCIAS
- [ ] Análise de riscos posicionada no Capítulo 3, não no 4
`
);

// Remove o que sobrou de gerações anteriores.
const esperados = new Set([...gerados.map((g) => `${g}.md`), '00-como-montar.md', 'img']);
for (const f of readdirSync(OUT)) {
  if (!esperados.has(f)) {
    rmSync(`${OUT}/${f}`, { recursive: true, force: true });
    console.log(`removido obsoleto: ${f}`);
  }
}

console.log(`word/: ${gerados.length + 1} arquivos, ${figura} figuras.`);
