# B2: Especificação de Requisitos

> **Artefato:** Especificação de Requisitos de Software (ERS) · **Bloco:** B, Engenharia de requisitos
> **Destino no TCC:** Capítulo 4, seção 4.2, Requisitos do sistema
> **Fundamentação:** Sommerville (2011) define requisitos funcionais como as funcionalidades do
> sistema e o comportamento esperado diante de determinadas entradas, e requisitos não funcionais
> como as diretrizes que regulam o sistema como um todo, classificando-os em **requisitos de
> produto**, **organizacionais** e **externos**, classificação adotada integralmente neste
> documento. A priorização por negociação entre *stakeholders* segue Pressman e Maxim (2016).

---

## 1. Como ler este documento

Todo requisito tem identificador estável, atribuído em sequência contínua na ordem em que as seções
aparecem. A matriz de rastreabilidade ([`B5`](B5-matriz-rastreabilidade.md)) depende dessa
estabilidade: alterar um identificador obriga a percorrer a matriz inteira.

Os termos empregados são os do [glossário](../A-fundacao/A2-glossario-dominio.md). Onde o texto diz
"espécie", "recipiente", "canal de venda" ou "perfil", entende-se a definição de lá.

### Legenda: origem

| Código | Origem do requisito |
|---|---|
| **OP** | Observação participante das rotinas de produção e venda |
| **EN** | Entrevista com chefia e gerência |
| **AD** | Análise documental: notas de compra, planilhas de notas fiscais |
| **DOM** | Estudo do domínio de produção de mudas nativas |
| **LEG** | Exigência legal, fiscal ou regulatória |
| **ORG** | Política ou convenção adotada pelo projeto |

### Legenda: prioridade (MoSCoW)

| Código | Significado |
|---|---|
| **D** | *Deve ter*: sem ele o sistema não cumpre seu propósito |
| **DV** | *Deveria ter*: importante, mas o sistema opera sem ele |
| **P** | *Poderia ter*: agrega valor se houver folga |
| **N** | *Não agora*: reconhecido e deliberadamente adiado |

---

## 2. Requisitos funcionais

Os requisitos estão agrupados pelas **três áreas de negócio** do sistema, Cadastro único, Produção e
Comercial, com Acesso e Configurações à frente por atravessarem as três. É o mesmo agrupamento
adotado em [`C1`](../C-modelagem/C1-diagrama-casos-de-uso.md),
[`C6`](../C-modelagem/C6-modelo-entidade-relacionamento.md),
[`D1`](../D-arquitetura/D1-arquitetura-c4.md) e [`D4`](../D-arquitetura/D4-matriz-rbac.md), e
descrito em [`docs/rotinas/00-mapa-de-rotinas.md`](../../rotinas/00-mapa-de-rotinas.md).

**Três perfis operam o sistema: chefia, gerência e administrador.** Os colaboradores de campo não
têm acesso: o trabalho deles é planejado e confirmado pela gerência, e é essa decisão que explica
por que nenhum requisito abaixo tem "Colaborador" como ator.

### 2.1 Acesso: transversal às três áreas

| ID | Requisito | Ator | Prior. | Origem | Verificação |
|---|---|---|---|---|---|
| **RF-01** | O sistema deve autenticar o usuário por identificador e senha antes de conceder qualquer acesso | Todos | D | ORG | Acesso a qualquer tela sem sessão redireciona para autenticação |
| **RF-02** | O sistema deve exigir troca de senha no primeiro acesso do usuário | Todos | D | ORG | Usuário recém-criado é conduzido à troca antes de qualquer outra tela |
| **RF-03** | O sistema deve permitir ao usuário encerrar sua sessão | Todos | D | ORG | Após encerrar, o acesso anterior deixa de ser válido |
| **RF-04** | O sistema deve registrar cada tentativa de autenticação com data, origem e dispositivo | - | DV | ORG | Consulta ao registro exibe as tentativas, bem e malsucedidas |
| **RF-05** | O sistema deve permitir ao administrador criar usuários e atribuir perfil | Administrador | D | ORG | Usuário criado acessa apenas o que seu perfil permite |
| **RF-06** | O sistema deve verificar a permissão do perfil a cada operação, e não apenas ocultar elementos da interface | - | D | ORG | Operação solicitada por perfil sem permissão é recusada mesmo quando acionada diretamente |
| **RF-07** | O sistema deveria permitir ao usuário visualizar e encerrar suas sessões ativas | Todos | DV | ORG | Sessão encerrada à distância deixa de ter acesso |

### 2.2 Configurações do sistema: transversal às três áreas

**O que é valor solto mora aqui; o que é lista de coisas com atributos é cadastro.** É a mesma
regra de fronteira que manteve o período de trabalho como entidade própria (`work_shifts`), com
hora de início e de fim por turno, e não como quatro chaves soltas: o que muda de lugar é a
**tela**, que sai dos Cadastros e vem para cá, porque quem a procura está procurando um ajuste do
sistema, e não um catálogo.

| ID | Requisito | Ator | Prior. | Origem | Verificação |
|---|---|---|---|---|---|
| **RF-08** | O sistema deve permitir manter o período de trabalho, com hora de início e de fim de cada turno, e adotá-lo como jornada padrão da agenda | Chefia | D | EN | Alterar o horário do turno altera a jornada exibida na agenda |
| **RF-09** | O sistema deve permitir alterar o valor dos parâmetros de operação, os limites de atenção e de atraso do lote e o limite de mortalidade, sem permitir criar nem excluir parâmetro | Chefia | D | ORG | O valor alterado passa a valer na tela seguinte; não há ação de criar nem de excluir parâmetro |

**Ninguém cria e ninguém exclui parâmetro** (RF-09). A chave nasce com a estrutura do banco, porque
existe código que a lê pelo nome: apagá-la não deixaria a tela vazia, deixaria a leitura sem
resposta. O que a operação faz é alterar o valor.

### 2.3 Área 1 · Cadastro único

O que é estável e se repete, e alimenta as outras duas áreas sem consumir nada.
**Regra de corte:** é cadastro se, ao apagá-lo, um movimento passado ficar sem sentido.

#### 2.3.1 Catálogo de produção: espécie, recipiente, insumo, área e canteiro

| ID | Requisito | Ator | Prior. | Origem | Verificação |
|---|---|---|---|---|---|
| **RF-10** | O sistema deve permitir cadastrar espécie com nome científico, nomes populares, características e fotografia | Chefia | D | EN, DOM | Espécie cadastrada aparece nas demais telas do sistema |
| **RF-11** | O sistema deve localizar a espécie por qualquer um de seus nomes populares ou pelo nome científico | Todos | D | OP | Busca por nome regional retorna a espécie correspondente |
| **RF-12** | O sistema deve permitir cadastrar recipientes com nome e volume | Chefia | D | EN | Recipiente cadastrado fica disponível na criação de lote e no item de pedido |
| **RF-13** | O sistema deve permitir cadastrar insumos com unidade de medida e categoria | Chefia | D | AD | Insumo cadastrado fica disponível para associação às tarefas do viveiro |
| **RF-14** | O sistema deve permitir cadastrar áreas do viveiro identificadas por letra | Gerência | D | OP | Área cadastrada fica disponível na escolha de canteiro |
| **RF-15** | O sistema deve permitir cadastrar canteiros numerados dentro de cada área, recusando número repetido na mesma área | Gerência | D | OP | Canteiro repetido na mesma área é recusado; a numeração recomeça em cada área |

#### 2.3.2 Pessoas: cliente, fornecedor, funcionário

Cliente, fornecedor e funcionário são **papéis de uma mesma identidade**: quem vende muda e às
vezes compra é um cadastro só. É o que o nome da área declara, e é a razão de o cadastro ser único
e o papel é que se multiplicar.

**Funcionário é vínculo, não acesso.** RF-22 cadastra quem trabalha no viveiro, tenha ou não
usuário: dos nove, três têm login. O diarista que aparece duas semanas por ano precisa existir na
agenda sem nunca abrir o sistema. Quem tem login é assunto de RF-05, no Acesso.

| ID | Requisito | Ator | Prior. | Origem | Verificação |
|---|---|---|---|---|---|
| **RF-16** | O sistema deve manter uma identidade única por pessoa, à qual se atribuem os papéis de cliente, fornecedor e funcionário, sem duplicar o cadastro quando a mesma pessoa exercer mais de um | - | D | ORG | Pessoa já cadastrada como fornecedor recebe o papel de cliente sem gerar segundo cadastro |
| **RF-17** | O sistema deve permitir cadastro rápido de cliente com nome e telefone, sem sair da tela de pedido | Chefia | D | OP | Pedido conclui-se com cliente novo sem interromper o fluxo |
| **RF-18** | O sistema deve permitir cadastro completo de cliente com dados fiscais de pessoa física ou jurídica | Chefia | D | LEG, AD | Cadastro completo comporta os dados exigidos pelo emissor de nota externo |
| **RF-19** | O sistema deve validar CPF e CNPJ informados | - | D | LEG | Documento inválido é recusado no momento da digitação |
| **RF-20** | O sistema deve permitir localizar pessoa por nome, telefone ou documento | Chefia | D | OP | Busca retorna a pessoa por qualquer dos três, indicando os papéis que ela exerce |
| **RF-21** | O sistema deve permitir cadastrar fornecedor com contato e localização | Chefia | DV | EN | Fornecedor cadastrado aparece na lista de pessoas com o papel correspondente |
| **RF-22** | O sistema deve permitir cadastrar funcionário com contato e vínculo (fixo ou diarista), inclusive quando ele não tem acesso ao sistema | Chefia | D | EN | Funcionário sem usuário aparece na agenda de pessoal e no cadastro |

#### 2.3.3 Trabalho: tipo de tarefa e protocolo de atividades

**O catálogo de tarefas comanda o formulário.** É o tipo de tarefa que diz se a tela vai pedir
espécie, recipiente, lote ou uma contagem por participante. Sem isso, ou o formulário pede tudo
sempre (e ninguém preenche), ou pede o mínimo sempre (e o dado não serve).

**O cadastro tem um nome e três declarações, e cada uma tem efeito visível.** "É quantitativa por
unidade" faz a confirmação pedir quanto cada funcionário do grupo fez; "lote específico" faz
aparecer o campo de lote; espécie e recipiente valem para as tarefas que os pedem sem haver lote,
como colher semente e encher saquinho. A **categoria** não comanda formulário algum: agrupa a
lista e os relatórios (RN-23).

| ID | Requisito | Ator | Prior. | Origem | Verificação |
|---|---|---|---|---|---|
| **RF-23** | O sistema deve permitir manter o catálogo de tipos de tarefa, com nome, categoria e a declaração de se a tarefa é quantitativa por unidade e de se exige lote específico, espécie e recipiente | Gerência | D | OP | Tipo cadastrado e ativo fica disponível na agenda e leva consigo as declarações feitas |
| **RF-24** | O sistema deve pedir, no planejamento e na confirmação, exatamente os dados que o tipo de tarefa declarar exigir, e nenhum outro | - | D | ORG | Tarefa sem lote específico não apresenta o campo de lote |
| **RF-25** | O sistema deve permitir manter, por recipiente, um protocolo de atividades como sequência ordenada de etapas | Gerência | D | EN | Protocolo montado para tubete passa a reger os lotes criados em tubete, e não os em saco |
| **RF-26** | O sistema deve permitir que cada etapa do protocolo referencie um tipo de tarefa do catálogo e declare se o agendamento é sequencial ou recorrente, com o tempo em dias | Gerência | D | EN | Etapa sequencial admite um único tempo; etapa recorrente admite também o intervalo entre ocorrências |
| **RF-27** | O sistema deve permitir que cada etapa do protocolo declare o seu evento de referência: a criação do lote ou a conclusão de uma etapa específica do mesmo protocolo | Gerência | D | DOM | Etapa ancorada em outra etapa exibe qual, e a lista oferecida não inclui a própria etapa |
| **RF-28** | O sistema deve permitir ligar e desligar o alerta de atraso por etapa do protocolo, e sobrescrever nela a janela de aviso padrão | Gerência | D | OP | Etapa com alerta desligado não recebe cor em nenhuma tela; etapa com janela própria a usa no lugar do padrão |
| **RF-29** | O sistema deveria permitir, no cadastro da espécie, sobrescrever o tempo em dias de uma etapa específica do protocolo | Gerência | DV | DOM | Espécie com tempo próprio para a classificação usa o dela; espécie sem valor usa o do protocolo do recipiente |

**A configuração do protocolo entra aqui, e a operação dele fica na §2.4.4.** Montar o protocolo é
cadastro, feito pela gerência sentada, uma vez por safra; segui-lo é produção, e acontece todo dia.

**O protocolo é do recipiente** (RF-25, RN-34). É o recipiente que determina o manejo: o que se faz
num tubete não é o que se faz num saco 20x26, e é do recipiente do lote que o sistema descobre qual
receita aplicar.

**O evento de referência é declarado, e não inferido da ordem das etapas** (RF-27, RN-35). Inferir
"a etapa anterior" faria a classificação pós-germinação contar da criação do lote, e a semente pode
ficar dias esperando plantio antes de germinar. É o erro que o requisito existe para impedir, e por
isso a âncora é um campo, e não uma consequência da posição na lista.

### 2.4 Área 2 · Produção

Onde o trabalho é planejado e onde a muda é acompanhada. É o módulo da gerência.
**As duas visões de entrada estão sob RNF-15**: quem opera a agenda e o mapa não registra,
compara, e comparar pede tela larga.

**A área abre em duas visões, e não numa lista de rotinas.** A pergunta que a gerência faz ao
entrar é sempre uma das duas: *quem está fazendo o quê esta semana* e *como está o viveiro*. A
primeira é a agenda da semana (§2.4.1), a segunda é o mapa de lotes (§2.4.3), e as duas convivem na
mesma tela alternadas por aba.

| ID | Requisito | Ator | Prior. | Origem | Verificação |
|---|---|---|---|---|---|
| **RF-30** | O sistema deve apresentar, na entrada da área Produção, as visões de agenda da semana e mapa de lotes alternadas por aba, com as demais rotinas listadas abaixo delas | Gerência | D | OP | A tela inicial da área apresenta as duas abas, e a agenda da semana é a que abre |

#### 2.4.1 Agenda semanal

**É o planejamento e a confirmação do trabalho, na mesma grade.** A gerência monta a semana por
funcionário, por dia e por turno, e é ali mesmo que marca o que foi feito. Não há apontamento por
relógio: o viveiro nunca planejou por hora marcada (RN-12), e medir a hora de entrada e saída de
cada pessoa seria controle de ponto, que está fora do escopo.

| ID | Requisito | Ator | Prior. | Origem | Verificação |
|---|---|---|---|---|---|
| **RF-31** | O sistema deve permitir montar a agenda da semana atribuindo, por funcionário e por dia, o tipo de tarefa e o turno, manhã ou tarde | Gerência | D | EN, OP | Semana montada exibe, por pessoa e por dia, as tarefas e os turnos atribuídos |
| **RF-32** | O sistema deve permitir copiar a agenda da semana anterior e marcar tarefas como recorrentes, que passam a nascer preenchidas na cópia | Gerência | D | OP | Semana copiada reproduz a anterior; tarefa recorrente aparece sem ser lançada de novo |
| **RF-33** | O sistema deve controlar a situação da semana (rascunho, publicada e fechada) e impedir alteração depois do fechamento | Gerência | D | ORG | Semana fechada recusa alteração de atribuição |
| **RF-34** | O sistema deve permitir atribuir a mesma tarefa a mais de um funcionário, e mais de uma tarefa ao mesmo turno com grupos diferentes | Gerência | D | OP | Duas tarefas com grupos distintos coexistem no mesmo turno |
| **RF-35** | O sistema deve permitir confirmar a atribuição como realizada, apresentando os campos que o tipo de tarefa exigir: o lote uma vez para a tarefa, e a quantidade uma vez por participante | Gerência | D | OP | Confirmar a tarefa fecha a atribuição de todos os participantes, cada um com a própria quantidade |
| **RF-36** | O sistema deve solicitar, na confirmação, a quantidade realizada por cada funcionário que participou da tarefa, quando o tipo de tarefa for quantitativo por unidade, e apenas nesse caso | - | D | OP | Tarefa não quantitativa confirma sem pedir número algum; tarefa quantitativa com três participantes apresenta três campos |
| **RF-37** | O sistema deve exigir o lote na confirmação da tarefa quando o tipo de tarefa declarar lote específico, dispensando o canteiro, que vem do próprio lote | - | D | OP | Confirmação de repicagem sem lote é recusada; o canteiro não é pedido |
| **RF-38** | O sistema deve permitir registrar a área ou o canteiro da tarefa que não exige lote, e dispensá-los quando o lote os determinar | Gerência | D | OP | Irrigação registra a área em que foi feita; repicagem não pede área nem canteiro |
| **RF-39** | O sistema deve assumir como realizada, ao fechar a semana, a tarefa planejada que não foi confirmada, registrando essa condição | - | DV | ORG | Tarefa não confirmada entra no realizado com a marca correspondente |

**RF-39 existe porque a alternativa é pior.** A semana que fecha com metade das células em branco
não diz que metade do trabalho não foi feito, diz que ninguém teve tempo de confirmar. Assumir o
planejado como realizado e **marcar a condição** preserva as duas leituras: o total sai certo e o
que foi presumido continua distinguível do que foi confirmado.

#### 2.4.2 Lotes, movimentos e perdas

**O lote é o endereço da muda dentro do viveiro.** Até 24/08/2026 o escopo o excluía, e a
justificativa da revisão está em [`A1` §7](../A-fundacao/A1-documento-de-visao.md). O rastreamento
vai até a leva, nunca até a muda.

**O canteiro comporta vários lotes.** Um canteiro recebe seis, oito, nove levas ao longo do tempo, e
é assim que ele é usado. O que vale é a outra metade da regra: **um lote não se espalha por dois
canteiros**, e por isso "o que tem neste canteiro" tem resposta direta.

**Todo movimento passa pela mesma porta.** Perda, repicagem, venda, ajuste de contagem e
transferência de canteiro são registrados como movimento do lote, e não em tabelas separadas. É o
que faz o saldo ser auditável: a soma dos movimentos tem de reproduzir o saldo exibido, e
divergência entre os dois é defeito detectável.

| ID | Requisito | Ator | Prior. | Origem | Verificação |
|---|---|---|---|---|---|
| **RF-40** | O sistema deve permitir criar lote informando espécie, recipiente, quantidade, área e canteiro | Gerência | D | OP | Lote criado passa a ocupar o canteiro escolhido |
| **RF-41** | O sistema deve apresentar a ocupação do viveiro por área e canteiro, indicando os lotes de cada canteiro ocupado e quais estão livres | Gerência | D | EN | Canteiro sem nenhum lote aberto aparece como livre |
| **RF-42** | O sistema deve permitir registrar repicagem transferindo parte ou todo o lote para recipiente maior, criando um lote novo que aponta para o de origem | Gerência | D | DOM | O lote criado exibe o lote de origem, e o saldo do de origem diminui na mesma quantidade |
| **RF-43** | O sistema deve apresentar o histórico de movimentos do lote, com a quantidade e o motivo de cada um | Gerência | D | EN | A soma dos movimentos reproduz o saldo exibido do lote |
| **RF-44** | O sistema não deve permitir movimento que deixe o saldo do lote negativo | - | D | ORG | Baixa maior que o saldo é recusada com o motivo informado |
| **RF-45** | O sistema deve encerrar o lote quando o saldo chegar a zero, liberando o canteiro e preservando o histórico | - | D | ORG | Lote zerado sai da ocupação e continua consultável |
| **RF-46** | O sistema deve permitir registrar perda, contagem física e saída de venda sobre o lote, dispensando informar espécie e recipiente, que o lote determina | Gerência | D | OP | Registro de perda feito sobre o lote não pede espécie nem recipiente |
| **RF-47** | O sistema deve permitir registrar a perda com quantidade e causa selecionada em lista fechada | Gerência | D | OP | Registro conclui-se em campo, sem campo de texto livre para a causa |
| **RF-48** | O sistema deve permitir registrar contagem física do lote, gerando o movimento de ajuste que reconcilia o saldo | Gerência | D | OP | Após a contagem, o saldo exibido é o contado, e o ajuste aparece no histórico |
| **RF-49** | O sistema deve permitir dividir um lote em dois, com cada resultante seguindo o protocolo de forma independente e herdando do original a fase e a data da última execução de cada etapa | Gerência | D | OP | Os dois lotes resultantes exibem as mesmas datas de referência do original, e podem divergir a partir da divisão |
| **RF-50** | O sistema deve listar as perdas registradas com filtro por período, espécie e causa | Gerência | D | EN | Filtro por período retorna apenas os registros do intervalo |
| **RF-51** | O sistema deve calcular a taxa de mortalidade do lote, como a razão entre as perdas dele e a sua quantidade inicial | - | D | EN | A taxa corresponde à soma das perdas dividida pela quantidade inicial do lote |
| **RF-52** | O sistema deve emitir alerta para o lote cuja mortalidade ultrapasse o limite definido em Configurações | Gerência | D | EN | Lote acima do limite gera alerta visível no mapa |
| **RF-53** | O sistema deve apresentar a quantidade de muda pronta disponível por espécie e recipiente, somada dos lotes abertos | Chefia, Gerência | D | OP | A quantidade reflete a soma dos lotes prontos, descontadas perdas e vendas |

**RF-53 é a ponte para o Comercial.** Ele não é um estoque digitado: é a soma dos lotes que
chegaram à fase de muda pronta, e é o número que o item de pedido exibe (RF-68). Estoque como
entidade própria criaria duas verdades sobre o mesmo dado.

**O limite de mortalidade é parâmetro, não constante** (RF-52, RN-32). Os 20% de RN-11 são o valor
inicial, não o enunciado da regra: o limite muda com a espécie e com a estação, e convenção que
muda é dado.

#### 2.4.3 Mapa de lotes

**É a ocupação de §2.4.2 desenhada, e não uma lista.** RF-41 já apresentava área, canteiro e lote em
texto. O mapa mostra a mesma informação com a forma do viveiro: a área é o quadro, o canteiro é a
faixa dentro dela, o lote é o quadrado dentro do canteiro. Quem opera reconhece o lote **pelo
lugar** antes de ler o rótulo, do mesmo jeito que hoje aponta com o dedo, e é essa correspondência
que faz a tela ser lida em segundos por quem não é técnico (RNF-02).

**A cor mede uma coisa só: tarefa que não foi feita.** A mortalidade acima do limite (RF-52) tem
alerta próprio e continua tendo. Somar tudo numa cor produziria um vermelho que não diz o que
fazer, e a cor aqui tem de dizer: apontar o lote mostra a tarefa que falta.

| ID | Requisito | Ator | Prior. | Origem | Verificação |
|---|---|---|---|---|---|
| **RF-54** | O sistema deve apresentar o mapa do viveiro com as áreas, os canteiros de cada área e os lotes abertos de cada canteiro, cada lote com a sua situação | Gerência | D | EN | Canteiro com seis lotes abertos apresenta os seis, cada um com a sua situação |
| **RF-55** | O sistema deve classificar o lote em saudável, atenção e crítico a partir das etapas do protocolo vencidas ou a vencer nele, sem que a situação seja digitada | - | D | ORG | Lote com etapa do protocolo vencida aparece como crítico, mesmo que nenhuma tarefa tenha sido lançada na agenda; concluída a etapa, volta a saudável no mesmo dia |
| **RF-56** | O sistema deve apresentar, ao apontar o lote, a tarefa pendente que determina a situação dele e o atraso em dias | Gerência | D | OP | Apontar o lote crítico exibe o nome da tarefa pendente mais antiga e há quantos dias ela espera |
| **RF-57** | O sistema deve apresentar, no mapa, a mortalidade de cada lote e destacar os que ultrapassam o limite | Gerência | D | EN | Lote com mortalidade acima do limite aparece destacado, com o percentual visível |

**RF-55 é o requisito que não tem ator.** Ninguém classifica lote: a classificação é consequência
do que já foi registrado. Status digitado envelheceria sozinho, e o lote marcado como saudável
ontem continuaria saudável hoje, que é justamente o contrário do que a tela existe para mostrar
(RN-31).

**A situação deriva do protocolo, e não das tarefas lançadas.** Se derivasse do atraso das
atribuições **já lançadas** na agenda, o lote esquecido por completo apareceria como saudável,
porque não haveria tarefa atrasada nele: a tela que existe para mostrar o esquecimento mostraria o
contrário dele. Com o protocolo, o que se cobra é o que o lote **tem** de receber, lembre alguém de
lançar ou não.

#### 2.4.4 Protocolo de atividades por lote

**É o que a §2.4.1 não alcança.** A agenda registra o que a gerência lançou; o protocolo registra o
que o lote **tem** de receber, lembre alguém ou não.

**Não é a tarefa recorrente de RF-32, e as duas convivem.** Aquela é de calendário, e o sujeito é a
equipe ("irrigar toda manhã"). Esta é do lote, conta a partir da **execução real anterior** e avança
a fase do lote quando a etapa é sequencial ("limpar 90 dias depois da última limpeza deste lote").
Forçar uma na outra quebraria as duas.

**Os requisitos sem ator são a maior parte da seção**, e é o traço que a define: RF-58 a RF-62 e
RF-65 descrevem o que o sistema faz **sozinho**. Requisito de geração automática com ator seria
requisito de digitação, e a seção existe justamente porque a digitação é o que falha.

| ID | Requisito | Ator | Prior. | Origem | Verificação |
|---|---|---|---|---|---|
| **RF-58** | O sistema deve atribuir ao lote, na criação, o protocolo vigente do recipiente dele, e acompanhar o lote etapa a etapa | - | D | ORG | Lote criado em tubete passa a exibir as etapas do protocolo do tubete |
| **RF-59** | O sistema deve gerar as ordens de tarefa do protocolo na agenda sem digitação, e permitir alterar ou excluir a ordem de um dia sem alterar a etapa | - | D | ORG | Excluir a ordem de uma quarta não altera o protocolo nem as ordens dos demais lotes |
| **RF-60** | O sistema deve avançar a fase do lote ao concluir uma etapa sequencial que declare fase resultante, e não deve avançá-la ao concluir etapa recorrente | - | D | DOM | Concluir o plantio avança a fase; concluir uma irrigação não altera fase alguma |
| **RF-61** | O sistema deve contar a ocorrência seguinte de etapa recorrente a partir da data real da execução anterior, e nunca de uma data de calendário prevista | - | D | DOM | Limpeza trimestral vencida em abril e executada em 15 de setembro produz a próxima em 14 de dezembro |
| **RF-62** | O sistema deve manter no máximo uma ordem em aberto por etapa e por lote, sem gerar ocorrência nova enquanto a anterior estiver pendente | - | D | ORG | Etapa vencida há cinco meses apresenta uma pendência, e não cinco |
| **RF-63** | O sistema deve apresentar, no lote, as etapas do protocolo com a data da última execução, o próximo vencimento e a situação de cada uma | Gerência | D | EN | A ficha do lote responde se a classificação já foi feita e quando é a próxima limpeza |
| **RF-64** | O sistema deve apresentar a etapa em atenção dentro da janela de aviso e em atraso depois do vencimento, e sem indicação de situação quando o alerta da etapa estiver desligado | Gerência | D | OP | Etapa trimestral entra em atenção cerca de dezoito dias antes; a irrigação diária não recebe indicação nenhuma |
| **RF-65** | O sistema deve encerrar o protocolo do lote quando ele se encerra por saldo zero, por expedição total ou por divisão, cancelando as ordens ainda em aberto sem removê-las | - | D | ORG | Lote zerado para de gerar ordens, e as ordens futuras dele aparecem canceladas, não ausentes |

**O horizonte de geração é parâmetro, e não constante.** O sistema gera as ordens de um período à
frente e apresenta o que vence depois disso na ficha do lote, sem materializá-lo na agenda: gerar
um ano de limpezas trimestrais encheria a grade de tarefas que ninguém olha por nove meses. É a
mesma justificativa de RN-27 e RN-32, e o parâmetro mora com os outros (RF-09).

**A ordem entra na semana do vencimento, e a semana fechada é a exceção** (RN-47). Se a semana
ainda não existe, o sistema a abre em rascunho; se já está fechada, a ordem entra na semana aberta
corrente, porque semana fechada não se altera (RF-33). O que determina o atraso continua sendo o
**vencimento**, e não o dia em que a ordem coube na agenda: sem essa separação, empurrar a ordem
para a semana seguinte apagaria o atraso que ela existe para denunciar.

**A ordem nasce sem ninguém escalado** (RN-48). O protocolo responde o que fazer e quando; quem faz
segue sendo decisão de quem monta a agenda (RF-34, RN-26).

**O lote da ordem do protocolo vem da ordem, e não do formulário.** A ordem sempre carrega o lote,
inclusive quando o tipo de tarefa não declara lote específico: irrigar *aquele* lote é o que o
protocolo mandou. Não há conflito com RF-24, que rege o que a tela **pede** a quem preenche: campo
já respondido pela origem da tarefa não é campo a pedir.

### 2.5 Área 3 · Comercial

Tudo aqui é movimento: acontece uma vez e vira histórico.

**O preço é digitado, e o sistema não o calcula.** Quem registra o pedido informa o valor unitário
que foi negociado. O sistema existe para guardar o que foi vendido, por quanto e para quem, e não
para dizer por quanto deveria ter sido vendido.

| ID | Requisito | Ator | Prior. | Origem | Verificação |
|---|---|---|---|---|---|
| **RF-66** | O sistema deve permitir registrar pedido com cliente, canal de venda e itens compostos por espécie, recipiente e quantidade | Chefia | D | OP | Pedido registrado aparece na lista de pedidos |
| **RF-67** | O sistema deve registrar o preço unitário informado em cada item do pedido, e apresentar o total do item e o do pedido | Chefia | D | EN | O total do pedido reproduz a soma de quantidade por preço de cada item |
| **RF-68** | O sistema deve apresentar, ao lado de cada item do pedido, a quantidade de muda pronta que a produção tem daquela espécie e recipiente | Chefia | D | OP | Item cuja espécie tem duzentas mudas prontas exibe esse saldo, atualizado a cada consulta |
| **RF-69** | O sistema deve controlar a situação do pedido (rascunho, confirmado e cancelado), impedindo alteração de item depois da confirmação | Chefia | D | ORG | Pedido confirmado recusa inclusão e alteração de item |
| **RF-70** | O sistema deve listar os pedidos com filtro por cliente, canal e período | Chefia | D | OP | Filtro por período retorna apenas os pedidos do intervalo |

**RF-68 é a interconexão que o sistema existe para provar.** O saldo exibido não é digitado nem
mantido à parte: vem de RF-53, que o soma dos lotes prontos. É o ponto em que o que a Produção
registrou passa a ser o que o Comercial pode vender, e é a razão de as duas áreas não poderem ser
avaliadas em separado.

---

## 3. Requisitos não funcionais

Classificados nos três grupos de Sommerville (2011).

### 3.1 Requisitos de produto

Definem o comportamento esperado do sistema em termos de usabilidade, desempenho, disponibilidade e
proteção. Nesta aplicação, os requisitos de usabilidade **não são preferências de projeto**.
decorrem diretamente das restrições de campo registradas em
[`A1`](../A-fundacao/A1-documento-de-visao.md), e um sistema que os viole é inutilizável pela equipe
a que se destina.

| ID | Requisito | Origem | Verificação |
|---|---|---|---|
| **RNF-01** | Formulários de campo devem apresentar no máximo cinco campos por tela | RE-1 | Contagem de campos em cada formulário destinado ao registro em campo |
| **RNF-02** | Campos de categoria devem oferecer lista fechada de opções, nunca entrada livre de texto | RE-1 | Inspeção dos formulários; nenhuma categoria admite texto digitado |
| **RNF-03** | Elementos acionáveis devem ter alvo de toque compatível com uso de dedos sujos e molhados | RE-4 | Medição do alvo de toque contra o mínimo definido no projeto de interface |
| **RNF-04** | Toda ação de gravação deve produzir resposta visual imediata de confirmação | RE-4 | Registro em campo exibe confirmação sem exigir conferência posterior |
| **RNF-05** | O registro de dados em campo deve funcionar sem conexão, com envio automático ao restabelecer a rede | RE-3 | Registro feito em modo avião aparece no sistema após reconexão |
| **RNF-06** | A interface deve ser concebida para uso em celular, e não adaptada a partir de tela de computador, nas rotinas de registro em campo | RE-2 | Todas as rotinas de campo executáveis em tela de celular sem rolagem horizontal |
| **RNF-07** | O sistema deve permanecer utilizável sob conexão móvel lenta | RE-3 | Execução das rotinas de campo sob rede limitada |
| **RNF-08** | A interface deve empregar o vocabulário da empresa, conforme o glossário, e não termos técnicos do sistema | RE-1 | Revisão dos rótulos contra [`A2`](../A-fundacao/A2-glossario-dominio.md) |
| **RNF-09** | Senhas devem ser armazenadas de forma cifrada, por técnica que impeça sua recuperação | ORG | Inspeção do armazenamento; nenhuma senha legível |
| **RNF-10** | Identificadores de sessão devem ser armazenados apenas em formato protegido | ORG | Inspeção do armazenamento de sessões |
| **RNF-11** | Cookies de sessão devem receber as marcações de segurança que restringem seu uso a comunicação cifrada e impedem leitura por código do navegador | ORG | Inspeção dos atributos do cookie |
| **RNF-12** | As regras de acesso aos dados devem ser executadas no servidor, nunca no navegador | ORG | Nenhuma credencial ou regra de acesso presente no código entregue ao cliente |
| **RNF-13** | Toda comunicação entre cliente e servidor deve ser cifrada em trânsito | ORG | Acesso por canal não cifrado é recusado |
| **RNF-14** | O sistema deve dispor de rotina de backup e procedimento de recuperação com objetivos declarados | RE-5 | Ver [`E6`](../E-qualidade/E6-plano-backup-recuperacao.md) |
| **RNF-15** | As telas de coordenação da produção, agenda da semana e mapa de lotes, devem ser concebidas para tela larga, e apresentar no celular uma versão reduzida em lista, sem rolagem horizontal | RE-2 | As duas telas são operáveis em tela de computador com a semana inteira visível, e no celular apresentam a mesma informação em lista |

> **Por que abrir a exceção, e por que só para essas duas.** A agenda da semana (RF-31) e o mapa de
> lotes (RF-54) não registram nada: elas **comparam**. Nove faixas ao longo de uma semana, ou trinta
> canteiros lado a lado, existem para que se enxergue o buraco e o atraso, e o que produz esse
> enxergar é ver tudo de uma vez. Espremer isso na largura de um celular não encolhe a tela, desfaz
> a comparação, e o resultado prático de obedecer RNF-06 aqui seria a coordenação continuar no
> papel. O registro em campo, que é o que RE-2 protege, segue inteiro no celular.

### 3.2 Requisitos organizacionais

Derivados das políticas e convenções adotadas pelo projeto.

| ID | Requisito | Origem | Verificação |
|---|---|---|---|
| **RNF-16** | Arquivos, identificadores e estruturas de dados devem ser nomeados em inglês; a documentação, em português | ORG | Revisão de nomenclatura |
| **RNF-17** | Cada funcionalidade deve ser desenvolvida em ramificação própria e integrada por solicitação de incorporação | ORG | Histórico do controle de versão |
| **RNF-18** | Alteração direta na versão principal deve ser impedida por controle automático | ORG | Tentativa de alteração direta é bloqueada |
| **RNF-19** | Mensagens de alteração devem seguir padrão fixo | ORG | Revisão do histórico |
| **RNF-20** | Alterações na estrutura do banco devem ser versionadas em arquivos aplicados de forma controlada, preservando compatibilidade retroativa | ORG | Cada alteração de esquema corresponde a um arquivo versionado |
| **RNF-21** | Toda alteração de código deve incluir testes automatizados cobrindo utilitários, regras de negócio e validações | ORG | Execução da suíte de testes |
| **RNF-22** | Verificação automática executada antes de cada alteração deve bloquear o envio em caso de arquivo sensível, falha de teste ou desvio de padronização | ORG | Tentativa de envio com falha é bloqueada |
| **RNF-23** | Credenciais, chaves e dados sensíveis não devem ser versionados | ORG | Varredura do histórico |

### 3.3 Requisitos externos

Impostos por fatores legais, regulatórios ou pelo ambiente em que o sistema opera.

| ID | Requisito | Origem | Verificação |
|---|---|---|---|
| **RNF-24** | O tratamento de dados pessoais deve observar a Lei nº 13.709/2018, com finalidade, base legal e prazo de retenção declarados para cada dado coletado | LEG | Ver [`E5`](../E-qualidade/E5-mapeamento-lgpd.md) |
| **RNF-25** | Os dados cadastrais de cliente devem comportar o conjunto exigido para emissão de nota fiscal no sistema externo em uso | LEG | Conferência contra os campos exigidos pelo emissor |
| **RNF-26** | O nome científico da espécie deve estar disponível para atender exigências de projetos de compensação ambiental | LEG, DOM | Documentos gerados exibem o nome científico |
| **RNF-27** | O sistema deve operar em navegador de celular de uso corrente pela equipe, sem exigir instalação a partir de loja de aplicativos | RE-2, RE-5 | Execução no ambiente-alvo |

---

## 4. Distribuição por prioridade

| Prioridade | Funcionais | Não funcionais | Total |
|---:|---:|---:|---:|
| **D**: Deve ter | 65 | 27 | 92 |
| **DV**: Deveria ter | 5 | - | 5 |
| **P**: Poderia ter | - | - | - |
| **N**: Não agora | - | - | - |
| **Total** | **70** | **27** | **97** |

Nenhum requisito não funcional foi classificado abaixo de *deve ter*: todos decorrem de restrição do
ambiente, de política do projeto ou de exigência legal, nenhum é preferência negociável.

Os itens classificados como *não agora* estão registrados como **fora de escopo** em
[`A1`, seção 7](../A-fundacao/A1-documento-de-visao.md), e não como requisitos adiados, para que a
delimitação fique explícita em vez de implícita numa tabela de prioridades.

---

## 5. Conflitos entre requisitos e sua resolução

Sommerville (2011) observa que *stakeholders* distintos produzem requisitos conflitantes, resolvidos
por negociação. Três conflitos se manifestaram e foram resolvidos como segue.

| Conflito | Partes | Resolução |
|---|---|---|
| **Proteção × produtividade**: exigir autenticação e troca de senha (RF-01, RF-02) contraria o uso rápido em campo | Chefia × gerência | Sessão de duração longa no dispositivo de quem registra. A autenticação ocorre raramente; o registro de perda ou de confirmação de tarefa não a exige a cada uso. Sommerville trata essa tensão explicitamente: proteção adicional custa produtividade, e o equilíbrio é decisão de projeto. |
| **Riqueza do dado × velocidade do registro**: registrar mais atributos por perda melhora a análise (RF-47, RF-50) e contraria o limite de cinco campos (RNF-01) | Gerência × quem registra em campo | Prevalece o limite. Dado que não é registrado por ser trabalhoso demais não existe: o registro incompleto e feito supera o completo e omitido. |
| **Concepção móvel × leitura de comparação**: a agenda da semana (RF-31) e o mapa (RF-54) precisam mostrar nove faixas ou trinta canteiros de uma vez, e RNF-06 exige conceber para celular | Gerência × quem registra em campo | Separam-se os dois usos em vez de escolher um. RNF-06 passa a valer para as rotinas de campo, que é o que RE-2 protege, e as duas telas de coordenação vão para RNF-15, concebidas para tela larga com redução em lista no celular. |

> **O terceiro conflito já foi resolvido de outro modo, e a solução anterior caiu com o escopo.**
> Ele era, antes, "precisão do custo × esforço de apuração", e a resolução envolvia apontamento de
> horas, valor-hora médio da equipe e jornada assumida por turno. Com o custeio fora do escopo, a
> tensão que restou é a de leitura contra dispositivo, e o apontamento por relógio deixou de
> existir: a agenda registra que a tarefa planejada foi feita, e a quantidade, sem medir a hora de
> entrada e saída de ninguém.

---

## 6. Rastreabilidade

Cada requisito funcional é vinculado a caso de uso, entidade, regra de acesso e caso de teste na
matriz [`B5`](B5-matriz-rastreabilidade.md). Requisito sem vínculo é indício de especificação sem
implementação prevista: ou de implementação sem requisito que a justifique.
