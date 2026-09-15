# Como montar o TCC a partir desta pasta

> **Pasta gerada automaticamente.** Não edite nada aqui, edite o artefato de origem em
> `docs/engenharia/` e rode `node scripts/build-word.mjs`. Qualquer edição feita nesta pasta é
> perdida na próxima geração.

Gerado a partir dos artefatos vigentes · 17 arquivos · 15 figuras.

## Ordem de colagem no Capítulo 4

1. `4.1-visao-geral-da-solucao.md` → **4.1 Visão geral da solução**
2. `4.2-requisitos.md` → **4.2 Requisitos do sistema**
3. `4.3-regras-de-negocio.md` → **4.3 Regras de negócio**
4. `4.4-modelagem-do-sistema.md` → **4.4 Modelagem do sistema**
5. `4.5-modelagem-de-dados.md` → **4.5 Modelagem de dados**
6. `4.6-arquitetura.md` → **4.6 Arquitetura da solução**
7. `4.7-seguranca-e-controle-de-acesso.md` → **4.7 Segurança e controle de acesso**
8. `4.8-verificacao-e-validacao.md` → **4.8 Verificação e validação**
9. `4.9-indicadores-de-desempenho.md` → **4.9 Indicadores de desempenho**
10. `4.10-rastreabilidade.md` → **4.10 Rastreabilidade**

## Fora do Capítulo 4

- `cap2-acrescimos-referencial.md` → Capítulo 2.5, Acréscimos ao referencial teórico
- `cap3-analise-de-riscos.md` → Capítulo 3, Análise de riscos do projeto

> **`cap2-acrescimos-referencial.md` deve ser colado antes do Capítulo 4.** Os artefatos de LGPD e
> de backup apresentam, nos resultados, conteúdo que o referencial atual não fundamenta. Sem esse
> acréscimo, o Capítulo 4 afirma o que o Capítulo 2 não sustenta.
>
> **Análise de riscos não pertence ao Capítulo 4.** É elemento de metodologia: cabe como seção
> nova no Capítulo 3.
>
> **`00-pre-textuais.md` vem antes de tudo.** Dedicatória, agradecimentos e epígrafe são os
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

- `apendice-A-glossario.md` → Apêndice A, Glossário do domínio
- `apendice-B-dicionario-de-dados.md` → Apêndice B, Dicionário de dados
- `apendice-C-casos-de-teste.md` → Apêndice C, Casos de teste de aceite
- `apendice-D-quadros.md` → Apêndice D, Quadros de regras de negócio e requisitos

Estes quatro são longos demais para o corpo do texto. A recomendação é apresentar, no capítulo,
uma amostra de duas ou três tabelas e remeter ao apêndice para o restante.

## Figuras

Todas em `img/`, numeradas em sequência contínua (Figura 1 a Figura 15) e já referenciadas
no texto de cada arquivo, com legenda no padrão ABNT abaixo da imagem.

> **As figuras da seção 4.5 são substituídas à mão.** As que este script gera saem do Mermaid do
> `C6`, num recorte largo demais para a página. Para o trabalho impresso, use as de
> [`modelo-dados-pt/img/`](../modelo-dados-pt/img/), que são o mesmo modelo, com os mesmos nomes,
> em recortes que cabem na mancha de 16 x 24 cm. São doze no lugar das do C6, e o
> [`README`](../modelo-dados-pt/README.md) de lá traz a fonte útil medida de cada uma e o
> deslocamento de numeração que a troca causa nas seções seguintes.

Ao colar no Word:

1. Insira a imagem por **Inserir → Imagens → Este dispositivo**, apontando para o arquivo em `img/`.
2. Aplique **Inserir legenda** na figura, para que o Word mantenha a numeração automática e permita
   gerar a lista de figuras. A legenda já está escrita no texto, use-a como conteúdo.
3. Confira a largura: as imagens foram geradas a 1400 px e devem ser reduzidas à largura da mancha
   de texto.

> A **Lista de Figuras** do trabalho passa a ser obrigatória: o próprio modelo indica que a lista é
> exigida acima de cinco figuras.

## Tabelas

As tabelas vêm em Markdown. Ao colar no Word, o formato mais confiável é:

1. Copiar a tabela do arquivo `.md`.
2. No Word, colar como **texto sem formatação**.
3. Selecionar o bloco e usar **Inserir → Tabela → Converter texto em tabela**, com `|` como
   separador.
4. Remover a linha de traços (`|---|---|`), que é sintaxe do Markdown e não conteúdo.

Alternativa mais rápida, se houver Pandoc instalado: converter o arquivo inteiro com
`pandoc arquivo.md -o arquivo.docx` e copiar do resultado.

## Conferência antes de entregar

- [ ] Numeração das figuras contínua e coerente com a Lista de Figuras
- [ ] Figuras da seção 4.5 trocadas pelas de `modelo-dados-pt/`, e a numeração seguinte ajustada
- [ ] Todas as tabelas cabem na largura da página, sem corte
- [ ] Figuras legíveis em escala de cinza, caso a impressão seja monocromática
- [ ] Referência da Lei nº 13.709/2018 inserida na seção REFERÊNCIAS
- [ ] Análise de riscos posicionada no Capítulo 3, não no 4
- [ ] Nomes entre colchetes dos pré-textuais substituídos
- [ ] Nenhuma página em branco: conferir com Ctrl+asterisco, de ponta a ponta
- [ ] Toda separação de elemento é quebra de página, e nenhuma é linha em branco
