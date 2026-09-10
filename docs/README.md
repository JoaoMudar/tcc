# 🗺️ Mapa da Documentação: Viveiro Mudar

> Ponto de entrada único da documentação. Comece por aqui para se situar.
> O `CLAUDE.md` (na raiz) é o contexto carregado em toda sessão e aponta para cá.

## Onde fica cada coisa

| Local | O que é | Quando ler |
|-------|---------|------------|
| `CLAUDE.md` (raiz) | Regras, stack, convenções, workflow. Carregado sempre. | Sempre: é a fonte das regras. |
| `docs/` | Documentação de referência (este diretório). | Para entender contexto, domínio e fluxo de trabalho. |
| `plans/` (raiz) | Roadmap de implementação, em quatro fases. | Antes de implementar uma feature. |
| `migrations/` (raiz) | Migrações SQL (`psql` puro), em ordem cronológica. | Ao mexer no schema do banco. |
| `data/seeds/` (raiz) | Fontes de carga inicial (seed): ex.: export das 142 espécies. Ver `data/seeds/README.md`. | Ao gerar/re-importar dados de catálogo. |
| `src/` (raiz) | Código da aplicação (Next.js App Router). | Ao implementar. |

## Por onde começar (ordem de leitura para pegar contexto)

1. **`CLAUDE.md`** (raiz): regras e convenções inegociáveis.
2. **`docs/contexto-projeto.md`**: visão geral, arquitetura dos projetos, histórico, princípios de UX de campo.
3. **`docs/funcionarios-viveiro-mudar.md`**: quem é quem, e quem tem acesso ao sistema.
4. **`docs/rotinas/00-mapa-de-rotinas.md`**: as **três áreas** (Cadastro único, Produção, Comercial), as rotinas de cada uma e quais perfis tocam cada etapa.
5. **`plans/`**: o plano da feature que você vai implementar.

## Conteúdo de `docs/`

### Referência geral
| Arquivo | Conteúdo |
|---------|----------|
| [`contexto-projeto.md`](contexto-projeto.md) | Histórico, as três áreas, o que a redução de escopo cortou e princípios de formulário de campo. **É a fonte única do roadmap.** |
| [`funcionarios-viveiro-mudar.md`](funcionarios-viveiro-mudar.md) | A equipe e os perfis de acesso. |

### Como trabalhar no projeto (workflow)
| Arquivo | Conteúdo |
|---------|----------|
| [`fluxo-claude-code-git.md`](fluxo-claude-code-git.md) | Fluxo de branches/commits com Claude Code (referenciado pelo `CLAUDE.md`). |
| [`banco-local-espelho.md`](banco-local-espelho.md) | Espelhar o Neon para um Postgres local descartável (`npm run db:refresh-local`) para testes seguros. |
| [`EXECUTION-GUIDE.md`](EXECUTION-GUIDE.md) | Como conduzir as sessões de desenvolvimento e a ordem dos sprints. |
| [`plano-seguranca-commits.md`](plano-seguranca-commits.md) | Plano histórico de segurança de commits (hooks, gitignore). |
| [`auditoria-divergencias.md`](auditoria-divergencias.md) | **Auditoria, catorze passadas entre 10/08 e 10/09/2026**: divergências entre docs, planos e código, a redução de escopo na oitava, a regra que afirmava um fato falso sobre o viveiro na décima, o modelo de dados em português na décima segunda e a redução das rotinas na décima quarta. É registro histórico: cita identificadores que já não existem, de propósito. |
| [`divida-tecnica.md`](divida-tecnica.md) | **Trabalho futuro (11/08/2026)**: o que falta para a produção ser segura de operar: backup, teste contra banco real, drift de schema. Prontidão medida: ~85%. |

### Engenharia de software (`docs/engenharia/`)

Documentação **formal de engenharia**, produzida como base do **Capítulo 4 (Resultados)** do TCC.
Distinta de `docs/rotinas/`, que é documentação de domínio em linguagem de negócio.

Comece por [`engenharia/README.md`](engenharia/README.md), explica a estrutura de pastas.
Índice completo, com status de cada artefato, em [`engenharia/00-indice.md`](engenharia/00-indice.md).

| Bloco | Artefatos |
|-------|-----------|
| A: Fundação | Documento de Visão, Glossário do domínio |
| B: Requisitos | Especificação de Requisitos (58 RF, 24 RNF), Regras de negócio (54 RN), Quadros do TCC, Matriz de rastreabilidade |
| C: Modelagem | Casos de uso (34 UC), Especificação de casos de uso, MER/DER (27 entidades), Dicionário de dados |
| D: Arquitetura | Arquitetura C4, Diagrama de implantação, Matriz RBAC |
| E: Qualidade | Casos de teste de aceite, Riscos, Modelagem de ameaças, LGPD, Backup |
| F: Usabilidade | Plano de avaliação (5 atributos de Nielsen) |
| G: Gestão | Fichas de indicadores (KPI) |

> **Entrega para o TCC:** `npm run docs:tcc` regenera [`engenharia/word/`](engenharia/word/), os
> arquivos na ordem do Capítulo 4, com os diagramas exportados em PNG. A pasta é **gerada**: editar
> lá não adianta, edite o artefato de origem.

### Domínio: rotinas de negócio (`docs/rotinas/`)
Cada rotina descreve um processo do viveiro e quais perfis executam cada etapa.
Mapa em [`rotinas/00-mapa-de-rotinas.md`](rotinas/00-mapa-de-rotinas.md).

O mapa traz também o **diagrama de como as três áreas se relacionam** e um diagrama por área.

| Área | Rotina | Arquivo |
|--------|--------|---------|
| **1 · Cadastro único** | Cadastro único (agrupador) | [`rotinas/1-cadastros/00-visao-geral.md`](rotinas/1-cadastros/00-visao-geral.md) |
| **1 · Cadastro único** | Identidade única: pessoa, papel e endereço | [`rotinas/1-cadastros/01-cadastro-unico.md`](rotinas/1-cadastros/01-cadastro-unico.md) |
| **2 · Produção** | Produção (visão geral) | [`rotinas/2-producao/00-visao-geral.md`](rotinas/2-producao/00-visao-geral.md) |
| **2 · Produção** | Agenda de pessoal | [`rotinas/2-producao/01-agenda-de-pessoal.md`](rotinas/2-producao/01-agenda-de-pessoal.md) |
| **2 · Produção** | Lotes e canteiros | [`rotinas/2-producao/04-lotes-e-canteiros.md`](rotinas/2-producao/04-lotes-e-canteiros.md) |
| **2 · Produção** | Protocolo de atividades por lote | [`rotinas/2-producao/06-protocolo-de-atividades.md`](rotinas/2-producao/06-protocolo-de-atividades.md) |
| **3 · Comercial** | Comercial (visão geral) | [`rotinas/3-comercial/00-visao-geral.md`](rotinas/3-comercial/00-visao-geral.md) |
| **3 · Comercial** | Pedidos | [`rotinas/3-comercial/pedidos.md`](rotinas/3-comercial/pedidos.md) |

### Planos de implementação (`plans/`)

Um plano só, [`P1-sistema-reduzido.md`](../plans/P1-sistema-reduzido.md), em quatro fases. Ele
substitui os quinze anteriores, que cobriam custeio, precificação, conciliação bancária, cotação,
catálogo, site, Instagram, comércio eletrônico e painel de indicadores: nenhum deles pertence mais
ao escopo.

### Scripts de geração (`scripts/`)

**Documento que resume outro não se escreve à mão.** Cinco tabelas do trabalho são derivadas das
suas fontes, e rodar os scripts é parte de alterar qualquer artefato:

| Script | O que gera |
|---|---|
| `build-b3-derivado.mjs` | `B3` §4 (RF → RN) e §7 (texto integral dos requisitos) |
| `build-b4-quadros.mjs` | `B4` inteiro, os dez quadros do apêndice |
| `build-b5-matriz.mjs` | `B5` §2 (a matriz) e §6 (estado da cobertura) |
| `build-e2-cobertura.mjs` | `E2` §9 (cobertura por seção e requisitos sem caso) |
| `mede-figuras.mjs` | A fonte útil de cada figura do `modelo-dados-pt` |
| `render-mapas.mjs` | Os PNG em escala de cinza de `rotinas/img/` |
| `confere-mapas.mjs` | Mede a fonte útil de cada PNG de `rotinas/img/` e verifica que nenhum nó voltou a contar telas |
| `verifica-rastreabilidade.mjs` | Confere, nos dois sentidos, os identificadores citados contra os definidos |
| `confere-modelo-pt.mjs` | Confere o conjunto de arestas das figuras em português contra o do `C6` |
| `leia.mjs` | Leitura dos geradores, normalizando a quebra de linha. Não se roda sozinho |

