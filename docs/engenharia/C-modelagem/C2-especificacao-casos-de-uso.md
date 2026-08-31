# C2: Especificação de casos de uso

> **Artefato:** Especificação de casos de uso · **Bloco:** C, Modelagem
> **Destino no TCC:** Capítulo 4, seção 4.4 (amostra) e Apêndice (integral)
> **Fundamentação:** Pressman e Maxim (2016, p. 149) definem que "um caso de uso conta uma jornada
> estilizada sobre como um usuário [...] interage com o sistema sob um conjunto de circunstâncias
> específicas". Sommerville (2011) complementa que a descrição textual detalha o que o diagrama
> apenas indica.

---

## Como ler

Dez casos de uso, dos trinta e quatro catalogados em [`C1`](C1-diagrama-casos-de-uso.md), estão
especificados aqui. O critério de seleção foi duplo: **concentração de fluxos alternativos** e
**custo operacional do erro**. Cadastrar um insumo errado corrige-se em segundos; repicar para o
canteiro errado põe a leva num lugar em que ninguém vai procurá-la.

**UC-17 e UC-18 esticam o critério.** Os dois são manutenção de cadastro, e pela regra acima
ficariam de fora. Entram porque o **custo do erro é diferido**: âncora escolhida errada no
protocolo não produz sintoma nenhum na hora, e aparece semanas depois no lote que foi classificado
cedo demais. Erro que não se manifesta quando é cometido precisa de fluxo de exceção escrito, e
não de tela de cadastro genérica.

Todos têm como pré-condição comum uma **sessão autenticada** cujo perfil autoriza a operação, a
verificação ocorre a cada ação, e não apenas na entrada da tela (RF-06).

**O campo Requisitos lista o que o fluxo exercita, e não só o que o caso realiza.** Quatro fluxos
atravessam requisito que [`C1`](C1-diagrama-casos-de-uso.md) §4 atribui a outro caso de uso, e o
requisito aparece aqui marcado com *(de UC-nn)*: cadastrar pedido oferece o cadastro rápido de
cliente sem sair da tela, consultar disponibilidade lê o mesmo saldo que UC-29 apresenta, registrar
perda atualiza a mortalidade que UC-30 analisa, e dividir lote encerra o protocolo do lote de
origem. **A atribuição canônica é a do `C1`**, e é dela que a matriz
[`B5`](../B-requisitos/B5-matriz-rastreabilidade.md) §2 é gerada: sem a marca, ler os dois
documentos lado a lado daria a impressão de que o mesmo requisito tem dois donos.

Notação dos fluxos: **FP** fluxo principal, **FA** fluxo alternativo, **FE** fluxo de exceção.

---

## UC-31 · Cadastrar pedido

| | |
|---|---|
| **Ator principal** | Chefia |
| **Objetivo** | Registrar no sistema um pedido já negociado por WhatsApp, antes que o detalhe se perca |
| **Requisitos** | RF-58, RF-59, RF-15 *(de UC-10)* |
| **Frequência** | Diária |
| **Pré-condições** | Existe ao menos uma espécie e um recipiente cadastrados |
| **Pós-condições** | Pedido criado no estado *rascunho*, com ao menos um item e o preço unitário de cada um |

### FP: Fluxo principal

1. A chefia inicia o cadastro de um novo pedido.
2. O sistema solicita o cliente.
3. A chefia seleciona um cliente existente.
4. O sistema solicita o canal de venda e apresenta *atacado* como opção padrão.
5. A chefia confirma ou altera o canal.
6. A chefia adiciona um item informando espécie, recipiente, quantidade e **preço unitário**.
7. O sistema valida que a quantidade e o preço são positivos, apresenta ao lado do item o saldo de muda pronta daquela espécie e recipiente (UC-32) e acrescenta o item ao pedido.
8. A chefia repete os passos 6 e 7 para os demais itens.
9. A chefia informa, opcionalmente, a data prevista de entrega e observações.
10. A chefia conclui o cadastro.
11. O sistema registra o pedido no estado *rascunho*, atribui-lhe número sequencial e apresenta o total do pedido.

### FA-1: Cliente ainda não cadastrado

No passo 3, a chefia não localiza o cliente.

1. A chefia aciona o cadastro rápido sem sair da tela de pedido.
2. O sistema solicita apenas **nome e telefone**.
3. O sistema cria o cliente e o seleciona no pedido, retornando ao passo 4.

> O cadastro fiscal completo não é exigido aqui. Exigi-lo interromperia a única
> etapa do processo que compete com uma conversa de WhatsApp em andamento: a complementação ocorre
> depois, pelo cadastro de cliente (UC-11), e só quando houver nota a emitir no sistema externo.

### FA-2: Saldo menor que a quantidade pedida

No passo 7, o saldo de muda pronta é menor do que a quantidade que o cliente pediu.

1. O sistema **sinaliza** a diferença ao lado do item, sem recusá-lo.
2. A chefia decide manter o item como está e prossegue para o passo 8.

> O sistema informa, e não impede. O pedido registra o que foi negociado, e o viveiro vende com
> frequência muda que ainda vai ficar pronta: bloquear o item pelo saldo de hoje transformaria uma
> venda normal em erro de sistema. O saldo existe para que a chefia decida sabendo, e é essa a
> diferença entre informar e barrar.

### FE-1: Quantidade ou preço inválido

No passo 7, a quantidade ou o preço informado é zero ou negativo. O sistema recusa o item, informa o
motivo e mantém o pedido em edição, sem perder os itens já lançados.

---

## UC-32 · Consultar disponibilidade no pedido

| | |
|---|---|
| **Ator principal** | Chefia |
| **Objetivo** | Saber, no momento em que o item é lançado, quanta muda pronta a produção tem daquela espécie e recipiente |
| **Requisitos** | RF-60, RF-46 *(de UC-29)* |
| **Frequência** | Diária, dentro de UC-31 |
| **Pré-condições** | Existe ao menos um lote aberto |
| **Pós-condições** | Nenhuma: o caso de uso é de leitura e não altera dado nenhum |

### FP: Fluxo principal

1. A chefia informa espécie e recipiente num item de pedido.
2. O sistema soma o saldo dos lotes abertos daquela espécie e recipiente que estão na fase de **muda pronta**.
3. O sistema apresenta o saldo ao lado do item, com a data da consulta.

### FA-1: Nenhum lote pronto

No passo 2, não há lote na fase de muda pronta. O sistema apresenta saldo zero e indica, quando
houver, a quantidade em produção daquela espécie e recipiente, que **não compõe** o saldo
disponível (RN-06).

> Distinguir "não tenho" de "tenho, mas ainda não está pronto" é o que permite à chefia responder
> ao cliente com uma data em vez de uma recusa. Somar as duas quantidades num número só faria o
> sistema prometer muda que não existe.

### FE-1: Espécie sem recipiente correspondente

No passo 1, a combinação de espécie e recipiente nunca foi produzida. O sistema apresenta saldo
zero, sem tratar o caso como erro: é pedido de algo que o viveiro ainda não faz, e essa é uma
informação comercial legítima.

> **Este caso de uso é a interconexão que o trabalho existe para demonstrar.** Ele não tem tela
> própria, não grava nada e não tem pós-condição: é uma leitura da Produção dentro de uma tela do
> Comercial. Especificá-lo em separado registra que o número exibido é **derivado**, e não
> digitado, que é exatamente o que distingue este sistema da planilha que ele substitui.

---

## UC-33 · Confirmar pedido

| | |
|---|---|
| **Ator principal** | Chefia |
| **Objetivo** | Encerrar a edição do pedido, fixando itens, quantidades e preços |
| **Requisitos** | RF-61 |
| **Frequência** | Diária |
| **Pré-condições** | Pedido no estado *rascunho*, com ao menos um item |
| **Pós-condições** | Pedido *confirmado*; itens não admitem mais alteração |

### FP: Fluxo principal

1. A chefia abre um pedido em rascunho.
2. O sistema apresenta os itens com espécie, recipiente, quantidade, preço unitário, total do item e o saldo disponível de cada um.
3. O sistema apresenta o total do pedido.
4. A chefia confirma o pedido.
5. O sistema registra o pedido como *confirmado* e passa a recusar inclusão e alteração de item.

### FA-1: Pedido cancelado

No passo 4, a chefia cancela em vez de confirmar. O sistema registra o pedido como *cancelado*,
preservando os itens para consulta.

### FE-1: Pedido sem itens

No passo 4, o pedido não tem nenhum item. O sistema recusa a confirmação e informa o motivo.

### FE-2: Alteração depois de confirmado

A chefia tenta alterar um item de pedido já confirmado. O sistema recusa a operação.

> **Confirmar é o único estado que trava alguma coisa, e é de propósito.** O pedido não percorre
> aprovação de preço, verificação, separação nem entrega: essas etapas existem na operação e
> continuam acontecendo fora do sistema. O que o sistema garante é que o registro do que foi
> vendido não mude depois de fechado, que é a condição para ele servir de histórico.

---

## UC-25 · Registrar perda

| | |
|---|---|
| **Ator principal** | Gerência |
| **Objetivo** | Registrar mudas perdidas no momento e no local em que a perda é constatada |
| **Requisitos** | RF-40, RF-39, RF-44 e RF-45 *(de UC-30)* |
| **Frequência** | Diária |
| **Pré-condições** | Existe lote aberto com saldo |
| **Pós-condições** | Movimento de perda gravado no lote; mortalidade do lote recalculada; alerta emitido se ultrapassar o limite |

### FP: Fluxo principal

1. A gerência aciona o registro de perda.
2. O sistema apresenta um formulário de **quatro campos**: lote, quantidade, causa e observação.
3. A gerência seleciona o lote, de uma lista dos canteiros ocupados.
4. O sistema exibe a espécie, o recipiente e o canteiro do lote escolhido, sem pedi-los.
5. A gerência informa a quantidade perdida.
6. A gerência seleciona a causa em lista fechada, seca, praga, geada, manuseio ou outro.
7. A gerência confirma.
8. O sistema grava o movimento de perda, exibe confirmação visual e retorna ao formulário vazio, pronto para o próximo registro.
9. O sistema baixa a quantidade do saldo do lote e recalcula a taxa de mortalidade do lote.

### FA-1: Mortalidade acima do limite

No passo 9, a taxa recalculada ultrapassa o limite mantido em Configurações, inicialmente 20%. O
sistema destaca o lote no mapa (UC-27), identificando taxa e causa predominante. **O registro não é
interrompido**: o alerta é uma leitura da tela seguinte, e não uma caixa a fechar.

### FA-2: Sem conexão

Nos passos 7 e 8, não há rede. O sistema grava localmente, confirma e envia ao restabelecer a
conexão. O recálculo do passo 9 ocorre na sincronização.

### FE-1: Quantidade inválida

No passo 5, a quantidade é zero, negativa ou não numérica. O sistema recusa, indica o campo e
preserva os demais já preenchidos.

### FE-2: Quantidade maior que o saldo do lote

No passo 7, a perda informada excede o que o lote ainda tem. O sistema recusa e apresenta o saldo
(RN-21): perda maior que o saldo significa que a contagem está errada, e gravar o negativo
propagaria o erro para o estoque. A correção é uma contagem física (UC-26), não uma perda maior.

> **Nota de projeto: como o quinto campo entrou sem virar campo.** Até 24/08/2026 este caso
> registrava que localizar a perda dentro do viveiro melhoraria a análise e **foi descartado**, por
> ser o campo que faria quem registra desistir de registrar. Com o lote, a decisão **não foi
> revertida, foi resolvida**: o formulário continua com quatro campos, e um deles deixou de ser
> "espécie" e "recipiente" para ser "lote", que carrega os dois **e mais o canteiro**. Passou-se a
> informar **menos**, e o sistema a saber mais. Ver
> [`B2`, seção 5](../B-requisitos/B2-especificacao-requisitos.md) e o achado L de
> [`auditoria-divergencias.md`](../../auditoria-divergencias.md).

---

## UC-22 · Criar lote

| | |
|---|---|
| **Ator principal** | Gerência |
| **Objetivo** | Registrar uma leva de mudas plantada junta e o canteiro que ela passa a ocupar |
| **Requisitos** | RF-34, RF-50 |
| **Frequência** | Semanal |
| **Pré-condições** | Existem espécie, recipiente e ao menos um canteiro livre cadastrados |
| **Pós-condições** | Lote aberto ocupando o canteiro, com saldo igual à quantidade inicial, um movimento de entrada e o protocolo do recipiente atribuído |

### FP: Fluxo principal

1. A gerência inicia a criação de um lote.
2. A gerência seleciona a espécie e o recipiente.
3. A gerência informa a quantidade de mudas.
4. O sistema apresenta as áreas e, dentro da escolhida, apenas os canteiros **livres**.
5. A gerência seleciona a área e o canteiro.
6. A gerência informa a data de plantio, que assume o dia corrente.
7. A gerência confirma.
8. O sistema cria o lote, gera o código, grava o movimento de entrada e atribui a ele o protocolo vigente do recipiente escolhido (RF-50).

### FA-1: A leva não cabe em um canteiro

No passo 3, a quantidade excede o que o canteiro ainda comporta, contando os lotes já abertos nele.
O sistema **avisa e não recusa** (RN-29), e a gerência escolhe: apertar mais, ou criar **dois
lotes**, um por canteiro, em vez de um lote em dois lugares (RN-19).

> **Por que não um lote em dois canteiros.** Seria uma entidade a mais e um campo a mais em toda
> tela que pede lote, para representar o que dois lotes já representam. E a pergunta que a
> operação faz é "o que tem neste canteiro", que o lote inteiro num canteiro só responde direto.
> **O canteiro comporta vários lotes** desde 26/08/2026: o que não existe é o lote espalhado.

### FA-2: Recipiente sem protocolo cadastrado

No passo 8, o recipiente escolhido ainda não tem protocolo. O lote é criado normalmente e **sem
etapas**: ele aparece no mapa como saudável e nunca cobra tarefa nenhuma. É estado válido e
visível, e não erro, porque o protocolo é cadastro que se monta uma vez por safra e o lote não pode
esperar por ele.

### FE-1: Canteiro já ocupado

No passo 7, o canteiro escolhido recebeu outro lote enquanto a tela estava aberta. O sistema recusa
e recarrega a lista de canteiros livres.

---

## UC-23 · Repicar lote

| | |
|---|---|
| **Ator principal** | Gerência |
| **Objetivo** | Passar mudas de um lote para recipiente maior, preservando a ligação com a leva de origem |
| **Requisitos** | RF-36, RF-37, RF-38 |
| **Frequência** | Semanal |
| **Pré-condições** | Existe lote aberto com saldo, e há canteiro livre para o lote de destino |
| **Pós-condições** | Lote novo aberto apontando para o de origem; saldo do de origem reduzido; dois movimentos gravados |

### FP: Fluxo principal

1. A gerência confirma a tarefa de repicagem (UC-20) e o sistema pede o destino das mudas.
2. O sistema exibe o lote de origem, com espécie, recipiente e saldo.
3. A gerência informa a quantidade repicada e o recipiente de destino.
4. A gerência seleciona a área e o canteiro de destino, entre os livres.
5. A gerência confirma.
6. O sistema grava um movimento de saída no lote de origem e cria o lote de destino com o movimento de entrada correspondente, apontando para a origem.
7. O sistema encerra o lote de origem se o saldo dele chegar a zero, liberando o canteiro.

### FA-1: Repicagem parcial

No passo 3, a quantidade é menor que o saldo. O lote de origem **permanece aberto** com o saldo
restante, e passa a ter um lote filho. É o caso normal: repica-se o que está no ponto.

### FA-2: Parte das mudas morreu na repicagem

No passo 3, entram menos mudas do que saíram. O sistema apresenta a diferença e pede a causa, em
lista fechada, gravando-a como **perda do lote de origem** no mesmo gesto (RN-28). A soma
"repicadas mais perdidas" tem de igualar a quantidade que saiu.

> Sem esta alternativa, a diferença viraria evaporação silenciosa: o saldo do lote de origem
> cairia sem que nada explicasse para onde a muda foi, e a mortalidade da espécie ficaria
> subestimada exatamente na etapa que mais mata.

### FA-3: Repica para o mesmo canteiro

No passo 4, o destino é o próprio canteiro do lote de origem, que se esvaziou por inteiro. O
sistema aceita, porque o passo 7 o liberou antes.

### FE-1: Quantidade maior que o saldo

No passo 5, a quantidade repicada somada à perdida excede o saldo do lote de origem. O sistema
recusa e apresenta o saldo disponível (RN-21).

---

## UC-20 · Confirmar tarefa realizada

| | |
|---|---|
| **Ator principal** | Gerência |
| **Objetivo** | Registrar que a tarefa planejada foi feita, e o que ela produziu |
| **Requisitos** | RF-30, RF-31, RF-32 |
| **Frequência** | Várias vezes ao dia |
| **Pré-condições** | Existe atribuição planejada na semana corrente, e a semana não está fechada |
| **Pós-condições** | Atribuição marcada como *confirmada*, com a quantidade de cada participante; movimento gravado no lote quando a tarefa moveu mudas |

### FP: Fluxo principal

1. A gerência aciona "confirmar" na célula da agenda.
2. Se o tipo de tarefa declarar **lote específico**, o sistema pede o lote, uma vez para a tarefa, e não pede canteiro, que vem do lote (RF-31).
3. Se o tipo de tarefa **não** exigir lote, o sistema oferece registrar a área ou o canteiro em que a tarefa foi feita (RF-32).
4. Se o tipo de tarefa for **quantitativo por unidade**, o sistema pede **um número por participante**: quanto cada um fez (RF-30).
5. Se o tipo de tarefa não for quantitativo, o passo 4 não ocorre e o sistema não pede número algum.
6. A gerência confirma.
7. O sistema marca a atribuição como *confirmada* para todos os participantes.
8. Se a tarefa movimentou mudas, o sistema grava o movimento no lote correspondente.

### FA-1: Tarefa de repicagem

No passo 8, a tarefa é repicagem. O sistema encaminha para UC-23, porque o destino das mudas
precisa ser informado antes que o movimento possa ser gravado.

### FA-2: Tarefa de classificação

No passo 8, a tarefa é classificação. O sistema pede, no mesmo formulário, quantas mudas foram
descartadas, e grava a perda como movimento do lote (RN-28). Separar os dois gestos faria a perda
ser esquecida.

### FA-3: Sem conexão

Nos passos 7 e 8, não há rede. O sistema grava localmente com a chave gerada no aparelho, confirma
e envia ao restabelecer a conexão (RNF-05). O reenvio não duplica a confirmação nem o movimento.

### FA-4: Confirmação sem quantidade

No passo 4, a gerência não sabe quantos um dos participantes fez e deixa o campo dele em branco. O
sistema aceita e marca **aquele** participante como sem contagem, sem afetar os demais: a tarefa
fica registrada como feita de qualquer modo, e tarefa feita sem contagem vale mais do que nenhum
registro.

### FA-5: Ordem do protocolo

No passo 1, a célula é uma ordem gerada pelo protocolo (RF-51), e não um lançamento manual. O lote
**já vem preenchido** pela ordem, e o passo 2 não pergunta nada: campo já respondido pela origem da
tarefa não é campo a pedir. A conclusão realimenta o protocolo, que passa a contar a ocorrência
seguinte a partir desta data (RF-53).

### FE-1: Quantidade inválida

No passo 4, um dos números é negativo ou não numérico. O sistema recusa e mantém a atribuição
planejada, sem gravar os demais participantes: ou confirma a tarefa inteira, ou não confirma parte
alguma dela.

### FE-2: Lote não informado

No passo 2, o tipo de tarefa declara lote específico e o lote não foi informado. O sistema recusa a
confirmação e mantém a atribuição planejada (RF-31): sem lote a atividade não se liga à leva, e a
perda não encontra destino.

### FE-3: Semana já fechada

No passo 6, a semana da atribuição foi fechada enquanto a tela estava aberta. O sistema recusa a
confirmação e informa o motivo (RF-29, RN-13): semana fechada não se altera, e o que ficou por
confirmar já entrou no realizado com a marca de não confirmado (RF-33).

> **Confirmar não é apontar hora.** A tarefa registra que foi feita e quanto rendeu, e nada mais.
> Medir a hora de entrada e de saída de cada pessoa seria controle de ponto, que está fora do
> escopo declarado em [`A1` §7](../A-fundacao/A1-documento-de-visao.md), e a agenda continua sendo
> planejada por turno (RN-12), que é como o viveiro sempre trabalhou.

---

## UC-17 · Manter protocolo de atividades

| | |
|---|---|
| **Ator principal** | Gerência |
| **Objetivo** | Definir, por recipiente, a sequência de etapas que todo lote daquele recipiente passa a seguir sozinho |
| **Requisitos** | RF-22, RF-23, RF-24 |
| **Frequência** | Raríssima: uma vez por recipiente, revista por safra |
| **Pré-condições** | Existem tipos de tarefa no catálogo e ao menos um recipiente |
| **Pós-condições** | Protocolo vigente para o recipiente; lotes criados a partir daí passam a segui-lo |

### FP: Fluxo principal

1. A gerência abre o cadastro de protocolos e escolhe o recipiente.
2. O sistema apresenta o protocolo vigente do recipiente, ou um protocolo vazio quando não há.
3. A gerência acrescenta uma etapa, escolhendo o tipo de tarefa no catálogo e dando-lhe um rótulo.
4. A gerência declara o agendamento: **sequencial**, que ocorre uma vez, ou **recorrente**, que repete (RF-22).
5. A gerência declara o **evento de referência**: a criação do lote, ou a conclusão de uma etapa já existente no protocolo, escolhida numa lista (RF-23).
6. A gerência informa o tempo em dias e, quando recorrente, o intervalo entre ocorrências.
7. A gerência informa o turno e decide se a etapa tem **alerta de atraso** ligado (RF-24).
8. Quando sequencial, a gerência escolhe, de forma opcional, a fase do lote que a conclusão da etapa passa a gravar.
9. O sistema valida a etapa e a acrescenta ao protocolo, na ordem escolhida.
10. A alteração passa a valer **apenas para o que ainda vai ser gerado** (RN-39).

### FA-1: Etapa que não altera a fase

No passo 8, a etapa é sequencial mas não corresponde a nenhuma mudança de fase do lote. A gerência
deixa o campo vazio e o sistema aceita: nem toda etapa sequencial promove o lote, e obrigar a
escolher uma fase faria inventar transições que o ciclo produtivo não tem.

### FA-2: Etapa com janela de aviso própria

No passo 7, a etapa precisa avisar antes ou depois do padrão. A gerência informa a janela própria,
em percentual do intervalo, e ela prevalece sobre o parâmetro geral (RN-37).

### FA-3: Alteração de protocolo com lotes em andamento

No passo 10, existem lotes seguindo o protocolo. O sistema **não** reescreve as ordens já emitidas
nem as datas já cumpridas: a alteração vale para a próxima geração de cada lote (RN-39). É a
mesma garantia que a ordem já gerada tem em RN-43, e a razão é a mesma: regra que reescrevesse o
passado apagaria dia já trabalhado.

### FE-1: Âncora circular

No passo 5, a etapa é apontada como âncora de outra que já é âncora dela, direta ou indiretamente.
O sistema recusa e indica o ciclo. **É validação de aplicação, e não do banco**: a restrição não
cabe em verificação declarativa, e sem ela as duas etapas nunca ganhariam data de referência, e
nenhuma das duas venceria coisa alguma, em silêncio.

### FE-2: Etapa recorrente sem intervalo

No passo 6, o agendamento é recorrente e o intervalo está vazio. O sistema recusa: recorrente sem
intervalo não tem como produzir a ocorrência seguinte, e aceitá-la criaria uma etapa que ocorre uma
vez e se apresenta como se repetisse.

### FE-3: Segundo protocolo vigente para o mesmo tipo

No passo 2, já existe protocolo vigente e a gerência tenta criar outro para o mesmo recipiente. O
sistema recusa e oferece editar o existente: dois vigentes tornariam indeterminado qual deles o
lote novo segue.

---

## UC-24 · Dividir lote

| | |
|---|---|
| **Ator principal** | Gerência |
| **Objetivo** | Separar uma leva em dois lotes que passam a ser conduzidos de forma independente |
| **Requisitos** | RF-42, RF-57 *(de UC-28)* |
| **Frequência** | Ocasional |
| **Pré-condições** | Lote aberto, com saldo maior que um |
| **Pós-condições** | Dois lotes abertos, cada um com o seu saldo e o seu protocolo; lote original encerrado com motivo `dividido` |

### FP: Fluxo principal

1. A gerência aciona "dividir" na ficha do lote.
2. O sistema apresenta o saldo atual e pede a quantidade que vai para o segundo lote.
3. A gerência informa a quantidade e o canteiro de cada resultante, que podem ser o mesmo.
4. O sistema cria os dois lotes, ambos apontando para o original como lote de origem.
5. O sistema **copia para cada um o acompanhamento do protocolo do original**: a fase e a data da última execução de cada etapa (RN-41).
6. O sistema encerra o original com motivo `dividido`, e **cancela** as ordens dele ainda em aberto (RN-40).
7. O sistema grava os movimentos que explicam o saldo dos três lotes.
8. Daí em diante, os dois resultantes vencem e cumprem etapas de forma independente.

### FA-1: Divisão que mantém os dois no mesmo canteiro

No passo 3, os dois resultantes ficam onde estavam. O sistema aceita: um canteiro comporta vários
lotes (RN-19), e a divisão é frequentemente contábil, e não física.

### FA-2: Etapa já vencida no momento da divisão

No passo 5, o original tem etapa vencida e não executada. Os dois resultantes **herdam o
vencimento vencido**, e nascem os dois em atraso naquela etapa. É o correto: a limpeza que não foi
feita continua não tendo sido feita, em nenhuma das duas metades.

### FE-1: Quantidade igual ou maior que o saldo

No passo 3, a quantidade informada não deixa saldo para o primeiro lote. O sistema recusa: divisão
que esvazia um dos lados não é divisão, é transferência de canteiro, e existe caminho próprio para
ela.

### FE-2: Lote com apontamento em curso

No passo 1, há tarefa aberta sobre o lote. O sistema recusa e indica a tarefa: dividir com
apontamento em curso deixaria a execução apontando para um lote que passou a estar encerrado, e a
hora trabalhada perderia destino.

---

## UC-18 · Customizar tempo de etapa por espécie

| | |
|---|---|
| **Ator principal** | Gerência |
| **Objetivo** | Ajustar, para uma espécie, o tempo de uma etapa específica do protocolo |
| **Requisitos** | RF-25 |
| **Frequência** | Rara, e apenas para as espécies que fogem da média |
| **Pré-condições** | Espécie cadastrada e protocolo montado para o tipo de embalagem em questão |
| **Pós-condições** | A espécie passa a usar o tempo próprio; as demais seguem o do tipo de embalagem |

### FP: Fluxo principal

1. A gerência abre o cadastro da espécie e a seção de tempos do protocolo.
2. O sistema apresenta as etapas dos protocolos, com o tempo padrão de cada uma.
3. A gerência informa o tempo próprio da espécie na etapa que difere.
4. O sistema grava apenas o que foi preenchido, e o que ficou em branco continua vindo do protocolo (RN-38).
5. Lotes daquela espécie criados a partir daí passam a usar o tempo próprio.

### FA-1: Remover a customização

No passo 3, a gerência apaga o valor informado antes. O sistema remove a customização em vez de
gravar zero: zero seria uma etapa que vence no mesmo dia da âncora, e é o oposto do que apagar
significa.

### FE-1: Nenhum dos dois tempos preenchido

No passo 3, a gerência abre a customização de uma etapa e confirma sem informar nada. O sistema não
grava linha alguma: registro sem nenhum valor próprio faz a consulta de tempo efetivo percorrer um
caminho a mais para chegar ao mesmo número.

### FE-2: Alteração com lotes em andamento

No passo 5, existem lotes da espécie em curso. O novo tempo vale para os vencimentos **ainda não
gerados**, e não reescreve ordem já emitida (RN-39). O sistema informa quantos lotes serão
afetados na próxima geração, para que a gerência saiba o alcance antes de confirmar.

---

## Casos de uso não especificados

Os vinte e quatro casos restantes de [`C1`](C1-diagrama-casos-de-uso.md) são operações de manutenção
de cadastro e de consulta, cujo fluxo se resume a selecionar, preencher e confirmar, sem alternativas
relevantes. Especificá-los produziria repetição sem ganho analítico.

Três merecem registro por já estarem descritos em linguagem de negócio na documentação de domínio:
**UC-19 (montar a agenda da semana)** e **UC-21 (fechar a semana)**, em
[`docs/rotinas/2-producao/01-agenda-de-pessoal.md`](../../rotinas/2-producao/01-agenda-de-pessoal.md),
e **UC-27 (consultar mapa de lotes)**, em
[`docs/rotinas/2-producao/04-lotes-e-canteiros.md`](../../rotinas/2-producao/04-lotes-e-canteiros.md).
