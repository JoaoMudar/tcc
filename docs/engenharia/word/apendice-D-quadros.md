# Apêndice D, Quadros de regras de negócio e requisitos

> Gerado a partir de `B-requisitos/B4-quadros-tcc.md`.
> **Não edite este arquivo**: edite o artefato de origem e rode `node scripts/build-word.mjs`.

## Como usar

Este arquivo existe por uma razão de formato, não de conteúdo: os artefatos `B2` e `B3` são
documentos de engenharia, com colunas de tipo, origem, prioridade e verificação que não cabem
no corpo do trabalho. Os quadros abaixo são a **redução desses artefatos ao que vai impresso**:
duas ou quatro colunas, prontos para colar no Word como tabela.

**A numeração dos quadros mudou com a redução de escopo.** Eram treze, e passaram a ser dez:
os quadros de custeio, precificação e financeiro deixaram de ter conteúdo. Quem já citou o
número antigo no corpo do texto precisa reconferir.

O parser espera `## Quadro N – Título`, a tabela markdown logo abaixo e a linha `Fonte: …` em
seguida. O script gera exatamente esse formato.

---

# Quadros: regras de negócio

## Quadro 1 – Regras de negócio da área de domínio e produto

| Código | Descrição |
|---|---|
| RN-01 | Toda informação do viveiro (lote, tarefa, perda, pedido) refere-se a uma espécie; a espécie é a unidade em torno da qual a operação se organiza. |
| RN-02 | A espécie possui um nome científico e vários nomes populares regionais; a mesma espécie é chamada por nomes diferentes conforme a região e o interlocutor. |
| RN-03 | Uma espécie admite várias características simultâneas, nativa, exótica, frutífera, ornamental, madeireira, forrageira. Uma nativa pode ser ao mesmo tempo frutífera e madeireira. |
| RN-04 | O recipiente determina o porte da muda e, por consequência, o seu preço. Espécie e recipiente formam o par que identifica um produto comercializável: a mesma espécie em dois recipientes são dois produtos. |
| RN-05 | O ciclo produtivo (semeadura, germinação, repicagem, rustificação) tem etapas conhecidas por espécie e recipiente, e é o protocolo de atividades que as declara. |
| RN-06 | Só a muda pronta compõe estoque comercializável. Muda em produção não é estoque de venda. |
| RN-115 | O insumo é material consumível aplicado na produção, classificado em categoria fechada: substrato, adubo, defensivo, recipiente, outros. |

Fonte: Elaborado pelo autor (2026).

## Quadro 2 – Regras de negócio da área de produção, lote e trabalho

| Código | Descrição |
|---|---|
| RN-13 | A quantidade disponível de uma espécie é a soma dos lotes abertos, já descontadas perdas e vendas, e não um número digitado. |
| RN-14 | A contagem física prevalece sobre a quantidade calculada: onde os dois divergem, o que vale é o que se contou, e o ajuste fica registrado. |
| RN-16 | A perda é evento normal da produção e exige causa classificada em lista fechada, seca, praga, geada, manuseio, outro. |
| RN-17 | A mortalidade é a razão entre as mudas perdidas de um lote e a quantidade inicial dele. Acima do limite definido, inicialmente 20%, dispara alerta. |
| RN-48 | O trabalho do viveiro é planejado por turno, não por horário: a unidade da agenda é dia × turno (manhã ou tarde). |
| RN-50 | A semana fecha e, fechada, não se altera: sem isso o registro do período muda depois de consolidado. |
| RN-51 | A atribuição não confirmada até o fechamento da semana é assumida como realizada, e a condição fica registrada, para que a suposição não se confunda com a confirmação. |
| RN-55 | O tipo de tarefa é vocabulário fechado, e não digitação livre: é ele que declara o que a confirmação vai pedir. |
| RN-57 | Só semeadura e repicagem somam ao estoque; irrigação, adubação e rustificação são manejo e não alteram quantidade. |
| RN-74 | O viveiro é dividido em áreas identificadas por letra (A, B, C…), e cada área tem canteiros numerados dentro dela, recomeçando em cada área. |
| RN-75 | Lote é a leva de mudas da mesma espécie, no mesmo recipiente, plantada junta. É a unidade de rastreamento da produção. |
| RN-76 | Um lote ocupa um canteiro, e um canteiro comporta vários lotes. Leva que não cabe num canteiro é outro lote. |
| RN-77 | A repicagem para recipiente maior cria lote novo ligado ao de origem: a leva muda de identidade quando muda de recipiente, e a ligação é o que permite saber quanto dela chegou à venda. |
| RN-78 | Nenhum lote tem saldo negativo. Movimento que levaria o saldo abaixo de zero é recusado: significa que a contagem está errada, e gravar o negativo propagaria o erro. |
| RN-79 | Lote com saldo zero está encerrado: sai da ocupação do canteiro e permanece no histórico. Canteiro livre é canteiro sem lote aberto. |
| RN-80 | Toda tarefa do viveiro pertence a uma de seis categorias: semente, terra, plantio, manutenção, pós-morte, expedição. |
| RN-81 | Parte das tarefas é contada por unidade, e a pergunta do viveiro é quantos; as demais só registram que foram feitas. |
| RN-82 | Tarefa que trabalha mudas já plantadas identifica o lote, e o lote carrega o canteiro, a espécie e o recipiente: perguntá-los de novo é redundância. |
| RN-84 | Uma tarefa admite vários executores, e o mesmo turno admite várias tarefas em curso com grupos diferentes. |
| RN-85 | O período de trabalho (hora de início e de fim de cada turno) é parâmetro mantido, não constante de código: muda com a estação. |
| RN-90 | A classificação separa mortas de vivas, e a parte morta vira perda do lote no mesmo registro. Separar os dois gestos faria a perda ser esquecida. |
| RN-91 | A quantidade realizada é de cada pessoa, e não da tarefa. Quatro pessoas enchendo saquinho produzem quatro números, e é assim que o viveiro fala. |
| RN-92 | A ocupação do canteiro é a soma dos saldos dos lotes abertos nele. |
| RN-93 | A situação do lote é derivada, nunca digitada. Situação gravada envelhece sozinha, e o lote marcado como saudável ontem continuaria saudável hoje. |
| RN-94 | O limite de dias que separa atenção de crítico é parâmetro mantido, não constante. Muda com a estação e com o tipo de tarefa. |
| RN-95 | A tarefa marcada como recorrente nasce preenchida na cópia da semana: a rotina fixa não se lança de novo a cada segunda-feira. |

Fonte: Elaborado pelo autor (2026).

## Quadro 3 – Regras de negócio da área de protocolo de atividades por lote

| Código | Descrição |
|---|---|
| RN-98 | O protocolo de atividades é do recipiente: é o recipiente que determina o manejo, e é dele que o lote descobre qual receita seguir. |
| RN-99 | O evento de referência da etapa é declarado, e não é a etapa anterior. Pode ser a criação do lote ou a conclusão de uma etapa específica do mesmo protocolo. |
| RN-100 | A ocorrência seguinte de etapa recorrente conta da data real da execução anterior, e nunca de uma data de calendário prevista. |
| RN-101 | Uma etapa tem no máximo uma ocorrência em aberto, e a contagem não reinicia sozinha enquanto ela estiver pendente. |
| RN-102 | A etapa sequencial ocorre uma vez e avança a fase do lote; a recorrente repete indefinidamente e não avança fase nenhuma. |
| RN-104 | A janela de aviso é proporcional ao intervalo da etapa, e não um número fixo de dias. Aviso fixo de três dias não serve à etapa trimestral e à diária ao mesmo tempo. |
| RN-105 | Etapa com o alerta desligado não recebe situação, e apenas registra feito ou não feito no dia. |
| RN-106 | O tempo cadastrado na espécie sobrescreve o do protocolo para aquela etapa; sem valor na espécie, vale o do protocolo do recipiente. |
| RN-107 | Alteração no protocolo não retroage. Vale para o que ainda vai ser gerado, e não reescreve ordem já cumprida. |
| RN-108 | Lote encerrado não gera ordem. O lote se encerra por saldo zero (RN-79), por expedição total ou por divisão, e as ordens em aberto são canceladas, não removidas. |
| RN-109 | A divisão do lote produz dois lotes que seguem o protocolo de forma independente, herdando do original a fase e a data da última execução de cada etapa. |
| RN-110 | O vencimento da etapa é derivado, nunca digitado: sai do evento de referência, da última execução e do tempo declarado. |
| RN-111 | A ordem gerada pelo protocolo é atribuição comum: alterar ou excluir a ordem de um dia não altera a etapa nem as ordens dos demais lotes. |
| RN-112 | A ordem do protocolo entra na semana do seu vencimento, e o sistema abre essa semana em rascunho se ela não existir; se a semana já estiver fechada, a ordem entra na semana aberta corrente, sem que o vencimento mude. |
| RN-113 | A ordem do protocolo nasce sem ninguém escalado. O protocolo diz o que fazer e quando; quem faz continua sendo de quem monta a agenda. |

Fonte: Elaborado pelo autor (2026).

## Quadro 4 – Regras de negócio da área de cliente e pedido

| Código | Descrição |
|---|---|
| RN-20 | O canal de venda é lista fechada de cinco, atacado (padrão), compensação ambiental, paisagismo, prefeitura e varejo, e todo pedido pertence a um deles. |
| RN-25 | O cliente é pessoa física ou jurídica; a venda com nota fiscal exige o conjunto fiscal completo e documento válido. |
| RN-26 | A negociação nasce no WhatsApp e o cliente frequentemente é novo: nome e telefone bastam para registrar o pedido, e o cadastro se completa depois. |
| RN-27 | Toda contraparte do viveiro é uma identidade única (quem compra, quem vende, quem trabalha), e o papel é que se multiplica. |
| RN-28 | A nota fiscal é emitida em sistema externo; a emissão não pertence a este sistema, que apenas mantém o cadastro capaz de alimentá-la. |
| RN-29 | A venda para compensação ambiental exige o nome científico da espécie. |
| RN-30 | Dado pessoal de cliente e de funcionário é tratado sob a Lei nº 13.709/2018, com finalidade, base legal e prazo de retenção declarados. |
| RN-31 | O pedido percorre uma sequência de situações (rascunho, confirmado, cancelado), e o item não se altera depois de confirmado. |
| RN-62 | Uma pessoa tem mais de um endereço, e o de entrega pode não ser o de cobrança. |
| RN-114 | O preço é o que foi negociado, e o viveiro o define fora do sistema, na conversa com o cliente. Ao sistema cabe registrar por quanto se vendeu, e não dizer por quanto se deveria vender. |

Fonte: Elaborado pelo autor (2026).

## Quadro 5 – Regras de negócio da área de acesso e responsabilidade

| Código | Descrição |
|---|---|
| RN-45 | Cada pessoa com acesso tem um perfil (chefia, gerência, administrador) que determina o que ela vê e o que pode fazer. |
| RN-46 | Todo registro tem autor identificado: quem criou o lote, registrou a perda, confirmou a tarefa ou lançou o pedido fica gravado com o registro. |

Fonte: Elaborado pelo autor (2026).

## Quadro 6 – Distribuição das regras de negócio por área do domínio

| Área | Regras | Quantidade |
|---|---|---:|
| Domínio e produto | RN-01, RN-02, RN-03, RN-04, RN-05, RN-06, RN-115 | 7 |
| Produção, lote e trabalho | RN-13, RN-14, RN-16, RN-17, RN-48, RN-50, RN-51, RN-55, RN-57, RN-74, RN-75, RN-76, RN-77, RN-78, RN-79, RN-80, RN-81, RN-82, RN-84, RN-85, RN-90, RN-91, RN-92, RN-93, RN-94, RN-95 | 26 |
| Protocolo de atividades por lote | RN-98, RN-99, RN-100, RN-101, RN-102, RN-104, RN-105, RN-106, RN-107, RN-108, RN-109, RN-110, RN-111, RN-112, RN-113 | 15 |
| Cliente e pedido | RN-20, RN-25, RN-26, RN-27, RN-28, RN-29, RN-30, RN-31, RN-62, RN-114 | 10 |
| Acesso e responsabilidade | RN-45, RN-46 | 2 |
| **Total** | | **60** |

Fonte: Elaborado pelo autor (2026).

---

# Quadros: requisitos

## Quadro 7 – Requisitos funcionais e as regras de negócio que os originam

| Código | Nome | Descrição | Código RN |
|---|---|---|---|
| RF-01 | Autenticação por identificador e senha | O sistema deve autenticar o usuário por identificador e senha antes de conceder qualquer acesso. | RN-45, RN-46 |
| RF-02 | Troca de senha no primeiro acesso | O sistema deve exigir troca de senha no primeiro acesso do usuário. | – |
| RF-03 | Encerramento da própria sessão | O sistema deve permitir ao usuário encerrar sua sessão. | – |
| RF-04 | Registro das tentativas de autenticação | O sistema deve registrar cada tentativa de autenticação com data, origem e dispositivo. | RN-46 |
| RF-05 | Criação de usuário e atribuição de perfil | O sistema deve permitir ao administrador criar usuários e atribuir perfil. | RN-45 |
| RF-06 | Verificação de permissão a cada operação | O sistema deve verificar a permissão do perfil a cada operação, e não apenas ocultar elementos da interface. | RN-45 |
| RF-07 | Consulta e encerramento de sessões ativas | O sistema deveria permitir ao usuário visualizar e encerrar suas sessões ativas. | – |
| RF-83 | Manutenção do período de trabalho | O sistema deve permitir manter o período de trabalho, com hora de início e de fim de cada turno, e adotá-lo como jornada padrão da agenda. | RN-48, RN-85 |
| RF-139 | Manutenção dos parâmetros de operação | O sistema deve permitir alterar o valor dos parâmetros de operação, os limites de atenção e de atraso do lote e o limite de mortalidade, sem permitir criar nem excluir parâmetro. | RN-17, RN-94 |
| RF-08 | Cadastro de espécie | O sistema deve permitir cadastrar espécie com nome científico, nomes populares, características e fotografia. | RN-01, RN-02, RN-03 |
| RF-09 | Busca de espécie por qualquer nome | O sistema deve localizar a espécie por qualquer um de seus nomes populares ou pelo nome científico. | RN-02, RN-03 |
| RF-10 | Cadastro de recipiente | O sistema deve permitir cadastrar recipientes com nome e volume. | RN-04 |
| RF-11 | Cadastro de insumo | O sistema deve permitir cadastrar insumos com unidade de medida e categoria. | RN-115 |
| RF-80 | Cadastro de área do viveiro | O sistema deve permitir cadastrar áreas do viveiro identificadas por letra. | RN-74 |
| RF-81 | Cadastro de canteiro | O sistema deve permitir cadastrar canteiros numerados dentro de cada área, recusando número repetido na mesma área. | RN-74 |
| RF-140 | Identidade única de pessoa com múltiplos papéis | O sistema deve manter uma identidade única por pessoa, à qual se atribuem os papéis de cliente, fornecedor e funcionário, sem duplicar o cadastro quando a mesma pessoa exercer mais de um. | RN-27 |
| RF-36 | Cadastro rápido de cliente | O sistema deve permitir cadastro rápido de cliente com nome e telefone, sem sair da tela de pedido. | RN-26 |
| RF-37 | Cadastro completo de cliente | O sistema deve permitir cadastro completo de cliente com dados fiscais de pessoa física ou jurídica. | RN-25, RN-28, RN-62 |
| RF-38 | Validação de CPF e CNPJ | O sistema deve validar CPF e CNPJ informados. | RN-25 |
| RF-39 | Busca de pessoa | O sistema deve permitir localizar pessoa por nome, telefone ou documento. | RN-27 |
| RF-52 | Cadastro de fornecedor | O sistema deve permitir cadastrar fornecedor com contato e localização. | RN-27 |
| RF-69 | Cadastro de funcionário | O sistema deve permitir cadastrar funcionário com contato e vínculo (fixo ou diarista), inclusive quando ele não tem acesso ao sistema. | RN-27 |
| RF-70 | Catálogo de tipos de tarefa | O sistema deve permitir manter o catálogo de tipos de tarefa, com nome, categoria e a declaração de se a tarefa é quantitativa por unidade e de se exige lote específico, espécie e recipiente. | RN-55, RN-80, RN-81 |
| RF-82 | Formulário comandado pelo tipo de tarefa | O sistema deve pedir, no planejamento e na confirmação, exatamente os dados que o tipo de tarefa declarar exigir, e nenhum outro. | RN-55, RN-82 |
| RF-122 | Protocolo de atividades por recipiente | O sistema deve permitir manter, por recipiente, um protocolo de atividades como sequência ordenada de etapas. | RN-05, RN-98, RN-107 |
| RF-123 | Etapa do protocolo com agendamento e tempo | O sistema deve permitir que cada etapa do protocolo referencie um tipo de tarefa do catálogo e declare se o agendamento é sequencial ou recorrente, com o tempo em dias. | RN-102 |
| RF-124 | Evento de referência da etapa | O sistema deve permitir que cada etapa do protocolo declare o seu evento de referência: a criação do lote ou a conclusão de uma etapa específica do mesmo protocolo. | RN-99 |
| RF-125 | Alerta e janela de aviso por etapa | O sistema deve permitir ligar e desligar o alerta de atraso por etapa do protocolo, e sobrescrever nela a janela de aviso padrão. | RN-104, RN-105 |
| RF-133 | Tempo de etapa customizado por espécie | O sistema deveria permitir, no cadastro da espécie, sobrescrever o tempo em dias de uma etapa específica do protocolo. | RN-106 |
| RF-108 | Entrada da área Produção em duas abas | O sistema deve apresentar, na entrada da área Produção, as visões de agenda da semana e mapa de lotes alternadas por aba, com as demais rotinas listadas abaixo delas. | – |
| RF-71 | Montagem da agenda da semana | O sistema deve permitir montar a agenda da semana atribuindo, por funcionário e por dia, o tipo de tarefa e o turno, manhã ou tarde. | RN-48, RN-84 |
| RF-72 | Cópia da semana e tarefa recorrente | O sistema deve permitir copiar a agenda da semana anterior e marcar tarefas como recorrentes, que passam a nascer preenchidas na cópia. | RN-95 |
| RF-73 | Situação da semana | O sistema deve controlar a situação da semana (rascunho, publicada e fechada) e impedir alteração depois do fechamento. | RN-50 |
| RF-92 | Tarefa com vários executores | O sistema deve permitir atribuir a mesma tarefa a mais de um funcionário, e mais de uma tarefa ao mesmo turno com grupos diferentes. | RN-84 |
| RF-107 | Confirmação da tarefa realizada | O sistema deve permitir confirmar a atribuição como realizada, apresentando os campos que o tipo de tarefa exigir: o lote uma vez para a tarefa, e a quantidade uma vez por participante. | RN-82, RN-90, RN-91 |
| RF-98 | Quantidade realizada por participante | O sistema deve solicitar, na confirmação, a quantidade realizada por cada funcionário que participou da tarefa, quando o tipo de tarefa for quantitativo por unidade, e apenas nesse caso. | RN-81, RN-91 |
| RF-99 | Lote exigido na confirmação | O sistema deve exigir o lote na confirmação da tarefa quando o tipo de tarefa declarar lote específico, dispensando o canteiro, que vem do próprio lote. | RN-82 |
| RF-113 | Área ou canteiro da tarefa sem lote | O sistema deve permitir registrar a área ou o canteiro da tarefa que não exige lote, e dispensá-los quando o lote os determinar. | RN-82 |
| RF-75 | Tarefa não confirmada assumida no fechamento | O sistema deve assumir como realizada, ao fechar a semana, a tarefa planejada que não foi confirmada, registrando essa condição. | RN-51 |
| RF-84 | Criação de lote | O sistema deve permitir criar lote informando espécie, recipiente, quantidade, área e canteiro. | RN-01, RN-04, RN-75, RN-76 |
| RF-85 | Ocupação do viveiro por área e canteiro | O sistema deve apresentar a ocupação do viveiro por área e canteiro, indicando os lotes de cada canteiro ocupado e quais estão livres. | RN-76, RN-92 |
| RF-86 | Repicagem com lote de origem | O sistema deve permitir registrar repicagem transferindo parte ou todo o lote para recipiente maior, criando um lote novo que aponta para o de origem. | RN-77 |
| RF-87 | Histórico de movimentos do lote | O sistema deve apresentar o histórico de movimentos do lote, com a quantidade e o motivo de cada um. | RN-13 |
| RF-88 | Recusa de saldo negativo | O sistema não deve permitir movimento que deixe o saldo do lote negativo. | RN-78 |
| RF-89 | Encerramento do lote por saldo zero | O sistema deve encerrar o lote quando o saldo chegar a zero, liberando o canteiro e preservando o histórico. | RN-79 |
| RF-91 | Registro de perda, contagem e venda sobre o lote | O sistema deve permitir registrar perda, contagem física e saída de venda sobre o lote, dispensando informar espécie e recipiente, que o lote determina. | RN-82 |
| RF-26 | Perda com causa em lista fechada | O sistema deve permitir registrar a perda com quantidade e causa selecionada em lista fechada. | RN-16 |
| RF-23 | Contagem física do lote | O sistema deve permitir registrar contagem física do lote, gerando o movimento de ajuste que reconcilia o saldo. | RN-14 |
| RF-135 | Divisão de lote | O sistema deve permitir dividir um lote em dois, com cada resultante seguindo o protocolo de forma independente e herdando do original a fase e a data da última execução de cada etapa. | RN-109 |
| RF-27 | Listagem de perdas com filtro | O sistema deve listar as perdas registradas com filtro por período, espécie e causa. | RN-16 |
| RF-28 | Cálculo da taxa de mortalidade | O sistema deve calcular a taxa de mortalidade do lote, como a razão entre as perdas dele e a sua quantidade inicial. | RN-17 |
| RF-29 | Alerta de mortalidade acima do limite | O sistema deve emitir alerta para o lote cuja mortalidade ultrapasse o limite definido em Configurações. | RN-17 |
| RF-22 | Quantidade de muda pronta disponível | O sistema deve apresentar a quantidade de muda pronta disponível por espécie e recipiente, somada dos lotes abertos. | RN-04, RN-06, RN-13, RN-57 |
| RF-117 | Mapa do viveiro com áreas, canteiros e lotes | O sistema deve apresentar o mapa do viveiro com as áreas, os canteiros de cada área e os lotes abertos de cada canteiro, cada lote com a sua situação. | RN-92, RN-93 |
| RF-118 | Classificação da situação do lote | O sistema deve classificar o lote em saudável, atenção e crítico a partir das etapas do protocolo vencidas ou a vencer nele, sem que a situação seja digitada. | RN-93, RN-110 |
| RF-119 | Tarefa pendente e atraso do lote | O sistema deve apresentar, ao apontar o lote, a tarefa pendente que determina a situação dele e o atraso em dias. | RN-93 |
| RF-120 | Mortalidade destacada no mapa | O sistema deve apresentar, no mapa, a mortalidade de cada lote e destacar os que ultrapassam o limite. | RN-17 |
| RF-126 | Atribuição do protocolo ao lote na criação | O sistema deve atribuir ao lote, na criação, o protocolo vigente do recipiente dele, e acompanhar o lote etapa a etapa. | RN-98 |
| RF-127 | Geração das ordens do protocolo na agenda | O sistema deve gerar as ordens de tarefa do protocolo na agenda sem digitação, e permitir alterar ou excluir a ordem de um dia sem alterar a etapa. | RN-111, RN-112, RN-113 |
| RF-128 | Avanço de fase por etapa sequencial | O sistema deve avançar a fase do lote ao concluir uma etapa sequencial que declare fase resultante, e não deve avançá-la ao concluir etapa recorrente. | RN-102 |
| RF-129 | Contagem a partir da execução real | O sistema deve contar a ocorrência seguinte de etapa recorrente a partir da data real da execução anterior, e nunca de uma data de calendário prevista. | RN-100 |
| RF-130 | Uma ocorrência em aberto por etapa | O sistema deve manter no máximo uma ordem em aberto por etapa e por lote, sem gerar ocorrência nova enquanto a anterior estiver pendente. | RN-101 |
| RF-131 | Ficha do lote com etapas e vencimentos | O sistema deve apresentar, no lote, as etapas do protocolo com a data da última execução, o próximo vencimento e a situação de cada uma. | RN-110 |
| RF-132 | Etapa em atenção e em atraso | O sistema deve apresentar a etapa em atenção dentro da janela de aviso e em atraso depois do vencimento, e sem indicação de situação quando o alerta da etapa estiver desligado. | RN-104, RN-105 |
| RF-134 | Encerramento do protocolo do lote | O sistema deve encerrar o protocolo do lote quando ele se encerra por saldo zero, por expedição total ou por divisão, cancelando as ordens ainda em aberto sem removê-las. | RN-108 |
| RF-41 | Registro de pedido com cliente, canal e itens | O sistema deve permitir registrar pedido com cliente, canal de venda e itens compostos por espécie, recipiente e quantidade. | RN-01, RN-04, RN-20, RN-29 |
| RF-141 | Preço unitário informado no item | O sistema deve registrar o preço unitário informado em cada item do pedido, e apresentar o total do item e o do pedido. | RN-114 |
| RF-42 | Saldo disponível ao lado do item | O sistema deve apresentar, ao lado de cada item do pedido, a quantidade de muda pronta que a produção tem daquela espécie e recipiente. | RN-06, RN-13 |
| RF-142 | Situação do pedido | O sistema deve controlar a situação do pedido (rascunho, confirmado e cancelado), impedindo alteração de item depois da confirmação. | RN-31 |
| RF-143 | Listagem de pedidos com filtro | O sistema deve listar os pedidos com filtro por cliente, canal e período. | RN-20 |

Fonte: Elaborado pelo autor (2026).

## Quadro 8 – Requisitos não funcionais

| Código | Descrição | Origem |
|---|---|---|
| RNF-01 | Formulários de campo devem apresentar no máximo cinco campos por tela. | RE-1 |
| RNF-02 | Campos de categoria devem oferecer lista fechada de opções, nunca entrada livre de texto. | RE-1 |
| RNF-03 | Elementos acionáveis devem ter alvo de toque compatível com uso de dedos sujos e molhados. | RE-4 |
| RNF-04 | Toda ação de gravação deve produzir resposta visual imediata de confirmação. | RE-4 |
| RNF-05 | O registro de dados em campo deve funcionar sem conexão, com envio automático ao restabelecer a rede. | RE-3 |
| RNF-06 | A interface deve ser concebida para uso em celular, e não adaptada a partir de tela de computador, nas rotinas de registro em campo. | RE-2 |
| RNF-07 | O sistema deve permanecer utilizável sob conexão móvel lenta. | RE-3 |
| RNF-08 | A interface deve empregar o vocabulário da empresa, conforme o glossário, e não termos técnicos do sistema. | RE-1 |
| RNF-09 | Senhas devem ser armazenadas de forma cifrada, por técnica que impeça sua recuperação. | ORG |
| RNF-10 | Identificadores de sessão devem ser armazenados apenas em formato protegido. | ORG |
| RNF-11 | Cookies de sessão devem receber as marcações de segurança que restringem seu uso a comunicação cifrada e impedem leitura por código do navegador. | ORG |
| RNF-12 | As regras de acesso aos dados devem ser executadas no servidor, nunca no navegador. | ORG |
| RNF-13 | Toda comunicação entre cliente e servidor deve ser cifrada em trânsito. | ORG |
| RNF-14 | O sistema deve dispor de rotina de backup e procedimento de recuperação com objetivos declarados. | RE-5 |
| RNF-27 | As telas de coordenação da produção, agenda da semana e mapa de lotes, devem ser concebidas para tela larga, e apresentar no celular uma versão reduzida em lista, sem rolagem horizontal. | RE-2 |
| RNF-15 | Arquivos, identificadores e estruturas de dados devem ser nomeados em inglês; a documentação, em português. | ORG |
| RNF-16 | Cada funcionalidade deve ser desenvolvida em ramificação própria e integrada por solicitação de incorporação. | ORG |
| RNF-17 | Alteração direta na versão principal deve ser impedida por controle automático. | ORG |
| RNF-18 | Mensagens de alteração devem seguir padrão fixo. | ORG |
| RNF-19 | Alterações na estrutura do banco devem ser versionadas em arquivos aplicados de forma controlada, preservando compatibilidade retroativa. | ORG |
| RNF-20 | Toda alteração de código deve incluir testes automatizados cobrindo utilitários, regras de negócio e validações. | ORG |
| RNF-21 | Verificação automática executada antes de cada alteração deve bloquear o envio em caso de arquivo sensível, falha de teste ou desvio de padronização. | ORG |
| RNF-22 | Credenciais, chaves e dados sensíveis não devem ser versionados. | ORG |
| RNF-23 | O tratamento de dados pessoais deve observar a Lei nº 13.709/2018, com finalidade, base legal e prazo de retenção declarados para cada dado coletado. | LEG |
| RNF-24 | Os dados cadastrais de cliente devem comportar o conjunto exigido para emissão de nota fiscal no sistema externo em uso. | LEG |
| RNF-25 | O nome científico da espécie deve estar disponível para atender exigências de projetos de compensação ambiental. | LEG, DOM |
| RNF-26 | O sistema deve operar em navegador de celular de uso corrente pela equipe, sem exigir instalação a partir de loja de aplicativos. | RE-2, RE-5 |

Fonte: Elaborado pelo autor (2026).

## Quadro 9 – Restrições do projeto e os requisitos não funcionais que originam

| Código | Descrição | Origem | Requisitos originados |
|---|---|---|---|
| RE-1 | Usuários sem formação técnica. | Perfil da equipe | RNF-01, RNF-02, RNF-08 |
| RE-2 | Celular como dispositivo principal. | Contexto de campo | RNF-06, RNF-27, RNF-26 |
| RE-3 | Conexão instável no viveiro. | Ambiente físico | RNF-05, RNF-07 |
| RE-4 | Uso com as mãos sujas, sob sol e chuva. | Ambiente físico | RNF-03, RNF-04 |
| RE-5 | Orçamento de microempresa. | Porte da organização | RNF-14, RNF-26 |
| RE-6 | Prazo até novembro de 2026. | Calendário acadêmico | – |
| RE-7 | Dados pessoais de clientes e de funcionários sujeitos à legislação de proteção de dados. | Legal | – |

Fonte: Elaborado pelo autor (2026).

## Quadro 10 – Síntese da origem dos requisitos do sistema

| Origem | RF: Qtd. | RF: % | RNF: Qtd. | RNF: % |
|---|---:|---:|---:|---:|
| Observação participante (OP) | 26 | 35,6 | 0 | 0,0 |
| Entrevista (EN) | 17 | 23,3 | 0 | 0,0 |
| Análise documental (AD) | 2 | 2,7 | 0 | 0,0 |
| Estudo do domínio (DOM) | 6 | 8,2 | 1 | 5,9 |
| Exigência legal (LEG) | 2 | 2,7 | 3 | 17,6 |
| Política do projeto (ORG) | 20 | 27,4 | 13 | 76,5 |
| **Total de menções** | **73** | | **17** | |

Fonte: Elaborado pelo autor (2026).

> **A soma das menções excede o número de requisitos**, e é esperado: um requisito pode ter mais
> de uma origem, e a coluna do `B2` é multivalorada. O percentual é sobre o total de menções, não
> sobre o de requisitos.
