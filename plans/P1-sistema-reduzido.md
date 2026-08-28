# P1: Sistema reduzido, do cadastro ao pedido

> Roadmap único de implementação, escrito depois da redução de escopo.
> Domínio em [`docs/rotinas/00-mapa-de-rotinas.md`](../docs/rotinas/00-mapa-de-rotinas.md).
> Especificação em [`docs/engenharia/`](../docs/engenharia/), com o índice em
> [`00-indice.md`](../docs/engenharia/00-indice.md).

**Substitui os quinze planos anteriores (P1 a P15).** Eles cobriam custeio, precificação,
conciliação bancária, cotação com fornecedores, catálogo digital, site, Instagram, comércio
eletrônico, agente de WhatsApp e painel de indicadores, e nenhum deles pertence mais ao escopo. O
que sobreviveu deles está nas quatro fases abaixo.

---

## A ideia em uma frase

**Um cadastro que alimenta tudo, uma agenda que organiza a semana, um lote que diz onde a muda
está, e um pedido que enxerga o que existe pronto.**

## O que o sistema não faz, e é decisão

Não apura custo, não calcula preço, não importa extrato, não emite nota, não cota com fornecedor,
não mede a hora de entrada e saída de ninguém e não tem tela de campo. A delimitação está em
[`A1` §7](../docs/engenharia/A-fundacao/A1-documento-de-visao.md), e cada uma dessas ausências é o
que torna o restante entregável no prazo.

---

## Fase 1: Acesso e cadastro único

Nada funciona antes disto, porque é o que as outras duas áreas consomem.

| # | Tarefa | Requisitos | Situação |
|---|---|---|---|
| T1.1 | Autenticação, troca de senha no primeiro acesso e sessões ativas | RF-01 a RF-04, RF-07 | ✅ feito |
| T1.2 | Gestão de usuários e perfis, com os três papéis | RF-05, RF-06 | ✅ feito |
| T1.3 | Guarda de permissão por recurso, no servidor, a cada operação | RF-06, RNF-12 | ✅ feito |
| T1.4 | Cadastro de espécie, com nomes populares e foto no banco | RF-08, RF-09 | ✅ feito |
| T1.5 | Cadastro de recipiente e de insumo | RF-10, RF-11 | ✅ feito |
| T1.6 | Esquema `cadastro`: pessoa, papel e endereço | RF-140 | ✅ feito |
| T1.7 | Tela de pessoas com filtro por papel, e cadastro rápido no pedido | RF-36 a RF-39, RF-52, RF-69 | ✅ feito |
| T1.8 | Cadastro de áreas e canteiros | RF-80, RF-81 | ⬜ |
| T1.9 | Catálogo de tipos de tarefa, com as três declarações que comandam o formulário | RF-70, RF-82 | ⬜ |
| T1.10 | Configurações do sistema: período de trabalho e parâmetros | RF-83, RF-139 | ⬜ |

**T1.10 é a única tarefa de tela nova que não é cadastro**, e existe porque o mapa de lotes lê os
parâmetros dela. Sem ela, os limites de atraso e de mortalidade ficam em constante de código, e
mudá-los exige implantação.

## Fase 2: Lotes e movimentos

O lote é o que dá endereço à muda, e é pré-requisito da agenda e do pedido.

| # | Tarefa | Requisitos | Situação |
|---|---|---|---|
| T2.1 | Criar lote informando espécie, recipiente, quantidade e canteiro | RF-84 | ⬜ |
| T2.2 | Ocupação do viveiro por área e canteiro, com os livres distinguíveis | RF-85, RF-89 | ⬜ |
| T2.3 | Movimentos do lote, com o saldo auditável contra a soma deles | RF-87, RF-88 | ⬜ |
| T2.4 | Repicagem, criando o lote de destino ligado ao de origem | RF-86 | ⬜ |
| T2.5 | Perda como movimento, com causa em lista fechada | RF-26, RF-91 | ⬜ |
| T2.6 | Contagem física, gerando o movimento de ajuste | RF-23 | ⬜ |
| T2.7 | Divisão de lote | RF-135 | ⬜ |
| T2.8 | Saldo de muda pronta por espécie e recipiente | RF-22 | ⬜ |

**T2.3 é a tarefa que decide se o resto vale alguma coisa.** O saldo materializado em
`batches.current_quantity` só se justifica se a soma dos movimentos o reproduzir, e o teste TA-51
existe para conferir isso contra uma contagem manual.

## Fase 3: Agenda da semana e protocolo

| # | Tarefa | Requisitos | Situação |
|---|---|---|---|
| T3.1 | Grade da semana por funcionário, dia e turno | RF-71, RF-92 | ⬜ |
| T3.2 | Copiar a semana anterior, com as tarefas recorrentes preenchidas | RF-72 | ⬜ |
| T3.3 | Situação da semana: rascunho, publicada, fechada | RF-73 | ⬜ |
| T3.4 | Confirmar a tarefa, com os campos que o tipo de tarefa exigir | RF-98, RF-99, RF-107, RF-113 | ⬜ |
| T3.5 | Fechamento da semana assumindo o não confirmado, com a marca | RF-75 | ⬜ |
| T3.6 | Entrada da área em duas abas: agenda e mapa | RF-108 | ⬜ |
| T3.7 | Cadastro do protocolo por recipiente, com etapas e âncoras | RF-122 a RF-125, RF-133 | ⬜ |
| T3.8 | Motor: atribuir protocolo ao lote e gerar as ordens na agenda | RF-126, RF-127 | ⬜ |
| T3.9 | Motor: avanço de fase, contagem da execução real, uma ordem em aberto | RF-128 a RF-130 | ⬜ |
| T3.10 | Ficha do protocolo do lote, com vencimentos e situações | RF-131, RF-132, RF-134 | ⬜ |

**T3.8 e T3.9 são o único código do sistema que roda sem ninguém acionar**, e são os requisitos
sem caso de uso ([`C1` §4.1](../docs/engenharia/C-modelagem/C1-diagrama-casos-de-uso.md)). Escrever
o teste antes do código não é preferência aqui: comportamento automático sem critério de aceitação
é comportamento que ninguém sabe dizer se está certo.

**A âncora circular é validação de aplicação**, e o banco não a impede. Sem ela, duas etapas que se
ancoram mutuamente nunca vencem, em silêncio.

## Fase 4: Mapa de lotes e pedidos

| # | Tarefa | Requisitos | Situação |
|---|---|---|---|
| T4.1 | Visão `batch_health` e o mapa desenhado por área e canteiro | RF-117, RF-118 | ⬜ |
| T4.2 | Tarefa pendente e atraso ao apontar o lote | RF-119 | ⬜ |
| T4.3 | Mortalidade no mapa, com destaque acima do limite | RF-29, RF-120 | ⬜ |
| T4.4 | Cadastro de pedido com cliente, canal, itens e preço digitado | RF-41, RF-141 | ✅ feito |
| T4.5 | Saldo de muda pronta ao lado de cada item | RF-42 | ⬜ |
| T4.6 | Confirmação do pedido, travando os itens | RF-142 | ⬜ |
| T4.7 | Lista de pedidos com filtro por cliente, canal e período | RF-143 | ✅ feito |

**T4.5 é a tarefa que o trabalho existe para demonstrar.** É uma consulta, não um fluxo: soma os
lotes prontos daquela espécie e recipiente e exibe o número ao lado do item. Se ela funcionar, a
afirmação de que o sistema interliga produção e comercial deixa de ser promessa.

---

## Ordem e dependências

```
Fase 1 ─┬─> Fase 2 ─┬─> Fase 4 (mapa)
        │           └─> Fase 4 (pedido: T4.5 depende de T2.8)
        └─> Fase 3 ──> Fase 4 (mapa: T4.1 depende de T3.4 e T3.8)
```

**A Fase 1 bloqueia tudo**, e não por convenção: a agenda escala `cadastro.parties`, o lote
referencia espécie e canteiro, e o pedido referencia pessoa. Sem cadastro, não há o que registrar.

**O mapa é a última coisa a funcionar**, porque depende das duas fontes de pendência: a atribuição
lançada à mão (T3.4) e a ordem gerada pelo protocolo (T3.8). Construí-lo antes produz uma tela que
mostra todo lote como saudável, que é o contrário do que ela existe para fazer.

## Verificação

Cada tarefa fecha quando o caso de aceite correspondente passa. A correspondência entre requisito e
caso está na coluna Teste de
[`B5` §2](../docs/engenharia/B-requisitos/B5-matriz-rastreabilidade.md), e os casos em
[`E2`](../docs/engenharia/E-qualidade/E2-casos-de-teste-de-aceite.md).

Ao final de cada fase, rodar a conferência de rastreabilidade:

```bash
node scripts/verifica-rastreabilidade.mjs
```
