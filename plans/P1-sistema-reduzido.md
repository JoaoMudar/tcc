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

- Branch `feat/<fase>-<tarefa>`, nunca `main`; commit Conventional em português.
- Testes Vitest em `__tests__/` ao lado do código; `npm test` verde.
- Permissão verificada no servidor pelo guard único (T1.4).
- Critério do RF (coluna do [`B2`](../docs/engenharia/B-requisitos/B2-especificacao-requisitos.md))
  conferido, e o caso de aceite do [`E2`](../docs/engenharia/E-qualidade/E2-casos-de-teste-de-aceite.md) passando.
- Mexeu em entidade: migration nova, `C6`, `C8` e `modelo-dados-pt` na mesma alteração.
- Mexeu em requisito, regra, caso de uso ou teste: `node scripts/verifica-rastreabilidade.mjs`.

---

## Fase 0: Fundação técnica

- [ ] **T0.1** Criar o projeto Next.js 16 (App Router), React 19, TypeScript `strict` e Tailwind em `src/`
- [ ] **T0.2** ESLint e Vitest configurados; scripts `dev`, `build`, `lint`, `typecheck`, `test`
- [ ] **T0.3** `.gitignore` completo (`.env*`, `.next/`, `coverage/`) e `.env.example` sem segredo (RNF-19)
- [ ] **T0.4** `src/lib/db.ts`: pool singleton, driver escolhido pelo host da `DATABASE_URL` (`*.neon.tech` usa `@neondatabase/serverless`, o resto usa `pg`), só no servidor
- [ ] **T0.5** `scripts/migrate.ts` com `db:migrate` e `db:migrate:status`, usando `_migrations` e o mesmo critério de host; falha ruidosa ([`D3` §4](../docs/engenharia/D-arquitetura/D3-diagrama-implantacao.md))
- [ ] **T0.6** Suíte de integração `test:db`: Postgres local limpo, todas as migrations aplicadas, tabelas declaradas comparadas com `information_schema` (dívida §2 e §3)
- [ ] **T0.7** Helper de transação e tradução de erro, para nunca exibir mensagem do Postgres na tela
- [ ] **T0.8** Hook de pre-commit (lint, testes e varredura de segredo). ✅ *Autorizado pelo usuário em 14/09/2026*
- [ ] **T0.9** CI no GitHub Actions: lint, typecheck, `test` e `test:db` com serviço Postgres
- [ ] **T0.10** Casca visual mobile-first: layout, navegação e componentes base (botão com alvo de toque grande, campo, seleção fechada, aviso de gravação), conforme `F1` e RNF-01 a RNF-04, RNF-07
- [ ] **T0.11** Publicação do esqueleto na Vercel com Neon `sa-east-1`, migrations aplicadas na publicação, HTTPS (RNF-12)

**Pronto quando:** uma página em produção lê `SELECT 1` do Neon, e o CI bloqueia PR com teste quebrado.

## Fase 1: Acesso

- [ ] **T1.1** Senha com hash forte e sessão por token aleatório guardado só como hash em `sessoes`; cookie `HttpOnly`, `Secure` e `SameSite` (RF-01, RNF-08 a RNF-10)
- [ ] **T1.2** Login com registro em `eventos_login` e bloqueio por tentativas falhas (RF-01, RF-04)
- [ ] **T1.3** Troca de senha obrigatória no primeiro acesso, e encerrar sessão (RF-02, RF-03)
- [ ] **T1.4** `src/lib/permissions.ts`: a matriz do [`D4`](../docs/engenharia/D-arquitetura/D4-matriz-rbac.md) como dado, um guard por recurso e operação, e o acesso irrestrito do admin num ponto só; teste tabular contra a matriz e teste estático de que toda Server Action chama o guard (RF-06, RNF-11)
- [ ] **T1.5** Proteção de rota e menu que oculta o que o perfil não pode (`D4` §4)
- [ ] **T1.6** Gestão de usuários pelo admin: criar, atribuir perfil, ativar, desativar e vincular a pessoa (RF-05); script `db:seed-admin`
- [ ] **T1.7** Sessões ativas, com encerramento à distância, e consulta da auditoria de acesso (RF-07, RF-04)

**Aceite:** TA-03, TA-08, TA-60, TA-62.

## Fase 2: Configurações

- [ ] **T2.1** Período de trabalho: manter os turnos de `turnos_trabalho` (RF-08, UC-05)
- [ ] **T2.2** Parâmetros: só alterar o valor, validado por `tipo_valor`, sem criar nem excluir (RF-09, UC-06)

## Fase 3: Cadastro único

- [ ] **T3.1** Espécies: nome científico, nomes populares, características e busca por qualquer nome (RF-10, RNF-22)
- [ ] **T3.2** Foto em `especies_fotos`, servida por `/api/fotos/[id]`, nunca gravada em disco
- [ ] **T3.3** Recipientes e insumos (RF-11, RF-12)
- [ ] **T3.4** Áreas por letra e canteiros numerados, recusando número repetido na mesma área (RF-13)
- [ ] **T3.5** `src/lib/pessoas.ts`: ponto único de escrita da identidade, dos papéis e dos endereços, que procura a pessoa existente antes de criar outra (RF-14)
- [ ] **T3.6** Validação de CPF e CNPJ como função pura, testada (RF-17)
- [ ] **T3.7** Tela de pessoas: selo por papel, busca por nome, telefone ou documento, ficha completa PF e PJ, fornecedor, funcionário fixo ou diarista; dado fiscal oculto e recusado para a gerência (RF-16, RF-18 a RF-20)
- [ ] **T3.8** Componente de cadastro rápido de cliente, com nome e telefone, reaproveitado no pedido (RF-15)
- [ ] **T3.9** Tipos de tarefa com as declarações que comandam o formulário (RF-21)

**Pronto quando:** a chefia cadastra espécie, recipiente e pessoa; a gerência cadastra área, canteiro e tipo de tarefa, e não vê CPF.

## Fase 4: Lotes e movimentos

- [ ] **T4.1** `src/lib/movimentos.ts`, a **porta única**: numa transação com trava de linha, grava em `movimentos_lote`, atualiza `quantidade_atual`, recusa saldo negativo e encerra o lote em zero liberando o canteiro (RF-33, RF-36). Teste de integração: a soma dos movimentos reproduz o saldo (TA-64)
- [ ] **T4.2** Criar lote: código gerado, posição no canteiro e movimento de entrada (RF-32)
- [ ] **T4.3** Ocupação do viveiro por área e canteiro, com os livres distinguíveis (RF-33)
- [ ] **T4.4** Ficha do lote com o histórico de movimentos e o lote de origem (RF-35)
- [ ] **T4.5** Perda com causa em lista fechada, em até cinco campos (RF-37, RF-38, RNF-01)
- [ ] **T4.6** Contagem física, gerando o ajuste (RF-39)
- [ ] **T4.7** Transferência de canteiro
- [ ] **T4.8** Repicagem: saída no lote de origem, lote novo apontando para ele, entrada no novo (RF-34)
- [ ] **T4.9** Alteração manual da fase do lote enquanto o protocolo não existe. ✅ *Confirmado em 14/09/2026: a gerência pode alterar a fase à mão*
- [ ] **T4.10** Saldo de muda pronta por espécie e recipiente (RF-43, UC-29)
- [ ] **T4.11** Análise de perdas por período, espécie e causa, e o cálculo da mortalidade como função pura (RF-41, RF-42)

## Fase 5: Agenda da semana

- [ ] **T5.1** Grade por funcionário, dia e turno, com hora opcional e vários participantes; tela larga no computador, lista no celular (RF-26, RNF-14)
- [ ] **T5.2** Formulário da atribuição comandado pelo tipo de tarefa: lote, espécie, recipiente, área ou canteiro só quando o tipo exige (RF-21, RF-30)
- [ ] **T5.3** Situação da semana, rascunho, publicada e fechada, com trava no servidor (RF-28)
- [ ] **T5.4** Copiar a semana anterior com as tarefas recorrentes (RF-27)
- [ ] **T5.5** Confirmar tarefa: o lote uma vez, a quantidade por participante só se o tipo for quantitativo (RF-29). ✅ *Confirmado em 14/09/2026: confirmar a tarefa gera movimento no lote*
- [ ] **T5.6** Fechar a semana, marcando o não confirmado (RF-31)
- [ ] **T5.7** Entrada da Produção em duas abas, agenda e mapa (prancha do `F1`; o mapa entra na Fase 7)

## Fase 6: Protocolo de atividades e motor

- [ ] **T6.1** Migration do protocolo: `protocolos`, `protocolos_etapas`, `especies_protocolos_tempos`, `lotes_etapas`, a visão `lotes_etapas_vencimento` e as FKs de `lotes.protocolo_id` e `atribuicoes.lote_etapa_id`; atualizar `C6`, `C8`, `modelo-dados-pt` e CHANGELOG
- [ ] **T6.2** Cadastro do protocolo por recipiente: etapas ordenadas, sequencial ou recorrente, âncora, alerta e janela, com validação de âncora circular na aplicação (RF-22 a RF-24)
- [ ] **T6.3** Tempo de etapa por espécie (RF-25)
- [ ] **T6.4** Motor como função pura, **testes escritos antes**: vencimento contado da execução real (RF-49), sobrescrita por espécie e uma ordem aberta por etapa (RF-50)
- [ ] **T6.5** Atribuir o protocolo vigente ao criar o lote, materializando `lotes_etapas` (RF-46)
- [ ] **T6.6** Gerar as ordens na agenda, abrindo a semana em rascunho se ela não existir; função idempotente, chamada nos eventos e por um agendamento diário (RF-47)
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
