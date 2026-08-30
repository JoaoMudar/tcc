# Cópia da documentação do Viveiro Mudar (base do TCC)

Cópia congelada em **26/08/2026** para trabalhar a **redução de escopo do TCC** sem mexer no
repositório de desenvolvimento. A redução foi executada em **28/08/2026**, e o que está aqui é o
resultado dela.

## Procedência

| Item | Valor |
|------|-------|
| Origem | `C:\Users\jppir\Documents\Pessoal\Trabalho\Viveiro\app-viveiro\viveiro-mudar` |
| Branch | `docs/quadros-regras-e-requisitos` |
| HEAD | `4b6e7a4` |
| Estado | **Árvore de trabalho**, não o HEAD: havia alterações não commitadas no momento da cópia. |

Daqui em diante os dois lados divergem. Alteração feita nesta pasta **não** volta para o repo,
e alteração feita no repo **não** chega aqui.

## O que a redução de escopo fez

O sistema foi especificado para a empresa e para o TCC ao mesmo tempo, e cresceu além do que um
protótipo entrega no prazo acadêmico. O corte foi aplicado a **todos** os artefatos, não só aos
requisitos.

| | Antes | Depois |
|---|---:|---:|
| Requisitos funcionais | 138 | **62** |
| Requisitos não funcionais | 27 | **27** |
| Regras de negócio | 105 | **60** |
| Casos de uso | 59 | **34** |
| Casos de uso detalhados | 15 | **10** |
| Entidades do modelo | 62 | **27**, mais 2 visões |
| Perfis de acesso | 4 | **3** |
| Recursos na matriz RBAC | 43 | **25** |
| Casos de teste de aceite | 98 | **68** |
| Pranchas de protótipo | 62 | **35** |
| Figuras do modelo de dados | 19 | **12** |
| Migrações SQL | 47 | **8** |
| Planos de implementação | 15 | **1** |

**O que saiu:** o módulo Financeiro por inteiro, custeio, precificação, cotação com fornecedores,
entregas e cargas, apontamento por relógio, estoque e gastos de insumo, indicadores financeiros,
catálogo digital, site, Instagram, comércio eletrônico e integração automática com WhatsApp. Saiu
também o **perfil colaborador**: os seis trabalhadores de campo não operam o sistema, e o trabalho
deles é planejado e confirmado pela gerência.

**O que ficou:** três áreas de negócio, Cadastro único, Produção e Comercial, com Acesso e
Configurações atravessando as três. O argumento do trabalho passou a ser a **interconexão**: o que
se cadastra alimenta as outras duas áreas, e o que a Produção deixa pronto é o que o Comercial
consegue vender.

**Os requisitos caíram duas vezes, e só a primeira tirou funcionalidade.** O corte de 28/08 levou de 138 a 70. A passagem de 70 a 62, em 30/08, fundiu oito pares que compartilhavam o mesmo caso de uso e o mesmo teste de aceite, e portanto eram um requisito escrito em duas linhas: o critério está em `B2` §1.

**Os identificadores foram renumerados** em sequência contínua, na ordem de leitura. A numeração
antiga sobrevive apenas em `docs/auditoria-divergencias.md`, que é registro histórico e cita, de
propósito, números que já não existem.

## O que veio

| Pasta | Conteúdo |
|-------|----------|
| `docs/engenharia/` | Artefatos formais, blocos A a G, mais `word/` (capítulo 4 montado) e `modelo-dados-pt/` (figuras em português). |
| `docs/rotinas/` | Documentação de domínio, em linguagem de negócio: as três áreas. |
| `docs/` (raiz) | Referência geral: contexto do projeto, auditoria, dívida técnica. |
| `plans/` | O roadmap de implementação, em quatro fases. |
| `migrations/` | 8 migrações SQL, o schema reduzido de 23 tabelas e 1 visão. |
| `scripts/` | Os geradores e a conferência de rastreabilidade. |
| `README.md`, `CLAUDE.md` | Mapa da documentação e regras/stack/convenções do projeto. |

Não veio: código-fonte (`src/`), dados de seed, `.env` e dependências. Por isso os scripts `npm run
docs:tcc` e `npm run docs:mapas`, citados na versão original dos documentos, **não existem aqui**:
foram recriados como scripts Node autônomos em `scripts/`.

## Documento que resume outro não se escreve à mão

É a lição que o corte deixou, e está registrada na oitava passada da auditoria. Cinco tabelas do
trabalho são **geradas** a partir das suas fontes, e rodar o script é parte de alterar o artefato:

```bash
node scripts/build-b3-derivado.mjs     # B3 §4 e §7
node scripts/build-e2-cobertura.mjs    # E2 §9
node scripts/build-b5-matriz.mjs       # B5 §2 e §6
node scripts/build-b4-quadros.mjs      # B4 inteiro
node scripts/build-word.mjs            # docs/engenharia/word/ e as figuras do capítulo
```

E, depois de qualquer alteração em requisito, regra, caso de uso ou teste:

```bash
node scripts/verifica-rastreabilidade.mjs
```

Ele confronta, **nos dois sentidos**, os identificadores definidos em B2, B3, C1, E2, G2 e A1
contra os citados em todo o repositório, e sai com erro se houver referência órfã. Foi ele que
encontrou, durante o corte, as dezenas de citações a requisitos removidos que sobreviveram em C8,
D4, E4, E5, F1 e nas rotinas.

Dois scripts cuidam das figuras:

```bash
node scripts/mede-figuras.mjs          # fonte útil de cada figura do modelo-dados-pt
node scripts/render-mapas.mjs          # PNG em cinza dos mapas de rotina
node scripts/confere-modelo-pt.mjs     # as figuras em português contra o C6, nos dois sentidos
```

## Por onde começar

1. [`docs/README.md`](docs/README.md), mapa geral da documentação.
2. [`docs/contexto-projeto.md`](docs/contexto-projeto.md), as três áreas e o que o corte tirou.
3. [`docs/engenharia/00-indice.md`](docs/engenharia/00-indice.md), índice dos artefatos com status.
4. [`docs/engenharia/word/00-como-montar.md`](docs/engenharia/word/00-como-montar.md), a ordem de
   colagem no Word e a troca das figuras da seção 4.5.
