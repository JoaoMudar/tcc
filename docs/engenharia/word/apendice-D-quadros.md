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
| RN-07 | O insumo é material consumível aplicado na produção, classificado em categoria fechada: substrato, adubo, defensivo, recipiente, outros. |

Fonte: Elaborado pelo autor (2026).

## Quadro 2 – Regras de negócio da área de produção, lote e trabalho

| Código | Descrição |
|---|---|
| RN-08 | A quantidade disponível de uma espécie é a soma dos lotes abertos, já descontadas perdas e vendas, e não um número digitado. |
| RN-09 | A contagem física prevalece sobre a quantidade calculada: onde os dois divergem, o que vale é o que se contou, e o ajuste fica registrado. |
| RN-10 | A perda é evento normal da produção e exige causa classificada em lista fechada, seca, praga, geada, manuseio, outro. |
| RN-11 | A mortalidade é a razão entre as mudas perdidas de um lote e a quantidade inicial dele. Acima do limite definido, inicialmente 20%, dispara alerta. |
| RN-12 | A unidade de planejamento da agenda é dia × turno (manhã ou tarde), e a tarefa que tem hora marcada na vida real a declara: a hora é opcional e o turno é sempre exigido, porque os turnos não cobrem o dia inteiro e a hora não diz a qual deles a tarefa pertence. |
| RN-13 | A semana fecha e, fechada, não se altera: sem isso o registro do período muda depois de consolidado. |
| RN-14 | A atribuição não confirmada até o fechamento da semana é assumida como realizada, e a condição fica registrada, para que a suposição não se confunda com a confirmação. |
| RN-15 | O tipo de tarefa é vocabulário fechado, e não digitação livre: é ele que declara o que a confirmação vai pedir. |
| RN-16 | Só semeadura e repicagem somam ao estoque; irrigação, adubação e rustificação são manejo e não alteram quantidade. |
| RN-17 | O viveiro é dividido em áreas identificadas por letra (A, B, C…), e cada área tem canteiros numerados dentro dela, recomeçando em cada área. |
| RN-18 | Lote é a leva de mudas da mesma espécie, no mesmo recipiente, plantada junta. É a unidade de rastreamento da produção. |
| RN-19 | Um lote ocupa um canteiro, e um canteiro comporta vários lotes. Leva que não cabe num canteiro é outro lote. |
| RN-20 | A repicagem para recipiente maior cria lote novo ligado ao de origem: a leva muda de identidade quando muda de recipiente, e a ligação é o que permite saber quanto dela chegou à venda. |
| RN-21 | Nenhum lote tem saldo negativo. Movimento que levaria o saldo abaixo de zero é recusado: significa que a contagem está errada, e gravar o negativo propagaria o erro. |
| RN-22 | Lote com saldo zero está encerrado: sai da ocupação do canteiro e permanece no histórico. Canteiro livre é canteiro sem lote aberto. |
| RN-23 | Toda tarefa do viveiro pertence a uma de seis categorias: semente, terra, plantio, manutenção, pós-morte, expedição. |
| RN-24 | Parte das tarefas é contada por unidade, e a pergunta do viveiro é quantos; as demais só registram que foram feitas. A quantidade é de cada pessoa, e não da tarefa: quatro pessoas enchendo saquinho produzem quatro números, e é assim que o viveiro fala. |
| RN-25 | Tarefa que trabalha mudas já plantadas identifica o lote, e o lote carrega o canteiro, a espécie e o recipiente: perguntá-los de novo é redundância. |
| RN-26 | Uma tarefa admite vários executores, e o mesmo turno admite várias tarefas em curso com grupos diferentes. |
| RN-27 | Os limiares e períodos da operação são parâmetros mantidos, e não constantes de código: a hora de início e de fim de cada turno e o limite de dias que separa atenção de crítico mudam com a estação e com o tipo de tarefa. |
| RN-28 | A classificação separa mortas de vivas, e a parte morta vira perda do lote no mesmo registro. Separar os dois gestos faria a perda ser esquecida. |
| RN-29 | A ocupação do canteiro é a soma dos saldos dos lotes abertos nele. |
| RN-30 | A situação do lote é derivada, nunca digitada. Situação gravada envelhece sozinha, e o lote marcado como saudável ontem continuaria saudável hoje. |
| RN-31 | A tarefa marcada como recorrente nasce preenchida na cópia da semana: a rotina fixa não se lança de novo a cada segunda-feira. |

Fonte: Elaborado pelo autor (2026).

## Quadro 3 – Regras de negócio da área de protocolo de atividades por lote

| Código | Descrição |
|---|---|
| RN-32 | O protocolo de atividades é do recipiente: é o recipiente que determina o manejo, e é dele que o lote descobre qual receita seguir. |
| RN-33 | O evento de referência da etapa é declarado, e não é a etapa anterior. Pode ser a criação do lote ou a conclusão de uma etapa específica do mesmo protocolo. |
| RN-34 | A ocorrência seguinte de etapa recorrente conta da data real da execução anterior, e nunca de uma data de calendário prevista. |
| RN-35 | Uma etapa tem no máximo uma ocorrência em aberto, e a contagem não reinicia sozinha enquanto ela estiver pendente. |
| RN-36 | A etapa sequencial ocorre uma vez e avança a fase do lote; a recorrente repete indefinidamente e não avança fase nenhuma. |
| RN-37 | A janela de aviso é proporcional ao intervalo da etapa, e não um número fixo de dias: aviso fixo de três dias não serve à etapa trimestral e à diária ao mesmo tempo. Etapa com o alerta desligado não recebe situação, e apenas registra feito ou não feito no dia. |
| RN-38 | O tempo cadastrado na espécie sobrescreve o do protocolo para aquela etapa; sem valor na espécie, vale o do protocolo do recipiente. |
| RN-39 | Alteração no protocolo não retroage. Vale para o que ainda vai ser gerado, e não reescreve ordem já cumprida. |
| RN-40 | Lote encerrado não gera ordem. O lote se encerra por saldo zero (RN-22), por expedição total ou por divisão, e as ordens em aberto são canceladas, não removidas. |
| RN-41 | A divisão do lote produz dois lotes que seguem o protocolo de forma independente, herdando do original a fase e a data da última execução de cada etapa. |
| RN-42 | O vencimento da etapa é derivado, nunca digitado: sai do evento de referência, da última execução e do tempo declarado. |
| RN-43 | A ordem gerada pelo protocolo é atribuição comum: nasce sem ninguém escalado, porque o protocolo diz o que fazer e quando, e quem faz continua sendo de quem monta a agenda; pertence à semana do seu vencimento, ou à semana aberta corrente se aquela já estiver fechada, sem que o vencimento mude; e alterar ou excluir a ordem de um dia não altera a etapa nem as ordens dos demais lotes. |

Fonte: Elaborado pelo autor (2026).

## Quadro 4 – Regras de negócio da área de cliente e pedido

| Código | Descrição |
|---|---|
| RN-44 | O canal de venda é lista fechada de cinco, atacado (padrão), compensação ambiental, paisagismo, prefeitura e varejo, e todo pedido pertence a um deles. |
| RN-45 | O cliente é pessoa física ou jurídica, e a venda com nota fiscal exige o conjunto fiscal completo e documento válido. A nota é emitida em sistema externo: a emissão não pertence a este sistema, que apenas mantém o cadastro capaz de alimentá-la. |
| RN-46 | A negociação nasce no WhatsApp e o cliente frequentemente é novo: nome e telefone bastam para registrar o pedido, e o cadastro se completa depois. |
| RN-47 | Toda contraparte do viveiro é uma identidade única (quem compra, quem vende, quem trabalha), e o papel é que se multiplica. |
| RN-48 | A venda para compensação ambiental exige o nome científico da espécie. |
| RN-49 | Dado pessoal de cliente e de funcionário é tratado sob a Lei nº 13.709/2018, com finalidade, base legal e prazo de retenção declarados. |
| RN-50 | O pedido percorre uma sequência de situações (rascunho, confirmado, cancelado), e o item não se altera depois de confirmado. |
| RN-51 | Uma pessoa tem mais de um endereço, e o de entrega pode não ser o de cobrança. |
| RN-52 | O preço é o que foi negociado, e o viveiro o define fora do sistema, na conversa com o cliente. Ao sistema cabe registrar por quanto se vendeu, e não dizer por quanto se deveria vender. |

Fonte: Elaborado pelo autor (2026).

## Quadro 5 – Regras de negócio da área de acesso e responsabilidade

| Código | Descrição |
|---|---|
| RN-53 | Cada pessoa com acesso tem um perfil (chefia, gerência, administrador) que determina o que ela vê e o que pode fazer. |
| RN-54 | Todo registro tem autor identificado: quem criou o lote, registrou a perda, confirmou a tarefa ou lançou o pedido fica gravado com o registro. |

Fonte: Elaborado pelo autor (2026).

## Quadro 6 – Distribuição das regras de negócio por área do domínio

| Área | Regras | Quantidade |
|---|---|---:|
| Domínio e produto | RN-01, RN-02, RN-03, RN-04, RN-05, RN-06, RN-07 | 7 |
| Produção, lote e trabalho | RN-08, RN-09, RN-10, RN-11, RN-12, RN-13, RN-14, RN-15, RN-16, RN-17, RN-18, RN-19, RN-20, RN-21, RN-22, RN-23, RN-24, RN-25, RN-26, RN-27, RN-28, RN-29, RN-30, RN-31 | 24 |
| Protocolo de atividades por lote | RN-32, RN-33, RN-34, RN-35, RN-36, RN-37, RN-38, RN-39, RN-40, RN-41, RN-42, RN-43 | 12 |
| Cliente e pedido | RN-44, RN-45, RN-46, RN-47, RN-48, RN-49, RN-50, RN-51, RN-52 | 9 |
| Acesso e responsabilidade | RN-53, RN-54 | 2 |
| **Total** | | **54** |

Fonte: Elaborado pelo autor (2026).

---

# Quadros: requisitos

## Quadro 7 – Requisitos funcionais e as regras de negócio que os originam

| Código | Nome | Descrição | Código RN |
|---|---|---|---|
| RF-01 | Autenticação por identificador e senha | O sistema deve autenticar o usuário por identificador e senha antes de conceder qualquer acesso. | RN-53, RN-54 |
| RF-02 | Troca de senha no primeiro acesso | O sistema deve exigir troca de senha no primeiro acesso do usuário. | – |
| RF-03 | Encerramento da própria sessão | O sistema deve permitir ao usuário encerrar sua sessão. | – |
| RF-04 | Registro das tentativas de autenticação | O sistema deve registrar cada tentativa de autenticação com data, origem e dispositivo. | RN-54 |
| RF-05 | Criação de usuário e atribuição de perfil | O sistema deve permitir ao administrador criar usuários e atribuir perfil. | RN-53 |
| RF-06 | Verificação de permissão a cada operação | O sistema deve verificar a permissão do perfil a cada operação, e não apenas ocultar elementos da interface. | RN-53 |
| RF-07 | Consulta e encerramento de sessões ativas | O sistema deveria permitir ao usuário visualizar e encerrar suas sessões ativas. | – |
| RF-08 | Manutenção do período de trabalho | O sistema deve permitir manter o período de trabalho, com hora de início e de fim de cada turno, e adotá-lo como jornada padrão da agenda. | RN-12, RN-27 |
| RF-09 | Manutenção dos parâmetros de operação | O sistema deve permitir alterar o valor dos parâmetros de operação, os limites de atenção e de atraso do lote e o limite de mortalidade, sem permitir criar nem excluir parâmetro. | RN-11, RN-27 |
| RF-10 | Cadastro e busca de espécie | O sistema deve permitir cadastrar espécie com nome científico, nomes populares, características e fotografia, e localizá-la por qualquer um desses nomes. | RN-01, RN-02, RN-03 |
| RF-11 | Cadastro de recipiente | O sistema deve permitir cadastrar recipientes com nome e volume. | RN-04 |
| RF-12 | Cadastro de insumo | O sistema deve permitir cadastrar insumos com unidade de medida e categoria. | RN-07 |
| RF-13 | Cadastro de área e canteiro | O sistema deve permitir cadastrar áreas do viveiro identificadas por letra e canteiros numerados dentro de cada área, recusando número repetido na mesma área. | RN-17 |
| RF-14 | Identidade única de pessoa com múltiplos papéis | O sistema deve manter uma identidade única por pessoa, à qual se atribuem os papéis de cliente, fornecedor e funcionário, sem duplicar o cadastro quando a mesma pessoa exercer mais de um. | RN-47 |
| RF-15 | Cadastro rápido de cliente | O sistema deve permitir cadastro rápido de cliente com nome e telefone, sem sair da tela de pedido. | RN-46 |
| RF-16 | Cadastro completo de cliente | O sistema deve permitir cadastro completo de cliente com dados fiscais de pessoa física ou jurídica. | RN-45, RN-51 |
| RF-17 | Validação de CPF e CNPJ | O sistema deve validar CPF e CNPJ informados. | RN-45 |
| RF-18 | Busca de pessoa | O sistema deve permitir localizar pessoa por nome, telefone ou documento. | RN-47 |
| RF-19 | Cadastro de fornecedor | O sistema deve permitir cadastrar fornecedor com contato e localização. | RN-47 |
| RF-20 | Cadastro de funcionário | O sistema deve permitir cadastrar funcionário com contato e vínculo (fixo ou diarista), inclusive quando ele não tem acesso ao sistema. | RN-47 |
| RF-21 | Catálogo de tipos de tarefa e formulário que ele comanda | O sistema deve permitir manter o catálogo de tipos de tarefa, com nome, categoria e a declaração de se a tarefa é quantitativa por unidade e de se exige lote específico, espécie e recipiente, e deve pedir, no planejamento e na confirmação, exatamente os dados que o tipo declarar exigir, e nenhum outro. | RN-15, RN-23, RN-24, RN-25 |
| RF-22 | Protocolo de atividades por recipiente | O sistema deve permitir manter, por recipiente, um protocolo de atividades como sequência ordenada de etapas, cada etapa referenciando um tipo de tarefa do catálogo e declarando se o agendamento é sequencial ou recorrente, com o tempo em dias. | RN-05, RN-32, RN-36, RN-39 |
| RF-23 | Evento de referência da etapa | O sistema deve permitir que cada etapa do protocolo declare o seu evento de referência: a criação do lote ou a conclusão de uma etapa específica do mesmo protocolo. | RN-33 |
| RF-24 | Alerta e janela de aviso por etapa | O sistema deve permitir ligar e desligar o alerta de atraso por etapa do protocolo, e sobrescrever nela a janela de aviso padrão. | RN-37 |
| RF-25 | Tempo de etapa customizado por espécie | O sistema deveria permitir, no cadastro da espécie, sobrescrever o tempo em dias de uma etapa específica do protocolo. | RN-38 |
| RF-26 | Montagem da agenda da semana | O sistema deve permitir montar a agenda da semana atribuindo, por funcionário e por dia, o tipo de tarefa e o turno, manhã ou tarde, admitindo a mesma tarefa para mais de um funcionário e mais de uma tarefa no mesmo turno com grupos diferentes, e deve permitir declarar a hora de início e de fim da tarefa que tiver hora marcada, sem exigi-la das demais. | RN-12, RN-26 |
| RF-27 | Cópia da semana e tarefa recorrente | O sistema deve permitir copiar a agenda da semana anterior e marcar tarefas como recorrentes, que passam a nascer preenchidas na cópia. | RN-31 |
| RF-28 | Situação da semana | O sistema deve controlar a situação da semana (rascunho, publicada e fechada) e impedir alteração depois do fechamento. | RN-13 |
| RF-29 | Confirmação da tarefa realizada | O sistema deve permitir confirmar a atribuição como realizada, apresentando os campos que o tipo de tarefa exigir, o lote uma vez para a tarefa e a quantidade uma vez por participante, exigindo o lote quando o tipo declarar lote específico e pedindo a quantidade apenas quando o tipo for quantitativo por unidade. | RN-24, RN-25, RN-28 |
| RF-30 | Área ou canteiro da tarefa sem lote | O sistema deve permitir registrar a área ou o canteiro da tarefa que não exige lote, e dispensá-los quando o lote os determinar. | RN-25 |
| RF-31 | Tarefa não confirmada assumida no fechamento | O sistema deve assumir como realizada, ao fechar a semana, a tarefa planejada que não foi confirmada, registrando essa condição. | RN-14 |
| RF-32 | Criação de lote | O sistema deve permitir criar lote informando espécie, recipiente, quantidade, área e canteiro. | RN-01, RN-04, RN-18, RN-19 |
| RF-33 | Ocupação do viveiro e encerramento do lote | O sistema deve apresentar a ocupação do viveiro por área e canteiro, indicando os lotes de cada canteiro ocupado e quais estão livres, e deve encerrar o lote quando o saldo chegar a zero, liberando o canteiro e preservando o histórico. | RN-19, RN-22, RN-29 |
| RF-34 | Repicagem com lote de origem | O sistema deve permitir registrar repicagem transferindo parte ou todo o lote para recipiente maior, criando um lote novo que aponta para o de origem. | RN-20 |
| RF-35 | Histórico de movimentos do lote | O sistema deve apresentar o histórico de movimentos do lote, com a quantidade e o motivo de cada um. | RN-08 |
| RF-36 | Recusa de saldo negativo | O sistema não deve permitir movimento que deixe o saldo do lote negativo. | RN-21 |
| RF-37 | Registro de perda, contagem e venda sobre o lote | O sistema deve permitir registrar perda, contagem física e saída de venda sobre o lote, dispensando informar espécie e recipiente, que o lote determina. | RN-25 |
| RF-38 | Perda com causa em lista fechada | O sistema deve permitir registrar a perda com quantidade e causa selecionada em lista fechada. | RN-10 |
| RF-39 | Contagem física do lote | O sistema deve permitir registrar contagem física do lote, gerando o movimento de ajuste que reconcilia o saldo. | RN-09 |
| RF-40 | Divisão de lote | O sistema deve permitir dividir um lote em dois, com cada resultante seguindo o protocolo de forma independente e herdando do original a fase e a data da última execução de cada etapa. | RN-41 |
| RF-41 | Listagem de perdas com filtro | O sistema deve listar as perdas registradas com filtro por período, espécie e causa. | RN-10 |
| RF-42 | Taxa de mortalidade e destaque no mapa | O sistema deve calcular a taxa de mortalidade do lote, como a razão entre as perdas dele e a sua quantidade inicial, apresentá-la no mapa e destacar ali o lote cuja taxa ultrapasse o limite definido em Configurações. | RN-11 |
| RF-43 | Quantidade de muda pronta disponível | O sistema deve apresentar a quantidade de muda pronta disponível por espécie e recipiente, somada dos lotes abertos. | RN-04, RN-06, RN-08, RN-16 |
| RF-44 | Mapa do viveiro com áreas, canteiros e lotes | O sistema deve apresentar o mapa do viveiro com as áreas, os canteiros de cada área e os lotes abertos de cada canteiro, cada lote com a sua situação. | RN-29, RN-30 |
| RF-45 | Situação do lote e tarefa pendente que a determina | O sistema deve classificar o lote em saudável, atenção e crítico a partir das etapas do protocolo vencidas ou a vencer nele, sem que a situação seja digitada, e apresentar, ao apontar o lote, a tarefa pendente que determina essa situação e o atraso em dias. | RN-30, RN-42 |
| RF-46 | Atribuição do protocolo ao lote na criação | O sistema deve atribuir ao lote, na criação, o protocolo vigente do recipiente dele, e acompanhar o lote etapa a etapa. | RN-32 |
| RF-47 | Geração das ordens do protocolo na agenda | O sistema deve gerar as ordens de tarefa do protocolo na agenda sem digitação, abrindo em rascunho a semana do vencimento quando ela ainda não existir, e permitir alterar ou excluir a ordem de um dia sem alterar a etapa. | RN-43 |
| RF-48 | Avanço de fase por etapa sequencial | O sistema deve avançar a fase do lote ao concluir uma etapa sequencial que declare fase resultante, e não deve avançá-la ao concluir etapa recorrente. | RN-36 |
| RF-49 | Contagem a partir da execução real | O sistema deve contar a ocorrência seguinte de etapa recorrente a partir da data real da execução anterior, e nunca de uma data de calendário prevista. | RN-34 |
| RF-50 | Uma ocorrência em aberto por etapa | O sistema deve manter no máximo uma ordem em aberto por etapa e por lote, sem gerar ocorrência nova enquanto a anterior estiver pendente. | RN-35 |
| RF-51 | Ficha do lote com etapas e vencimentos | O sistema deve apresentar, no lote, as etapas do protocolo com a data da última execução, o próximo vencimento e a situação de cada uma. | RN-42 |
| RF-52 | Etapa em atenção e em atraso | O sistema deve apresentar a etapa em atenção dentro da janela de aviso e em atraso depois do vencimento, e sem indicação de situação quando o alerta da etapa estiver desligado. | RN-37 |
| RF-53 | Encerramento do protocolo do lote | O sistema deve encerrar o protocolo do lote quando ele se encerra por saldo zero, por expedição total ou por divisão, cancelando as ordens ainda em aberto sem removê-las. | RN-40 |
| RF-54 | Registro de pedido com cliente, canal e itens | O sistema deve permitir registrar pedido com cliente, canal de venda e itens compostos por espécie, recipiente e quantidade. | RN-01, RN-04, RN-44, RN-48 |
| RF-55 | Preço unitário informado no item | O sistema deve registrar o preço unitário informado em cada item do pedido, e apresentar o total do item e o do pedido. | RN-52 |
| RF-56 | Saldo disponível ao lado do item | O sistema deve apresentar, ao lado de cada item do pedido, a quantidade de muda pronta que a produção tem daquela espécie e recipiente. | RN-06, RN-08 |
| RF-57 | Situação do pedido | O sistema deve controlar a situação do pedido (rascunho, confirmado e cancelado), impedindo alteração de item depois da confirmação. | RN-50 |
| RF-58 | Listagem de pedidos com filtro | O sistema deve listar os pedidos com filtro por cliente, canal e período. | RN-44 |

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
| RNF-07 | A interface deve empregar o vocabulário da empresa, conforme o glossário, e não termos técnicos do sistema. | RE-1 |
| RNF-08 | Senhas devem ser armazenadas de forma cifrada, por técnica que impeça sua recuperação. | ORG |
| RNF-09 | Identificadores de sessão devem ser armazenados apenas em formato protegido. | ORG |
| RNF-10 | Cookies de sessão devem receber as marcações de segurança que restringem seu uso a comunicação cifrada e impedem leitura por código do navegador. | ORG |
| RNF-11 | As regras de acesso aos dados devem ser executadas no servidor, nunca no navegador. | ORG |
| RNF-12 | Toda comunicação entre cliente e servidor deve ser cifrada em trânsito. | ORG |
| RNF-13 | O sistema deve dispor de rotina de backup e procedimento de recuperação com objetivos declarados. | RE-5 |
| RNF-14 | As telas de coordenação da produção, agenda da semana e mapa de lotes, devem ser concebidas para tela larga, e apresentar no celular uma versão reduzida em lista, sem rolagem horizontal. | RE-2 |
| RNF-15 | Arquivos, identificadores e estruturas de dados devem ser nomeados em inglês; a documentação, em português. | ORG |
| RNF-16 | Cada funcionalidade deve ser desenvolvida em ramificação própria e integrada por solicitação de incorporação. | ORG |
| RNF-17 | Mensagens de alteração devem seguir padrão fixo. | ORG |
| RNF-18 | Alterações na estrutura do banco devem ser versionadas em arquivos aplicados de forma controlada, preservando compatibilidade retroativa. | ORG |
| RNF-19 | Toda alteração de código deve incluir testes automatizados cobrindo utilitários, regras de negócio e validações. | ORG |
| RNF-20 | Credenciais, chaves e dados sensíveis não devem ser versionados. | ORG |
| RNF-21 | O tratamento de dados pessoais deve observar a Lei nº 13.709/2018, com finalidade, base legal e prazo de retenção declarados para cada dado coletado. | LEG |
| RNF-22 | Os dados cadastrais de cliente devem comportar o conjunto exigido para emissão de nota fiscal no sistema externo em uso. | LEG |
| RNF-23 | O nome científico da espécie deve estar disponível para atender exigências de projetos de compensação ambiental. | LEG, DOM |
| RNF-24 | O sistema deve operar em navegador de celular de uso corrente pela equipe, sem exigir instalação a partir de loja de aplicativos. | RE-2, RE-5 |

Fonte: Elaborado pelo autor (2026).

## Quadro 9 – Restrições do projeto e os requisitos não funcionais que originam

| Código | Descrição | Origem | Requisitos originados |
|---|---|---|---|
| RE-1 | Usuários sem formação técnica. | Perfil da equipe | RNF-01, RNF-02, RNF-07 |
| RE-2 | Celular como dispositivo principal. | Contexto de campo | RNF-06, RNF-14, RNF-24 |
| RE-3 | Conexão instável no viveiro. | Ambiente físico | RNF-05 |
| RE-4 | Uso com as mãos sujas, sob sol e chuva. | Ambiente físico | RNF-03, RNF-04 |
| RE-5 | Orçamento de microempresa. | Porte da organização | RNF-13, RNF-24 |
| RE-6 | Prazo até novembro de 2026. | Calendário acadêmico | – |
| RE-7 | Dados pessoais de clientes e de funcionários sujeitos à legislação de proteção de dados. | Legal | – |

Fonte: Elaborado pelo autor (2026).

## Quadro 10 – Síntese da origem dos requisitos do sistema

| Origem | RF: Qtd. | RF: % | RNF: Qtd. | RNF: % |
|---|---:|---:|---:|---:|
| Observação participante (OP) | 21 | 32,3 | 0 | 0,0 |
| Entrevista (EN) | 14 | 21,5 | 0 | 0,0 |
| Análise documental (AD) | 2 | 3,1 | 0 | 0,0 |
| Estudo do domínio (DOM) | 6 | 9,2 | 1 | 6,7 |
| Exigência legal (LEG) | 2 | 3,1 | 3 | 20,0 |
| Política do projeto (ORG) | 20 | 30,8 | 11 | 73,3 |
| **Total de menções** | **65** | | **15** | |

Fonte: Elaborado pelo autor (2026).

> **A soma das menções excede o número de requisitos**, e é esperado: um requisito pode ter mais
> de uma origem, e a coluna do `B2` é multivalorada. O percentual é sobre o total de menções, não
> sobre o de requisitos.
