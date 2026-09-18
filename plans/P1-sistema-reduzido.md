# P1: Sistema reduzido, do zero ao sistema em operação

> Roadmap único de implementação, em checklist. Marque `[x]` ao concluir cada tarefa.
> Domínio em [`docs/rotinas/00-mapa-de-rotinas.md`](../docs/rotinas/00-mapa-de-rotinas.md).
> Especificação em [`docs/engenharia/`](../docs/engenharia/), com o índice em
> [`00-indice.md`](../docs/engenharia/00-indice.md).

**Reescrito em 14/09/2026.** A versão anterior marcava acesso, catálogo, pessoas e pedido como
feitos, mas aquilo era o aplicativo antigo em inglês, noutro repositório, e não é herdado. Este
repositório tem a engenharia e as migrations em português, e **nenhuma linha de aplicação**: o
código começa aqui, na Fase 0.

## O que o sistema não faz, e é decisão

Não apura custo, não calcula preço, não importa extrato, não emite nota, não cota com fornecedor,
não mede a hora de entrada e saída de ninguém e não tem tela de campo. A delimitação está em
[`A1` §7](../docs/engenharia/A-fundacao/A1-documento-de-visao.md).

## Por que esta ordem

1. **Esqueleto andando primeiro.** Projeto, banco, teste, CI e publicação funcionando com uma tela
   vazia, antes de qualquer regra. Erro de infraestrutura descoberto na Fase 8 custa a semana.
2. **Dependências do [`D1` §4](../docs/engenharia/D-arquitetura/D1-arquitetura-c4.md).** O acesso
   protege tudo; o Cadastro único não depende de nada; a Produção consome o cadastro; o Comercial
   lê a Produção por uma aresta só.
3. **O mapa vem depois das duas fontes de pendência**, a agenda e o protocolo. Antes delas, ele
   pinta todo lote de saudável.
4. **A regra do saldo tem teste contra Postgres real.** Suíte só com mock já escondeu tabela
   inexistente ([`divida-tecnica.md` §2](../docs/divida-tecnica.md)).
5. **O motor do protocolo nasce do teste.** É o único código que roda sem ninguém acionar.

## Definição de pronto (vale para toda tarefa)

- Uma branch por fase, `feat/fase-<N>-<nome>` (ex.: `feat/fase-0-fundacao`), nunca `master`; um
  commit Conventional em português por tarefa ou grupo de tarefas.
- Testes Vitest em `__tests__/` ao lado do código; `npm test` verde.
- Permissão verificada no servidor pelo guard único (T1.4).
- Critério do RF (coluna do [`B2`](../docs/engenharia/B-requisitos/B2-especificacao-requisitos.md))
  conferido, e o caso de aceite do [`E2`](../docs/engenharia/E-qualidade/E2-casos-de-teste-de-aceite.md) passando.
- Mexeu em entidade: migration nova, `C6`, `C8` e `modelo-dados-pt` na mesma alteração.
- Mexeu em requisito, regra, caso de uso ou teste: `node scripts/verifica-rastreabilidade.mjs`.

---

## Fase 0: Fundação técnica

- [x] **T0.1** Criar o projeto Next.js 16 (App Router), React 19, TypeScript `strict` e Tailwind em `src/`
- [x] **T0.2** ESLint e Vitest configurados; scripts `dev`, `build`, `lint`, `typecheck`, `test`
- [x] **T0.3** `.gitignore` completo (`.env*`, `.next/`, `coverage/`) e `.env.example` sem segredo (RNF-19)
- [x] **T0.4** `src/lib/db.ts`: pool singleton, driver escolhido pelo host da `DATABASE_URL` (`*.neon.tech` usa `@neondatabase/serverless`, o resto usa `pg`), só no servidor
- [x] **T0.5** `scripts/migrate.ts` com `db:migrate` e `db:migrate:status`, usando `_migrations` e o mesmo critério de host; falha ruidosa ([`D3` §4](../docs/engenharia/D-arquitetura/D3-diagrama-implantacao.md))
- [x] **T0.6** Suíte de integração `test:db`: Postgres local limpo, todas as migrations aplicadas, tabelas declaradas comparadas com `information_schema` (dívida §2 e §3)
- [x] **T0.7** Helper de transação e tradução de erro, para nunca exibir mensagem do Postgres na tela
- [x] **T0.8** Hook de pre-commit (lint, testes e varredura de segredo). ✅ *Autorizado pelo usuário em 14/09/2026*
- [x] **T0.9** CI no GitHub Actions: lint, typecheck, `test` e `test:db` com serviço Postgres. *Passou no PR #2 em 14/09/2026; `master` é a branch padrão e exige o check `verificar`*
- [x] **T0.10** Casca visual mobile-first: layout, navegação e componentes base (botão com alvo de toque grande, campo, seleção fechada, aviso de gravação), conforme `F1` e RNF-01 a RNF-04, RNF-07
- [x] **T0.11** Publicação do esqueleto na Vercel com Neon `sa-east-1`, migrations aplicadas na publicação, HTTPS (RNF-12)

**Pronto quando:** uma página em produção lê `SELECT 1` do Neon, e o CI bloqueia PR com teste quebrado.

## Fase 1: Acesso

- [x] **T1.1** Senha com hash forte e sessão por token aleatório guardado só como hash em `sessoes`; cookie `HttpOnly`, `Secure` e `SameSite` (RF-01, RNF-08 a RNF-10). *scrypt; sessão de 30 dias renovada no uso*
- [x] **T1.2** Login com registro em `eventos_login` e bloqueio por tentativas falhas (RF-01, RF-04). *Cinco falhas bloqueiam 15 minutos*
- [x] **T1.3** Troca de senha obrigatória no primeiro acesso, e encerrar sessão (RF-02, RF-03)
- [x] **T1.4** `src/lib/permissions.ts`: a matriz do [`D4`](../docs/engenharia/D-arquitetura/D4-matriz-rbac.md) como dado, um guard por recurso e operação, e o acesso irrestrito do admin num ponto só; teste tabular contra a matriz e teste estático de que toda Server Action chama o guard (RF-06, RNF-11). *Guards em `src/lib/auth/guards.ts`*
- [x] **T1.5** Proteção de rota e menu que oculta o que o perfil não pode (`D4` §4)
- [x] **T1.6** Gestão de usuários pelo admin: criar, atribuir perfil, ativar, desativar e vincular a pessoa (RF-05); script `db:seed-admin`. *Senha provisória digitada pelo admin*
- [x] **T1.7** Sessões ativas, com encerramento à distância, e consulta da auditoria de acesso (RF-07, RF-04)

**Aceite:** TA-03, TA-08, TA-60, TA-62. *Em 14/09/2026: TA-03 e TA-08 por teste do guard, TA-60 pela varredura do
bundle do cliente após o build, TA-04 a TA-06 contra Postgres real. TA-62 (criar usuário gerência e entrar com ele)
aguarda execução manual no navegador.*

## Fase 2: Configurações

- [x] **T2.1** Período de trabalho: manter os turnos de `turnos_trabalho` (RF-08, UC-05). *Cria e altera horário; sem exclusão, o turno sai de uso desativado; jornada diária derivada dos turnos ativos*
- [x] **T2.2** Parâmetros: só alterar o valor, validado por `tipo_valor`, sem criar nem excluir (RF-09, UC-06). *Limite por chave (dias de 0 a 365, percentual de 0 a 100) e crítico maior que atenção*

**Aceite:** TA-07, TA-08, TA-12. *Em 14/09/2026: TA-08 por teste do guard e das actions; TA-07 (sem criar nem
excluir, valor gravado) e TA-12 (jornada acompanha o horário) contra Postgres real. Faltam as partes que dependem
de tela ainda inexistente: a agenda exibindo a jornada (Fase 5) e o mapa sem o destaque (Fase 7).*

## Fase 3: Cadastro único

- [x] **T3.1** Espécies: nome científico, nomes populares, características e busca por qualquer nome (RF-10, RNF-22). *Busca sem acento nem maiúscula; espécie sai de uso desativada, sem exclusão*
- [x] **T3.2** Foto em `especies_fotos`, servida por `/api/fotos/[id]`, nunca gravada em disco. *Reduzida no navegador a 1024 px (WEBP); tipo conferido pelos bytes; a foto trocada é apagada na mesma transação*
- [x] **T3.3** Recipientes e insumos (RF-11, RF-12). *Unidade de medida em lista fechada; os dois saem de uso desativados*
- [x] **T3.4** Áreas por letra e canteiros numerados, recusando número repetido na mesma área (RF-13). *Área só é excluída vazia, porque a chave apaga os canteiros em cascata*
- [x] **T3.5** `src/lib/pessoas.ts`: ponto único de escrita da identidade, dos papéis e dos endereços, que procura a pessoa existente antes de criar outra (RF-14). *Documento igual recusa e aponta a dona; telefone igual pergunta antes de criar; papel retirado fica inativo*
- [x] **T3.6** Validação de CPF e CNPJ como função pura, testada (RF-17). *`src/lib/documento.ts`, também na saída do campo*
- [x] **T3.7** Tela de pessoas: selo por papel, busca por nome, telefone ou documento, ficha completa PF e PJ, fornecedor, funcionário fixo ou diarista; dado fiscal oculto e recusado para a gerência (RF-16, RF-18 a RF-20). *Dado fiscal é o documento e o endereço de cobrança: sem a permissão, o SQL nem os seleciona nem busca por eles*
- [x] **T3.8** Componente de cadastro rápido de cliente, com nome e telefone, reaproveitado no pedido (RF-15). *`src/components/ClienteRapido.tsx`, hoje aberto na lista de pessoas*
- [x] **T3.9** Tipos de tarefa com as declarações que comandam o formulário (RF-21). *Com lote exigido, a espécie não é pedida*

**Pronto quando:** a chefia cadastra espécie, recipiente e pessoa; a gerência cadastra área, canteiro e tipo de tarefa, e não vê CPF.

**Aceite:** TA-09, TA-13, TA-14, TA-15, TA-50, TA-67. *Em 14/09/2026: TA-09, TA-13, TA-14, TA-15 e TA-67 contra Postgres real;
TA-50 e as recusas por perfil por teste das actions; o bundle do cliente varrido após o build, sem matriz nem SQL. Ficam para
as fases que têm a tela: TA-10 (agenda), TA-11 (confirmação), TA-49 e o resto de TA-63 (lote e pedido). O roteiro no
navegador com chefia e gerência aguarda execução manual. Fora do escopo: as espécies que o fornecedor fornece e a distância
do UC-13, sem tabela e com RF-19 desejável.*

## Fase 4: Lotes e movimentos

- [x] **T4.1** `src/lib/movimentos.ts`, a **porta única**: numa transação com trava de linha, grava em `movimentos_lote`, atualiza `quantidade_atual`, recusa saldo negativo e encerra o lote em zero liberando o canteiro (RF-33, RF-36). Teste de integração: a soma dos movimentos reproduz o saldo (TA-64). *A data do movimento sai do fuso do viveiro, não do `CURRENT_DATE` do Neon (UTC)*
- [x] **T4.2** Criar lote: código gerado, posição no canteiro e movimento de entrada (RF-32). *Código `AAAA-NNNN` sob trava consultiva por ano; posição no fim do canteiro, com o canteiro travado; migration `20260914000001` cria o índice `lotes_posicao_unica_no_canteiro` que o C8 já descrevia. Qualquer canteiro é aceito e a capacidade só avisa (RN-19, RN-28)*
- [x] **T4.3** Ocupação do viveiro por área e canteiro, com os livres distinguíveis (RF-33). *`/producao/lotes`*
- [x] **T4.4** Ficha do lote com o histórico de movimentos e o lote de origem (RF-35). *Mostra também os lotes que nasceram dele e a mortalidade*
- [x] **T4.5** Perda com causa em lista fechada, em até cinco campos (RF-37, RF-38, RNF-01). *Três campos e a causa tocada*
- [x] **T4.6** Contagem física, gerando o ajuste (RF-39). *Contagem igual ao saldo não grava movimento: a constraint só admite quantidade zero na transferência*
- [x] **T4.7** Transferência de canteiro
- [x] **T4.8** Repicagem: saída no lote de origem, lote novo apontando para ele, entrada no novo (RF-34). *As que morreram no processo viram perda do lote de origem na mesma transação (RN-27); repicar para o mesmo recipiente é recusado*
- [x] **T4.9** Alteração manual da fase do lote enquanto o protocolo não existe. ✅ *Confirmado em 14/09/2026: a gerência pode alterar a fase à mão. Sem `encerrado`, que só a porta põe*
- [x] **T4.10** Saldo de muda pronta por espécie e recipiente (RF-43, UC-29). *`saldoPronto` em `src/lib/estoque.ts`, a função que T8.2 vai ler*
- [x] **T4.11** Análise de perdas por período, espécie e causa, e o cálculo da mortalidade como função pura (RF-41, RF-42). *A taxa é do lote inteiro; o destaque no mapa fica para T7.3*

**Aceite:** TA-16 (sem a parte do protocolo), TA-17, TA-18, TA-19, TA-20, TA-64, TA-65, TA-66. *Em 14/09/2026: todos
contra Postgres real, com a soma dos movimentos conferida contra o saldo em cada caso, e as recusas por perfil por teste
das actions. TA-21 e TA-22 (quatro campos no celular) e o roteiro no navegador com a gerência aguardam execução manual;
TA-23 é da Fase 9, TA-24 e TA-25 do mapa (Fase 7).*

## Fase 5: Agenda da semana

- [x] **T5.1** Grade por funcionário, dia e turno, com hora opcional e vários participantes; tela larga no computador, lista no celular (RF-26, RNF-14). *`/producao/agenda`: semana de segunda a sábado; a tarefa do grupo aparece na linha de cada participante; funcionário inativo só aparece na semana em que trabalhou; lançar para vários dias de uma vez*
- [x] **T5.2** Formulário da atribuição comandado pelo tipo de tarefa: lote, espécie, recipiente, área ou canteiro só quando o tipo exige (RF-21, RF-30). *O campo que o tipo não declara é descartado no servidor. No planejamento lote, espécie e recipiente são opcionais (a semeadura se planeja antes de o lote existir); a confirmação exige o lote*
- [x] **T5.3** Situação da semana, rascunho, publicada e fechada, com trava no servidor (RF-28). *Toda escrita trava a linha da semana antes da atribuição, na mesma ordem em todo lugar*
- [x] **T5.4** Copiar a semana anterior com as tarefas recorrentes (RF-27). *Abrir a semana traz as recorrentes; "Copiar semana passada" traz o resto, só em semana sem outro lançamento. A cópia volta planejada, sem contagem, só com quem ainda é funcionário e com o lote só se aberto*
- [x] **T5.5** Confirmar tarefa: o lote uma vez, a quantidade por participante só se o tipo for quantitativo (RF-29). ✅ *Confirmado em 14/09/2026: confirmar a tarefa gera movimento no lote. Decidido na mesma data: a tarefa com lote oferece "Morreu alguma?", gravado como perda com `atribuicao_id`; "Confirmar e registrar a repicagem" leva ao formulário do lote, e os movimentos da repicagem apontam para a tarefa. Sem coluna nova em `tipos_tarefa`*
- [x] **T5.6** Fechar a semana, marcando o não confirmado (RF-31). *Só a semana publicada fecha; a planejada sem ninguém escalado segue pendente*
- [x] **T5.7** Entrada da Produção em duas abas, agenda e mapa (prancha do `F1`; o mapa entra na Fase 7). *A aba do mapa avisa que ainda não está pronto e aponta para Lotes*

**Aceite:** TA-10, TA-26 a TA-34. *Em 14/09/2026: todos contra Postgres real (TA-28 também na validação pura), com a
soma dos movimentos conferida contra o saldo na confirmação com perda e na repicagem ligada à tarefa; as recusas por
perfil por teste das actions. A jornada da agenda do dia sai de `jornadaDiaria` (TA-12). TA-58 (nove funcionários
no computador e no celular) e o roteiro no navegador com gerência e chefia aguardam execução manual.*

## Fase 6: Protocolo de atividades e motor

- [x] **T6.1** Migration do protocolo: `protocolos`, `protocolos_etapas`, `especies_protocolos_tempos`, `lotes_etapas`, a visão `lotes_etapas_vencimento` e as FKs de `lotes.protocolo_id` e `atribuicoes.lote_etapa_id`; atualizar `C6`, `C8`, `modelo-dados-pt` e CHANGELOG. *Onde o `C6` e as figuras discordavam do `C8`, prevaleceu o `C8`: `lotes_etapas` tem chave composta e não guarda vencimento. `lotes.data_plantio` virou `data_criacao`, e `data_plantio` renasceu anulável para a data real que o protocolo grava (TA-38)*
- [x] **T6.2** Cadastro do protocolo por recipiente: etapas ordenadas, sequencial ou recorrente, âncora, alerta e janela, com validação de âncora circular na aplicação (RF-22 a RF-24). *`/cadastros/protocolos`. A FE-1 (ciclo de âncoras) é da aplicação, com o ciclo indicado na mensagem, e a lista de âncoras não oferece a própria etapa. A FE-3 (segundo vigente) a tela evita e o índice único recusa. O admin atravessa a coluna `L` dele pelo acesso irrestrito do D4 §1.1, e o teste registra isso em vez de contrariá-lo*
- [x] **T6.3** Tempo de etapa por espécie (RF-25). *Seção "Tempos do protocolo" na ficha da espécie, listando as etapas ativas dos protocolos vigentes com o tempo padrão ao lado. O guard é `protocolos`, e não `especies`: o D4 nota 3 lista o RF-25 entre os recursos do protocolo, e guardá-lo como espécie tiraria da gerência o que o UC-18 lhe dá. Os dois campos em branco apagam a linha (FA-1), e zero é recusado, porque não é o mesmo que apagar*
- [x] **T6.4** Motor como função pura, **testes escritos antes**: vencimento contado da execução real (RF-49), sobrescrita por espécie e uma ordem aberta por etapa (RF-50). *`src/lib/protocolo-motor.ts`, sem `pg`, com a aritmética toda vinda de `datas.ts`. Os 18 testes saíram da prova de mesa da rotina 06 antes do módulo existir, e cobrem TA-37, TA-41, TA-42, TA-43, TA-44 e a herança do TA-46. A visão faz a mesma conta em SQL: a duplicação é deliberada, e a conferência dos dois lados contra os mesmos casos entra com o `protocolo.db.test.ts` do T6.5*
- [ ] **T6.5** Atribuir o protocolo vigente ao criar o lote, materializando `lotes_etapas` (RF-46)
- [ ] **T6.6** Apresentar as etapas vencidas ou a vencer como **sugestão** ao lado da semana, sem lançar nada na agenda; a sugestão aceita abre o lançamento já com a etapa, o lote e o tipo preenchidos, exigindo o que o tipo declarar (RF-47). *Corrigido em 18/09/2026: o texto anterior mandava gerar ordem na agenda, que é o comportamento que a revisão de 15/09 retirou ao reescrever a RN-41 e o RF-47. Sem agendamento diário: a tela resolve*
- [ ] **T6.7** Avanço de fase ao concluir etapa sequencial com fase resultante (RF-48); retirar o provisório de T4.9
- [ ] **T6.8** Ficha do protocolo do lote, com última execução, vencimento e situação (RF-51, RF-52)
- [ ] **T6.9** Encerramento do protocolo por saldo zero, expedição ou divisão, cancelando as ordens sem apagá-las (RF-53)
- [ ] **T6.10** Divisão de lote, herdando a fase e as datas das etapas (RF-40)
- [ ] **T6.11** Migration que faz `situacao_lote` considerar a etapa vencida mesmo sem atribuição lançada (RF-45)

## Fase 7: Mapa de lotes

- [ ] **T7.1** Mapa por área e canteiro, com os lotes abertos e a situação lida de `situacao_lote` (RF-44, RNF-14)
- [ ] **T7.2** Ao tocar no lote: a tarefa pendente mais antiga e os dias de atraso (RF-45)
- [ ] **T7.3** Mortalidade destacada acima do limite de Configurações (RF-42)

## Fase 8: Comercial

- [ ] **T8.1** Cadastro de pedido: cliente (com o cadastro rápido de T3.8), canal, itens com preço digitado e totais (RF-54, RF-55)
- [ ] **T8.2** Saldo de muda pronta ao lado de cada item, lido de T4.10 a cada consulta (RF-56)
- [ ] **T8.3** Confirmar e cancelar o pedido, travando os itens no servidor (RF-57)
- [ ] **T8.4** Lista de pedidos com filtro por cliente, canal e período (RF-58)

**Pronto quando:** a perda registrada num lote pronto muda o saldo exibido no item do pedido. É a interligação que o trabalho existe para demonstrar.

## Fase 9: PWA e registro sem conexão (cortável)

- [ ] **T9.1** Manifest, ícones e instalação no celular (RNF-23)
- [ ] **T9.2** Service worker com cache da casca
- [ ] **T9.3** Fila local idempotente para perda, contagem e confirmação de tarefa, com a migration da chave de idempotência (RNF-05)
- [ ] **T9.4** Indicador de pendentes e reenvio ao reconectar, testado em modo avião

## Fase 10: Pronto para operar

- [ ] **T10.1** Backup automático fora do Neon e **uma restauração cronometrada** (RNF-13, [`E6`](../docs/engenharia/E-qualidade/E6-plano-backup-recuperacao.md))
- [ ] **T10.2** Revisão contra `E5` (LGPD) e `E4` (ameaças) (RNF-20)
- [ ] **T10.3** Testes ponta a ponta dos três fluxos: lote e perda; semana montada e fechada; pedido com saldo
- [ ] **T10.4** Varredura dos requisitos de campo: até cinco campos, lista fechada, alvo de toque, confirmação visual e vocabulário do `A2`
- [ ] **T10.5** Carga inicial real: espécies, recipientes, áreas, canteiros, pessoas e os três usuários
- [ ] **T10.6** Todos os casos do `E2` executados, e a conferência de rastreabilidade limpa
- [ ] **T10.7** Avaliação de usabilidade do `F3` com chefia e gerência
- [ ] **T10.8** Atualizar `EXECUTION-GUIDE`, `divida-tecnica` e `contexto-projeto` com o estado real

---

## Ordem e dependências

```
Fase 0 -> Fase 1 -> Fase 2 -> Fase 3 -┬-> Fase 4 -┬-> Fase 6 -> Fase 7
                                      └-> Fase 5 -┘      └-> Fase 8 (T8.2 depende de T4.10)
                                                             Fase 9 -> Fase 10
```

**As Fases 4 e 5 podem correr em paralelo** depois da 3: o lote depende de espécie e canteiro, a
agenda depende de pessoa e tipo de tarefa. O protocolo precisa das duas, porque gera ordem de
agenda sobre lote.
