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
// **substituídas à mão** pelas de `modelo-dados-pt/`: mesmo modelo, mesmos nomes, porém
// num recorte mais fino, que cabe na mancha. Até a renomeação do modelo para português a
// troca também era de idioma; hoje é só de recorte. O README de lá explica a troca e o
// deslocamento de numeração que ela causa.

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
  ['00-pre-textuais', 'Elementos pré-textuais', ['tcc-pre-textuais.md']],
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

// Subordina a numeração interna do artefato à da seção do capítulo.
//
// O artefato numera as suas seções a partir de 1, e o gerador só troca o título de
// nível 1. Colado no Word, o Capítulo 4 exibia "4.1, 4.2, 4.3" e logo em seguida
// "3.5, 3.6", que são as seções do B3 e parecem do Capítulo 3. Prefixar com o número
// da seção resolve: `### 3.5 Área E` vira `### 4.3.3.5 Área E`.
//
// A seção montada de vários artefatos (4.4, 4.6 e 4.7) tem um problema a mais: cada
// fonte recomeça em 1, e quatro seções "4.7.1" seguidas leem-se como erro. Por isso o
// deslocamento: a segunda fonte continua de onde a primeira parou.
//
// As remissões em prosa ("na §2.4") acompanham. As que apontam para outro artefato
// ("`A2` §1", "[`A1`](...) §9") NAO: vêm precedidas de crase ou do parêntese que
// fecha o link, e é esse o critério que as distingue.
function subordina(texto, secao, deslocamento) {
  if (!secao) return { texto, topo: 0 };
  let topo = 0;
  const numera = (num) => {
    const partes = num.split('.');
    const primeiro = Number(partes[0]) + deslocamento;
    topo = Math.max(topo, primeiro);
    return [secao, primeiro, ...partes.slice(1)].join('.');
  };

  const comCabecalhos = texto
    .split('\n')
    .map((linha) =>
      linha.replace(/^(#{2,4}) (\d+(?:\.\d+)*)\.? (.+)$/, (todo, nivel, num, resto) => `${nivel} ${numera(num)} ${resto}`)
    )
    .join('\n');

  const comRemissoes = comCabecalhos.replace(/(.{0,2})§(\d+(?:\.\d+)*)/g, (todo, antes, num) =>
    /[`)]\s$/.test(antes) ? todo : `${antes}§${numera(num)}`
  );

  return { texto: comRemissoes, topo };
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
  // Só o Capítulo 4 é subordinado: o que vai para outro capítulo e os apêndices
  // entram no trabalho como seção própria, e a numeração deles já é a de lá.
  const primeira = titulo.split(' ')[0];
  const secao = /^\d+\.\d+$/.test(primeira) ? primeira : null;
  let deslocamento = 0;
  const partes = fontes
    .map((fonte) => {
      const { texto, topo } = subordina(corpo(fonte), secao, deslocamento);
      deslocamento = topo;
      return texto;
    })
    .join('\n\n---\n\n');
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
>
> **\`00-pre-textuais.md\` vem antes de tudo.** Dedicatória, agradecimentos e epígrafe são os
> primeiros elementos do trabalho, e os nomes próprios ali estão entre colchetes, à espera de
> preenchimento.

## Montagem no Word: quebras de página e página em branco

**Toda separação entre elementos é quebra de página, e nunca linha em branco.** Linha em branco
empurra o texto enquanto a página couber, e volta a subir assim que qualquer parágrafo acima muda
de tamanho. A quebra não se desfaz:

1. Posicione o cursor no início do elemento que deve abrir página, e não no fim do anterior.
2. Use **Ctrl+Enter** (Inserir → Quebra → Página).
3. Cada um destes abre página própria: capa, folha de rosto, folha de aprovação, dedicatória,
   agradecimentos, epígrafe, resumo, abstract, listas, sumário e cada capítulo.

**Onde a numeração muda de romana para arábica, a quebra é de seção, e não de página.** Nos
pré-textuais a contagem corre sem número impresso, e a numeração visível começa na introdução. Use
Layout → Quebras → **Próxima Página** no ponto da virada, e no cabeçalho da nova seção desligue
**Vincular ao Anterior** antes de reiniciar a numeração. Sem desligar o vínculo, mudar uma seção
muda a outra.

**A página em branco no meio do trabalho tem três causas, e todas se veem com Ctrl+asterisco**, que
liga as marcas de formatação:

| O que aparece na tela | O que é | Como resolver |
|---|---|---|
| Um ¶ sozinho na página | Parágrafo vazio sobrando ao fim do elemento anterior | Apague o parágrafo |
| Uma linha "Quebra de seção (Página ímpar)" | Quebra herdada do modelo, que salta a página par para o elemento abrir sempre à direita | Se o trabalho não é impresso em frente e verso, troque por **Próxima Página** |
| Duas quebras seguidas | Quebra de página inserida onde já havia quebra de seção | Apague uma das duas |

A terceira é a mais comum ao colar conteúdo vindo daqui, porque o Markdown traz o próprio espaço
entre seções e o Word soma o dele.

**Uma tabela grande também produz página em branco**, quando não cabe no que resta da página e o
Word a empurra inteira. Em Propriedades da Tabela → Linha, desligue "Permitir quebra de linha entre
páginas" apenas se a tabela couber numa página; se não couber, deixe ligado e marque a primeira
linha como **Repetir como linha de cabeçalho**.

## Apêndices

${APENDICES.map(([nome, titulo]) => `- \`${nome}.md\` → ${titulo}`).join('\n')}

Estes quatro são longos demais para o corpo do texto. A recomendação é apresentar, no capítulo,
uma amostra de duas ou três tabelas e remeter ao apêndice para o restante.

## Figuras

Todas em \`img/\`, numeradas em sequência contínua (Figura 1 a Figura ${figura}) e já referenciadas
no texto de cada arquivo, com legenda no padrão ABNT abaixo da imagem.

> **As figuras da seção 4.5 são substituídas à mão.** As que este script gera saem do Mermaid do
> \`C6\`, num recorte largo demais para a página. Para o trabalho impresso, use as de
> [\`modelo-dados-pt/img/\`](../modelo-dados-pt/img/), que são o mesmo modelo, com os mesmos nomes,
> em recortes que cabem na mancha de 16 x 24 cm. São doze no lugar das do C6, e o
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
- [ ] Nomes entre colchetes dos pré-textuais substituídos
- [ ] Nenhuma página em branco: conferir com Ctrl+asterisco, de ponta a ponta
- [ ] Toda separação de elemento é quebra de página, e nenhuma é linha em branco
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
