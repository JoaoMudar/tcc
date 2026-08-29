# Viveiro Mudar: Ecossistema de Gestão

Sistema integrado de gestão para um viveiro de mudas nativas no Alto Vale do Itajaí (SC).
Área de ~10.000 m², equipe de 9 pessoas e venda no atacado via WhatsApp.

O sistema tem **três áreas de negócio**, Cadastro único, Produção e Comercial, com Acesso e
Configurações atravessando as três, e é operado por **três pessoas**: chefia, gerência e
administrador.

O foco é trocar o "tudo de cabeça" por **dados estruturados**, com interfaces extremamente
simples e **mobile-first**: os usuários finais não são técnicos e o celular é o dispositivo
principal de uso no campo.

---

## Stack

| Camada            | Tecnologia                                                        |
| ----------------- | ----------------------------------------------------------------- |
| Frontend          | Next.js 16 (App Router) + React 19 + Tailwind CSS                 |
| Backend           | Server Actions com SQL direto (`pool.query`)                      |
| Banco de dados    | PostgreSQL: **local em dev**, **Neon (cloud) na produção/Vercel**; driver escolhido pelo host |
| Autenticação      | Sessão própria por cookie (scrypt + tokens SHA-256)               |
| Mobile            | PWA (manifest + service worker, fila de sync offline)             |
| Linguagem         | TypeScript                                                        |
| Testes            | Vitest (unitários)                                                |

---

## Como rodar localmente

Pré-requisitos: **Node.js 20+** e um **PostgreSQL local** acessível (ex.: instância do pgAdmin).
Na produção (Vercel) o banco é o **Neon**: basta apontar a `DATABASE_URL` de cada ambiente;
o driver certo é escolhido automaticamente pelo host (`*.neon.tech` → driver serverless).

```bash
# 1. Instalar dependências
npm install

# 2. Configurar a conexão com o banco local (.env.local)
echo 'DATABASE_URL=postgresql://postgres:<senha>@localhost:5432/viveiro' > .env.local

# 3. Rodar as migrações
npm run db:migrate

# 4. Criar o primeiro usuário administrador
npm run db:seed-admin

# 5. Subir o ambiente de desenvolvimento
npm run dev
```

A aplicação fica disponível em `http://localhost:3000`. O login é exigido em todas as rotas
(o middleware redireciona para `/login`).

---

## Scripts

| Comando                     | Descrição                                            |
| --------------------------- | ---------------------------------------------------- |
| `npm run dev`               | Servidor de desenvolvimento                          |
| `npm run build`             | Roda migrações e faz o build de produção             |
| `npm start`                 | Servidor de produção                                 |
| `npm run lint`              | ESLint sobre `src/`                                  |
| `npm test`                  | Testes unitários (Vitest)                            |
| `npm run db:migrate`        | Aplica migrações pendentes                           |
| `npm run db:migrate:status` | Mostra o estado das migrações                        |
| `npm run db:migrate:mark`   | Marca migrações como aplicadas (sem executá-las)     |
| `npm run db:seed-admin`     | Cria o usuário administrador inicial                 |

---

## Estrutura do projeto

```
docs/              Documentação de referência (ver docs/README.md, mapa de tudo)
migrations/        Migrações SQL (psql puro), aplicadas em ordem cronológica
data/seeds/        Fontes de carga inicial (seed), ex.: export das 142 espécies
plans/             Roadmap de implementação, em quatro fases
scripts/           migrate.ts, seed-admin.ts, geração de ícones, hooks de git
src/
  app/             Rotas (App Router), organizadas pelas três áreas
    cadastros/     1 · Espécies, recipientes, insumos, pessoas, tipos de tarefa, protocolos
    producao/      2 · Ainda sem tela: agenda, lotes, protocolo e mapa
    pedidos/       3 · Cadastro de pedidos
    clientes/ fornecedores/  1 · As telas de cada papel da mesma pessoa
    configuracoes/ Período de trabalho e parâmetros do sistema
    admin/         Usuários e sessões
    login/ logout/ conta/ trocar-senha/   Fluxo de autenticação
    api/           Endpoints (notificações, fotos de espécie)
  components/      Componentes compartilhados (Toast, Autocomplete, sino de notificações)
  lib/             db, auth, orders, permissions, modules, offline-queue, utilitários
  middleware.ts    Proteção de rotas por sessão
```

---

## Perfis de acesso

São três papéis, e correspondem às três pessoas que operam o sistema:

- **admin**: acesso total, incluindo gestão de usuários e sessões
- **chefia**: cadastros, pedidos e parâmetros do sistema
- **gerencia**: agenda da semana, lotes, protocolo e mapa

> **Não há perfil de campo.** Os seis colaboradores do viveiro não operam o sistema: o trabalho
> deles é planejado e confirmado pela gerência. Eles existem em `cadastro.party_roles` com o papel
> `funcionario`, que diz *esta pessoa trabalha aqui* e não implica acesso. A matriz completa está em
> [`docs/engenharia/D-arquitetura/D4-matriz-rbac.md`](docs/engenharia/D-arquitetura/D4-matriz-rbac.md).

---

## Funcionalidades implementadas

- **Acesso:** autenticação, troca de senha no primeiro acesso, sessões ativas, usuários e perfis.
- **Cadastro único:** espécies (com nomes populares e foto), recipientes, insumos, e as pessoas
  com os seus papéis de cliente, fornecedor e funcionário.
- **Comercial:** cadastro de pedidos e listagem.

O pedido percorre três situações: `rascunho → confirmado`, com `cancelado` à parte. Confirmado, ele
não aceita mais alteração de item.

**Falta construir a Produção inteira**, e é a maior parte do que resta: agenda da semana, lotes e
movimentos, protocolo por lote e mapa. O modelo de dados dela está no banco; o que falta é tela.

---

## Roadmap

Quatro fases, e a ordem importa.

```
Fase 1 (acesso e cadastro) ─┬─> Fase 2 (lotes) ─┬─> Fase 4 (mapa e pedido)
                            └─> Fase 3 (agenda e protocolo) ─┘
```

**A Fase 1 bloqueia tudo**: a agenda escala pessoas, o lote referencia espécie e canteiro, e o
pedido referencia pessoa. **O mapa é o último a funcionar**, porque depende das duas fontes de
pendência, a atribuição lançada à mão e a ordem gerada pelo protocolo.

O plano detalhado, tarefa a tarefa, está em
[`plans/P1-sistema-reduzido.md`](plans/P1-sistema-reduzido.md).

---

## Banco de dados

- O schema é **compartilhado entre todos os projetos**.
- Toda alteração deve ser um arquivo `.sql` em `migrations/` (compatível com `psql` puro),
  manter compatibilidade retroativa e ser documentada.
- A entidade central é a **espécie**: quase tudo se relaciona a ela.
- PostgreSQL: **local no desenvolvimento** (pgAdmin/`localhost`) e **Neon (cloud) na produção/Vercel**.
- Conexão via `DATABASE_URL`; pool singleton em `src/lib/db.ts`. O driver é escolhido pelo
  **host** da URL: `*.neon.tech` → `@neondatabase/serverless`; qualquer outro → `pg`
  (mesmo critério de `scripts/migrate.ts`). Importar como `import pool from '@/lib/db'`.
  Nunca usar o pool no lado cliente.

---

## Convenções

- Arquivos e identificadores em inglês; comentários podem ser em português.
- Tabelas: `snake_case` no plural (ex.: `species`, `loss_events`).
- Commits: Conventional Commits em português (ex.: `feat(pedidos): adiciona separação por cargas`).
- **Toda alteração de código deve incluir testes** (`*.test.ts` em `__tests__/`).
  O pre-commit hook roda lint e testes: commits são bloqueados se algo falhar.
- Formulários de campo: no máximo 5 campos por tela, dropdowns pré-definidos, botões grandes
  e feedback visual imediato.

Mais detalhes e regras de negócio em [`CLAUDE.md`](CLAUDE.md).
