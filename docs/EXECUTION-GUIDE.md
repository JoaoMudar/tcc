# Guia de Execução

> Reescrito em **28/08/2026**, com a redução de escopo. As duas versões anteriores descreviam
> cronogramas que a realidade não seguiu: a primeira, quatro meses de P1 a P10; a segunda, uma
> ordem de quinze projetos em que o custeio deixou de ser o primeiro. Este guia parte de onde o
> projeto **está**, não de onde se planejou que estivesse.
>
> O planejamento original está preservado no histórico do git, e serve ao TCC como material sobre
> a diferença entre planejado e executado, que é um resultado do trabalho e não um acidente dele.

## Estrutura real do repositório

```
viveiro-mudar/
├── CLAUDE.md                  ← regras, carregado em toda sessão
├── docs/
│   ├── README.md              ← mapa da documentação (entrada)
│   ├── auditoria-divergencias.md  ← registro histórico das divergências e do corte de escopo
│   ├── contexto-projeto.md    ← as três áreas, o corte e o estado do projeto
│   ├── rotinas/               ← domínio, em linguagem de negócio
│   └── engenharia/            ← artefatos formais (base do Cap. 4 do TCC)
├── plans/                     ← P1…P13, roadmaps de implementação
├── migrations/                ← SQL puro, ordem cronológica
├── data/seeds/                ← cargas iniciais
├── scripts/                   ← migrate, seeds, refresh do banco local, build do TCC
└── src/                       ← Next.js App Router
```

## Onde o projeto está

| | Fase | Estado |
|---|---|---|
| 🟡 | **Fase 0** Fundação técnica | na `master`: projeto, banco, migrations, `test:db`, hook, CI (obrigatório no PR) e casca prontos; falta publicar na Vercel com Neon |
| ⬜ | **Fases 1 a 3** Acesso, Configurações e Cadastro único | modelo no banco, nenhuma tela |
| ⬜ | **Fases 4 a 7** Lotes, agenda, protocolo e mapa | lote e agenda no banco; protocolo só especificado |
| ⬜ | **Fases 8 a 10** Comercial, PWA e operação | pedido no banco, nenhuma tela |

**Em 14/09/2026 o código recomeçou do zero neste repositório.** O que as versões anteriores deste
guia davam como pronto era o aplicativo antigo em inglês, noutro repositório, e não é herdado.

**A redução de escopo de 28/08/2026 é o que mudou o quadro.** Custeio, precificação, financeiro,
cotação e superfície pública saíram da especificação, e com eles a maior parte do que este guia
listava como não iniciado. O que restou está detalhado, tarefa a tarefa, em
[`plans/P1-sistema-reduzido.md`](../plans/P1-sistema-reduzido.md).

## Ordem recomendada a partir daqui

A ordem tem um motivo concreto: **o Cadastro único alimenta as outras duas áreas e não consome
nada**, e o mapa de lotes depende das duas fontes de pendência, a atribuição lançada à mão e a
ordem gerada pelo protocolo. Construir o mapa antes produz uma tela que mostra todo lote como
saudável, que é o contrário do que ela existe para fazer.

```
1. Fase 1  - areas e canteiros, tipos de tarefa, Configuracoes
2. Fase 2  - lote, movimentos, perda, contagem, saldo disponivel
3. Fase 3  - agenda da semana, confirmacao, protocolo e o motor de ordens
4. Fase 4  - mapa de lotes, preco no item, confirmacao do pedido
```

As fases 2 e 3 podem correr em paralelo depois da 1: a agenda depende de pessoas e tipos de
tarefa, e o lote depende de espécie e canteiro, e as duas coisas saem da Fase 1. O detalhamento
por tarefa está em [`plans/P1-sistema-reduzido.md`](../plans/P1-sistema-reduzido.md).

## Como conduzir uma sessão

1. **Confirmar a branch.** `git branch --show-current`. Se estiver em `main`, parar e criar
   `git checkout -b feat/nome-da-tarefa`. Nunca editar direto na main.
2. **Ler o plan file da fase** e a rotina de domínio correspondente em `docs/rotinas/`.
3. **Conferir a auditoria.** Plano antigo pode estar à frente ou atrás do sistema real. Ver
   [`auditoria-divergencias.md`](auditoria-divergencias.md).
4. **Uma task por vez**, marcando `[x]` no plan file ao concluir. O plan file é o checkpoint
   entre sessões.
5. **Testes junto com o código.** Vitest em `__tests__/` ao lado do arquivo. Server Action que
   depende do banco: mockar com `vi.mock`.
6. **`npm test` antes de commitar**: o hook de pre-commit roda lint + testes e bloqueia se falhar.
7. **Fechar com resumo**: o que foi feito, arquivos alterados, decisões técnicas e pendências.

## Comandos

| Comando | Para quê |
|---|---|
| `npm run dev` | sobe a aplicação |
| `npm test` | roda os testes (obrigatório antes do commit) |
| `npm run db:migrate` | aplica as migrations pendentes |
| `npm run db:migrate:status` | mostra o que está pendente |
| `npm run db:refresh-local` | espelha o Neon num Postgres local descartável |
| `npm run db:seed-admin` | cria o usuário administrador |
| `npm run docs:tcc` | regenera `docs/engenharia/word/` com os diagramas em PNG |

## Bancos

**São dois, e o driver é escolhido pelo host da `DATABASE_URL`**: não pelo `NODE_ENV`:

| Ambiente | Banco | Driver |
|---|---|---|
| Desenvolvimento | Postgres local (`localhost:5432`) | `pg`, pool TCP |
| Produção (Vercel) | Neon, `sa-east-1` | `@neondatabase/serverless` |

> **Neon é só o banco.** É Postgres gerenciado, e nada além disso: não há função de borda,
> armazenamento de arquivo, canal de tempo real nem identidade de usuário dentro do banco.
>
> **Por isso o controle de acesso não é RLS**, e não adianta ligar: a aplicação conecta com um
> papel só, o da `DATABASE_URL`, que é dono das tabelas, e dono ignora política de linha. Uma
> policy não teria sobre o que discriminar, e fazê-la funcionar significaria duplicar a matriz de
> acesso em SQL. O controle é a checagem de perfil dentro da Server Action, com
> `src/lib/permissions.ts` como fonte única, conforme a
> [Matriz RBAC (D4)](engenharia/D-arquitetura/D4-matriz-rbac.md).
>
> **Arquivo também não vai para disco**: o filesystem da Vercel é somente-leitura fora de `/tmp` e
> some a cada deploy. Foto vira linha no banco, servida por rota (`species_photos` +
> `/api/fotos/[id]`).

Toda migration aplicada no local precisa ser aplicada também no Neon antes do deploy.

## Trabalho de campo em paralelo

Parte de cada plano não depende de código, é levantamento que a equipe faz no viveiro, na
seção "Dados que a Equipe de Campo Precisa Levantar" de cada plan file. O levantamento de
custos do P1 é o mais crítico de todos: é a dependência-raiz do indicador IND-02 e, por
tabela, de toda a análise de margem
([`E3`, risco R-01](engenharia/E-qualidade/E3-analise-de-riscos.md)).
