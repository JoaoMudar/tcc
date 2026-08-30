# Viveiro Mudar: Ecossistema de Gestão

> 📂 **Mapa de toda a documentação em [`docs/README.md`](docs/README.md)**, comece por aí para se situar.
> Contexto completo (as três áreas, o que a redução de escopo cortou, princípios de formulário de
> campo) em `docs/contexto-projeto.md`. Rotinas de negócio em `docs/rotinas/`.
> **Registro das divergências** em `docs/auditoria-divergencias.md`: é histórico, e cita
> identificadores que já não existem, de propósito.

## Projeto
Sistema de gestão para viveiro de mudas nativas (Alto Vale do Itajaí, SC). ~10.000 m², 9 pessoas, venda atacado via WhatsApp.

**Contexto que molda decisões:**
- Usuários (Gilberto, Débora, João) **não são técnicos** → interfaces extremamente simples.
- **Mobile-first**: celular é o dispositivo principal; offline desejável (PWA).
- Empresa operou sempre sem dados estruturados; não há controle de lotes, perdas nem estoque.
- **Três perfis operam o sistema**: chefia, gerência e administrador. Os seis colaboradores de
  campo **não têm acesso**: o trabalho deles é planejado e confirmado pela gerência.

## Stack
- **Banco**: PostgreSQL. **Dev = Postgres local** (pgAdmin, `localhost:5432`); **produção/Vercel = Neon** (cloud, `sa-east-1`). O driver é escolhido pelo **host da `DATABASE_URL`** em `src/lib/db.ts` (mesmo critério de `scripts/migrate.ts`): host `*.neon.tech` → `@neondatabase/serverless` (evita esgotar conexões no serverless); qualquer outro host → `pg` (pool TCP). Ou seja, basta apontar `DATABASE_URL` para o banco certo em cada ambiente, não depende de `NODE_ENV`. Pool singleton → `import pool from '@/lib/db'`. Nunca usar no client, só Server Components/Actions.
  - Env: `DATABASE_URL`, local: `postgresql://postgres:<senha>@localhost:5432/viveiro`; Vercel/Neon: `postgresql://<user>:<senha>@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require` (definida no painel da Vercel, não no `.env.local`)
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind. TypeScript em todo o ecossistema.
- **Dados**: Server Actions com SQL direto (`pool.query`).
- **Infra**: PWA mobile, deploy VPS/local. **Sem integração com WhatsApp**: a negociação é conversa entre pessoas, e o pedido é registrado depois, à mão.
- **Fotos de espécies**: linha em `species_photos` (BYTEA), referenciada por `species.photo_url` no formato `/api/fotos/<uuid>`. **Não gravar em `public/uploads/`**: o filesystem da Vercel é somente-leitura fora de `/tmp` e é descartado a cada deploy, ou seja, o upload em disco nunca funcionou em produção (migration `20260811000001_species_photos.sql`). Ganho colateral: a imagem entra no mesmo backup do banco.

## Banco de dados (schema compartilhado entre projetos)
Toda alteração no banco: (1) arquivo `.sql` em `migrations/` (psql puro), (2) manter compatibilidade retroativa, (3) documentar no CHANGELOG. Tabelas: snake_case, plural (`species`, `batches`, `batch_movements`).

**O modelo de dados tem três documentos que andam juntos.** Mexeu em entidade, atributo, chave ou
cardinalidade, atualize os três na mesma alteração:
`docs/engenharia/C-modelagem/C6-modelo-entidade-relacionamento.md` (MER),
`docs/engenharia/C-modelagem/C8-dicionario-de-dados.md` (dicionário) e
`docs/engenharia/modelo-dados-pt/` (as mesmas figuras em português, para o TCC).
O `modelo-dados-pt` é **fonte separada e renderizada à mão**: nenhum gerador passa por ele. Edite o
`.mmd` da figura, regere o `.png` com o comando do
[`README`](docs/engenharia/modelo-dados-pt/README.md) e rode `node scripts/mede-figuras.mjs` para
conferir a fonte útil, que muda quando a figura muda de proporção. Depois,
`node scripts/confere-modelo-pt.mjs`: ele compara o **conjunto** de arestas das figuras com o do
`C6`, nos dois sentidos, e é o que pega a aresta perdida numa divisão de figura.

**A fonte da verdade do modelo é a migration.** Onde `C6` ou `C8` discordarem do SQL, quem está
errado é o documento. O que ainda não existe no banco vem marcado como *especificado, não
implementado*, e é assim que a intenção fica registrada sem se passar por descrição.

**Documento que resume outro não se escreve à mão.** Cinco tabelas do trabalho são geradas, e rodar
o script é parte de alterar o artefato de origem: `build-b3-derivado.mjs`, `build-b4-quadros.mjs`,
`build-b5-matriz.mjs`, `build-e2-cobertura.mjs` e `mede-figuras.mjs`. Depois de qualquer alteração
em requisito, regra, caso de uso ou teste, rode `node scripts/verifica-rastreabilidade.mjs`: ele
confere, nos dois sentidos, os identificadores citados contra os definidos.

## Convenções de código
- Arquivos/código em inglês; comentários podem ser em português.
- Componentes React PascalCase (1 por arquivo); hooks `useNome.ts`; utils camelCase; rotas API kebab-case.
- Commits: Conventional Commits em português (ex: `feat(custeio): adiciona cálculo de custo`).

## Escrita
- **Nunca usar travessão (—).** Vale para docs, comentários, commits e respostas. Use vírgula, dois-pontos, ponto ou parênteses.
- Explicação curta. Diga o que mudou e o que o usuário precisa saber; corte o resto.

## Regras de negócio
- **Espécie** é a entidade central: tudo gira em torno dela.
- **Recipientes** (tubete, sacos 10x18 / 17x22 / 20x26 / 28x32, balde) definem o tamanho da muda e
  determinam o **protocolo de manejo** que o lote segue.
- **Lote** é a leva plantada junta num canteiro: um lote ocupa um canteiro, e um canteiro comporta
  vários lotes. É o que diz **onde** a muda está e **de que leva** ela veio.
- **Todo movimento do lote passa pela mesma porta**: perda, repicagem, venda, ajuste de contagem e
  transferência são linhas de `batch_movements`. A soma delas tem de reproduzir o saldo.
- **Mortalidade** acima do limite definido em Configurações, inicialmente 20%, destaca o lote.
- **Preço é digitado no item do pedido.** O sistema registra por quanto se vendeu; não calcula custo,
  margem nem piso.
- **Canais de venda**: atacado (padrão), compensação ambiental, paisagismo, prefeitura, varejo.
- **A agenda registra o turno, e não a hora.** Não há apontamento por relógio: seria controle de
  ponto, e está fora do escopo.

## Workflow
1. Ler o plan file em `plans/P{N}-*.md`; implementar task por task marcando `[x]` ao concluir cada uma.
2. Garantir a branch correta (ver abaixo) antes de editar.
3. `npm test` antes de commitar: o pre-commit hook roda lint+testes e bloqueia se falhar.
4. Ao finalizar: resumo com o que foi feito, arquivos alterados, decisões técnicas e pendências.

## Testes obrigatórios
- Toda alteração de código inclui testes. Vitest unit em `__tests__/` ao lado do código (`*.test.ts`).
- Cobrir: utils, lógica de negócio, validações. Server Actions que dependem do DB: mockar imports com `vi.mock`.

## Branch, commit e segurança
- **NUNCA** trabalhe direto em `main`/`master`. Antes de editar: `git branch --show-current`; se estiver em main/master, **pare** e crie `git checkout -b feat/nome-da-tarefa`. (Detalhes em `docs/fluxo-claude-code-git.md`.)
- Sem autorização explícita do usuário, **nunca**: faça merge para main, `git push --force`, `git reset --hard`, delete branches, ou altere `.claude/settings.json`/hooks.
- Nunca commite `.env`, credenciais, tokens ou dumps sensíveis.
