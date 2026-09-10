# Auditoria de divergências: docs × planos × código

> Feita em **10/08/2026**, antes de retomar o desenvolvimento. Objetivo: colocar toda a
> documentação na mesma linha, para que nenhum plano mande construir algo que o sistema
> real não comporta.
>
> Método: leitura dos planos, das rotinas e dos artefatos de engenharia, e conferência contra
> `migrations/`, `src/` e `package.json`. *(Eram 13 planos, 9 rotinas e 17 artefatos na primeira
> passada; as contagens mudaram e não são mantidas aqui.)*
>
> **Sequência:** as correções apontadas aqui foram executadas em 10–11/08/2026, e as passadas
> seguintes estão registradas ao fim do arquivo, até a **sétima, de 26/08/2026**, que fechou os
> achados que tinham sido apenas *marcados*. O que ficou pendente está em
> [`divida-tecnica.md`](divida-tecnica.md).
>
> **O que este documento não guarda:** a diferença entre o modelo especificado e o implementado.
> Essa conta vive em [`C6 §2.1`](engenharia/C-modelagem/C6-modelo-entidade-relacionamento.md) e na
> seção *Recorte implementado* de [`C8`](engenharia/C-modelagem/C8-dicionario-de-dados.md), que são
> mantidos junto do modelo. Havia aqui uma cópia dela, o antigo achado I, e ela envelheceu três
> vezes: foi retirada em 26/08/2026.

> ---
>
> ⚠️ **A redução de escopo de 28/08/2026 superou boa parte deste arquivo.** O sistema passou de
> quatro módulos para três áreas de negócio, de quatro perfis para três, e de 62 entidades para 27.
> Os achados **D** (colaborador × funcionario), **G** (dois documentos definindo indicadores),
> **K** (taxonomias de módulo concorrentes) e **M** (um lote por canteiro) tratam de estruturas que
> deixaram de existir, e ficam aqui como registro do que se decidiu, não como pendência a resolver.
> A oitava passada, ao final do arquivo, descreve o corte e o que ele fechou.
>
> **Este é um registro, e registro não se reescreve.** Os identificadores de requisito, regra e caso
> de uso citados abaixo são os da numeração da época, e muitos já não existem. Por isso o arquivo
> está na lista de exceções de `scripts/verifica-rastreabilidade.mjs`: corrigi-lo para satisfazer a
> conferência produziria uma auditoria que descreve um passado que não aconteceu.

## Resumo

| # | Divergência | Situação |
|---|---|---|
| [A](#a--stack-fantasma-supabase-em-6-planos) | 6 planos escritos para uma stack (Supabase) que foi abandonada | ✅ resolvido 26/08 |
| [B](#b--tarefa-marcada-como-feita-que-foi-desfeita) | `P1 T1.8` marcado `[x]` para RLS, que a migration seguinte removeu | ✅ resolvido 26/08 |
| [C](#c--cabeçalho-de-status-mentindo) | `P1` diz "NÃO INICIADO" com 16 de 32 tarefas feitas | ✅ resolvido 26/08 |
| [D](#d--colaborador-nos-docs--funcionario-no-banco) | Perfil chamado `colaborador` nos docs e `funcionario` no banco | 🟡 falta só conferir o Neon |
| [E](#e--roadmap-desatualizado-em-três-lugares) | Roadmap P1→P10 repetido em 3 arquivos, sem P11, P12 e P13 | ✅ resolvido 26/08 |
| [F](#f--execution-guide-fossilizado) | `EXECUTION-GUIDE.md` descreve um cronograma que a realidade não seguiu | ✅ resolvido 10/08 |
| [G](#g--dois-documentos-definindo-os-mesmos-indicadores) | `P6` e `G2` definem indicadores diferentes para a mesma tela | ✅ resolvido 26/08 |
| [H](#h--pendências-já-registradas-do-p13) | Agenda de pessoal e cadastro único ainda não estão na engenharia | ✅ resolvido 19/08 |
| [J](#j--migrations-marcadas-como-aplicadas-que-nunca-rodaram) | Duas tabelas do P1 registradas em `_migrations` e inexistentes nos dois bancos | ✅ corrigido 11/08, prevenção em aberto |
| [K](#k--sete-taxonomias-de-modulo-concorrentes) | Sete agrupamentos diferentes dos mesmos módulos, e o código não seguia nenhum | ✅ resolvido 19/08, conferido 26/08 |
| [L](#l-lote-excluído-em-três-documentos-e-assumido-num-plano-24082026) | "Lote" fora de escopo em `A1`, `A2` e `C2`, e assumido pelo `P2` | ✅ resolvido 24/08 |
| [M](#m-um-lote-por-canteiro-que-o-viveiro-nunca-praticou-26082026) | Um lote por canteiro, regra que o viveiro nunca praticou | ✅ resolvido 26/08 |
| [N](#n-as-fotos-de-espécie-mudaram-de-lugar-e-o-claudemd-não-soube-26082026) | `CLAUDE.md` mandava gravar foto em `public/uploads/`, desfeito desde 11/08 | ✅ resolvido 26/08 |

> A letra **I** não aparece mais: era "o que não é divergência", e foi retirada em 26/08/2026
> (ver o cabeçalho). As letras não são reaproveitadas.

---

## A: Stack fantasma (Supabase em 6 planos)

O projeto **não usa Supabase**. Usa PostgreSQL direto (`pg` local / `@neondatabase/serverless`
em produção) com Server Actions do Next.js. A própria migration diz isso:

```
migrations/20260413000002_p1_rls.sql
-- RLS removido — projeto usa PostgreSQL local sem autenticação Supabase.
-- Controle de acesso será feito na camada de aplicação (Next.js) quando necessário.
```

Mesmo assim, seis planos ainda mandam construir sobre Supabase:

| Plano | Onde | O que manda fazer |
|---|---|---|
| P1 | T1.18, linha 127 | Edge Function `calculate-species-cost`; Supabase Realtime |
| P2 | T2.8, T2.14, linha 150 | RLS policies; Edge Function `check-mortality-alerts`; Supabase Storage |
| P3 | T3.8, T3.9, T3.10 | três Edge Functions de precificação |
| P5 | linha 83, T5.14, linha 134 | webhooks do Supabase disparando o n8n |
| P6 | T6.6, T6.11, linhas 166-167 | Edge Function `dashboard-summary`; Realtime; "Supabase views" |
| P7 | T7.2 | bucket `species-photos` no Supabase Storage |
| P9 | linha 71 | Supabase Edge Function + Resend para o formulário de contato |

**Conflito adicional:** P7 quer as fotos no Supabase Storage; o `CLAUDE.md` diz
`public/uploads/especies/`. *(Em 26/08/2026 descobriu-se que **nenhum dos dois** descrevia o
código: a foto virou linha em `species_photos` em 11/08/2026, servida por `/api/fotos/[id]`. Ver o
achado N.)*

**Equivalência na stack real:** Edge Function → Server Action ou rota de API; RLS → verificação
de perfil na Server Action (é o que `D4` já especifica); Realtime → `revalidatePath` ou polling;
Storage → linha no banco servida por rota; webhook do Supabase → chamada HTTP a partir da própria
Server Action.

> ✅ **Resolvido em 26/08/2026.** A decisão de 10/08 tinha sido *marcar, não reescrever*: um banner
> de tradução no topo dos sete planos. Quinze dias depois ficou claro que **quem implementa lê a
> tarefa, e não o banner**, e que a tabela de tradução do próprio banner já estava errada num item
> (mandava `public/uploads/`, ver achado N). Os sete banners saíram e as quinze tarefas e notas
> foram reescritas na stack real. Sobra uma menção a Supabase em `plans/`, a do `P14 §Reconciliação`,
> que é registro histórico e não instrução.

## B: Tarefa marcada como feita que foi desfeita

`plans/P1-custeio-por-especie.md` linha 76:

```
- [x] **T1.8** Criar RLS policies: apenas usuários autenticados leem/escrevem. Admin full access.
```

A migration correspondente não cria política nenhuma, remove o conceito. O `[x]` afirma uma
proteção que não existe. É o tipo de marca que, mantida, faz alguém assumir que o banco tem
defesa própria e escrever uma Server Action sem checar perfil.

> ✅ **Resolvido em 26/08/2026, com o veredicto que faltava.** Em 10/08 a tarefa foi desmarcada e
> riscada, o que deixava a pergunta em aberto: *e no Neon, precisa?* **Não precisa, e não
> funcionaria.** A aplicação conecta com um papel só, o da `DATABASE_URL`, a partir do servidor:
> não há identidade de usuário dentro do banco sobre a qual uma política pudesse discriminar; fazê-la
> funcionar significaria reescrever a matriz `D4` em SQL, com duas fontes da verdade para a mesma
> regra; e o papel de conexão é **dono** das tabelas, e dono ignora RLS sem `FORCE ROW LEVEL
> SECURITY`, de modo que a `DATABASE_URL` vazada continua abrindo tudo. Conferido no banco em
> 26/08/2026: nenhuma tabela com RLS ligado, nenhuma política, papel `postgres` dono de todas.
>
> O raciocínio está gravado em [`D4 §4.1`](engenharia/D-arquitetura/D4-matriz-rbac.md), e não aqui,
> porque é lá que a pergunta é feita. A `T1.8` deixou de ser tarefa riscada e voltou a ser tarefa:
> *aplicar a checagem de perfil da `D4` em cada Server Action de custeio*.

## C: Cabeçalho de status mentindo

| Plano | Cabeçalho diz | Caixas marcadas | Realidade |
|---|---|---|---|
| **P1** | `## Status: NÃO INICIADO` | 16 de 32 | tabelas, view e todos os CRUDs prontos; falta o motor de cálculo |
| **P12** | Fase 0 concluída | 1 de 7 | correto |
| **P11** | bloco `📌 STATUS`, datado e detalhado | 25 de 25 | correto: só não usa o formato `## Status:` dos demais |
| P2…P10 | NÃO INICIADO | 0 | correto |

Só o **P1** afirma algo falso. O P11 usa um formato próprio de status, mais rico que o dos
outros; a inconsistência é de forma, não de conteúdo.

> ✅ **Resolvido em 26/08/2026, na segunda tentativa.** A correção de 10/08 trocou "NÃO INICIADO"
> por "PARCIAL, 16 de 32 tarefas", e o número estava errado: **32 é o total de caixas do arquivo**,
> que soma as 20 tarefas `T1.x` com 7 itens de levantamento de campo e 5 critérios de aceite, e as
> marcadas eram 15, não 16. O cabeçalho passou a contar o que interessa, *15 das 20 tarefas de
> desenvolvimento*, e a explicar de onde vinham as outras doze caixas. Lição pequena e cara:
> **contagem de caixa em markdown precisa dizer quais caixas está contando.**

## D: `colaborador` nos docs × `funcionario` no banco

```sql
-- migrations/20260521000001_auth_users_sessions.sql
CREATE TYPE user_role AS ENUM ('admin', 'chefia', 'gerencia', 'funcionario');
```

Toda a documentação: `00-mapa-de-rotinas`, `D4 Matriz RBAC`, `C1 Casos de uso`,
`G2 Indicadores`, `B2 Requisitos`: chama esse perfil de **Colaborador**. A palavra
`colaborador` não aparece em uma linha de código.

O problema piora com o [cadastro único](rotinas/1-cadastros/00-visao-geral.md): lá, `funcionario` é um
**papel de cadastro** (`cadastro.party_roles`), que significa "é nosso empregado", e existe
para gente que não tem login nenhum. Passa a haver dois `funcionario` com sentidos diferentes:

| Termo | Onde | Significa |
|---|---|---|
| `user_role = 'funcionario'` | `users` | nível de acesso mais baixo do app |
| `party_roles.role = 'funcionario'` | `cadastro.party_roles` | esta pessoa trabalha aqui |

Gilberto é chefia no primeiro sentido e funcionário no segundo. Sem desambiguar, a matriz RBAC
e o cadastro vão brigar na primeira consulta que juntar os dois.

> 🟡 **Conferido em 26/08/2026: a regra está de pé, e falta um passo operacional.** O padrão é
> `users.role = 'colaborador'` para nível de acesso, `party_roles.role = 'funcionario'` para vínculo
> empregatício, e `funcionario` como **recurso** da matriz de permissões (quem pode ver a lista).
> O banco local confirma o enum `admin · chefia · gerencia · colaborador`; `src/lib/parties.ts`,
> `modules.ts` e `permissions.ts` usam `funcionario` só nos dois sentidos certos; `C8` e o cabeçalho
> de `20260811000004_cadastro_unico_parties.sql` declaram a desambiguação por escrito.
>
> **O que falta é conferir o Neon**, e não se resolve desta máquina: a `DATABASE_URL` local aponta
> para `127.0.0.1` e a de produção vive no painel da Vercel. Rodar
> `DATABASE_URL="<neon>" npm run db:migrate:status` e confirmar
> `20260810000001_rename_role_funcionario_to_colaborador.sql` aplicada antes do próximo deploy.

## E: Roadmap desatualizado em três lugares

O diagrama `P1 → P10` está copiado em `CLAUDE.md`, `docs/contexto-projeto.md` e
`docs/README.md`. Nenhuma das três cópias inclui **P11** (concluído), **P12** (em curso) ou
**P13** (novo). O `docs/README.md` já ganhou uma tabela complementar nesta rodada; as outras duas
continuam mostrando só o encadeamento original.

A ordem real de execução também não foi a planejada: o que se construiu primeiro foi
Pedidos/Clientes/Fornecedores: que sequer existiam no roadmap original.

> ✅ **Resolvido em 26/08/2026.** A correção de 10/08 elegeu `contexto-projeto.md` como fonte, mas
> **deixou a cópia no `docs/README.md` viva ao lado do ponteiro**, e ela envelheceu de novo: seguia
> em P1→P10 enquanto a fonte já ia a P13. Agora a cópia saiu de vez, e o `README` só aponta. A
> fonte ganhou **P14** e **P15**, o estado real de cada projeto e o elo que falta reescrito: a
> agenda de pessoal já **tem banco** desde 24/08, o que não tem é tela. `CLAUDE.md` passou a dizer
> "P1 a P15", sem repetir a lista.
>
> A lição é a mesma do achado A: **ponteiro ao lado de cópia não é ponteiro, é uma segunda fonte**.

## F: `EXECUTION-GUIDE` fossilizado

`docs/EXECUTION-GUIDE.md` descreve um cronograma de 4 meses, sessão por sessão, de P1 a P10.
Três problemas:

1. **A realidade não seguiu.** "Sprint 1 Sessão 2: P2 Fase 1" nunca aconteceu; P2 está zerado
   e o que se construiu foi P11.
2. **A árvore de arquivos está errada**: não mostra `migrations/`, `docs/rotinas/`,
   `docs/engenharia/`, `data/seeds/`.
3. **Não menciona** os testes obrigatórios nem o hook de pre-commit, que hoje são regra do
   `CLAUDE.md` e bloqueiam commit.

## G: Dois documentos definindo os mesmos indicadores

| | `G2: Fichas de indicadores` | `P6: Dashboard` |
|---|---|---|
| Quantos | 9 (IND-01 a IND-09) | "5-7, a definir" |
| Especificação | fórmula, fonte, janela, meta, faixas, responsável | lista de nomes |
| Painel por perfil | definido (chefia 9, gerência 4, colaborador nenhum) | não trata |
| Regra de mês aberto | travessão, nunca zero (RF-61) | não trata |

São a mesma tela especificada duas vezes, e `P6` é a versão mais fraca e mais antiga. Quem
implementar o dashboard lendo só o plano vai construir a coisa errada.

> ✅ **Resolvido em 26/08/2026.** Em 10/08 o `P6` ganhou um aviso no topo dizendo "implemente pelo
> `G2`, as listas abaixo ficam como histórico". As listas continuaram ali, no corpo, exatamente onde
> se lê ao implementar. Agora foram **substituídas**: `T6.6` devolve as nove fichas IND-01 a IND-09
> com a fonte de dados de cada uma, `T6.7` monta o painel pelo perfil do `G2 §6` (chefia as nove,
> gerência IND-01, 02, 03 e 05, colaborador nenhuma), os critérios de aceite passaram a exigir a
> fórmula da ficha e o travessão de mês não fechado (RF-61), e o item de campo que mandava
> *"escolher os 5-7 indicadores mais importantes"* virou *confirmar meta e faixa dos nove que já
> foram escolhidos*. A Fase 3, que não tem ficha, ficou marcada como **fora das nove**, com a regra
> de que ganhar ficha no `G2` é pré-requisito para virar indicador.

## H: Pendências já registradas do P13

Cadastro único e agenda de pessoal ainda não constam da engenharia: faltam ~8 RF em `B2`, o
subsistema Cadastros em `C1`, quatro entidades em `C6`/`C8`, a regra do colaborador em `D4` e
as linhas novas em `B5`. Lista completa em
`plans/P13-producao-agenda-cadastros.md`, apagado na redução de escopo.

> ✅ **Resolvido em 19/08/2026**: RF-69 a RF-76 no `B2`, RN-48 a RN-55 no `B3`, UC-41 a UC-44 no
> `C1`, as quatro entidades da agenda em `C6`/`C8`, a regra §3.11 no `D4` e as linhas do `B5`.
> Detalhe na terceira passada, no fim deste arquivo. Ficaram de fora, com motivo declarado, o `C2`
> e os indicadores novos do `G2`.

## J: Migrations marcadas como aplicadas que nunca rodaram

> Achado em **11/08/2026**, fora da rodada anterior: só apareceu ao tentar acrescentar uma
> coluna a `input_usages`.

`_migrations` registrava como aplicadas:

```
20260413000003_p1_input_usages.sql
20260413000004_p1_input_price_history.sql
```

As duas tabelas **não existiam em nenhum dos dois bancos**, nem no Postgres local (24 tabelas)
nem no Neon (23). Havia ainda um registro sem arquivo correspondente,
`20260521100006_pedidos_partial_availability.sql`, confirmando uso de `--mark-applied` no
passado.

É a **lição nº 7 do post-mortem acontecendo de fato**: migration marcada sem ter sido executada.
O histórico afirmava um schema que o banco não tinha, e nada acusou: porque migration marcada
nunca mais é tentada.

**O que estava quebrado em produção, silenciosamente:**

| Tela | Tarefa no P1 | Sintoma |
|---|---|---|
| `/insumos/registrar` | T1.10–T1.12 (marcadas `[x]`) | todo envio falhava: tabela de destino inexistente |
| `/admin/insumos` → histórico de preço | T1.15 (marcada `[x]`) | `getPriceHistory` falhava |

**Correção:** `migrations/20260811000002_repara_tabelas_p1_ausentes.sql` recria as duas com a
definição original, sem `IF NOT EXISTS`: se algum banco já as tiver, deve falhar alto e parar o
deploy em vez de passar em silêncio. O registro fantasma foi mantido: apagar linha de
`_migrations` à mão é o que produz este tipo de problema.

**Prevenção:** o achado só existiu porque alguém foi mexer na tabela. Não há hoje nada que
compare o schema declarado nas migrations com o schema real. Fica registrado como candidato a
teste de CI: comparar `CREATE TABLE` das migrations com `pg_tables` do banco alvo.

> ✅ **Conferido em 26/08/2026, e o que sobra é a prevenção.** Leitura direta do banco local: os 47
> arquivos de `migrations/` estão todos registrados em `_migrations`, `input_usages` e
> `input_price_history` existem, e sobra **um** registro fantasma, sem arquivo,
> `20260521100006_pedidos_partial_availability.sql` (o arquivo real é `20260521100008_…`, e
> `20260521100006` é o `_pedidos_status_history`). Ele fica: apagar linha de `_migrations` à mão é
> o que produz este tipo de problema.
>
> A parte viva do achado é a que nunca foi feita, e é a que teria pego tudo isso sozinha: o teste
> que compara migration com `information_schema`, registrado em
> [`divida-tecnica.md` §3](divida-tecnica.md).

---

## Correções aplicadas: 10/08/2026

| # | Decisão | O que mudou |
|---|---|---|
| **A** | Marcar, não reescrever | Bloco de alerta no topo de P1, P2, P3, P5, P6, P7 e P9, com a tabela de tradução (Edge Function → Server Action, RLS → checagem de perfil, Storage → `public/uploads/`, Realtime → `revalidatePath`, webhook → chamada HTTP na própria action) |
| **B** | Desmarcar | `P1 T1.8` voltou a `[ ]`, riscado, apontando para a migration que removeu RLS e para a `D4` como controle real |
| **C** | Corrigir | `P1` passou a `Status: PARCIAL, 16 de 32`, com o que está feito e o que falta |
| **D** | Renomear o banco | Migration `20260810000001`: `ALTER TYPE user_role RENAME VALUE 'funcionario' TO 'colaborador'`; 13 referências no código; `C8` e o apêndice B do TCC. **Aplicada no Postgres local; falta aplicar no Neon antes do próximo deploy.** |
| **E** | Roadmap único | `contexto-projeto.md` passou a ser a fonte, com estado real por projeto e P13 antes do P1; `CLAUDE.md` e `docs/README.md` apontam para lá |
| **F** | Reescrever | `EXECUTION-GUIDE.md` refeito a partir de onde o projeto está, com a ordem nova, os comandos reais e a distinção Neon × Supabase |
| **G** | `G2` é a fonte | Alerta no topo do `P6`: implementar pelas 9 fichas do `G2`; as listas de KPI do plano ficam como histórico |
| **H** | Junto do P13 | Permanece pendente, na Fase 6 do `P13` |

### Por que "marcar" e não "reescrever" nos planos Supabase

Reescrever as tarefas de infraestrutura de sete planos não implementados produziria muito
texto novo sobre decisões que ainda não foram tomadas, e que serão tomadas melhor no momento
de implementar, com o código na frente. O alerta no topo resolve o risco real, que é alguém
implementar sem perceber a troca de stack.

### Decisão de fundo sobre o roadmap

**P13 passou na frente do P1.** O custo unitário depende da mão de obra, e a mão de obra só
existe quando a agenda de pessoal registrar horas. Enquanto isso não acontecer, o motor de
cálculo do P1 (T1.18–T1.20) só sabe somar insumo e custo fixo, devolveria um custo
sistematicamente subestimado, que é exatamente o erro que o projeto existe para corrigir.


---

## K: Sete taxonomias de módulo concorrentes

> Encontrada em **19/08/2026**. Corrigida na mesma data.

Os mesmos módulos apareciam agrupados de sete maneiras diferentes, e a navegação do app não
seguia nenhuma delas:

| Fonte | Agrupamento |
|---|---|
| `docs/rotinas/img/mapa-sistema.mmd` (v1) | 6 blocos |
| `docs/rotinas/img/mapa-sistema-v2.mmd` | 7 blocos |
| `mapa-4-areas` | Cadastros · Pedidos · Produção · Financeiro |
| `mapa-0-acesso` … `mapa-4-financeiro` | Acesso · Cadastros · Produção · Comercial · Financeiro |
| `00-mapa-de-rotinas.md` §1–8 | 8 rotinas planas |
| `D1-arquitetura-c4.md` §4 | Acesso · Núcleo · Operação · Comercial · Rede externa · Financeiro |
| `C1-diagrama-casos-de-uso.md` §2 | 12 subsistemas planos, sem Cadastros |
| `src/lib/permissions.ts` | 7 blocos, com `custo_fixo` e `coleta_semente` sob Produção |
| `src/app/page.tsx` (o menu real) | Pedidos · Operações de Campo · Administração · Minha Conta |

Sintomas concretos: Clientes, Estoque, Perdas e Entregas mudavam de dono conforme o
documento; Custeio e Precificação ora eram "o que a produção gera", ora Financeiro; Custos
fixos e Coleta de sementes estavam em três lugares ao mesmo tempo (tela em `/admin`,
permissão sob Produção, mapa sob Cadastros); o fornecedor aparecia duas vezes no mapa v2,
contra o cadastro único que o P12 Fase 1 estava construindo; e o `mapa-sistema-v2` não era
referenciado por nenhum `.md`: o mapa de rotinas ainda embutia a v1.

**Correção.** Uma taxonomia só: **Cadastros · Produção · Comercial · Financeiro**, com Acesso
transversal. Regra de corte de Cadastros mantida do `1-cadastros/00-visao-geral.md` (*é cadastro se, ao
apagá-lo, um movimento passado ficar sem sentido*), o que tirou Custos fixos (→ Financeiro) e
Coleta de sementes (→ Produção) de lá. Estoque voltou para a Produção; Custeio, Precificação
e os Dashboards foram para o Financeiro; Indicadores deixou de ser módulo próprio; Compras
passou a nascer no Financeiro, com a seta de retorno para a Produção que faltava.

**O que impede a divergência de voltar:** a lista de telas de cada módulo passou a viver em
`src/lib/modules.ts` (uma fonte só, lida pelo painel inicial, pelos hubs e pelas abas) e
`src/lib/__tests__/modules.test.ts` confere cada link contra as rotas que existem em
`src/app/` e contra a matriz de permissões.

### Adendo: cliente e fornecedor viram papéis de uma pessoa

Na primeira passada eu deixei Clientes e Fornecedores como **duas abas irmãs** em
`/cadastros`, o que reintroduzia em menor escala a mesma divergência: o modelo de dados diz
"uma identidade, N papéis" (`cadastro.parties`), a navegação dizia "duas listas".

Corrigido em 19/08/2026: `/cadastros/pessoas` é uma lista só de `cadastro.parties`, com
filtro por papel e um selo por papel em cada linha. As telas `/clientes` e `/fornecedores`
continuam sendo as telas **do papel**: é lá que vivem os campos que não são de identidade
(dados fiscais e CNPJ de um lado; espécies, confiabilidade e geocodificação do outro).

Dois efeitos colaterais que valem registro:

- O recurso **`funcionario`** entrou na matriz de permissões (`src/lib/permissions.ts`),
  declarado como pendência do D4 no mesmo molde de `tarefa`. Sem ele, o filtro de
  funcionário cairia numa permissão emprestada.
- `ModuleLink.permission` passou a aceitar lista, avaliada com `canAny`, Pessoas reúne três
  recursos numa tela só. `canLink()` é o único lugar que decide se um atalho aparece.

A ficha da pessoa (`/cadastros/pessoas/[id]`) nasceu junto, e com uma finalidade declarada: é
onde *quanto compramos e quanto vendemos para esta pessoa* vai ser respondido. Hoje ela mostra
volume de venda e valor cotado de compra, e diz na tela que o valor em reais depende da Fase 2
do P12: `order_items` ainda não tem preço no banco (o modelo passou a especificá-lo em 24/08/2026,
ver a quarta passada), então o número virá do extrato, apontando para a mesma
`party_id`. Ver também [`divida-tecnica.md`](divida-tecnica.md) §8, que registra o conserto que
`mergeParties` vai precisar quando essa tabela existir.

### Segunda passada: a documentação alcança o código (19/08/2026)

A reconciliação do achado K parou no código e nos diagramas. Uma comparação entre o mapa novo
e o que estava planejado mostrou que **o resto da documentação continuava na taxonomia
antiga**: e, em três pontos, dizendo coisa que o sistema já não fazia. Corrigido nesta
passada:

| Onde | O que estava | O que ficou |
|---|---|---|
| `docs/rotinas/` | 8 arquivos `rotina-*.md` soltos na raiz, herança das rotinas planas | quatro pastas, `1-cadastros/` a `4-financeiro/`; `rotina-producao.md` e `rotina-financeiro.md` (índices redundantes) absorvidos pelos `00-visao-geral.md` |
| `B2 §2` · `B5 §2` | 12 seções por subsistema | Acesso + os quatro módulos, sem renumerar RF nenhum |
| `C1 §2, §3` | Cadastros sem o catálogo; subgrafos por rótulo informal | catálogo entra no módulo 1; subgrafos por módulo; catálogo de UC ganha coluna **Módulo** |
| `C6 §1` · `C8` | "a divisão por área corresponde aos subsistemas" | declarado que **área de dados não é módulo**, com o mapa entre as duas decomposições. Área 2 e 3 renomeadas (`Núcleo`→`Catálogo`, `Operação`→`Produção`) |
| `D4 §2` | 29 recursos em ordem histórica | 31 recursos agrupados por módulo; `Funcionários` e `Tarefas` saem de "pendente" e entram na matriz |
| `A1 §6` | escopo por subsistema | escopo pelos quatro módulos |
| `plans/P1…P10` | rotas `/app/admin/*`, `/app/relatorios/*`, `/app/lotes/*` | rotas reais, com tabela de-para no P1 e faixa de módulo em cada plano |
| `contexto-projeto.md` | roadmap só por projeto | módulos primeiro, tabela projeto × módulo × situação, e o ciclo com o elo que falta |

**A correção de fundo: "o financeiro é exclusivo da chefia" era falso desde o reagrupamento.**
`D4 §3.2` dizia restrição total do subsistema, mas o módulo 4 passou a abrigar custo unitário,
margem, preço e indicadores: quatro recursos que a matriz sempre deu à gerência em leitura, e
que `src/lib/permissions.ts` de fato dá. A regra foi reescrita para o que é verdade e é
defensável: **restringe-se o que expõe a base bancária; o que dela deriva permanece legível**.
`RF-62`, `RN-44`, `TA-04` e o painel do `G2 §6` foram alinhados a esse enunciado.

**Achado lateral, de ferramenta.** `npm run docs:tcc` vinha descartando **seis das vinte e uma
figuras** (as de `D1` e `D3`) em silêncio: no Windows o checkout entrega esses artefatos em
CRLF (`core.autocrlf`) e a regex do gerador exigia `\n`. As figuras do Word estavam
desatualizadas desde a reescrita do `D1`. Corrigido em `scripts/build-docs-tcc.mjs` com
`\r?\n`; a pasta `word/` foi regerada com as 21.

### Terceira passada: o resto (19/08/2026)

O que a segunda passada não alcançou, resolvido na mesma data.

**A regra do módulo restrito não tinha chegado ao código.** `permissions.ts`, `modules.ts` e o
comentário do próprio teste ainda diziam "exclusivo da chefia" a três linhas de `custo_unitario`,
`margem_canal`, `preco_venda` e `indicador`, que dão `ler` à gerência. Corrigidos, e o teste ganhou
as quatro asserções do lado que faltava: sem elas, "consertar" o módulo restrito fechando o que
nunca foi fechado passaria despercebido. A transcrição do `D4 §2` no teste também estava
incompleta: `Funcionários` e `Tarefas` entraram.

**Os mapas: cor na fonte, cinza na figura.** Os três diagramas de topo discordavam entre si sobre o
status de Comercial e de Financeiro, e os sub-mapas usavam outro vocabulário de classes. Agora são
oito arquivos com as mesmas três classes (`ok`/`meio`/`falta`), definidas **em cores**, e
`npm run docs:mapas` troca a paleta por escala de cinza só na hora de renderizar. O status passou a
ser contado por critério verificável: quantas etapas da tabela de cada módulo têm tela
(Cadastros 4/6, Produção 2/10, Comercial 6/8, Financeiro 1/9), com a fração no rótulo do nó.

**`C6` e `C8` adotaram os quatro módulos**: as duas últimas peças em taxonomia própria. A objeção
de perder arestas ao separar entidades relacionadas foi resolvida com a convenção de **caixa
vazia**: a entidade de outro módulo aparece sem atributos, só para a aresta existir.

**A dívida do P13 com a engenharia (`T13.22`) foi paga.** `B2` ganhou **RF-69 a RF-76** (funcionário,
tipos de tarefa, agenda semanal, recorrência, fechamento, conclusão pelo colaborador, valor-hora,
mão de obra no custo) e o conflito de §5 foi reescrito para turno de 4h × valor-hora médio da
equipe. Em cascata: `B3` ganhou **RN-48 a RN-55**, `C1` os **UC-41 a UC-44**, `C6`/`C8` as quatro
entidades da agenda, `D4` a regra **§3.11** (a tarefa é a primeira permissão que depende do
registro, não do perfil) e `B5` as linhas correspondentes.

**Ficaram de fora, com motivo declarado:** `C2`, que detalha oito casos escolhidos e não os 44; e
indicadores novos no `G2`, porque os três que o P13 sugeria eram *possíveis*, não pedidos, e cada
ficha do G2 exige meta e responsável, que teriam de ser inventados junto.

**Contagens acertadas.** Várias estavam erradas e se repetiam por até sete arquivos: as entidades
eram declaradas como 39 e passaram a 45 (a tabela-resumo do `C6` contava 10 no Financeiro, que
tinha 12), hoje 46;
os requisitos passaram de 68 para 76; os casos de uso, de 40 para 44; as regras de negócio, de 47
para 55.

### Quarta passada: o modelo de dados contra o banco e contra os requisitos (24/08/2026)

Conferência de `C6` e `C8` contra as 33 migrations, contra `B2`, `B3`, `B5` e `D4`, e contra
`src/`. Conferiu certo o essencial: as 28 tabelas reais estão todas documentadas, sem tabela órfã;
as 37 chaves estrangeiras reais batem uma a uma com o `C8`; todas as listas fechadas coincidem com
os `CHECK` e `ENUM` do banco, inclusive o `funcionario` → `colaborador`; os 8 estados de pedido e os
4 de disponibilidade batem com `src/lib/orders.ts`; nenhuma entidade citada em `B5` ou `D4` falta no
`C8`; e `src/` não referencia tabela inexistente. Seis correções:

1. **O preço praticado não tinha onde ser gravado.** `order_items` não tinha atributo de preço em
   lugar nenhum, embora a nota de `sale_prices` no `C8` afirmasse que o valor acordado fica no item,
   RN-59 o admita diferente do sugerido e RF-33, RF-35 e RF-44 tratem de preço praticado. Era a
   metade que faltava da correção registrada em `B5 §5.1`. `order_items` recebeu `unit_price` e
   `sale_price_id`; `orders` recebeu `price_approved_by` e `price_approved_at`. Em cascata: `C6`
   §3.4 e §5, `C8` e as linhas de RF-33, RF-35 e RF-44 no `B5`.
2. **`users.party_id` aparecia como coluna existente.** Passou a trazer a marca de especificado e
   não implementado, e a declarar o alvo `cadastro.parties`.
3. **O esquema `financeiro` não estava qualificado no `C8`**, embora o `C6 §3.5` e
   `rotinas/4-financeiro/02-schema-financeiro.md` o exijam, e embora o `C8` já qualificasse
   `cadastro.*`. As nove entidades do extrato passaram a `financeiro.*`. O `C6 §3.5` também
   passou a dizer quais são as nove: custeio e preço ficam em `public`, e a frase anterior dava a
   entender que o módulo inteiro estava no esquema separado.
4. **Sete chaves estrangeiras sem alvo declarado** (`users.party_id`, `week_plans.published_by` e as
   cinco de `assignments`) ganharam o `→ tabela`, como todas as demais do dicionário.
5. **`task_types` estava sob o título do Módulo 2** no `C8`, enquanto o `C6` e a própria tabela-resumo
   do `C8` o contam em Cadastros. Foi movido.
6. **A nota de `production_activities` omitia a rustificação** da lista de manejo que RN-57 nomeia.

Duas contagens erradas junto: o `C6 §2` dizia "quarenta e cinco do modelo completo" e o `D1` falava
em 45 entidades, quando são 46 desde que a precificação entrou.

**Recorte implementado, agora declarado.** Nem `C6` nem `C8` diziam quais das 46 entidades existem
no banco, e a distinção é a primeira pergunta de quem lê o modelo ao lado do sistema. O `C6` ganhou
a seção §2.1 e o `C8` a seção "Recorte implementado", ambas com a mesma conta (28 no banco, 18 só
especificadas), e o `C8` marca a condição entidade por entidade.

---

## L: "Lote" excluído em três documentos e assumido num plano (24/08/2026)

🔴 **Divergência de escopo, não de redação.** Quatro documentos diziam coisas incompatíveis sobre a
mesma palavra:

| Documento | O que dizia |
|---|---|
| `A1` §7 | "Controle de lotes de produção rastreáveis individualmente" **fora de escopo** |
| `A2`, termos não adotados | "Lote" **fora da especificação**, por ambiguidade |
| `C2` UC-17 | registrar o **local da perda** dentro do viveiro **descartado** |
| `plans/P2` T2.1-T2.7 | especifica `batches`, `batch_counts`, `mortality_thresholds` e as telas `/producao/lotes/*` |

O `CLAUDE.md` §Banco de dados ainda cita `batches` como exemplo de nomenclatura de tabela, e
`rotinas/2-producao/00-visao-geral.md` lista "Acompanhamento de lotes" como a terceira subrotina,
com o documento marcado "(a fazer)". Ou seja: metade dos artefatos trabalhava com lote e a outra
metade o proibia, e ninguém tinha percebido porque **nenhum dos dois lados chegou ao código**.

Passou pelas três primeiras passadas sem ser vista porque cada passada conferiu **documento contra
banco**, e lote não existe nem num nem noutro. A divergência era **entre documentos**, e só
apareceu quando o levantamento da rotina de produção pediu a entidade.

### Resolução: o escopo abriu

Decisão do dia 24/08/2026, com a justificativa gravada no próprio `A1` §7 e não como apagamento
silencioso da linha. Os dois termos da justificativa original caíram:

1. **"Disciplina de registro incompatível"**: o viveiro já planta por leva e já sabe dizer de
   cabeça o que está em cada canteiro. O que falta é o registro escrito. E o lote é **escolhido**
   de uma lista de canteiros ocupados, não digitado, então não acrescenta digitação ao campo.
2. **"Agregado por espécie e recipiente basta"**: não basta. Sem lote não se diz onde a muda está,
   a mortalidade só se mede sobre a espécie inteira (esvaziando RN-17) e a repicagem vira uma soma
   que entra e outra que sai, sem ligação entre as duas.

O limite não sumiu, subiu de altura: **o rastreamento vai até o lote, nunca até a muda**. O `A1`
§7 passou a excluir "rastreamento individual da muda".

**UC-17 não foi revertido, foi resolvido.** O caso rejeitava pedir o *local* da perda porque
acrescentaria um quinto campo a um formulário de campo de quatro. Com lote, o local **vem do
lote**: o formulário continua com quatro campos, e um deles troca de "espécie + recipiente" para
"lote", que já carrega os dois.

`plans/P2` deixa de estar à frente dos documentos: as tabelas que ele previa entram no modelo com
nomes reconciliados (`batches` + `batch_movements`, no lugar de `batches` + `batch_counts`), e a
contagem física de lote passa a ser `stock_counts` com `batch_id`, sem entidade paralela.

---

## Quinta passada: a rotina de produção contra o que ela deixou para trás (24/08/2026, depois das migrations)

A quarta passada conferiu o modelo **antes** de as migrations existirem, e por isso fala em "28
tabelas reais": as sete migrations `20260824000001` a `20260824000007` vieram depois dela, no mesmo
dia. Esta passada confere o estado resultante, com o banco local migrado e consultado pelo
`information_schema`.

**Conferiu certo o essencial.** As 7 migrations estão aplicadas, sem colisão de nome com tabela
existente e sem guarda condicional; as regras viraram restrição onde deviam (RN-76 por índice único
parcial no canteiro, RN-78 por `CHECK`, RN-79 pelo par `closed_at`/`bed_id`, RN-83 por índice único
parcial na pessoa); `B3` fecha em 82 regras com os tipos batendo; TA e UC não têm buraco de
numeração; os 686 testes passam e `permissions.ts` confere os 7 recursos novos contra o `D4`.

Nove correções:

1. **O recorte implementado ficou mentindo.** `C6` §2.1 e `C8` seguiam em "28 no banco, 27 só
   especificadas", e as dezesseis tabelas novas traziam a marca *Especificada, não implementada no
   protótipo*, embora existissem no banco. A conta passou a **44 no banco e 11 só especificadas**,
   todas do Financeiro, e as duas visões passaram a implementadas. Em cascata: a seção I deste
   arquivo, que na época guardava uma cópia da conta, e `word/`. *(A seção I foi retirada em
   26/08/2026, e a conta vive só no `C6` e no `C8`, justamente para não precisar desta cascata.)*
2. **`labor_rates` não batia em nenhuma coluna.** O `C8` declarava `year`, `month`,
   `payroll_total`, `hours_total` e `hourly_rate`; o banco tem `reference_month`, `total_payroll`,
   `total_hours` e `rate_per_hour`. O dicionário passou a seguir o banco, com a justificativa do mês
   como data e da coluna gerada.
3. **Três colunas existiam no banco e faltavam nos documentos**: `loss_events.client_id` (a
   idempotência offline da perda, RNF-05), `stock_counts.notes` e `batch_movements.recorded_by`.
   As duas primeiras faltavam no `C8` e no `C6`; a terceira, só no diagrama do `C6`.
4. **`input_stock_entries.transaction_id` estava no `C8` e não no banco.** É especificação à frente
   do código, como `task_expenses.cost_center_id`: passou a trazer a marca **Especificado, não
   implementado** e a aparecer no diagrama do `C6`, com a caixa de `transactions`.
5. **A entrada de insumo não tinha requisito que a originasse.** `input_stock_entries` existia no
   banco, a RN-88 a pressupunha ("entradas menos consumo") e o recurso `Estoque de insumo` do `D4`
   já a autorizava, mas nenhum RF mandava registrá-la: RF-101 é consumo, RF-102 saldo, RF-103
   alerta, RF-104 gasto e RF-105 negativo. Sem ela o saldo nasceria negativo em todo insumo. Entrou
   **RF-106**, com **UC-56** e **TA-85**, e a linha correspondente no `B5`.
6. **O saldo do lote dizia-se mantido pelo banco.** Não há gatilho: a migration cria a restrição de
   não negativo e a atualização fica com a aplicação, na mesma transação do movimento. `C6` e `C8`
   passaram a dizer isso.
7. **O conceitual tinha 21 entidades e o texto dizia vinte**, e as figuras em português tinham
   perdido `ESPECIE → PRODUCAO` e `ESPECIE → PERDA` na divisão da figura 6, o que desmentia a
   leitura "a espécie participa de sete relacionamentos". As duas voltaram à `fig06`.
8. **Contagens desatualizadas em quatro documentos**: o guia de elicitação dizia "RN-01 a RN-73"
   com o catálogo já em RN-90, e a sua tabela de áreas não trazia as dezessete regras novas; a
   tabela de técnicas de elicitação do mesmo guia vinha de quando havia 79 RF; o `B5` §4 contava 45
   casos de uso, 45 entidades, 32 recursos e 58 casos de aceite; e a `E2` §13 dava "80 dos 87 deve
   ter", contra 84 reais, e listava como descobertos seis requisitos que a própria `B5` dá por
   cobertos indiretamente.
9. **Os mapas de rotina atualizaram a Produção e esqueceram os Cadastros.** A tabela do
   `00-mapa-de-rotinas` ganhou área e canteiro e período de trabalho, mas `mapa-1-cadastros`,
   `mapa-4-areas` e `mapa-sistema-v2` seguiam em "4 de 6 etapas".

**A lição, para a próxima rodada:** as duas passadas do mesmo dia conferiram documento contra
documento e documento contra banco, e o que escapou às duas foi a **ordem**. A migration escrita
depois da conferência do modelo deixa o modelo desatualizado no mesmo dia em que foi conferido.
Quando a rodada inclui migration, a conferência é a última etapa, nunca a penúltima.

---

## M: um lote por canteiro, que o viveiro nunca praticou (26/08/2026)

🔴 **Divergência entre o modelo e a operação, e não entre documentos.** A RN-76 dizia "um lote ocupa
um canteiro" e o banco garantia isso com o índice único parcial
`batches_um_lote_aberto_por_canteiro`. O viveiro **nunca operou assim**: um canteiro recebe seis,
oito, nove levas ao mesmo tempo, e é assim que o espaço é usado.

| Onde estava | O que dizia |
|---|---|
| `B3` RN-76 | "Um lote ocupa um canteiro. Leva que não cabe é outro lote" |
| `C6` §3.2 e §3.3 | cardinalidade `beds ||--o| batches`, no máximo um |
| `C8` `batches` | "a pergunta da operação é 'o que tem neste canteiro', que um lote por canteiro responde sem junção" |
| `migrations/20260824000004` | `CREATE UNIQUE INDEX batches_um_lote_aberto_por_canteiro` |
| `plans/P14` decisão 2 | "Garantido por índice único parcial, não por validação de tela" |
| `C2` UC-47 FA-1 | a leva que não cabe vira dois lotes |

Os seis diziam a mesma coisa, coerentes entre si, e a coerência foi o que escondeu o erro: **nenhuma
conferência documento-contra-documento acharia isso**, porque não havia contradição para achar. As
cinco passadas anteriores compararam artefato com artefato e artefato com banco, e o erro não estava
em nenhum dos dois lados: estava entre o banco e o viveiro.

**Quem apontou foi um protótipo de tela.** O desenho do mapa de produção, feito no Figma antes de
qualquer código, mostra os lotes como quadrados dentro de cada canteiro, vários por canteiro. Foi ao
tentar escrever os requisitos daquele desenho que a contradição apareceu.

### Resolução: a exclusividade caiu, o resto ficou

A RN-76 tinha duas afirmações grudadas, e só uma era verdadeira:

1. **"Um lote não se espalha por dois canteiros"** — continua de pé, e é a que interessa: é ela que
   faz "o que tem neste canteiro" ter resposta direta, sem entidade de ocupação no meio.
2. **"Um canteiro tem no máximo um lote"** — caiu. Nunca foi observação, foi suposição.

O índice único foi derrubado em `20260826000001` e substituído por `batches.position`, a ordem do
lote dentro do canteiro, que é o que dá ao mapa um desenho estável. RN-79 foi emendada junto
("canteiro livre é canteiro sem **nenhum** lote aberto") e RN-92 entrou para dizer que a ocupação é
a soma dos saldos dos lotes abertos.

**A lição é sobre o que uma auditoria de documentos não alcança.** Cinco passadas conferiram
documento contra documento e documento contra banco. Nenhuma delas podia achar este erro, porque as
duas pontas concordavam entre si e discordavam **do viveiro**. O que achou foi desenhar a tela: a
figura obriga a representar o espaço, e o espaço não mente. **Protótipo de tela antes do código é
verificação de requisito, e não só de interface** — vale tratá-lo como tal na próxima rotina que for
levantada.

---

## Sexta passada: a própria entrega da tela de produção, conferida contra si mesma (26/08/2026)

A engenharia dos dois protótipos foi escrita, aplicada e commitada, e **em seguida auditada**. A
conferência achou cinco defeitos na entrega recém-feita, três deles de modelo e lógica:

1. **`task_recurrences` nascera sem turno**, e `assignments.shift_id` é `NOT NULL`. A ocorrência
   gerada por RF-115 não tinha de onde tirar o turno, e a hora não o determina: os turnos não cobrem
   o dia inteiro, e a rotina das 11h30 às 12h30 não cai em nenhum deles. Corrigido em
   `20260826000006`, com `shift_id` obrigatório.
2. **A visão `batch_health` tratava tarefa `confirmada` como pendência.** O filtro era
   `status <> 'nao_confirmada'`, escrito pensando só no fechamento da semana, e deixava passar o
   status que significa "o colaborador deu por concluída" (RF-74). O lote ficaria colorido por um
   serviço feito, sem nada na tela denunciando. Corrigido em `20260826000005`, com condição
   **positiva**: pendência é o que segue `planejada`, e nada mais.
3. **A divisão da figura 13 custou dois relacionamentos**, `especies → atribuicoes` e
   `recipientes → atribuicoes`, exatamente o que a caixa de aviso do
   [`README` do `modelo-dados-pt`](engenharia/modelo-dados-pt/README.md) manda conferir desde que a
   `fig06` cometeu a mesma falha. Segunda ocorrência do mesmo erro: a conferência virou **comando
   documentado** naquele README, e não mais uma lembrança.
4. **As chaves estrangeiras novas não ganharam relacionamento no `C6` §3.3**, nem a caixa `areas`.
   O `C8` listava os FKs corretamente e o desenho ficou atrás do texto: doze relacionamentos
   faltando entre `areas`/`beds`/`species`/`containers`/`batches`/`work_shifts` e as três entidades
   de agenda. Repostos, e o `C6` e as figuras voltaram a bater, 31 de cada lado.
5. **`word/4.4-modelagem-do-sistema.md` estava desatualizado**, gerado antes da última correção no
   `C2`. É a mesma lição da quinta passada, de novo: **a geração é a última etapa, nunca a
   penúltima**. Desta vez o que ficou entre as duas foi uma edição de documento, e não uma
   migration.

**A lição desta passada:** auditar a própria entrega, no mesmo dia, achou o que a escrita não achou.
Os defeitos 1 e 2 só apareceram ao perguntar "isto é implementável?" e "quais valores esta coluna
aceita mesmo?", que são perguntas de conferência, não de redação. O defeito 3 já tinha aviso escrito
e mesmo assim aconteceu: **aviso que depende de alguém lembrar não é controle**, e por isso virou
comando.
---

## N: as fotos de espécie mudaram de lugar, e o `CLAUDE.md` não soube (26/08/2026)

🔴 **Divergência entre a regra escrita e o banco, achada por acidente**, ao montar a tabela de
tradução do achado A. O `CLAUDE.md`, seção Stack, dizia:

> **Fotos de espécies**: `public/uploads/especies/`, servidas estaticamente.

É falso **desde 11/08/2026**. A migration `20260811000001_species_photos.sql` moveu a foto para uma
linha de `species_photos` (BYTEA), referenciada por `species.photo_url` no formato
`/api/fotos/<uuid>`, e o motivo está escrito no cabeçalho dela: o filesystem da Vercel é
somente-leitura fora de `/tmp` e é descartado a cada deploy, ou seja, **o upload em disco nunca
funcionou em produção**. A mesma migration anulou os `photo_url` que apontavam para `/uploads/%`,
porque eram imagem quebrada. O código confirma: `src/app/cadastros/especies/actions.ts` devolve
`/api/fotos/<id>` e `src/middleware.ts` exclui essa rota do matcher.

**O agravante é que a instrução errada estava sendo propagada.** A tabela de tradução repetida nos
sete banners do achado A mandava, literalmente, *Storage → `public/uploads/`*: mandava construir o
que já tinha sido desfeito, e o `P7 T7.2` teria sido implementado assim.

**Correção.** O `CLAUDE.md` passou a descrever o armazenamento real, com o porquê; o `P7 T7.2`
passou a mandar reaproveitar `species_photos` e `/api/fotos/[id]`, que já existem; a nota de foto de
perda no `P2` seguiu o mesmo molde; e o `EXECUTION-GUIDE` ganhou a frase de que arquivo não vai
para disco nesta stack.

**A lição é sobre onde a regra morre primeiro.** A migration documentou a decisão muito bem, no
lugar certo, e o `CLAUDE.md`, que é o arquivo **carregado em toda sessão**, continuou dizendo o
contrário por quinze dias. Migration explica uma mudança; ela não revoga a regra escrita em outro
arquivo. **Mexeu no que o `CLAUDE.md` afirma, o `CLAUDE.md` entra na mesma alteração.**

---

## Sétima passada: fechar o que tinha sido só marcado (26/08/2026)

As seis passadas anteriores conferiram documento contra documento, documento contra banco e a
entrega contra si mesma. Esta é de outra natureza: **não procurou divergência nova, foi cobrar as
que ficaram marcadas em vez de resolvidas.** Sete dos treze achados tinham decisão registrada e
execução parcial.

| Achado | O que estava | O que ficou |
|---|---|---|
| **A** Supabase | banner de tradução em 7 planos, tarefas intactas | banners apagados, 15 tarefas e notas reescritas na stack real |
| **B** RLS | tarefa riscada, sem veredicto sobre o Neon | veredicto com quatro razões, gravado em [`D4 §4.1`](engenharia/D-arquitetura/D4-matriz-rbac.md); `T1.8` virou tarefa de verdade |
| **C** cabeçalho do P1 | "16 de 32", contagem errada e de listas misturadas | "15 das 20 tarefas de desenvolvimento", com as outras doze caixas explicadas |
| **D** colaborador | regra certa, migration só no local | regra reconferida no banco; falta **só** aplicar/conferir no Neon |
| **E** roadmap | fonte eleita, cópia mantida ao lado | cópia removida do `docs/README.md`; fonte com P14, P15 e estado real |
| **G** indicadores | aviso no topo do `P6`, listas fracas no corpo | corpo reescrito pelas 9 fichas do `G2`, com o painel por perfil e a regra do travessão |
| **I** contagem | seção permanente com número que envelhecia | retirada; a conta vive só em `C6 §2.1` e no `C8` |
| **J** migrations | corrigido em 11/08 | reconferido no banco: 47 arquivos registrados, 1 fantasma conhecido, prevenção ainda em aberto |
| **K** taxonomia | corrigido em 19/08 | conferido documento por documento; dois resíduos anotados, ambos deliberados |
| **N** fotos | não existia | achado novo, acima |

**Três resíduos anotados e deixados de propósito:**

1. O registro fantasma em `_migrations` continua lá. Apagar linha à mão é o que gera o problema.
2. `docs/rotinas/img/mapa-sistema.mmd`, a taxonomia de antes, continua no repositório com o aviso
   de superada no próprio arquivo. `npm run docs:mapas` sem argumento ainda a rerenderiza, e isso
   passou a estar dito no `00-mapa-de-rotinas`.
3. `C1 §3` continua organizado por ator, enquanto `C1 §2` é por módulo. São eixos diferentes do
   mesmo conjunto, e o `C1` passou a dizer isso, para não ser "corrigido" numa próxima passada.

### A lição: marca de tradução é dívida, não conserto

Em 10/08 a decisão foi *marcar, não reescrever*, com uma justificativa que parecia boa: reescrever
tarefa de infraestrutura de sete planos não implementados produziria muito texto sobre decisões que
seriam tomadas melhor com o código na frente. Quinze dias depois, o saldo dessa escolha:

- **Ninguém lê o banner.** Quem implementa lê a tarefa, e a tarefa continuava dizendo *Edge
  Function*.
- **O banner apodrece igual.** A tabela de tradução dos sete banners mandava `public/uploads/`, que
  o próprio projeto tinha desfeito no dia seguinte. O aviso passou a espalhar o erro que o achado N
  registra.
- **Aviso ao lado de fonte cria duas fontes**, e foi exatamente o que aconteceu em **E** (ponteiro
  ao lado da cópia) e em **G** (aviso ao lado da lista fraca). Nos três casos, o conserto real foi
  apagar um dos lados.

O critério que fica: **marcar só serve para o que não se pode consertar agora.** Se a tradução já é
sabida, ela é o conserto, e adiá-la significa reescrever o mesmo texto duas vezes, uma no aviso e
outra na tarefa, e ainda arcar com o risco de o aviso envelhecer sozinho.

---

## Oitava passada: a redução de escopo (28/08/2026)

O sistema foi especificado para a empresa e para o TCC ao mesmo tempo, e a especificação cresceu
além do que um protótipo entrega no prazo acadêmico. O corte foi aplicado a todos os artefatos, e é
o maior evento registrado neste arquivo.

### O que saiu

Módulo Financeiro por inteiro (extrato, conciliação, lançamentos, centros de custo, fechamento
mensal), custeio, precificação, cotação com fornecedores, entregas e cargas, apontamento por
relógio, gastos e insumos da tarefa, coleta de sementes, estoque de insumo, item genérico de
pedido, notificações, histórico de estados do pedido e exigência de nota fiscal. Junto deles, o
**perfil colaborador**: os seis trabalhadores de campo deixaram de operar o sistema, e o trabalho
deles passou a ser planejado e confirmado pela gerência.

### O que o corte fechou

| Achado | Como fechou |
|---|---|
| **D** | O enum `user_role` perdeu `colaborador`, e a ambiguidade com `party_roles.role = 'funcionario'` deixou de existir: hoje só há um sentido para cada palavra, declarado em `D4` §1 |
| **G** | `G2` passou a ter três indicadores, e os três são o que o mapa de lotes mostra. Não há painel próprio nem segunda definição |
| **K** | Uma taxonomia só, de três áreas, espelhada em B2, B5, C1, C6, D1, D4 e no mapa de rotinas |
| **M** | Um canteiro comporta vários lotes, e a restrição sobrevivente é a do lote, que não se espalha |

### O que o corte revelou, e é achado novo

**Achado O: tabela de cobertura escrita à mão afirmando cobertura que não existia.** Ao remover
seções inteiras de `E2`, dezenove requisitos de prioridade *deve ter* ficaram sem caso de aceite, e
a tabela de cobertura da §13 continuou afirmando cobertura total, porque era mantida à mão. A
lacuna só apareceu quando a tabela passou a ser **calculada a partir dos casos**.

A correção não foi escrever os dezenove casos, ainda que eles tenham sido escritos: foi tornar
derivadas as tabelas que resumem outras. Passaram a ser geradas por script:

| Documento | Script | O que ele deriva |
|---|---|---|
| `B3` §4 e §7 | `scripts/build-b3-derivado.mjs` | RF → RN, invertido do catálogo; texto integral dos requisitos |
| `B4` inteiro | `scripts/build-b4-quadros.mjs` | Os dez quadros, de B2, B3 e A1 |
| `B5` §2 e §6 | `scripts/build-b5-matriz.mjs` | Caso de uso e teste por requisito; estado da cobertura |
| `E2` §9 | `scripts/build-e2-cobertura.mjs` | Cobertura por seção e os requisitos sem caso |
| `modelo-dados-pt` | `scripts/mede-figuras.mjs` | A fonte útil de cada figura, medida do PNG |

**O critério é um só: documento que resume outro não se escreve à mão.** Foi o que produziu, no
histórico deste projeto, o `.docx` de quadros defasado em dois meses (achado do `B4`), as
contagens divergentes de requisitos (136 declarados contra 138 reais) e agora a cobertura de teste
afirmada e inexistente. Três vezes é padrão.

**Achado P: a conferência de referências virou comando.** `scripts/verifica-rastreabilidade.mjs`
confronta, nos dois sentidos, os identificadores definidos em B2, B3, C1, E2, G2 e A1 contra os
citados em todo o repositório. Foi ele que encontrou, durante o corte, as dezenas de citações a
requisitos removidos que sobreviveram em C8, D4, E4, E5, F1 e nas rotinas.


---

## Nona passada: o que o corte deixou para tras (30/08/2026)

A oitava passada fechou com um criterio: **documento que resume outro nao se escreve a mao.** Ele
foi aplicado a cinco tabelas, e funcionou. Esta passada e a conferencia de onde ele **nao** foi
aplicado, e a resposta e desconfortavel: foi exatamente ali que a divergencia reapareceu.

### O achado de fundo

| Onde o criterio foi aplicado | Estado em 30/08 |
|---|---|
| `B5` §2 e §6, `E2` §9, `B3` §4 e §7, `B4` | Corretos, e batem com a fonte |
| `B5` §3, `B3` §6, `D4`, o `C8` inteiro | **Todos divergiam**, e nenhum acusava |

A conferencia automatica passava limpa o tempo todo, porque
`verifica-rastreabilidade.mjs` so sabe responder se um identificador citado existe. Nao conta
linha, nao confere cobertura, e nao compara um documento com o vizinho. Nenhum dos achados abaixo
era visivel para ela.

### Achado Q: o dicionario de dados descrevia o sistema anterior ao corte

O `C8` vai impresso como Apendice B, e nao era impresicao de redacao: era outra especificacao.
`batch_movements` documentava tres colunas apontando para `task_executions`, `loss_events` e
`stock_counts`, tabelas que nao existem em lugar nenhum do modelo, e **omitia as duas colunas
reais**, `assignment_id` e `loss_cause`. Era o contrario da regra-simbolo do projeto, a de que
todo movimento passa pela mesma porta: o documento continuava descrevendo a entidade propria de
perda que a migration explicitamente recusou. O dominio de `loss_cause`, que e onde RN-10 e
imposta pelo banco, nao estava documentado em lugar nenhum dos tres documentos do modelo.

Junto dele: nove valores no papel de `party_roles` contra tres no enum, com os seis extras sendo
residuo do modulo Financeiro; `cadastro.addresses` com dez colunas inexistentes; a carga inicial
de `task_types` falando em 22 tarefas contra as 15 do seed, e afirmando em destaque que "Semear
nao exige lote" enquanto o seed grava o contrario; e uma nota dizendo que `users.role` fora
renomeado para `colaborador` numa migration que nao existe, o que ressuscitava o **achado D**
num documento impresso.

### Achado R: o gerador que apagava a tabela em silencio

E o achado mais grave da passada, e nasceu de rodar os geradores nesta copia pela primeira vez
depois de um checkout com quebra de linha do Windows.

Os quatro partem o arquivo em linhas e casam cada uma contra uma regex ancorada no fim. Com CRLF
sobra um retorno de carro depois do split, e em JavaScript o `.` de uma regex **nao casa retorno
de carro**. A regex nao casava nada, o gerador concluia que o documento nao tinha requisito nenhum
e **gravava a tabela vazia**. Sem erro, sem aviso: o unico sinal era a linha `B3: 0 RF, 0 RNF,
0 RN` passando no terminal.

**Tornar a tabela derivada nao basta se o gerador puder falhar em silencio.** O criterio da oitava
passada ganhou uma segunda metade: derivar, e falhar alto quando nao conseguir derivar.

### Achado S: a delimitacao de escopo nao registrou o proprio corte

`A1` §7 e a delimitacao canonica, citada pelo `P1` e pelo `B2` §4 como o lugar onde o que
saiu esta declarado. Ela nao tinha **nenhuma** das exclusoes de 28/08: custeio, modulo financeiro,
cotacao com fornecedor, entregas, apontamento por relogio e tela de campo. O corte foi aplicado aos
requisitos e ao modelo, e nao ao documento que existe para dizer onde o sistema termina.

### O que mais foi corrigido

- `D1` dizia "62 entidades em 3 esquemas", **dentro do bloco mermaid que vira a figura de 4.6**.
- `D4` e `B5` diziam 23 recursos; a matriz tem 25, e o mapa do gerador de `B5` ja usava 25.
- `B3` §3.6 declarava Restricao 21 e Acionamento 2, contra 22 e 1 reais. **Os dois erros se
  cancelavam e o total 60 fechava**, que e por que nenhuma leitura o pegou.
- `B5` §3 herdava o teste do primeiro RNF de cada faixa, e assim afirmava cobertura de RNF-03 e
  RNF-04, que nao tem caso de aceite nenhum.
- `C1` §4.1 e `B5` §5.2 contavam conjuntos diferentes de requisitos sem ator. Sem ator e sem
  caso de uso nao sao a mesma coisa, e a distincao decide o contador de `B5` §6.
- `TA-25` testava o perfil `colaborador`, verificando que um usuario inexistente nao e
  interrompido: condicao vaziamente verdadeira, num apendice impresso.
- O guia de escrita dos capitulos 4.2 e 4.3 estava inteiro na numeracao antiga, e seu exemplo
  canonico era o **piso minimo**, conceito que saiu com o custeio.

### O que a passada mudou de processo

Duas conferencias novas, porque as duas classes de erro acima eram invisiveis para a existente:

| Comando | O que confronta |
|---|---|
| `node scripts/confere-modelo-pt.mjs` | O conjunto de arestas das figuras em portugues contra o do `C6`, nos dois sentidos |
| `scripts/leia.mjs` | Leitura unica dos geradores, normalizando a quebra de linha |

A conferencia que o `README` do `modelo-dados-pt` mandava fazer, somar `grep -c` e comparar
com o `C6`, **nunca poderia fechar**: as figuras sao um recorte mais fino, e aresta que cruza a
fronteira de duas aparece nas duas. Conferencia que nunca fecha e conferencia que se para de rodar,
e foi assim que a aresta `protocolos -> lotes` sumiu de todas as figuras sem que ninguem notasse.

### A fusao dos oito pares

Na mesma data, e por decisao de escopo e nao de correcao, os requisitos passaram de 70 para 62.
Nenhuma funcionalidade saiu: oito pares compartilhavam **o mesmo caso de uso e o mesmo teste de
aceite**, e portanto eram um requisito escrito em duas linhas. O criterio esta declarado em
`B2` §1, com a excecao de RF-46 e RF-60, que compartilham TA-65 e ficam separados de proposito
por serem a unica aresta entre a Producao e o Comercial.

### A fusao de cinco grupos de regras (31/08/2026)

Um dia depois, o mesmo criterio foi levado ao catalogo de regras: **duas regras que enunciam a
mesma coisa sobre o mesmo objeto sao uma regra so**, e o sinal de alerta e a coluna *RF originados*,
quando uma regra origina exatamente os mesmos requisitos que a vizinha ou um subconjunto deles.
Cinco grupos se enquadravam, e as regras passaram de 60 para 54 (numeracao anterior):

  RN-24 + RN-29                contar por unidade e contar por pessoa
  RN-27 + RN-32                turno e limite de atraso, ambos parametro mantido
  RN-39 + RN-40                a janela de aviso e o alerta desligado da etapa
  RN-46 + RN-47 + RN-48        a ordem gerada pelo protocolo
  RN-50 + RN-53                o conjunto fiscal e a nota emitida fora daqui

**Nenhuma regra do viveiro foi descartada:** os enunciados sobreviventes absorveram o texto inteiro
dos absorvidos, e o catalogo continua originando os mesmos requisitos.

### O grupo que nao foi fundido, e por que

RN-08 (a quantidade disponivel), RN-31 (a situacao do lote) e RN-45 (o vencimento da etapa) foram
apontados como candidatos, porque as tres terminam em "e derivado, nunca digitado". **Nao foram
fundidas**, e a razao vale registro porque e o unico ponto em que o criterio foi recusado.

O que cada uma carrega de substantivo e a **formula**, e as tres formulas sao diferentes: a
quantidade sai da soma dos lotes abertos descontadas perdas e vendas, a situacao sai das etapas
vencidas, e o vencimento sai do evento de referencia com a ultima execucao. Fundi-las guardaria o
principio comum e jogaria fora o conteudo, e a primeira delas e o que sustenta o saldo de muda
pronta que este trabalho existe para demonstrar.

Mais de fundo: **"valor derivado nao se digita" falha no teste da propria §2.1 do B3.** Apague o
sistema e nao ha onde digitar. E principio de projeto, e nao regra do viveiro. A regra e cada
formula; o principio ja estava registrado na ressalva de RN-31, e continua la.

**A licao, e ela e nova:** o criterio de granularidade nao substitui o criterio de existencia. Duas
regras podem se parecer porque compartilham um principio de projeto, e nesse caso o parecido nao e
o negocio, e sim o software. Fundir por semelhanca de forma teria escondido isso.

### O que a fusao das regras corrigiu de quebra

Ao mover a ressalva de RN-32 para RN-27, apareceram duas afirmacoes que ja estavam erradas na §2.4:
RN-27 constava da lista das regras que **nao** precisam de ressalva, e a frase que atribui a origem
**ORG** as cinco citava quatro RF, faltando o de RN-12, cujos requisitos estao marcados como **EN**
e **OP**. O que e convencao do projeto em RN-12 nao e o turno, que foi observado, e sim a duracao
unica declarada para ele.

**Os identificadores foram renumerados outra vez**, so os RN desta vez, com RF, RNF, UC e TA saindo
com zero alteracoes. Este arquivo continua sendo o registro historico, e cita, de proposito, numeros
que ja nao existem.

---

## Decima passada: uma regra que afirmava um fato falso sobre o viveiro (31/08/2026)

A nona passada conferiu se os documentos batiam **entre si**. Esta passada e outra pergunta, e e a
mais dificil de automatizar: se o que os documentos afirmam sobre o viveiro **e verdade**. A
resposta, num ponto, era nao.

### Achado R: RN-12 negava a hora marcada, que existe no viveiro

RN-12 estava classificada como **Fato**, a categoria reservada ao que sobrevive ao teste da §2.1 do
`B3` (apague o sistema e veja se o enunciado continua verdadeiro), e dizia:

> "O trabalho do viveiro e **planejado por turno, nao por horario**: a unidade da agenda e dia x
> turno (manha ou tarde)."

A primeira metade e verdade. A segunda nao: a irrigacao das sete as oito tem horario na vida real,
e a carga de terra chega meio-dia. O enunciado nao sobrevivia ao proprio teste que o classificou.

**A causa nao foi descuido de redacao, foi uma fusao indevida.** Duas coisas diferentes tinham sido
tratadas como uma so:

| | O que e | Decisao |
|---|---|---|
| Planejar com hora | A tarefa tem horario e a agenda o registra | Existe no viveiro. RN-12 negava |
| Apontar hora de entrada e saida da pessoa | Medir quando cada um chegou e saiu | Controle de ponto, fora do escopo (`A1` §7) |

A segunda foi excluida por uma razao boa, e continua excluida. A primeira foi excluida **de
carona**, sem que ninguem a tivesse decidido: o enunciado que justificava a exclusao do controle de
ponto passou a valer tambem para a hora da tarefa, e o documento acabou afirmando que o viveiro
nunca planeja por hora.

### O repositorio ja denunciava a contradicao, e ninguem tinha lido os dois lados juntos

`rotinas/2-producao/01-agenda-de-pessoal.md` abria uma **excecao declarada** ("ha uma excecao, e e
declarada: a tarefa recorrente tem hora"), e o mesmo documento era citado como a **origem** de
RN-12. A regra e a sua propria fonte discordavam, no mesmo repositorio, em arquivos que se citam.
Enquanto isso, `assignments` nao tinha coluna de hora nenhuma: a excecao declarada nao tinha onde
morar.

**Nenhum script pegaria isto.** `verifica-rastreabilidade.mjs` confere se um identificador citado
existe; `confere-modelo-pt.mjs` confere se duas figuras desenham o mesmo modelo. Nenhum dos dois
le o que a frase diz. Foi o usuario, que conhece o viveiro, quem apontou.

### O que foi corrigido

- **RN-12** reescrita: o turno e a unidade e continua obrigatorio, e a tarefa que tem hora marcada a
  declara. A hora e opcional. O turno segue exigido porque os turnos **nao cobrem o dia inteiro**:
  entre as 11h e as 13h nao ha turno nenhum, e a hora sozinha nao diz a qual deles a tarefa
  pertence.
- **RF-27** emendado, sem RF novo: a contagem segue em 62.
- **`assignments`** ganhou `start_time` e `end_time`, nulaveis, na migration
  `20260901000008_agenda_hora_opcional.sql`, com `CHECK` que recusa fim sem inicio. `C6`, `C8` e a
  `fig14` do `modelo-dados-pt` acompanharam.
- **`A1` §7** mantem a exclusao do apontamento por relogio, agora justificada pelo que ela e
  (relacao de trabalho, e nao gestao de producao), e nao por uma afirmacao falsa sobre o viveiro.
- **`E2`** ganhou TA-69 e TA-70, e TA-12 foi reescrito: ele testava horas assumidas por turno, que e
  logica do custeio, cortado na oitava passada.

### O que a passada limpou de quebra

`rotinas/2-producao/01-agenda-de-pessoal.md` foi **reescrito por inteiro**. Ele ainda descrevia o
sistema anterior a reducao de escopo: apontamento por relogio, horas reais, valor-hora medio,
custo de mao de obra rateado por especie, tela do colaborador (que nao tem acesso ao sistema) e
quatro entidades que nao existem (`task_executions`, `labor_rates`, `task_recurrences`,
`task_recurrence_members`). Citava tambem `05-apontamento-de-tarefas.md`, arquivo que nao existe, e
`src/lib/offline-queue.ts`, num repositorio que nao tem `src/`.

O mesmo residuo aparecia em `00-visao-geral.md` da producao (que listava quatro subrotinas, uma
delas o apontamento), em `04-lotes-e-canteiros.md`, em `06-protocolo-de-atividades.md` e no
prototipo `F1`, cujo UC-21 mostrava um mockup de **fechar o dia** com horas apontadas por pessoa.
Todos corrigidos.

**A licao:** a oitava passada cortou o escopo nos artefatos de engenharia e parou ali. A
documentacao de dominio, que e a **fonte** citada por eles, ficou descrevendo o sistema antigo, e
foi por ali que uma afirmacao falsa voltou a entrar na engenharia. Fonte que nao acompanha o corte
nao fica so desatualizada: ela realimenta o que foi cortado.

---

## Decima primeira passada: o requisito que ninguem precisaria ler (31/08/2026)

> **Os identificadores desta secao sao os que vigoravam antes do corte**, e varios ja nao existem
> ou passaram a designar outro requisito depois da renumeracao. E a convencao deste arquivo, e aqui
> ela importa mais do que de costume: sete ids foram apagados e trinta e tres mudaram de numero na
> mesma passada.

As duas passadas anteriores de reducao perguntaram se dois enunciados eram **o mesmo**: a de 30/08
fundiu oito pares de RF (70 -> 62), a de 31/08 fundiu cinco grupos de RN (60 -> 54). Esta pergunta e
outra, e e a primeira que **apaga** em vez de fundir:

> Dado o resto da especificacao, quem fosse implementar o sistema chegaria ao mesmo resultado sem
> este enunciado? Se sim, ele nao acrescenta informacao nem muda decisao.

### Tres formas de obvio, e sete cortes

| Forma | O que e | Cortados |
|---|---|---|
| **Exemplo resolvido** | Instancia um requisito mais geral, que ja o decide | RF-31 (exigir o lote), caso particular de RF-21, que ja manda pedir exatamente o que o tipo de tarefa declarar exigir |
| **Definicao travestida de exigencia** | Define um termo do glossario em vez de exigir comportamento | RF-44, que enunciava a razao que define mortalidade, ja dita em RN-11 e em `A2` |
| **Mecanismo de fiscalizacao** | Diz como outro RNF e cobrado, e nao uma exigencia propria | RNF-18 (bloquear alteracao na main), mecanismo de RNF-17; RNF-22 (verificacao antes do envio), mecanismo de RNF-19, RNF-21 e RNF-23 |

Sairam ainda **RF-49**, que reapresentava o alerta de RF-45 (cuja propria coluna de verificacao ja
dizia "visivel no mapa"), **RF-26**, que prescrevia um componente de abas e por isso pertence ao
prototipo `F1`, e **RNF-07**, contido em RNF-05: o que funciona sem conexao funciona em rede lenta, e
"tempo aceitavel para uso real" nao era criterio verificavel.

**Nenhuma funcionalidade saiu.** O que cada corte dizia de proprio foi absorvido: RF-30 passou a
exigir o lote do tipo que o declara, e RF-45 a calcular a taxa, apresenta-la no mapa e destacar quem
passa do limite. Os testes seguiram o mesmo caminho: TA-30 foi reapontada para RF-30, TA-48 foi
absorvida por TA-24, e so TA-33 e TA-59 desapareceram, porque o que elas verificavam deixou de ser
requisito. Contagens novas: **RF 62 -> 58, RNF 27 -> 24, TA 70 -> 67**.

### Dois sinais que o proprio documento ja dava, e ninguem tinha lido como sinal

- **A coluna Verificacao de RF-45 dizia "alerta visivel no mapa"**, que e literalmente o enunciado de
  RF-49. Um requisito descrevia o outro na sua propria condicao de aprovacao.
- **RF-44 e RF-45 compartilhavam UC-30 e TA-24.** O criterio de granularidade de `B2` §1, escrito na
  passada de 30/08, diz que isso e um requisito so. O par sobreviveu aquela passada porque ela
  procurava enunciados *parecidos*, e estes dois nao se parecem: um calcula, o outro alerta. So o
  compartilhamento de teste denunciava.

### As regras de negocio: nada a cortar, e e resultado

Aplicado o mesmo criterio as 54 RN, **nenhuma se mostrou dispensavel**, e as duas mais fracas se
defendem sozinhas: RN-29 (ocupacao = soma dos saldos) parece aritmetica decorrente de RN-19 e RN-22,
mas e nela que `B3` §6.3 pendura um achado real, o aviso de que a leva nao cabe no canteiro, que
nenhum RF realiza; e RN-49 (LGPD) origina zero RF, mas cortar a linha leria-se como abandonar o
mapeamento de `E5`. RN-21 ("nenhum lote tem saldo negativo") e obviedade fisica, e continua porque e
o exemplo canonico das §2.1 e §2.2 do proprio `B3`.

**Quatro RF/RNF foram examinados e mantidos**, e ficam registrados para nao serem reexaminados a
cada passada: RF-32 espelha o RF de lote que saiu, mas carrega campo proprio (a area da tarefa sem
lote); RF-35 e RF-47 dizem a ocupacao duas vezes, em lista e em desenho, e o desenho e o que este
trabalho demonstra; RNF-10 divide TA-62 com RNF-09, mas protege outro objeto; RF-03 e banal, porem e
o unico *deve ter* de encerramento de sessao, ja que RF-07 e *deveria ter*. A decisao esta repetida
em `B2` §1, ali com a numeracao nova, para nao ser reaberta a cada leitura.

### O que a passada limpou de quebra

O mapa `NOME` de `scripts/build-b4-quadros.mjs`, que guarda o nome curto de cada RF e nao existe em
nenhum artefato, tinha **oito chaves duplicadas**: `RF-11`, `RF-15`, `RF-24`, `RF-26`, `RF-34`,
`RF-36`, `RF-45` e `RF-56`. Sao residuo da fusao de 30/08: `renumerar.mjs` reescreve `scripts/*.mjs`,
e ao renumerar o RF absorvido a chave dele caiu em cima de uma existente. Em objeto literal a ultima
vence **em silencio**, e por sorte a ultima era a certa em todos os oito, entao o `B4` publicado
nunca chegou a ficar errado. O mapa foi reescrito sem duplicatas.

**Nenhum script pegaria nem uma coisa nem outra.** `verifica-rastreabilidade.mjs` confere se um
identificador citado existe, e os oito existiam; `build-b4-quadros.mjs` so avisa `FALTA NOME` quando
falta chave, e nao quando sobra. Duplicata em objeto literal nao e erro de sintaxe, e obviedade de
requisito nao e erro de nada: as duas exigem leitura.

**A licao:** o pipeline confere **correspondencia** (o id citado existe, as duas figuras desenham o
mesmo modelo, a tabela derivada bate com a fonte). Nao ha, e provavelmente nao pode haver,
verificacao automatica de que um enunciado **valha a pena estar escrito**. Tres passadas seguidas de
reducao encontraram tres criterios diferentes (mesmo enunciado partido, mesmo caso de uso e teste,
enunciado dispensavel), e nenhum deles saiu de um script.

## Decima segunda passada: o modelo de dados deixou de ser bilingue (10/09/2026)

O banco nomeava tabelas e colunas em ingles porque o **RNF-15** mandava. A pasta
`modelo-dados-pt` existia por causa disso: as figuras do TCC precisavam do portugues, e alguem
traduzia a mao. O `confere-modelo-pt.mjs` carregava uma tabela de 27 pares so para conseguir
comparar os dois lados.

**As duas linguas acabaram.** O banco passou a ser o que as figuras ja eram. O que mudou:

- As oito migrations foram **reescritas no lugar**, e nao acrescidas de uma migration de `ALTER`.
  Banco de desenvolvimento se recria do zero; o de producao vive noutro repositorio, e e de la que
  o ajuste sai. Isso contraria a compatibilidade retroativa que o `CLAUDE.md` exige, e a excecao
  foi decidida em conjunto: manter o historico em ingles conservaria justamente o que a passada
  existe para remover.
- `C6` §3 e `C8` inteiro seguiram. O `C6` §2, o conceitual, ja estava em portugues e nao mudou.
- O `RNF-15` foi removido, e os RNF fecharam de 24 para 23 por `renumerar.mjs`.
- O `confere-modelo-pt.mjs` perdeu a tabela `PT` e o fallback `?? m[1]`: os dois lados escrevem o
  mesmo nome, e nao ha mais o que traduzir antes de comparar.
- O de-para completo (33 entidades e tipos, 136 colunas, 70 indices, restricoes e gatilhos) ficou
  em `docs/engenharia/modelo-dados-pt/de-para-ingles-portugues.md`. Ele existe para o repositorio
  do aplicativo, que continua apontando para os nomes antigos.

**Tres tokens mudavam de destino conforme a tabela**, e sao os unicos: `role` e `perfil` em
`usuarios` e `papel` em `cadastro.pessoas_papeis`; `closed_at` e `encerrado_em` no lote e
`fechada_em` na semana; `active` e `ativa` em `especies` e `cadastro.pessoas`, pelo genero do nome
da entidade, e `ativo` em todas as demais. Traducao por token inteiro, aplicada de uma vez, nao
resolve nenhum dos tres sozinha, e cada um exigiu decisao escrita.

### O que a passada deixou de proposito em ingles

`docs/rotinas/` **nao foi traduzido**, e a primeira tentativa mostrou por que. Aqueles documentos
citam, lado a lado, tabelas deste esquema e identificadores do repositorio do aplicativo: caminhos
(`src/lib/customers.ts`), nomes de funcao (`listParties`, `toggleUserActive`), nomes de branch
(`refactor/politica-e-parties`), scripts de `npm` (`db:migrate:status`) e tabelas que nunca
existiram aqui (`customers`, `suppliers`). A substituicao por token inteiro transformou
`fluxo-claude-code-git.md` em `fluxo-claude-codigo-git.md` e `.claude/settings.json` em
`.claude/parametros.json`. Foi revertida.

`docs/divida-tecnica.md` e `plans/P1-sistema-reduzido.md` ficaram de fora pelo mesmo motivo, e
`auditoria-divergencias.md` pelo motivo de sempre: registro historico cita o nome da epoca.

**A licao e a mesma de sempre, por outro caminho.** Renomeacao mecanica nao distingue o nome que o
esquema define do nome que o documento apenas menciona. Onde as duas coisas convivem no mesmo
arquivo, o script nao serve, e a escolha e traduzir a mao ou nao traduzir. Aqui foi nao traduzir, e
fica registrado que `docs/rotinas/` segue falando em `customers` e `orders` enquanto o banco fala
em `pessoas` e `pedidos`.

> **Superado em 10/09/2026 pela decima terceira passada**, que traduziu os tres alvos a mao. O
> registro acima fica porque descreve por que a substituicao automatica falhou, e essa parte
> continua valendo.


---

## Decima terceira passada: os tres alvos que a passada anterior deixou em ingles (10/09/2026)

A decima segunda passada renomeou o modelo de dados e parou em tres arquivos: `docs/rotinas/`,
`docs/divida-tecnica.md` e `plans/P1-sistema-reduzido.md`. Esta passada os fecha, e o caminho foi o
que a anterior ja tinha diagnosticado: **a mao, caso a caso**, porque nenhum script distingue o
nome que o esquema define do nome que o documento apenas menciona.

### Tres regras de corte

1. **Identificador do repositorio do aplicativo fica em ingles.** Caminho (`src/lib/parties.ts`),
   funcao (`mergeParties`, `listParties`), branch (`refactor/politica-e-parties`), script de `npm`
   e arquivo de configuracao. Sao nomes reais de outro repositorio, e traduzi-los tornaria o
   documento falso. E a regra que faltava na tentativa automatica.
2. **Nome de tabela historica se resolve reescrevendo a frase**, e nao substituindo o token.
   "partida entre `customers` e `suppliers`" virou "cadastros separados de cliente e de
   fornecedor". O fato sobrevive sem o identificador.
3. **Bloco SQL que reproduz um esquema inexistente nao se traduz.** Ou sai junto com o arquivo, ou
   some.

### O achado: dez arquivos nao estavam so em ingles, estavam obsoletos

Nao ha uma frase em ingles nos tres alvos. A prosa ja era portuguesa, e o ingles estava sempre em
identificador entre crases. Mas dez arquivos de `docs/rotinas/` descreviam a tabela `customers`,
os campos fiscais, a emissao de nota, as cargas e as notificacoes, e citavam sete migrations
(`20260521100001_pedidos_customers.sql` e as seguintes) que **nao existem mais**. O `P1` diz
explicitamente que o sistema nao emite nota. Traduzi-los produziria SQL em portugues que nunca
rodou em banco nenhum.

Sairam `1-cadastros/clientes.md` e a pasta `1-cadastros/clientes/` (sete arquivos, 774 linhas), e
`3-comercial/pedidos/01-banco-de-dados.md` e `03-cadastro-pedido.md`. No lugar,
`1-cadastros/01-cadastro-unico.md` foi reescrito contra
`migrations/20260901000003_cadastro_pessoas_e_tarefas.sql`, e `3-comercial/pedidos.md` virou
indice curto do que existe.

**A reducao de escopo da oitava passada cortou os artefatos de engenharia e nao chegou as
rotinas.** E a mesma licao da decima passada, num diretorio diferente: o documento que ninguem
regera continua afirmando o mundo em que foi escrito.

### O que sobrou em ingles, e por que

`src/lib/parties.ts`, `mergeParties`, `listParties`, `refactor/politica-e-parties`,
`feat/cadastro-unico-casamento-pessoa`, `information_schema`, `_migrations`, `vi.mock`, `BYTEA` e
os `npm run *`, todos pela regra 1. E `input_usages` e `input_price_history` em
`divida-tecnica.md`, agora com a frase dizendo que sao os nomes da epoca: sao o fato do achado J,
e sem eles o achado deixa de ser verificavel.

### O que a passada nao resolveu

> **Superado em 10/09/2026 pela decima quarta passada**, que reduziu os dois arquivos, apagou
> `3-comercial/pedidos/` e fechou os links quebrados.

`1-cadastros/00-visao-geral.md` e `3-comercial/00-visao-geral.md` continuam descrevendo escopo
cortado (centros de custo, cotacao com fornecedor, custeio, valor-hora, entregas por carga,
`/financeiro`). Isso e conteudo, nao idioma, e fica para a proxima passada de reducao. Os links
para `plans/P13`, `plans/P15` e `centros-de-custo.md` ja estavam quebrados antes desta passada,
pelo mesmo motivo.

**Nenhum script pega nada disso.** `verifica-rastreabilidade.mjs` le os tres alvos, mas so confere
identificador de requisito; nome de tabela e invisivel para ele. Nao existe verificacao automatica
de idioma no repositorio, e a conferencia foi um `grep` da lista de tabelas antigas com inspecao de
cada ocorrencia restante contra as tres regras acima.

---

## Decima quarta passada: a reducao chega as visoes gerais das rotinas (10/09/2026)

A passada anterior fechou o idioma e deixou escrito o que faltava: as duas visoes gerais de area
continuavam descrevendo escopo cortado. Esta passada as fecha, e o alvo cresceu no caminho, porque
o mesmo problema estava em mais tres arquivos.

### A fonte da verdade usada em cada caso

Nao foi julgamento de escopo. Cada afirmacao foi conferida contra o artefato que a define, e onde
os dois discordavam, quem estava errado era a rotina:

| Alvo | Conferido contra |
|---|---|
| Quem cadastra o que | `D4` §2 (a matriz) e §3.1, §3.2, §3.4 |
| Campo de tabela | `migrations/20260901000003` e `20260901000006` |
| Enunciado de requisito | `B2`, RF-10 a RF-25 e RF-54 a RF-58 |
| Taxonomia de area e etapa | `00-mapa-de-rotinas.md`, que ja estava reduzido |

### O que saiu

`1-cadastros/00-visao-geral.md` foi reescrito inteiro. Sairam os centros de custo (linha de tabela,
no da arvore, paragrafo proprio e link para `centros-de-custo.md`, que nao existe), a cotacao com
fornecedor e as quatro rotas dela, o valor-hora medio da equipe, o encadeamento do tipo de tarefa
ate o custo de mao de obra, `/financeiro/custos-fixos`, as linhas Financeiro e Custeio/Precificacao
da tabela final e as citacoes a `P11`, `P12`, `P13`, `T13.3` e `T13.7`.

`3-comercial/00-visao-geral.md`, de 47 linhas, perdeu o miolo: o diagrama de quatro etapas com
cargas e separacao, o ramo de cotacao, o paragrafo sobre entrega nao ser a quinta etapa, a linha
"4 · Financeiro" da tabela e o "Modulo 3 de 4" do cabecalho. Sao tres areas, e nao quatro.

`3-comercial/pedidos/` foi apagada. Sobrara um arquivo da versao pre-reducao, com cargas
multi-viagem, oito status, notificacoes in-app e uma lista de seis arquivos de implementacao que a
passada anterior ja tinha apagado. O `README` e o mapa apontavam para a pasta.

`2-producao/00-visao-geral.md` perdeu a tela de custo de mao de obra e a secao `### Colaborador`
inteira, que descrevia duas telas para um perfil que saiu do sistema em 28/08/2026.

`06-protocolo-de-atividades.md` perdeu os dois links para `plans/P15`.

### O achado: o arquivo ja reduzido tambem estava errado

`3-comercial/pedidos.md` e `1-cadastros/01-cadastro-unico.md` foram reescritos na passada anterior
e passaram por reduzidos. Nao estavam.

- `pedidos.md` descrevia o fluxo como `cadastro (chefia) -> verificacao (gerencia) -> confirmacao
  (chefia)` e dedicava uma secao ao **item generico**, em que a gerencia escolhe as especies. O
  `D4` §3.2 diz que a gerencia **nao le pedido**, e `pedidos_itens.especie_id` e `NOT NULL`. As
  duas coisas sairam, e o fluxo virou `rascunho -> confirmado`, com `cancelado` ao lado, que e o
  `CHECK` da migration.
- `01-cadastro-unico.md` afirmava que "a leitura nao e uniforme" e que a gerencia nao fica sabendo
  que uma pessoa tambem e fornecedora. A nota 2 do `D4` §2 diz o contrario: Pessoas e **um recurso
  so**, e os papeis nao se separam. A unica restricao e a ficha fiscal (§3.1).

**A licao e a mesma da decima terceira passada, um nivel mais fundo:** reescrever um documento
contra a migration acerta o schema e nao acerta o processo. Quem descreve quem faz o que tem de ler
a matriz de acesso, e nao so o `CREATE TABLE`.

De quebra, `1-cadastros/00-visao-geral.md` era o unico arquivo de `docs/rotinas/` que citava
caminho de codigo (`src/lib/modules.ts`, `src/app/cadastros/pessoas/actions.ts`,
`src/lib/parties.ts`). Este repositorio nao tem `src/`. As citacoes foram trocadas por migration e
`C8`, que e a ancora que os outros arquivos usam.

### O que os scripts pegaram, e o que nao pegaram

`verifica-rastreabilidade.mjs` e `confere-mapas.mjs` passam limpos, antes e depois: nenhum dos dois
enxerga escopo. A conferencia foi um `grep` da lista de termos cortados sobre `docs/rotinas/`, mais
um verificador de link relativo escrito para esta passada. Ele achou um link morto fora do alvo, o
`plans/P13` no achado H deste arquivo, que virou texto simples: o registro historico fica, o 404
sai.

As tres mencoes a "carga" que sobreviveram sao a carga de terra que chega meio-dia
(`01-agenda-de-pessoal.md`) e a que este arquivo acabou de escrever. A quarta,
em `04-lotes-e-canteiros.md`, dizia que "carga" continuava sendo um dos sentidos do termo no
sistema, e virou carregamento de caminhao, que nao e modelado.
