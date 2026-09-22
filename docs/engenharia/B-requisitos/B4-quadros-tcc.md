# B4: Quadros de regras de negócio e requisitos

> **Artefato:** Quadros formatados para o texto do TCC · **Bloco:** B, Engenharia de requisitos
> **Destino no TCC:** Apêndice D, Quadros de regras de negócio e requisitos
> **Arquivo gerado** por `scripts/build-b4-quadros.mjs`, a partir de [`B2`](B2-especificacao-requisitos.md),
> [`B3`](B3-regras-de-negocio.md) e [`A1`](../A-fundacao/A1-documento-de-visao.md) §9.
> **Não editar à mão:** altere a fonte e rode o script.

---

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
| RN-01 | Toda informação da produção e da venda se refere a uma espécie. |
| RN-02 | A espécie tem um nome científico e vários nomes populares. |
| RN-03 | A espécie pode ter várias características ao mesmo tempo, como nativa, frutífera e madeireira. |
| RN-04 | O recipiente define o porte da muda. Espécie e recipiente formam o produto. |
| RN-05 | A produção da muda segue uma sequência declarada de etapas com prazo, do plantio à muda pronta. |
| RN-06 | Só a muda pronta pode ser vendida. |
| RN-07 | O insumo pertence a uma categoria, que pode ser substrato, adubo, defensivo, recipiente ou outros. |

Fonte: Elaborado pelo autor (2026).

## Quadro 2 – Regras de negócio da área de produção, lote e trabalho

| Código | Descrição |
|---|---|
| RN-08 | A quantidade disponível do produto é a soma dos lotes abertos daquela espécie e recipiente. |
| RN-09 | A contagem física vale mais que a quantidade calculada. |
| RN-10 | Toda perda tem uma causa, que pode ser seca, praga, geada, manuseio ou outra. |
| RN-11 | A mortalidade do lote é a razão entre as perdas e a quantidade inicial. Acima do limite definido em Configurações, o lote é destacado. |
| RN-12 | A agenda é planejada por dia e turno. A tarefa com hora marcada informa a hora, mas o turno é sempre obrigatório. |
| RN-13 | A semana fechada não pode ser alterada. |
| RN-14 | A tarefa não confirmada até o fechamento da semana é considerada realizada, e isso fica registrado. |
| RN-15 | O tipo de tarefa vem de uma lista fechada e define o que a confirmação pede. |
| RN-16 | Só semeadura e repicagem aumentam o estoque. |
| RN-17 | As mudas ficam em áreas identificadas por letra, com canteiros numerados em cada área. |
| RN-18 | Lote é a leva de mudas da mesma espécie e recipiente plantada junta. |
| RN-19 | Um lote ocupa um canteiro, e um canteiro pode ter vários lotes. |
| RN-20 | A repicagem para recipiente maior cria um lote novo ligado ao de origem. |
| RN-21 | Nenhum lote pode ter saldo negativo. |
| RN-22 | O lote com saldo zero é encerrado e continua no histórico. |
| RN-23 | Algumas tarefas são contadas por unidade, e a quantidade é registrada por pessoa. |
| RN-24 | A tarefa feita em mudas plantadas informa só o lote, que já define canteiro, espécie e recipiente. |
| RN-25 | Uma tarefa pode ter várias pessoas, e um turno pode ter várias tarefas. |
| RN-26 | O horário dos turnos e os limites de atraso são ajustáveis. |
| RN-27 | Na classificação, as mudas mortas viram perda do lote no mesmo registro. |
| RN-28 | A ocupação do canteiro é a soma dos saldos dos lotes abertos nele. |
| RN-29 | A tarefa recorrente já aparece preenchida na cópia da semana. |

Fonte: Elaborado pelo autor (2026).

## Quadro 3 – Regras de negócio da área de protocolo de atividades por lote

| Código | Descrição |
|---|---|
| RN-30 | O protocolo de atividades pertence ao recipiente. |
| RN-31 | Cada etapa informa a partir de quando é contada, que pode ser a criação do lote ou a conclusão de outra etapa. |
| RN-32 | A etapa recorrente seguinte conta a partir da data real da execução anterior. |
| RN-33 | Uma etapa tem no máximo uma ocorrência em aberto. |
| RN-34 | A etapa sequencial acontece uma vez e avança a fase do lote. A recorrente se repete e não avança fase. |
| RN-35 | O aviso da etapa é proporcional ao seu intervalo. Etapa com alerta desligado não recebe situação. |
| RN-36 | O tempo informado na espécie substitui o do protocolo para aquela etapa. |
| RN-37 | Alterar o protocolo não muda o que já foi feito. |
| RN-38 | O lote se encerra por saldo zero, expedição total ou divisão. Lote encerrado não recebe sugestão do protocolo, e as tarefas dele ainda não confirmadas são canceladas. |
| RN-39 | Na divisão, cada lote novo segue o protocolo sozinho e herda a fase e as datas do original. |
| RN-40 | O vencimento da etapa é calculado, nunca digitado. |
| RN-41 | O protocolo sugere tarefas de acordo com a necessidade do lote. |

Fonte: Elaborado pelo autor (2026).

## Quadro 4 – Regras de negócio da área de cliente e pedido

| Código | Descrição |
|---|---|
| RN-42 | Todo pedido tem um canal de venda, que pode ser atacado, compensação ambiental, paisagismo, prefeitura ou varejo. |
| RN-43 | O cliente é pessoa física ou jurídica. A venda com nota exige os dados fiscais completos, e a nota é emitida em outro sistema. |
| RN-44 | Nome e telefone bastam para registrar o pedido de um cliente novo. |
| RN-45 | Cada pessoa tem um cadastro único, mesmo sendo cliente, fornecedor e funcionário. |
| RN-46 | A venda para compensação ambiental exige o nome científico da espécie. |
| RN-47 | Os dados pessoais de clientes e funcionários seguem a Lei nº 13.709/2018. |
| RN-48 | Aprovar o pedido trava o item, que depois disso não muda em espécie, quantidade nem preço. |
| RN-49 | Uma pessoa pode ter mais de um endereço. |
| RN-50 | O preço é combinado com o cliente e registrado no pedido depois da conferência de disponibilidade, e o pedido não é aprovado enquanto faltar o preço de algum item. |

Fonte: Elaborado pelo autor (2026).

## Quadro 5 – Regras de negócio da área de acesso e responsabilidade

| Código | Descrição |
|---|---|
| RN-51 | O perfil do usuário (chefia, gerência ou administrador) define o que ele pode ver e fazer. |
| RN-52 | Todo registro guarda quem o fez. |
| RN-53 | O pedido percorre oito situações, cadastrado, verificando, verificado, pendente de alteração, aprovado, separando, pronto para envio e cancelado, e cada uma delas espera por um perfil determinado. |
| RN-54 | O item conferido está disponível por inteiro, disponível em parte ou indisponível. A parte informada vai de uma muda até uma a menos que a pedida, e exige dizer em que recipiente ela está. |
| RN-55 | A composição do item pedido sem espécie soma exatamente a quantidade dele, e só admite espécie que o cliente aceite. |
| RN-56 | O item pedido sem espécie não vai na carga, e sim as espécies que o compõem. A soma de um item nas cargas reproduz a quantidade dele. |
| RN-57 | A carga fica pronta quando todos os itens dela foram separados, e o pedido fica pronto para envio quando todas as cargas estão prontas. |
| RN-58 | O dia de carregar é o dia útil anterior à data de entrega, de segunda a sexta-feira. |

Fonte: Elaborado pelo autor (2026).

## Quadro 6 – Distribuição das regras de negócio por área do domínio

| Área | Regras | Quantidade |
|---|---|---:|
| Domínio e produto | RN-01, RN-02, RN-03, RN-04, RN-05, RN-06, RN-07 | 7 |
| Produção, lote e trabalho | RN-08, RN-09, RN-10, RN-11, RN-12, RN-13, RN-14, RN-15, RN-16, RN-17, RN-18, RN-19, RN-20, RN-21, RN-22, RN-23, RN-24, RN-25, RN-26, RN-27, RN-28, RN-29 | 22 |
| Protocolo de atividades por lote | RN-30, RN-31, RN-32, RN-33, RN-34, RN-35, RN-36, RN-37, RN-38, RN-39, RN-40, RN-41 | 12 |
| Cliente e pedido | RN-42, RN-43, RN-44, RN-45, RN-46, RN-47, RN-48, RN-49, RN-50 | 9 |
| Acesso e responsabilidade | RN-51, RN-52, RN-53, RN-54, RN-55, RN-56, RN-57, RN-58 | 8 |
| **Total** | | **58** |

Fonte: Elaborado pelo autor (2026).

---

# Quadros: requisitos

## Quadro 7 – Requisitos funcionais e as regras de negócio que os originam

| Código | Nome | Descrição | Código RN |
|---|---|---|---|
| RF-01 | Autenticação por identificador e senha | O sistema deve autenticar o usuário por identificador e senha antes de conceder qualquer acesso. | – |
| RF-02 | Troca de senha no primeiro acesso | O sistema deve exigir troca de senha no primeiro acesso do usuário. | – |
| RF-03 | Encerramento da própria sessão | O sistema deve permitir ao usuário encerrar sua sessão. | – |
| RF-04 | Registro das tentativas de autenticação | O sistema deve registrar cada tentativa de autenticação com data, origem e dispositivo. | RN-52 |
| RF-05 | Criação de usuário e atribuição de perfil | O sistema deve permitir ao administrador criar usuários e atribuir perfil. | RN-51 |
| RF-06 | Verificação de permissão a cada operação | O sistema deve verificar a permissão do perfil a cada operação, e não apenas ocultar elementos da interface. | RN-51 |
| RF-07 | Consulta e encerramento de sessões ativas | O sistema deve permitir ao usuário visualizar e encerrar suas sessões ativas. | – |
| RF-08 | Manutenção do período de trabalho | O sistema deve permitir manter o período de trabalho, com hora de início e de fim de cada turno, e adotá-lo como jornada padrão da agenda. | RN-12, RN-26 |
| RF-09 | Manutenção dos parâmetros de operação | O sistema deve permitir alterar o valor dos parâmetros de operação, os limites de atenção e de atraso do lote e o limite de mortalidade, sem permitir criar nem excluir parâmetro. | RN-11, RN-26 |
| RF-10 | Cadastro e busca de espécie | O sistema deve permitir cadastrar espécie com nome científico, nomes populares, características e fotografia, e localizá-la por qualquer um desses nomes. | RN-01, RN-02, RN-03 |
| RF-11 | Cadastro de recipiente | O sistema deve permitir cadastrar recipientes com nome e volume. | RN-04 |
| RF-12 | Cadastro de insumo | O sistema deve permitir cadastrar insumos com unidade de medida e categoria. | RN-07 |
| RF-13 | Cadastro de área e canteiro | O sistema deve permitir cadastrar áreas do viveiro identificadas por letra e canteiros numerados dentro de cada área, recusando número repetido na mesma área. | RN-17 |
| RF-14 | Identidade única de pessoa com múltiplos papéis | O sistema deve manter uma identidade única por pessoa, à qual se atribuem os papéis de cliente, fornecedor e funcionário, sem duplicar o cadastro quando a mesma pessoa exercer mais de um. | RN-45 |
| RF-15 | Cadastro rápido de cliente | O sistema deve permitir cadastro rápido de cliente com nome e telefone, sem sair da tela de pedido. | RN-44 |
| RF-16 | Cadastro completo de cliente | O sistema deve permitir cadastro completo de cliente com dados fiscais de pessoa física ou jurídica. | RN-43, RN-49 |
| RF-17 | Validação de CPF e CNPJ | O sistema deve validar CPF e CNPJ informados. | RN-43 |
| RF-18 | Busca de pessoa | O sistema deve permitir localizar pessoa por nome, telefone ou documento. | RN-45 |
| RF-19 | Cadastro de fornecedor | O sistema deve permitir cadastrar fornecedor com contato e localização. | RN-45 |
| RF-20 | Cadastro de funcionário | O sistema deve permitir cadastrar funcionário com contato e vínculo (fixo ou diarista), inclusive quando ele não tem acesso ao sistema. | RN-45 |
| RF-21 | Catálogo de tipos de tarefa e formulário que ele comanda | O sistema deve permitir manter o catálogo de tipos de tarefa, com nome, categoria, a declaração de se a tarefa é quantitativa por unidade e em que unidade se conta, e de se exige lote específico, espécie, recipiente e área, e deve pedir, no planejamento e na confirmação, exatamente os dados que o tipo declarar exigir, e nenhum outro. | RN-15, RN-23, RN-24 |
| RF-22 | Protocolo de atividades por recipiente | O sistema deve permitir manter, por recipiente, um protocolo de atividades como sequência ordenada de etapas, cada etapa referenciando um tipo de tarefa do catálogo e declarando se o agendamento é sequencial ou recorrente, com o tempo em dias. | RN-05, RN-30, RN-34, RN-37 |
| RF-23 | Evento de referência da etapa | O sistema deve permitir que cada etapa do protocolo declare o seu evento de referência: a criação do lote ou a conclusão de uma etapa específica do mesmo protocolo. | RN-31 |
| RF-24 | Alerta e janela de aviso por etapa | O sistema deve permitir ligar e desligar o alerta de atraso por etapa do protocolo, e sobrescrever nela a janela de aviso padrão. | RN-35 |
| RF-25 | Tempo de etapa customizado por espécie | O sistema deve permitir, no cadastro da espécie, sobrescrever o tempo em dias de uma etapa específica do protocolo. | RN-36 |
| RF-26 | Montagem da agenda da semana | O sistema deve permitir montar a agenda da semana atribuindo, por funcionário e por dia, o tipo de tarefa e o turno, manhã ou tarde, admitindo a mesma tarefa para mais de um funcionário e mais de uma tarefa no mesmo turno com grupos diferentes, e deve permitir declarar a hora de início e de fim da tarefa que tiver hora marcada, sem exigi-la das demais; na apresentação em tela larga (RNF-14) a montagem deve ser direta, arrastando a tarefa planejada para remarcá-la e puxando a borda dela para declarar a duração, e lançando tarefa nova no ponto da grade em que se clicar. | RN-12, RN-25 |
| RF-27 | Cópia da semana e tarefa recorrente | O sistema deve permitir copiar a agenda da semana anterior e marcar tarefas como recorrentes, que passam a nascer preenchidas na cópia. | RN-29 |
| RF-28 | Situação da semana | O sistema deve controlar a situação da semana (rascunho, publicada e fechada) e impedir alteração depois do fechamento. | RN-13 |
| RF-29 | Confirmação da tarefa realizada | O sistema deve permitir confirmar a atribuição como realizada, apresentando os campos que o tipo de tarefa exigir, o lote uma vez para a tarefa e a quantidade uma vez por participante, exigindo o lote quando o tipo declarar lote específico e pedindo a quantidade apenas quando o tipo for quantitativo por unidade. | RN-23, RN-24, RN-27 |
| RF-30 | Área ou canteiro da tarefa sem lote | O sistema deve permitir registrar a área ou o canteiro da tarefa cujo tipo declarar área, e dispensá-los quando o lote os determinar. | RN-24 |
| RF-31 | Tarefa não confirmada assumida no fechamento | O sistema deve assumir como realizada, ao fechar a semana, a tarefa planejada que não foi confirmada, registrando essa condição. | RN-14 |
| RF-32 | Criação de lote | O sistema deve permitir criar lote informando espécie, recipiente, quantidade, área e canteiro. | RN-01, RN-04, RN-18, RN-19 |
| RF-33 | Ocupação do viveiro e encerramento do lote | O sistema deve apresentar a ocupação do viveiro por área e canteiro, indicando os lotes de cada canteiro ocupado e quais estão livres, e deve encerrar o lote quando o saldo chegar a zero, liberando o canteiro e preservando o histórico. | RN-19, RN-22, RN-28 |
| RF-34 | Repicagem com lote de origem | O sistema deve permitir registrar repicagem transferindo parte ou todo o lote para recipiente maior, criando um lote novo que aponta para o de origem. | RN-20 |
| RF-35 | Histórico de movimentos do lote | O sistema deve apresentar o histórico de movimentos do lote, com a quantidade e o motivo de cada um. | RN-08 |
| RF-36 | Recusa de saldo negativo | O sistema não deve permitir movimento que deixe o saldo do lote negativo. | RN-21 |
| RF-37 | Registro de perda, contagem e venda sobre o lote | O sistema deve permitir registrar perda, contagem física e saída de venda sobre o lote, dispensando informar espécie e recipiente, que o lote determina. | RN-24 |
| RF-38 | Perda com causa em lista fechada | O sistema deve permitir registrar a perda com quantidade e causa selecionada em lista fechada. | RN-10 |
| RF-39 | Contagem física do lote | O sistema deve permitir registrar contagem física do lote, gerando o movimento de ajuste que reconcilia o saldo. | RN-09 |
| RF-40 | Divisão de lote | O sistema deve permitir dividir um lote em dois, com cada resultante seguindo o protocolo de forma independente e herdando do original a fase e a data da última execução de cada etapa. | RN-39 |
| RF-41 | Listagem de perdas com filtro | O sistema deve listar as perdas registradas com filtro por período, espécie e causa. | RN-10 |
| RF-42 | Taxa de mortalidade e destaque no mapa | O sistema deve calcular a taxa de mortalidade do lote, como a razão entre as perdas dele e a sua quantidade inicial, apresentá-la no mapa e destacar ali o lote cuja taxa ultrapasse o limite definido em Configurações. | RN-11 |
| RF-43 | Quantidade de muda pronta disponível | O sistema deve apresentar a quantidade de muda pronta disponível por espécie e recipiente, somada dos lotes abertos. | RN-04, RN-06, RN-08, RN-16 |
| RF-44 | Mapa do viveiro com áreas, canteiros e lotes | O sistema deve apresentar o mapa do viveiro com as áreas, os canteiros de cada área e os lotes abertos de cada canteiro, cada lote com a sua situação. | RN-28 |
| RF-45 | Situação do lote e tarefa pendente que a determina | O sistema deve classificar o lote em saudável, atenção e crítico a partir das etapas do protocolo vencidas ou a vencer nele, sem que a situação seja digitada, e apresentar, ao apontar o lote, a tarefa pendente que determina essa situação e o atraso em dias. | RN-40 |
| RF-46 | Atribuição do protocolo ao lote na criação | O sistema deve atribuir ao lote, na criação, o protocolo vigente do recipiente dele, e acompanhar o lote etapa a etapa. | RN-30 |
| RF-47 | Geração das ordens do protocolo na agenda | O sistema deve apresentar, ao lado da agenda da semana, as etapas de protocolo vencidas ou a vencer como sugestão de tarefa, sem lançar nada na agenda, e, quando a sugestão for aceita, abrir o lançamento de tarefa já com a etapa, o lote e o tipo preenchidos, exigindo os demais dados que o tipo declarar. | RN-41 |
| RF-48 | Avanço de fase por etapa sequencial | O sistema deve avançar a fase do lote ao concluir uma etapa sequencial que declare fase resultante, e não deve avançá-la ao concluir etapa recorrente. | RN-34 |
| RF-49 | Contagem a partir da execução real | O sistema deve contar a ocorrência seguinte de etapa recorrente a partir da data real da execução anterior, e nunca de uma data de calendário prevista. | RN-32 |
| RF-50 | Uma ocorrência em aberto por etapa | O sistema deve manter no máximo uma ordem em aberto por etapa e por lote, sem gerar ocorrência nova enquanto a anterior estiver pendente. | RN-33 |
| RF-51 | Ficha do lote com etapas e vencimentos | O sistema deve apresentar, no lote, as etapas do protocolo com a data da última execução, o próximo vencimento e a situação de cada uma. | RN-40 |
| RF-52 | Etapa em atenção e em atraso | O sistema deve apresentar a etapa em atenção dentro da janela de aviso e em atraso depois do vencimento, e sem indicação de situação quando o alerta da etapa estiver desligado. | RN-35 |
| RF-53 | Encerramento do protocolo do lote | O sistema deve encerrar o protocolo do lote quando ele se encerra por saldo zero, por expedição total ou por divisão, deixando de sugerir etapas dele e cancelando as tarefas ainda não confirmadas sem removê-las. | RN-38 |
| RF-54 | Registro de pedido com cliente, canal e itens | O sistema deve permitir registrar pedido com cliente, canal de venda e itens compostos por espécie, recipiente e quantidade, montando os itens um a um ou a partir da lista de texto que o cliente enviou, sempre com revisão de quem registra. | RN-01, RN-04, RN-42, RN-46 |
| RF-55 | Preço unitário informado no item | O sistema deve registrar o preço unitário informado em cada item do pedido depois da conferência de disponibilidade, e apresentar o total do item e o do pedido. | RN-50 |
| RF-56 | Saldo disponível ao lado do item | O sistema deve apresentar, ao lado de cada item do pedido, a quantidade de muda pronta que a produção tem daquela espécie e recipiente. | RN-06, RN-08 |
| RF-57 | Situação do pedido | O sistema deve controlar a situação do pedido ao longo das oito situações que vão do cadastro ao pronto para envio, impedindo alteração de item depois da aprovação. | RN-48, RN-53 |
| RF-58 | Listagem de pedidos com filtro | O sistema deve listar os pedidos com filtro por cliente, canal e período. | RN-42 |
| RF-59 | Disponibilidade conferida item a item | O sistema deve registrar, para cada item do pedido, a disponibilidade conferida no viveiro, que pode ser total, parcial com a quantidade encontrada e o recipiente em que ela está, ou nenhuma. | RN-54 |
| RF-60 | Composição do item pedido sem espécie | O sistema deve permitir compor em espécies o item que o cliente pediu sem escolher espécie, respeitando as espécies que ele aceita. | RN-55 |
| RF-61 | Cargas do pedido e separação dos itens | O sistema deve permitir organizar o pedido aprovado em cargas e registrar a separação de cada item em cada carga. | RN-56, RN-57 |
| RF-62 | Dia de carregar e calendário de entregas | O sistema deve apresentar o dia de carregamento de cada pedido e o calendário de entregas e carregamentos do mês. | RN-58 |

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
| RNF-14 | As telas de coordenação da produção, agenda da semana e mapa de lotes, devem ser concebidas para tela larga, e apresentar no celular uma versão reduzida em lista, sem rolagem horizontal; a manipulação direta da agenda (RF-26) pertence à versão de tela larga, e a versão em lista continua operando pelo formulário. | RE-2 |
| RNF-15 | Cada funcionalidade deve ser desenvolvida em ramificação própria e integrada por solicitação de incorporação. | ORG |
| RNF-16 | Mensagens de alteração devem seguir padrão fixo. | ORG |
| RNF-17 | Alterações na estrutura do banco devem ser versionadas em arquivos aplicados de forma controlada, preservando compatibilidade retroativa. | ORG |
| RNF-18 | Toda alteração de código deve incluir testes automatizados cobrindo utilitários, regras de negócio e validações. | ORG |
| RNF-19 | Credenciais, chaves e dados sensíveis não devem ser versionados. | ORG |
| RNF-20 | O tratamento de dados pessoais deve observar a Lei nº 13.709/2018, com finalidade, base legal e prazo de retenção declarados para cada dado coletado. | LEG |
| RNF-21 | Os dados cadastrais de cliente devem comportar o conjunto exigido para emissão de nota fiscal no sistema externo em uso. | LEG |
| RNF-22 | O nome científico da espécie deve estar disponível para atender exigências de projetos de compensação ambiental. | LEG, DOM |
| RNF-23 | O sistema deve operar em navegador de celular de uso corrente pela equipe, sem exigir instalação a partir de loja de aplicativos. | RE-2, RE-5 |

Fonte: Elaborado pelo autor (2026).

## Quadro 9 – Restrições do projeto e os requisitos não funcionais que originam

| Código | Descrição | Origem | Requisitos originados |
|---|---|---|---|
| RE-1 | Usuários sem formação técnica. | Perfil da equipe | RNF-01, RNF-02, RNF-07 |
| RE-2 | Celular como dispositivo principal. | Contexto de campo | RNF-06, RNF-14, RNF-23 |
| RE-3 | Conexão instável no viveiro. | Ambiente físico | RNF-05 |
| RE-4 | Uso com as mãos sujas, sob sol e chuva. | Ambiente físico | RNF-03, RNF-04 |
| RE-5 | Orçamento de microempresa. | Porte da organização | RNF-13, RNF-23 |
| RE-6 | Prazo até novembro de 2026. | Calendário acadêmico | – |
| RE-7 | Dados pessoais de clientes e de funcionários sujeitos à legislação de proteção de dados. | Legal | – |

Fonte: Elaborado pelo autor (2026).

## Quadro 10 – Síntese da origem dos requisitos do sistema

| Origem | RF: Qtd. | RF: % | RNF: Qtd. | RNF: % |
|---|---:|---:|---:|---:|
| Observação participante (OP) | 25 | 36,2 | 0 | 0,0 |
| Entrevista (EN) | 14 | 20,3 | 0 | 0,0 |
| Análise documental (AD) | 2 | 2,9 | 0 | 0,0 |
| Estudo do domínio (DOM) | 6 | 8,7 | 1 | 7,1 |
| Exigência legal (LEG) | 2 | 2,9 | 3 | 21,4 |
| Política do projeto (ORG) | 20 | 29,0 | 10 | 71,4 |
| **Total de menções** | **69** | | **14** | |

Fonte: Elaborado pelo autor (2026).

> **A soma das menções excede o número de requisitos**, e é esperado: um requisito pode ter mais
> de uma origem, e a coluna do `B2` é multivalorada. O percentual é sobre o total de menções, não
> sobre o de requisitos.
