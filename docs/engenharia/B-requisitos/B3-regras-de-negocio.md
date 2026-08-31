# B3: Regras de negócio e vínculo com os requisitos

> **Artefato:** Catálogo de regras de negócio · **Bloco:** B, Engenharia de requisitos
> **Destino no TCC:** Capítulo 4, seção 4.3, Regras de negócio (os quadros formatados estão em [`B4`](B4-quadros-tcc.md))
> **Fundamentação:** Sommerville (2011) distingue os **requisitos de domínio**, os que derivam do
> domínio de aplicação e não da vontade do usuário, dos requisitos de usuário e de sistema. As
> regras aqui catalogadas são a expressão desse domínio: valem no viveiro independentemente da
> existência do software. Elmasri e Navathe (2011) sustentam a parte final, em que a regra se
> materializa como restrição de integridade no modelo de dados.

---

## 1. Como usar este documento

O documento tem uma finalidade dupla:

1. **Fonte do capítulo de regras de negócio** do TCC.
2. **Arquivo de alimentação** para geração automatizada das tabelas do trabalho. As seções 3, 4, 5 e
   6 são estruturadas para consumo direto: identificadores estáveis, uma regra por linha, sem
   informação implícita.

### Instruções para quem for gerar as tabelas a partir deste arquivo

- **Não invente identificadores.** As regras deste catálogo, os requisitos funcionais e não
  funcionais de [`B2`](B2-especificacao-requisitos.md) e as restrições `RE-1` a `RE-7` de
  [`A1`](../A-fundacao/A1-documento-de-visao.md) §9 são os únicos válidos.
- **Não converta regra em requisito.** Se o texto gerado começar com "O sistema deve", ele pertence
  a `B2`, não a este documento.
- **Um requisito pode servir a mais de uma regra**, e uma regra costuma originar vários requisitos.
  A relação é muitos-para-muitos: não force cardinalidade 1:1 nas tabelas.
- **A seção 6 é parte do resultado, não sobra.** Os requisitos que não decorrem de regra de negócio
  decorrem de restrição do ambiente ou de política do projeto, e isso é um achado a apresentar.
- O texto integral de todos os RF e RNF está no **apêndice (seção 7)**, para que a geração das
  tabelas não dependa de abrir `B2`.

### Tabelas sugeridas para o trabalho

| Tabela | Colunas | Fonte neste arquivo |
|---|---|---|
| Catálogo de regras de negócio | RN · Enunciado · Tipo · Requisitos originados | Seção 3 |
| Regras por área do domínio | Área · Quantidade de regras · Regras | Seção 3 |
| Rastreabilidade regra → requisito | RN · RF · RNF | Seção 3 (colunas 5 e 6) |
| Rastreabilidade inversa | RF · Regra que o origina | Seção 4 |
| Origem dos requisitos não funcionais | RNF · Regra ou restrição de origem | Seção 5 |
| Requisitos sem regra de negócio | RF/RNF · Origem alternativa | Seção 6 |

---

## 2. Convenções

### 2.1 O que é e o que não é regra de negócio

Critério adotado: **apague mentalmente o sistema**. Se o enunciado continua verdadeiro na operação do
viveiro, é regra de negócio. Se ele desaparece junto com o software, é requisito.

| | Regra de negócio (aqui) | Requisito funcional (`B2`) | Requisito não funcional (`B2`) |
|---|---|---|---|
| Formulação | "Nenhum lote tem saldo negativo" | "O sistema não deve permitir movimento que deixe o saldo negativo" | "Formulários de campo devem ter no máximo cinco campos" |
| Origem | O negócio | A regra, traduzida em comportamento | Restrição do ambiente ou política |
| Sobrevive sem o sistema | Sim | Não | Não |

### 2.2 Tipos de regra

Classificação adotada neste catálogo:

| Tipo | Significado | Exemplo |
|---|---|---|
| **Fato** | Afirma uma estrutura do domínio que o sistema precisa representar | RN-04: espécie e recipiente formam o produto |
| **Restrição** | Proíbe ou limita uma ação | RN-21: nenhum lote tem saldo negativo |
| **Derivação** | Define como um valor se obtém a partir de outros | RN-08: composição da quantidade disponível |
| **Acionamento** | Dispara uma providência quando uma condição se verifica | RN-11: mortalidade acima do limite |

### 2.3 Notação das colunas

- **Documentada em**: onde a regra já aparece registrada no projeto, antes deste catálogo.
- **RF originados**: requisitos funcionais que existem *porque* a regra existe.
- **RNF vinculados**: requisitos não funcionais que a regra exige ou condiciona. A maioria das
  regras não gera RNF: os não funcionais deste projeto derivam predominantemente das restrições do
  ambiente (ver seção 6). Célula vazia é informação, não omissão.

### 2.3.1 O critério de granularidade

**Duas regras que enunciam a mesma coisa sobre o mesmo objeto são uma regra só**, ainda que o
catálogo as tenha colhido em momentos diferentes. O sinal de alerta é a coluna *RF originados*: se
uma regra origina exatamente os mesmos requisitos que a vizinha, ou um subconjunto deles, é provável
que as duas sejam metades de um enunciado que foi partido na escrita.

O critério foi aplicado em 31/08/2026 e fundiu cinco grupos, de sessenta regras para cinquenta e
quatro. **Nenhuma regra do viveiro foi descartada**: os enunciados sobreviventes absorveram o texto
inteiro dos absorvidos.

| Regra | Absorveu | O que passou a ser um enunciado só |
|---|---|---|
| RN-24 | RN-29 | Contar por unidade e contar por pessoa: quatro pessoas produzem quatro números |
| RN-27 | RN-32 | Turno e limite de atraso são o mesmo tipo de coisa, parâmetro mantido |
| RN-37 | RN-40 | A janela de aviso e o alerta desligado governam o mesmo campo da etapa |
| RN-43 | RN-47, RN-48 | A ordem gerada é atribuição comum, sem escalação e na semana do vencimento |
| RN-45 | RN-53 | O conjunto fiscal existe **porque** a nota é emitida fora daqui |

**Três regras parecidas que continuam separadas, e é decisão.** RN-08 (a quantidade disponível),
RN-30 (a situação do lote) e RN-42 (o vencimento da etapa) terminam todas em "é derivado, nunca
digitado", e a tentação de fundi-las é grande. Elas não são fundidas por duas razões. A primeira é
que o que cada uma carrega de substantivo é a **fórmula**, e as três fórmulas são diferentes: a
quantidade sai da soma dos lotes abertos descontadas perdas e vendas, a situação sai das etapas
vencidas, e o vencimento sai do evento de referência com a última execução. Fundi-las guardaria o
princípio e jogaria fora o conteúdo, e a primeira delas é o que sustenta o saldo de muda pronta que
este trabalho existe para demonstrar. A segunda é que "valor derivado não se digita" **falha no
teste da §2.1**: apague o sistema e não há onde digitar. É princípio de projeto, e não regra do
viveiro; a regra é cada fórmula, e o princípio já está registrado na ressalva de RN-30, na §2.4.

### 2.4 Cinco regras que são convenção, não fato observado

O critério da seção 2.1 (apague o sistema e veja se o enunciado sobrevive) é limpo para quase
todo o catálogo, e áspero para cinco regras nascidas ao desenhar a agenda de pessoal e o mapa de
lotes:

| RN | Por que merece ressalva |
|---|---|
| **RN-12** | Que o viveiro planeje **por turno** é observação. Que o turno tenha uma **duração única declarada** é convenção: foi fixada para que a jornada da agenda tenha um padrão quando ninguém a alterar |
| **RN-13** | "A semana fecha e, fechada, não se altera" descreve uma disciplina que o viveiro **passará a ter**, não uma que já tinha. É pré-requisito de histórico estável, e por isso vale como regra, mas é regra imposta pelo projeto ao negócio, não colhida dele |
| **RN-14** | Assumir o planejado como realizado é **escolha metodológica** diante de dado faltante. A alternativa (agenda com buraco) não distingue o trabalho que não foi feito do que ninguém teve tempo de confirmar; a condição fica registrada justamente para que a suposição não se disfarce de medição |
| **RN-30** | Que o lote atrasado seja o que preocupa é observação: é assim que a chefia olha o viveiro, pelo que ainda não foi feito. Que a situação seja **derivada e nunca digitada** é decisão de projeto, e da mesma família de RN-08 e RN-29: guardar o número cria duas verdades sobre ele, e esta em particular envelheceria sozinha da noite para o dia |
| **RN-27** | Que o viveiro trate turno e atraso como coisas ajustáveis é observação; que a fronteira entre atenção e crítico caia em **três dias** é arbitragem do projeto. O número foi escolhido para a tela ter alguma cor, e é parâmetro justamente para poder estar errado sem exigir implantação |

Registrar a ressalva é mais defensável do que reclassificá-las como requisito: elas governam a
operação, e não a interface. Mas ao escrever o capítulo, atribuí-las à observação do viveiro seria
inexato: **a origem é política do projeto**, e é assim que `B2` marca os requisitos de quatro
delas, RF-29 (RN-13), RF-33 (RN-14), RF-48 (RN-30) e RF-09 (RN-27).

**A quinta é exceção, e vale dizer.** Os requisitos de RN-12, RF-27 e RF-08, estão marcados como
**EN** e **OP**: o planejamento por turno foi de fato colhido em entrevista e observado no viveiro.
O que é convenção do projeto ali não é o turno, é a **duração única declarada** para ele.

**As demais regras novas não precisam de ressalva.** Área, canteiro, lote, categoria de tarefa e
forma de medição (RN-17 a RN-26, RN-28, RN-29, RN-31) descrevem o viveiro como ele
funciona hoje, sem sistema nenhum: as áreas têm letra, os canteiros têm número, planta-se por leva,
e já se diz "fiz tantos saquinhos hoje". Apague o sistema e os enunciados sobrevivem.

---

## 3. Catálogo de regras de negócio

### 3.1 Área A: Domínio e produto

| RN | Enunciado | Tipo | Documentada em | RF originados | RNF vinculados |
|---|---|---|---|---|---|
| **RN-01** | Toda informação do viveiro (lote, tarefa, perda, pedido) refere-se a uma **espécie**; a espécie é a unidade em torno da qual a operação se organiza | Fato | `A2` §1; `C6` §1; `CLAUDE.md` | RF-10, RF-34, RF-58 | - |
| **RN-02** | A espécie possui **um nome científico e vários nomes populares regionais**; a mesma espécie é chamada por nomes diferentes conforme a região e o interlocutor | Fato | `A2` §1 | RF-10 | RNF-08, RNF-26 |
| **RN-03** | Uma espécie admite **várias características simultâneas**, nativa, exótica, frutífera, ornamental, madeireira, forrageira. Uma nativa pode ser ao mesmo tempo frutífera e madeireira | Fato | `A2` §1 | RF-10 | RNF-02 |
| **RN-04** | O **recipiente determina o porte da muda** e, por consequência, o seu preço. Espécie e recipiente formam o par que identifica um produto comercializável: a mesma espécie em dois recipientes são dois produtos | Fato | `A2` §2; `CLAUDE.md` | RF-11, RF-46, RF-58, RF-34 | - |
| **RN-05** | O ciclo produtivo (semeadura, germinação, repicagem, rustificação) tem **etapas conhecidas por espécie e recipiente**, e é o protocolo de atividades que as declara | Fato | `A2` §1 | RF-22 | - |
| **RN-06** | **Só a muda pronta compõe estoque comercializável.** Muda em produção não é estoque de venda | Restrição | `A2` §1 | RF-46, RF-60 | - |
| **RN-07** | O **insumo é material consumível aplicado na produção**, classificado em categoria fechada: substrato, adubo, defensivo, recipiente, outros | Fato | `A2` §2 | RF-12 | RNF-02 |

### 3.2 Área B: Produção, lote e trabalho

| RN | Enunciado | Tipo | Documentada em | RF originados | RNF vinculados |
|---|---|---|---|---|---|
| **RN-08** | A quantidade disponível de uma espécie é a **soma dos lotes abertos**, já descontadas perdas e vendas, e não um número digitado | Derivação | `A2` §1 | RF-46, RF-60, RF-37 | - |
| **RN-09** | A **contagem física prevalece** sobre a quantidade calculada: onde os dois divergem, o que vale é o que se contou, e o ajuste fica registrado | Restrição | `rotinas/2-producao` | RF-41 | - |
| **RN-10** | A perda é evento **normal** da produção e exige **causa classificada em lista fechada**, seca, praga, geada, manuseio, outro | Restrição | `A2` §1 | RF-40, RF-43 | RNF-02 |
| **RN-11** | A **mortalidade** é a razão entre as mudas perdidas de um lote e a quantidade inicial dele. Acima do **limite definido**, inicialmente 20%, dispara alerta | Acionamento | `A2` §1; `CLAUDE.md` | RF-44, RF-45, RF-49, RF-09 | - |
| **RN-12** | O trabalho do viveiro é **planejado por turno, não por horário**: a unidade da agenda é dia × turno (manhã ou tarde) | Fato | `rotinas/2-producao` | RF-27, RF-08 | - |
| **RN-13** | A semana **fecha** e, fechada, não se altera: sem isso o registro do período muda depois de consolidado | Restrição | `rotinas/2-producao` | RF-29 | - |
| **RN-14** | A atribuição **não confirmada até o fechamento da semana é assumida como realizada**, e a condição fica registrada, para que a suposição não se confunda com a confirmação | Derivação | `rotinas/2-producao` | RF-33 | - |
| **RN-15** | O **tipo de tarefa** é vocabulário fechado, e não digitação livre: é ele que declara o que a confirmação vai pedir | Fato | `A2` §5 | RF-21 | RNF-02 |
| **RN-16** | Só **semeadura e repicagem somam ao estoque**; irrigação, adubação e rustificação são manejo e não alteram quantidade | Fato | `rotinas/2-producao` | RF-46 | - |
| **RN-17** | O viveiro é dividido em **áreas identificadas por letra** (A, B, C…), e cada área tem **canteiros numerados dentro dela**, recomeçando em cada área | Fato | `A2` §1 | RF-13 | - |
| **RN-18** | **Lote é a leva de mudas da mesma espécie, no mesmo recipiente, plantada junta.** É a unidade de rastreamento da produção | Fato | `A2` §1; `A1` §7 | RF-34 | - |
| **RN-19** | **Um lote ocupa um canteiro, e um canteiro comporta vários lotes.** Leva que não cabe num canteiro é outro lote | Restrição | `A2` §1 | RF-34, RF-35 | - |
| **RN-20** | A **repicagem para recipiente maior cria lote novo** ligado ao de origem: a leva muda de identidade quando muda de recipiente, e a ligação é o que permite saber quanto dela chegou à venda | Derivação | `A2` §1 | RF-36 | - |
| **RN-21** | **Nenhum lote tem saldo negativo.** Movimento que levaria o saldo abaixo de zero é recusado: significa que a contagem está errada, e gravar o negativo propagaria o erro | Restrição | `rotinas/2-producao` | RF-38 | - |
| **RN-22** | **Lote com saldo zero está encerrado**: sai da ocupação do canteiro e permanece no histórico. Canteiro livre é canteiro sem lote aberto | Restrição | `rotinas/2-producao` | RF-35 | - |
| **RN-23** | Toda tarefa do viveiro pertence a uma de **seis categorias**: semente, terra, plantio, manutenção, pós-morte, expedição | Fato | `A2` §5 | RF-21 | - |
| **RN-24** | Parte das tarefas é **contada por unidade**, e a pergunta do viveiro é quantos; as demais só registram que foram feitas. A **quantidade é de cada pessoa, e não da tarefa**: quatro pessoas enchendo saquinho produzem quatro números, e é assim que o viveiro fala | Fato | `A2` §5 | RF-21, RF-30 | - |
| **RN-25** | Tarefa que trabalha **mudas já plantadas identifica o lote**, e o lote carrega o canteiro, a espécie e o recipiente: perguntá-los de novo é redundância | Restrição | `rotinas/2-producao` | RF-21, RF-39, RF-31, RF-30, RF-32 | RNF-01 |
| **RN-26** | Uma **tarefa admite vários executores**, e o mesmo turno admite **várias tarefas em curso** com grupos diferentes | Fato | `rotinas/2-producao` | RF-27 | - |
| **RN-27** | Os **limiares e períodos da operação são parâmetros mantidos**, e não constantes de código: a hora de início e de fim de cada turno e o limite de dias que separa atenção de crítico mudam com a estação e com o tipo de tarefa | Fato | `rotinas/2-producao` | RF-08, RF-09 | - |
| **RN-28** | A **classificação separa mortas de vivas**, e a parte morta **vira perda do lote no mesmo registro**. Separar os dois gestos faria a perda ser esquecida | Derivação | `rotinas/2-producao` | RF-30 | - |
| **RN-29** | A **ocupação do canteiro é a soma dos saldos dos lotes abertos** nele | Derivação | `rotinas/2-producao` | RF-35, RF-47 | - |
| **RN-30** | A **situação do lote é derivada, nunca digitada**. Situação gravada envelhece sozinha, e o lote marcado como saudável ontem continuaria saudável hoje | Derivação | `rotinas/2-producao` | RF-47, RF-48 | - |
| **RN-31** | A **tarefa marcada como recorrente nasce preenchida na cópia da semana**: a rotina fixa não se lança de novo a cada segunda-feira | Fato | `rotinas/2-producao` | RF-28 | - |

### 3.3 Área C: Protocolo de atividades por lote

| RN | Enunciado | Tipo | Documentada em | RF originados | RNF vinculados |
|---|---|---|---|---|---|
| **RN-32** | O **protocolo de atividades é do recipiente**: é o recipiente que determina o manejo, e é dele que o lote descobre qual receita seguir | Fato | `rotinas/2-producao` | RF-22, RF-50 | - |
| **RN-33** | O **evento de referência da etapa é declarado, e não é a etapa anterior**. Pode ser a criação do lote ou a conclusão de uma etapa específica do mesmo protocolo | Restrição | `rotinas/2-producao` | RF-23 | - |
| **RN-34** | A ocorrência seguinte de etapa recorrente conta da **data real da execução anterior**, e nunca de uma data de calendário prevista | Derivação | `rotinas/2-producao` | RF-53 | - |
| **RN-35** | Uma etapa tem **no máximo uma ocorrência em aberto**, e a contagem não reinicia sozinha enquanto ela estiver pendente | Restrição | `rotinas/2-producao` | RF-54 | - |
| **RN-36** | A etapa **sequencial ocorre uma vez e avança a fase do lote**; a **recorrente repete indefinidamente e não avança fase nenhuma** | Fato | `rotinas/2-producao` | RF-22, RF-52 | - |
| **RN-37** | A **janela de aviso é proporcional ao intervalo da etapa**, e não um número fixo de dias: aviso fixo de três dias não serve à etapa trimestral e à diária ao mesmo tempo. Etapa com o **alerta desligado não recebe situação**, e apenas registra feito ou não feito no dia | Derivação | `rotinas/2-producao` | RF-24, RF-56 | - |
| **RN-38** | O **tempo cadastrado na espécie sobrescreve o do protocolo** para aquela etapa; sem valor na espécie, vale o do protocolo do recipiente | Derivação | `rotinas/2-producao` | RF-25 | - |
| **RN-39** | **Alteração no protocolo não retroage.** Vale para o que ainda vai ser gerado, e não reescreve ordem já cumprida | Restrição | `rotinas/2-producao` | RF-22 | - |
| **RN-40** | **Lote encerrado não gera ordem.** O lote se encerra por saldo zero (RN-22), por expedição total ou por divisão, e as ordens em aberto são canceladas, não removidas | Restrição | `rotinas/2-producao` | RF-57 | - |
| **RN-41** | A **divisão do lote produz dois lotes que seguem o protocolo de forma independente**, herdando do original a fase e a data da última execução de cada etapa | Derivação | `rotinas/2-producao` | RF-42 | - |
| **RN-42** | O **vencimento da etapa é derivado, nunca digitado**: sai do evento de referência, da última execução e do tempo declarado | Derivação | `rotinas/2-producao` | RF-48, RF-55 | - |
| **RN-43** | A **ordem gerada pelo protocolo é atribuição comum**: nasce **sem ninguém escalado**, porque o protocolo diz o que fazer e quando, e quem faz continua sendo de quem monta a agenda; pertence à **semana do seu vencimento**, ou à semana aberta corrente se aquela já estiver fechada, sem que o vencimento mude; e alterar ou excluir a ordem de um dia não altera a etapa nem as ordens dos demais lotes | Restrição | `rotinas/2-producao` | RF-51 | - |

### 3.4 Área D: Cliente e pedido

| RN | Enunciado | Tipo | Documentada em | RF originados | RNF vinculados |
|---|---|---|---|---|---|
| **RN-44** | O **canal de venda** é lista fechada de cinco, atacado (padrão), compensação ambiental, paisagismo, prefeitura e varejo, e todo pedido pertence a um deles | Fato | `A2` §3 | RF-58, RF-62 | RNF-02 |
| **RN-45** | O cliente é **pessoa física ou jurídica**, e a venda com nota fiscal exige o conjunto fiscal completo e documento válido. A **nota é emitida em sistema externo**: a emissão não pertence a este sistema, que apenas mantém o cadastro capaz de alimentá-la | Restrição | `rotinas/1-cadastros`; `A1` §7 | RF-16, RF-17 | RNF-25 |
| **RN-46** | A negociação nasce no WhatsApp e o cliente frequentemente é novo: **nome e telefone bastam** para registrar o pedido, e o cadastro se completa depois | Restrição | `rotinas/1-cadastros` | RF-15 | RNF-01 |
| **RN-47** | **Toda contraparte do viveiro é uma identidade única** (quem compra, quem vende, quem trabalha), e o papel é que se multiplica | Fato | `rotinas/1-cadastros` | RF-18, RF-19, RF-20, RF-14 | - |
| **RN-48** | A venda para **compensação ambiental** exige o nome científico da espécie | Restrição | `A2` §3 | RF-58 | RNF-26 |
| **RN-49** | Dado pessoal de cliente e de funcionário é tratado sob a **Lei nº 13.709/2018**, com finalidade, base legal e prazo de retenção declarados | Restrição | `E5` | - | RNF-24 |
| **RN-50** | O pedido percorre uma **sequência de situações** (rascunho, confirmado, cancelado), e o item não se altera depois de confirmado | Fato | `rotinas/3-comercial` | RF-61 | - |
| **RN-51** | Uma pessoa tem **mais de um endereço**, e o de entrega pode não ser o de cobrança | Fato | `rotinas/1-cadastros` | RF-16 | - |
| **RN-52** | O **preço é o que foi negociado**, e o viveiro o define fora do sistema, na conversa com o cliente. Ao sistema cabe registrar por quanto se vendeu, e não dizer por quanto se deveria vender | Fato | `A1` §6 | RF-59 | - |

### 3.5 Área E: Acesso e responsabilidade

| RN | Enunciado | Tipo | Documentada em | RF originados | RNF vinculados |
|---|---|---|---|---|---|
| **RN-53** | Cada pessoa com acesso tem um **perfil** (chefia, gerência, administrador) que determina o que ela vê e o que pode fazer | Fato | `D4` §1 | RF-01, RF-05, RF-06 | RNF-12 |
| **RN-54** | **Todo registro tem autor identificado**: quem criou o lote, registrou a perda, confirmou a tarefa ou lançou o pedido fica gravado com o registro | Fato | `D4` §5 | RF-01, RF-04 | - |

### 3.6 Síntese por área

| Área | Regras | Quantidade |
|---|---|---:|
| A: Domínio e produto | RN-01 a RN-07 | 7 |
| B: Produção, lote e trabalho | RN-08 a RN-31 | 24 |
| C: Protocolo de atividades por lote | RN-32 a RN-43 | 12 |
| D: Cliente e pedido | RN-44 a RN-52 | 9 |
| E: Acesso e responsabilidade | RN-53 a RN-54 | 2 |
| **Total** | | **54** |

| Tipo | Quantidade |
|---|---:|
| Fato | 25 |
| Restrição | 17 |
| Derivação | 11 |
| Acionamento | 1 |

---

## 4. Rastreabilidade inversa: requisito funcional → regra que o origina

Os 62 requisitos funcionais de `B2`. Quatro não decorrem de regra de
negócio e estão justificados na seção 6.

| RF | Regras que o originam |
|---|---|
| RF-01 | RN-53, RN-54 |
| RF-02 | - |
| RF-03 | - |
| RF-04 | RN-54 |
| RF-05 | RN-53 |
| RF-06 | RN-53 |
| RF-07 | - |
| RF-08 | RN-12, RN-27 |
| RF-09 | RN-11, RN-27 |
| RF-10 | RN-01, RN-02, RN-03 |
| RF-11 | RN-04 |
| RF-12 | RN-07 |
| RF-13 | RN-17 |
| RF-14 | RN-47 |
| RF-15 | RN-46 |
| RF-16 | RN-45, RN-51 |
| RF-17 | RN-45 |
| RF-18 | RN-47 |
| RF-19 | RN-47 |
| RF-20 | RN-47 |
| RF-21 | RN-15, RN-23, RN-24, RN-25 |
| RF-22 | RN-05, RN-32, RN-36, RN-39 |
| RF-23 | RN-33 |
| RF-24 | RN-37 |
| RF-25 | RN-38 |
| RF-26 | - |
| RF-27 | RN-12, RN-26 |
| RF-28 | RN-31 |
| RF-29 | RN-13 |
| RF-30 | RN-24, RN-25, RN-28 |
| RF-31 | RN-25 |
| RF-32 | RN-25 |
| RF-33 | RN-14 |
| RF-34 | RN-01, RN-04, RN-18, RN-19 |
| RF-35 | RN-19, RN-22, RN-29 |
| RF-36 | RN-20 |
| RF-37 | RN-08 |
| RF-38 | RN-21 |
| RF-39 | RN-25 |
| RF-40 | RN-10 |
| RF-41 | RN-09 |
| RF-42 | RN-41 |
| RF-43 | RN-10 |
| RF-44 | RN-11 |
| RF-45 | RN-11 |
| RF-46 | RN-04, RN-06, RN-08, RN-16 |
| RF-47 | RN-29, RN-30 |
| RF-48 | RN-30, RN-42 |
| RF-49 | RN-11 |
| RF-50 | RN-32 |
| RF-51 | RN-43 |
| RF-52 | RN-36 |
| RF-53 | RN-34 |
| RF-54 | RN-35 |
| RF-55 | RN-42 |
| RF-56 | RN-37 |
| RF-57 | RN-40 |
| RF-58 | RN-01, RN-04, RN-44, RN-48 |
| RF-59 | RN-52 |
| RF-60 | RN-06, RN-08 |
| RF-61 | RN-50 |
| RF-62 | RN-44 |
## 5. Rastreabilidade inversa: requisito não funcional → origem

Os requisitos não funcionais deste projeto **não decorrem de regra de negócio**, e sim das
restrições do ambiente (`A1` §9) ou de política do projeto. É um achado, não uma lacuna: o negócio
diz o que o sistema tem de fazer, e o ambiente diz sob que condições ele tem de funcionar.

| RNF | Origem primária | Regra relacionada |
|---|---|---|
| RNF-01 | RE-1: usuários sem formação técnica | RN-46, RN-25 |
| RNF-02 | RE-1: usuários sem formação técnica | RN-03, RN-10, RN-44, RN-15, RN-07 |
| RNF-03 | RE-4: mãos sujas, sol e chuva | - |
| RNF-04 | RE-4: mãos sujas, sol e chuva | - |
| RNF-05 | RE-3: conexão instável | - |
| RNF-06 | RE-2: celular como dispositivo principal | - |
| RNF-07 | RE-3: conexão instável | - |
| RNF-08 | RE-1: usuários sem formação técnica | RN-02 |
| RNF-09 a RNF-13 | ORG: política de segurança do projeto | RN-53 |
| RNF-14 | RE-5: orçamento de microempresa | - |
| RNF-16 a RNF-23 | ORG: convenções de desenvolvimento | - |
| RNF-24 | LEG: Lei nº 13.709/2018 | RN-49 |
| RNF-25 | LEG: exigência do emissor fiscal externo | RN-45, RN-53 |
| RNF-26 | LEG e DOM: compensação ambiental | RN-02, RN-48 |
| RNF-27 | RE-2 e RE-5: dispositivo e orçamento | - |
| RNF-15 | RE-2: celular como dispositivo principal | RN-29, RN-30 |

---

## 6. Requisitos que não decorrem de regra de negócio

### 6.1 Requisitos funcionais sem regra de negócio

Quatro dos sessenta e dois requisitos funcionais não têm regra de negócio que os origine. Todos são de
política do projeto ou de organização da interface, e nenhum é omissão do catálogo.

| RF | Por que não tem regra de negócio |
|---|---|
| RF-02 | Trocar senha no primeiro acesso é política de segurança do projeto (ORG), não prática do viveiro |
| RF-03 | Encerrar a própria sessão é higiene de acesso (ORG); o viveiro não tinha sessão para encerrar |
| RF-07 | Ver e encerrar sessões ativas é decorrência de RF-03, e da mesma origem |
| RF-26 | Abrir a área em duas abas é organização de interface: não há regra de negócio sobre por onde se entra numa tela |

### 6.2 As restrições que originam os requisitos não funcionais

Doze dos vinte e sete requisitos não funcionais nascem das restrições de
[`A1`](../A-fundacao/A1-documento-de-visao.md) §9, e nenhuma delas é regra de negócio: são
condições do ambiente. Os outros quinze vêm de política do projeto (ORG) ou de exigência legal
(LEG), e estão atribuídos um a um na seção 5.

| RE | Restrição | RNF originados |
|---|---|---|
| RE-1 | Usuários sem formação técnica | RNF-01, RNF-02, RNF-08 |
| RE-2 | Celular como dispositivo principal | RNF-06, RNF-27, RNF-15 |
| RE-3 | Conexão instável no viveiro | RNF-05, RNF-07 |
| RE-4 | Uso com as mãos sujas, sob sol e chuva | RNF-03, RNF-04 |
| RE-5 | Orçamento de microempresa | RNF-14, RNF-27 |
| RE-6 | Prazo até novembro de 2026 | *(não origina RNF: governa o escopo, não o produto)* |
| RE-7 | Dados pessoais sujeitos à legislação de proteção de dados | RNF-24 |

### 6.3 Regras sem requisito que as realize por inteiro

| RN | O que fica de fora |
|---|---|
| RN-49 | A regra de proteção de dados é realizada por RNF-24 e pelo mapeamento de [`E5`](../E-qualidade/E5-mapeamento-lgpd.md), e não por requisito funcional: não há tela de LGPD, há uma forma de tratar o dado em todas elas |
| RN-29 | O **aviso** de que a leva não cabe no que resta do canteiro. RF-34 manda criar o lote informando o canteiro e não menciona conferência nenhuma; a ocupação é apresentada (RF-35, RF-47), mas ninguém é avisado no momento em que a decisão é tomada |

---

## 7. Apêndice: texto integral dos requisitos

Transcrito de [`B2`](B2-especificacao-requisitos.md) para que a geração das tabelas do trabalho
não dependa de abrir outro arquivo. **Não editar aqui**: a fonte é o `B2`.

### 7.1 Requisitos funcionais

| RF | Texto | Prior. | Origem |
|---|---|---|---|
| RF-01 | O sistema deve autenticar o usuário por identificador e senha antes de conceder qualquer acesso | D | ORG |
| RF-02 | O sistema deve exigir troca de senha no primeiro acesso do usuário | D | ORG |
| RF-03 | O sistema deve permitir ao usuário encerrar sua sessão | D | ORG |
| RF-04 | O sistema deve registrar cada tentativa de autenticação com data, origem e dispositivo | DV | ORG |
| RF-05 | O sistema deve permitir ao administrador criar usuários e atribuir perfil | D | ORG |
| RF-06 | O sistema deve verificar a permissão do perfil a cada operação, e não apenas ocultar elementos da interface | D | ORG |
| RF-07 | O sistema deveria permitir ao usuário visualizar e encerrar suas sessões ativas | DV | ORG |
| RF-08 | O sistema deve permitir manter o período de trabalho, com hora de início e de fim de cada turno, e adotá-lo como jornada padrão da agenda | D | EN |
| RF-09 | O sistema deve permitir alterar o valor dos parâmetros de operação, os limites de atenção e de atraso do lote e o limite de mortalidade, sem permitir criar nem excluir parâmetro | D | ORG |
| RF-10 | O sistema deve permitir cadastrar espécie com nome científico, nomes populares, características e fotografia, e localizá-la por qualquer um desses nomes | D | EN, DOM, OP |
| RF-11 | O sistema deve permitir cadastrar recipientes com nome e volume | D | EN |
| RF-12 | O sistema deve permitir cadastrar insumos com unidade de medida e categoria | D | AD |
| RF-13 | O sistema deve permitir cadastrar áreas do viveiro identificadas por letra e canteiros numerados dentro de cada área, recusando número repetido na mesma área | D | OP |
| RF-14 | O sistema deve manter uma identidade única por pessoa, à qual se atribuem os papéis de cliente, fornecedor e funcionário, sem duplicar o cadastro quando a mesma pessoa exercer mais de um | D | ORG |
| RF-15 | O sistema deve permitir cadastro rápido de cliente com nome e telefone, sem sair da tela de pedido | D | OP |
| RF-16 | O sistema deve permitir cadastro completo de cliente com dados fiscais de pessoa física ou jurídica | D | LEG, AD |
| RF-17 | O sistema deve validar CPF e CNPJ informados | D | LEG |
| RF-18 | O sistema deve permitir localizar pessoa por nome, telefone ou documento | D | OP |
| RF-19 | O sistema deve permitir cadastrar fornecedor com contato e localização | DV | EN |
| RF-20 | O sistema deve permitir cadastrar funcionário com contato e vínculo (fixo ou diarista), inclusive quando ele não tem acesso ao sistema | D | EN |
| RF-21 | O sistema deve permitir manter o catálogo de tipos de tarefa, com nome, categoria e a declaração de se a tarefa é quantitativa por unidade e de se exige lote específico, espécie e recipiente, e deve pedir, no planejamento e na confirmação, exatamente os dados que o tipo declarar exigir, e nenhum outro | D | OP, ORG |
| RF-22 | O sistema deve permitir manter, por recipiente, um protocolo de atividades como sequência ordenada de etapas, cada etapa referenciando um tipo de tarefa do catálogo e declarando se o agendamento é sequencial ou recorrente, com o tempo em dias | D | EN |
| RF-23 | O sistema deve permitir que cada etapa do protocolo declare o seu evento de referência: a criação do lote ou a conclusão de uma etapa específica do mesmo protocolo | D | DOM |
| RF-24 | O sistema deve permitir ligar e desligar o alerta de atraso por etapa do protocolo, e sobrescrever nela a janela de aviso padrão | D | OP |
| RF-25 | O sistema deveria permitir, no cadastro da espécie, sobrescrever o tempo em dias de uma etapa específica do protocolo | DV | DOM |
| RF-26 | O sistema deve apresentar, na entrada da área Produção, as visões de agenda da semana e mapa de lotes alternadas por aba, com as demais rotinas listadas abaixo delas | D | OP |
| RF-27 | O sistema deve permitir montar a agenda da semana atribuindo, por funcionário e por dia, o tipo de tarefa e o turno, manhã ou tarde, admitindo a mesma tarefa para mais de um funcionário e mais de uma tarefa no mesmo turno com grupos diferentes | D | EN, OP |
| RF-28 | O sistema deve permitir copiar a agenda da semana anterior e marcar tarefas como recorrentes, que passam a nascer preenchidas na cópia | D | OP |
| RF-29 | O sistema deve controlar a situação da semana (rascunho, publicada e fechada) e impedir alteração depois do fechamento | D | ORG |
| RF-30 | O sistema deve permitir confirmar a atribuição como realizada, apresentando os campos que o tipo de tarefa exigir, o lote uma vez para a tarefa e a quantidade uma vez por participante, e pedindo a quantidade apenas quando o tipo for quantitativo por unidade | D | OP |
| RF-31 | O sistema deve exigir o lote na confirmação da tarefa quando o tipo de tarefa declarar lote específico, dispensando o canteiro, que vem do próprio lote | D | OP |
| RF-32 | O sistema deve permitir registrar a área ou o canteiro da tarefa que não exige lote, e dispensá-los quando o lote os determinar | D | OP |
| RF-33 | O sistema deve assumir como realizada, ao fechar a semana, a tarefa planejada que não foi confirmada, registrando essa condição | DV | ORG |
| RF-34 | O sistema deve permitir criar lote informando espécie, recipiente, quantidade, área e canteiro | D | OP |
| RF-35 | O sistema deve apresentar a ocupação do viveiro por área e canteiro, indicando os lotes de cada canteiro ocupado e quais estão livres, e deve encerrar o lote quando o saldo chegar a zero, liberando o canteiro e preservando o histórico | D | EN, ORG |
| RF-36 | O sistema deve permitir registrar repicagem transferindo parte ou todo o lote para recipiente maior, criando um lote novo que aponta para o de origem | D | DOM |
| RF-37 | O sistema deve apresentar o histórico de movimentos do lote, com a quantidade e o motivo de cada um | D | EN |
| RF-38 | O sistema não deve permitir movimento que deixe o saldo do lote negativo | D | ORG |
| RF-39 | O sistema deve permitir registrar perda, contagem física e saída de venda sobre o lote, dispensando informar espécie e recipiente, que o lote determina | D | OP |
| RF-40 | O sistema deve permitir registrar a perda com quantidade e causa selecionada em lista fechada | D | OP |
| RF-41 | O sistema deve permitir registrar contagem física do lote, gerando o movimento de ajuste que reconcilia o saldo | D | OP |
| RF-42 | O sistema deve permitir dividir um lote em dois, com cada resultante seguindo o protocolo de forma independente e herdando do original a fase e a data da última execução de cada etapa | D | OP |
| RF-43 | O sistema deve listar as perdas registradas com filtro por período, espécie e causa | D | EN |
| RF-44 | O sistema deve calcular a taxa de mortalidade do lote, como a razão entre as perdas dele e a sua quantidade inicial | D | EN |
| RF-45 | O sistema deve emitir alerta para o lote cuja mortalidade ultrapasse o limite definido em Configurações | D | EN |
| RF-46 | O sistema deve apresentar a quantidade de muda pronta disponível por espécie e recipiente, somada dos lotes abertos | D | OP |
| RF-47 | O sistema deve apresentar o mapa do viveiro com as áreas, os canteiros de cada área e os lotes abertos de cada canteiro, cada lote com a sua situação | D | EN |
| RF-48 | O sistema deve classificar o lote em saudável, atenção e crítico a partir das etapas do protocolo vencidas ou a vencer nele, sem que a situação seja digitada, e apresentar, ao apontar o lote, a tarefa pendente que determina essa situação e o atraso em dias | D | ORG, OP |
| RF-49 | O sistema deve apresentar, no mapa, a mortalidade de cada lote e destacar os que ultrapassam o limite | D | EN |
| RF-50 | O sistema deve atribuir ao lote, na criação, o protocolo vigente do recipiente dele, e acompanhar o lote etapa a etapa | D | ORG |
| RF-51 | O sistema deve gerar as ordens de tarefa do protocolo na agenda sem digitação, abrindo em rascunho a semana do vencimento quando ela ainda não existir, e permitir alterar ou excluir a ordem de um dia sem alterar a etapa | D | ORG |
| RF-52 | O sistema deve avançar a fase do lote ao concluir uma etapa sequencial que declare fase resultante, e não deve avançá-la ao concluir etapa recorrente | D | DOM |
| RF-53 | O sistema deve contar a ocorrência seguinte de etapa recorrente a partir da data real da execução anterior, e nunca de uma data de calendário prevista | D | DOM |
| RF-54 | O sistema deve manter no máximo uma ordem em aberto por etapa e por lote, sem gerar ocorrência nova enquanto a anterior estiver pendente | D | ORG |
| RF-55 | O sistema deve apresentar, no lote, as etapas do protocolo com a data da última execução, o próximo vencimento e a situação de cada uma | D | EN |
| RF-56 | O sistema deve apresentar a etapa em atenção dentro da janela de aviso e em atraso depois do vencimento, e sem indicação de situação quando o alerta da etapa estiver desligado | D | OP |
| RF-57 | O sistema deve encerrar o protocolo do lote quando ele se encerra por saldo zero, por expedição total ou por divisão, cancelando as ordens ainda em aberto sem removê-las | D | ORG |
| RF-58 | O sistema deve permitir registrar pedido com cliente, canal de venda e itens compostos por espécie, recipiente e quantidade | D | OP |
| RF-59 | O sistema deve registrar o preço unitário informado em cada item do pedido, e apresentar o total do item e o do pedido | D | EN |
| RF-60 | O sistema deve apresentar, ao lado de cada item do pedido, a quantidade de muda pronta que a produção tem daquela espécie e recipiente | D | OP |
| RF-61 | O sistema deve controlar a situação do pedido (rascunho, confirmado e cancelado), impedindo alteração de item depois da confirmação | D | ORG |
| RF-62 | O sistema deve listar os pedidos com filtro por cliente, canal e período | D | OP |

### 7.2 Requisitos não funcionais

| RNF | Texto | Origem |
|---|---|---|
| RNF-01 | Formulários de campo devem apresentar no máximo cinco campos por tela | RE-1 |
| RNF-02 | Campos de categoria devem oferecer lista fechada de opções, nunca entrada livre de texto | RE-1 |
| RNF-03 | Elementos acionáveis devem ter alvo de toque compatível com uso de dedos sujos e molhados | RE-4 |
| RNF-04 | Toda ação de gravação deve produzir resposta visual imediata de confirmação | RE-4 |
| RNF-05 | O registro de dados em campo deve funcionar sem conexão, com envio automático ao restabelecer a rede | RE-3 |
| RNF-06 | A interface deve ser concebida para uso em celular, e não adaptada a partir de tela de computador, nas rotinas de registro em campo | RE-2 |
| RNF-07 | O sistema deve permanecer utilizável sob conexão móvel lenta | RE-3 |
| RNF-08 | A interface deve empregar o vocabulário da empresa, conforme o glossário, e não termos técnicos do sistema | RE-1 |
| RNF-09 | Senhas devem ser armazenadas de forma cifrada, por técnica que impeça sua recuperação | ORG |
| RNF-10 | Identificadores de sessão devem ser armazenados apenas em formato protegido | ORG |
| RNF-11 | Cookies de sessão devem receber as marcações de segurança que restringem seu uso a comunicação cifrada e impedem leitura por código do navegador | ORG |
| RNF-12 | As regras de acesso aos dados devem ser executadas no servidor, nunca no navegador | ORG |
| RNF-13 | Toda comunicação entre cliente e servidor deve ser cifrada em trânsito | ORG |
| RNF-14 | O sistema deve dispor de rotina de backup e procedimento de recuperação com objetivos declarados | RE-5 |
| RNF-15 | As telas de coordenação da produção, agenda da semana e mapa de lotes, devem ser concebidas para tela larga, e apresentar no celular uma versão reduzida em lista, sem rolagem horizontal | RE-2 |
| RNF-16 | Arquivos, identificadores e estruturas de dados devem ser nomeados em inglês; a documentação, em português | ORG |
| RNF-17 | Cada funcionalidade deve ser desenvolvida em ramificação própria e integrada por solicitação de incorporação | ORG |
| RNF-18 | Alteração direta na versão principal deve ser impedida por controle automático | ORG |
| RNF-19 | Mensagens de alteração devem seguir padrão fixo | ORG |
| RNF-20 | Alterações na estrutura do banco devem ser versionadas em arquivos aplicados de forma controlada, preservando compatibilidade retroativa | ORG |
| RNF-21 | Toda alteração de código deve incluir testes automatizados cobrindo utilitários, regras de negócio e validações | ORG |
| RNF-22 | Verificação automática executada antes de cada alteração deve bloquear o envio em caso de arquivo sensível, falha de teste ou desvio de padronização | ORG |
| RNF-23 | Credenciais, chaves e dados sensíveis não devem ser versionados | ORG |
| RNF-24 | O tratamento de dados pessoais deve observar a Lei nº 13.709/2018, com finalidade, base legal e prazo de retenção declarados para cada dado coletado | LEG |
| RNF-25 | Os dados cadastrais de cliente devem comportar o conjunto exigido para emissão de nota fiscal no sistema externo em uso | LEG |
| RNF-26 | O nome científico da espécie deve estar disponível para atender exigências de projetos de compensação ambiental | LEG, DOM |
| RNF-27 | O sistema deve operar em navegador de celular de uso corrente pela equipe, sem exigir instalação a partir de loja de aplicativos | RE-2, RE-5 |
## 8. Manutenção

Este catálogo é a fonte das regras de negócio do trabalho. Regra nova entra aqui antes de virar
requisito, e requisito novo em [`B2`](B2-especificacao-requisitos.md) precisa apontar a regra que o
origina ou justificar-se na seção 6.

Ao alterar `B2`, reconferir as seções 4, 5 e 7 deste documento, que espelham o conteúdo de lá.
Ao alterar este catálogo, reconferir [`B4`](B4-quadros-tcc.md), que o transcreve para os quadros do
trabalho, e [`B5`](B5-matriz-rastreabilidade.md), que amarra regra, requisito, caso de uso, entidade
e teste.
