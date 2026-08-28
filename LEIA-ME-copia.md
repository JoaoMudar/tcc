# Cópia da documentação do Viveiro Mudar (base do TCC)

Cópia congelada em **26/08/2026** para trabalhar a **redução de escopo do TCC** sem mexer no
repositório de desenvolvimento.

## Procedência

| Item | Valor |
|------|-------|
| Origem | `C:\Users\jppir\Documents\Pessoal\Trabalho\Viveiro\app-viveiro\viveiro-mudar` |
| Branch | `docs/quadros-regras-e-requisitos` |
| HEAD | `4b6e7a4` |
| Estado | **Árvore de trabalho**, não o HEAD: havia alterações não commitadas no momento da cópia (docs de engenharia, rotinas e figuras). O conteúdo aqui é o que estava em disco, que é mais novo que o commit. |

Daqui em diante os dois lados divergem. Alteração feita nesta pasta **não** volta para o repo,
e alteração feita no repo **não** chega aqui.

## O que veio

| Pasta | Conteúdo |
|-------|----------|
| `docs/engenharia/` | Artefatos formais de engenharia, blocos A a G, mais `word/` (capítulo 4 montado) e `modelo-dados-pt/` (figuras em português). |
| `docs/rotinas/` | Documentação de domínio em linguagem de negócio: os quatro módulos (Cadastros, Produção, Comercial, Financeiro). |
| `docs/` (raiz) | Referência geral: contexto do projeto, auditoria de divergências, dívida técnica, post-mortem do BI financeiro. |
| `plans/` | Roadmaps de implementação `P1` a `P15`. |
| `migrations/` | 47 migrações SQL, o schema real do banco. |
| `README.md`, `CLAUDE.md` | Mapa da documentação e regras/stack/convenções do projeto. |
| `quadros-regras-de-negocio-e-requisitos.docx` | Quadros exportados para o Word. |

Não veio: código-fonte (`src/`), dados de seed, `.env` e dependências.

## Por onde começar

1. [`docs/README.md`](docs/README.md), mapa geral da documentação.
2. [`docs/engenharia/00-indice.md`](docs/engenharia/00-indice.md), índice dos artefatos com status.
3. [`docs/engenharia/B-requisitos/B2-especificacao-requisitos.md`](docs/engenharia/B-requisitos/B2-especificacao-requisitos.md) e [`B3-regras-de-negocio.md`](docs/engenharia/B-requisitos/B3-regras-de-negocio.md), o volume a ser cortado (136 RF, 26 RNF, 103 RN).
4. [`docs/engenharia/B-requisitos/B5-matriz-rastreabilidade.md`](docs/engenharia/B-requisitos/B5-matriz-rastreabilidade.md), para ver o que cada corte arrasta junto.
