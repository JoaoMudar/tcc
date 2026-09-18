# Apêndice C, Casos de teste de aceite

> Gerado a partir de `E-qualidade/E2-casos-de-teste-de-aceite.md`.
> **Não edite este arquivo**: edite o artefato de origem e rode `node scripts/build-word.mjs`.

## 1. Níveis de teste e critério de aprovação

Como o plano de testes completo não integra o conjunto de artefatos produzidos, esta seção fixa o
mínimo necessário para que os casos abaixo se sustentem.

| Nível | O que verifica | Quem executa | Automatizado |
|---|---|---|---|
| **Unitário** | Funções utilitárias, regras de negócio e validações isoladas, cálculo de preço, validação de documento, política de senha | Desenvolvimento | Sim |
| **Integração** | Operações de servidor contra o banco, incluindo restrições de integridade e permissão | Desenvolvimento | Sim, com dependências simuladas |
| **Aceite** | Se o sistema resolve o problema do usuário, com dados reais da empresa | **Usuário, com observação** | Não |

**Critério de entrada** no teste de aceite: os testes automatizados passam e a funcionalidade está
publicada no ambiente de produção com dados reais.

**Critério de aprovação** de um subsistema: todos os seus casos de aceite de prioridade *deve ter*
resultam em **Aprovado**. Caso reprovado impede a aprovação do subsistema: não existe aprovação
parcial, pela razão registrada em [`E3`, R-10](E3-analise-de-riscos.md): módulo iniciado e não
validado conta como não entregue.

**Ambiente:** celular Android com navegador de uso corrente, nas condições reais de campo, inclusive
sob conexão instável, que não é exceção a evitar mas condição a testar.

---

## 2. Como ler os casos

| Campo | Significado |
|---|---|
| **ID** | Identificador estável do caso |
| **Requisito** | Requisito de [`B2`](../B-requisitos/B2-especificacao-requisitos.md) que o caso verifica |
| **Pré-condição** | Estado necessário antes de iniciar |
| **Passos** | Ações do usuário, na ordem |
| **Resultado esperado** | O que deve ocorrer para o caso ser aprovado |
| **Situação** | Aprovado · Reprovado · Não executado |

Todos partem de **sessão autenticada** com perfil autorizado, salvo quando o próprio caso testa a
autenticação.

---

## 3. Acesso e segurança

| ID | Requisito | Pré-condição | Passos | Resultado esperado | Situação |
|---|---|---|---|---|---|
| **TA-01** | RF-01 | Sem sessão ativa | 1. Acessar diretamente o endereço de uma tela interna | Acesso é recusado e o usuário conduzido à autenticação | Não executado |
| **TA-02** | RF-02 | Usuário recém-criado com senha temporária | 1. Autenticar-se com a senha temporária<br>2. Tentar acessar qualquer outra tela | Sistema exige a definição de nova senha antes de permitir qualquer outra tela | Não executado |
| **TA-03** | RF-06 | Sessão de perfil gerência | 1. Acionar diretamente uma operação restrita à chefia, digitando o endereço | Operação é recusada, ainda que acionada fora da interface | Não executado |
| **TA-04** | RF-07 | Duas sessões ativas do mesmo usuário, em aparelhos distintos | 1. Listar sessões ativas<br>2. Encerrar a sessão do outro aparelho<br>3. Tentar usar o outro aparelho | A sessão encerrada perde o acesso; a sessão atual permanece | Não executado |
| **TA-05** | RF-04 | - | 1. Tentar autenticar com senha errada<br>2. Autenticar corretamente<br>3. Consultar o registro de acessos | Ambas as tentativas constam, com data, origem e dispositivo | Não executado |
| **TA-06** | RF-03 | Sessão ativa | 1. Encerrar a própria sessão<br>2. Tentar acessar uma tela interna | O acesso anterior deixa de ser válido e o usuário é conduzido à autenticação | Não executado |

## 4. Configurações do sistema

| ID | Requisito | Pré-condição | Passos | Resultado esperado | Situação |
|---|---|---|---|---|---|
| **TA-07** | RF-09 | Sessão de chefia, com lote acima de 20% de mortalidade | 1. Alterar o limite de mortalidade para 30%<br>2. Abrir o mapa de lotes<br>3. Procurar ação de criar ou excluir parâmetro | O lote deixa de aparecer destacado, e não há ação de criar nem de excluir parâmetro | Não executado |
| **TA-08** | RF-09 | Sessão de gerência | 1. Tentar alterar um parâmetro do sistema | A alteração é recusada; a leitura permanece permitida (D4 §3.7) | Não executado |

## 5. Produção: cadastro do viveiro, lotes, agenda e protocolo

*Acrescentada em 24/08/2026.* Fecha a lacuna que a §9 declarava desde 19/08: o subsistema da
agenda não tinha como ser aceito, porque nenhum dos seus requisitos tinha critério de aprovação.
Os casos abaixo cobrem do cadastro do viveiro ao protocolo do lote, e a lista exata de requisitos
por subseção está na tabela gerada da §9.

### 5.1 Cadastro do viveiro

| ID | Requisito | Pré-condição | Passos | Resultado esperado | Situação |
|---|---|---|---|---|---|
| **TA-09** | RF-13 | Sessão de gerência | 1. Cadastrar a área A<br>2. Cadastrar os canteiros 1, 2 e 3 nela<br>3. Cadastrar a área B e o canteiro 1 nela<br>4. Tentar cadastrar um segundo canteiro 1 na área A | Existem o canteiro 1 da área A e o canteiro 1 da área B, como lugares distintos; o repetido na mesma área é recusado | Não executado |
| **TA-10** | RF-20 | Sessão de chefia | 1. Cadastrar funcionário sem criar usuário para ele<br>2. Abrir a agenda da semana | O funcionário aparece na escalação mesmo sem nunca ter feito login | Não executado |
| **TA-11** | RF-21 | Catálogo de tarefas carregado | 1. Abrir o encerramento de "Irrigação" (não quantitativa, sem lote específico)<br>2. Abrir o encerramento de "Repicar" (quantitativa, com lote específico) | A primeira tela não apresenta campo de lote nem de quantidade; a segunda apresenta os dois | Não executado |
| **TA-12** | RF-08 | Período de trabalho cadastrado, com hora de início e de fim de cada turno | 1. Alterar o fim do turno da manhã para uma hora mais tarde<br>2. Abrir a agenda da semana | A jornada padrão exibida na agenda acompanha o novo horário, sem que nenhuma atribuição seja alterada: **o período de trabalho é cadastro, e não constante** (RN-26) | Não executado |
| **TA-13** | RF-10 | Sessão de chefia | 1. Cadastrar espécie com nome científico, dois nomes populares, características e foto<br>2. Buscar pelo segundo nome popular<br>3. Buscar pelo nome científico | As duas buscas retornam a mesma espécie, com a foto exibida | Não executado |
| **TA-14** | RF-12 | Sessão de chefia | 1. Cadastrar insumo com unidade de medida e categoria<br>2. Consultar a lista de insumos | O insumo aparece na lista com a unidade e a categoria informadas | Não executado |
| **TA-15** | RF-14, RF-16 | Pessoa já cadastrada com o papel de fornecedor | 1. Acrescentar a ela o papel de cliente<br>2. Completar os dados fiscais<br>3. Consultar a lista de pessoas | Não há segundo cadastro: a mesma pessoa exibe os dois papéis, e os dados fiscais ficam nela | Não executado |

### 5.2 Lotes

| ID | Requisito | Pré-condição | Passos | Resultado esperado | Situação |
|---|---|---|---|---|---|
| **TA-16** | RF-32, RF-46 | Espécie, recipiente com protocolo e canteiro livre | 1. Criar lote de 500 mudas no canteiro A-3<br>2. Consultar o lote | O lote ocupa A-3, tem saldo 500 e previsão de disponibilidade igual à data de plantio somada ao tempo de produção da espécie | Não executado |
| **TA-17** | RF-33 | Lote aberto em A-3 | 1. Consultar a ocupação do viveiro<br>2. Baixar o lote inteiro por perda<br>3. Consultar a ocupação de novo | A-3 aparece ocupado no passo 1 e **livre** no passo 3; o lote continua consultável pelo histórico | Não executado |
| **TA-18** | RF-34, RF-35 | Lote de 500 mudas em tubete, canteiro B-1 livre | 1. Repicar 300 mudas para saco 10x18, destino B-1<br>2. Consultar os dois lotes | O lote de origem fica com saldo 200; o novo tem 300, está em B-1 e exibe o lote de origem. O histórico de ambos explica a diferença | Não executado |
| **TA-19** | RF-34, RF-37 | Lote de 500 mudas | 1. Repicar 300 mudas informando que 20 morreram no processo<br>2. Consultar o saldo do lote de origem e a mortalidade da espécie | O lote de origem cai para 180, o novo tem 300, e as 20 aparecem como perda **daquele lote**, não como diferença sem explicação | Não executado |
| **TA-20** | RF-36 | Lote com saldo 200 | 1. Tentar registrar perda de 250 mudas | A operação é recusada, com o saldo disponível informado. **Nenhum saldo negativo é gravado** | Não executado |
| **TA-21** | RF-37, RNF-01 | Lote aberto | 1. Registrar uma perda a partir do lote, no celular | O registro conclui-se em **no máximo quatro campos**, e em nenhum deles se digita espécie, recipiente ou canteiro: os três vêm do lote | Não executado |

### 5.3 Perdas

| ID | Requisito | Pré-condição | Passos | Resultado esperado | Situação |
|---|---|---|---|---|---|
| **TA-22** | RF-38, RNF-01 | Espécies e recipientes cadastrados | 1. Registrar uma perda no celular, em campo | Registro concluído em **no máximo quatro campos**, sem digitação de texto livre | Não executado |
| **TA-23** | RF-38, RNF-05 | Dispositivo em modo avião | 1. Registrar uma perda sem conexão<br>2. Observar a confirmação<br>3. Restabelecer a conexão | Confirmação aparece imediatamente mesmo sem rede; o registro aparece no sistema após a reconexão | Não executado |
| **TA-24** | RF-42 | Lote aberto com quantidade inicial conhecida e limite de mortalidade em 20% | 1. Registrar perdas que somem mais de 20% da quantidade inicial do lote<br>2. Abrir o mapa de lotes como gerência | A taxa exibida é a soma das perdas dividida pela quantidade inicial, e o lote aparece destacado no mapa, com o percentual visível | Não executado |
| **TA-25** | RF-42 | O lote de TA-24, com mortalidade entre 20% e 30% | 1. Alterar o limite de mortalidade para 30% em Configurações<br>2. Reabrir o mapa de lotes | O alerta desaparece sem que nada no lote mude: **o limite é parâmetro, e não constante** (RN-11, RF-09) | Não executado |

### 5.4 Agenda da semana

| ID | Requisito | Pré-condição | Passos | Resultado esperado | Situação |
|---|---|---|---|---|---|
| **TA-26** | RF-26 | Três funcionários cadastrados | 1. Escalar dois deles para "Encher saquinho" na manhã de segunda<br>2. Escalar o terceiro para "Irrigação" na mesma manhã<br>3. Consultar a agenda do dia | As duas tarefas coexistem no mesmo turno, cada uma com o seu grupo | Não executado |
| **TA-27** | RF-26 | Turnos cadastrados e um tipo de tarefa "Irrigação" | 1. Lançar "Irrigação" na manhã de segunda declarando das 07:00 às 08:00<br>2. Lançar "Repicagem" na mesma manhã sem informar hora<br>3. Consultar a agenda do dia | As duas são aceitas: a primeira exibe o horário, a segunda exibe só o turno, e **as duas exigiram o turno** (RN-12) | Não executado |
| **TA-28** | RF-26 | A atribuição de TA-27 | 1. Tentar declarar hora de fim sem hora de início | O lançamento é recusado: fim sem início não é um dos casos que a agenda admite | Não executado |
| **TA-29** | RF-27 | Semana anterior preenchida, com uma tarefa marcada como recorrente | 1. Criar a semana nova<br>2. Acionar "copiar semana passada" | A semana nasce com a tarefa recorrente já presente, e a cópia reproduz o restante da anterior | Não executado |
| **TA-30** | RF-28 | Semana no estado *fechada* | 1. Tentar alterar uma atribuição dela | A alteração é recusada, com o motivo informado | Não executado |
| **TA-31** | RF-29 | Atribuição planejada de tarefa quantitativa, com três participantes | 1. Confirmar a tarefa<br>2. Informar a quantidade de cada um | A atribuição passa a *confirmada* para os três, cada um com o próprio número | Não executado |
| **TA-32** | RF-29 | Atribuição de tarefa que declara lote específico | 1. Confirmar sem informar o lote | A confirmação é recusada, e a atribuição permanece *planejada* | Não executado |
| **TA-33** | RF-30 | Atribuição de tarefa cujo tipo declara **área**, e outra cujo tipo não declara | 1. Confirmar a primeira informando a área em que foi feita. 2. Abrir a confirmação da segunda | A área da primeira fica registrada; a segunda não apresenta área nem canteiro | Não executado |
| **TA-34** | RF-31 | Semana com atribuição planejada não confirmada | 1. Fechar a semana<br>2. Consultar a atribuição | Ela consta como realizada, com a marca de **não confirmada**, distinguível das confirmadas | Não executado |

### 5.5 Protocolo de atividades por lote

*Acrescentada em 26/08/2026, junto com a especificação do módulo.* Cobre o protocolo, do cadastro
da etapa ao encerramento do lote. **Os casos foram escritos antes de qualquer linha de código**, e as datas de TA-41, TA-42 e TA-46 saem
da prova de mesa de
[`rotinas/2-producao/06`](../../rotinas/2-producao/06-protocolo-de-atividades.md): são elas que
qualquer implementação do motor tem de reproduzir.

| ID | Requisito | Pré-condição | Passos | Resultado esperado | Situação |
|---|---|---|---|---|---|
| **TA-35** | RF-22 | Catálogo de tarefas carregado, sem protocolo montado | 1. Escolher o recipiente "bandeja"<br>2. Montar um protocolo para ele com duas etapas, uma sequencial e uma recorrente<br>3. Consultar o protocolo do tubete | O protocolo da bandeja existe com as duas etapas na ordem definida, e o do tubete não foi afetado | Não executado |
| **TA-36** | RF-23 | Protocolo com as etapas "Plantar no tubete" e "Classificar pós-germinação" | 1. Ancorar a classificação na conclusão do plantio<br>2. Tentar ancorar o plantio na conclusão da classificação | A primeira âncora é aceita; a segunda é **recusada** por formar ciclo, com o ciclo indicado | Não executado |
| **TA-37** | RF-24, RF-52 | Protocolo com uma etapa trimestral (90 dias) com alerta ligado e uma diária com alerta desligado | 1. Consultar um lote 75 dias depois da última execução da trimestral<br>2. Consultar a etapa diária no mesmo lote | A trimestral aparece em **atenção** (janela de 20% de 90 dias, ou seja, 18 dias); a diária aparece **sem indicação de situação**, feita ou não | Não executado |
| **TA-38** | RF-46 | Protocolo montado para tubete | 1. Criar um lote de tubete em 10 de janeiro<br>2. Consultar a ficha do lote | O lote exibe as etapas do protocolo do tubete, a data de criação 10/01 e a **data de plantio vazia** | Não executado |
| **TA-39** | RF-47 | Lote criado com protocolo, horizonte de 14 dias | 1. Abrir a agenda da semana<br>2. Conferir a grade da semana<br>3. Aceitar uma das sugestões e gravar a tarefa | As etapas vencidas aparecem como **sugestão** ao lado da semana, e **nenhuma** delas está na grade; a sugestão aceita só vira tarefa depois de preenchidos dia, turno e os campos que o tipo exige, e deixa de ser sugerida | Não executado |
| **TA-40** | RF-48 | Lote com a etapa sequencial de plantio pendente e uma etapa recorrente de irrigação | 1. Concluir a ordem de plantio<br>2. Consultar a fase do lote<br>3. Concluir uma ordem de irrigação<br>4. Consultar a fase do lote de novo | A fase avança no passo 2 e **permanece a mesma** no passo 4; a data de plantio do lote passa a ser a data real da execução | Não executado |
| **TA-41** | RF-49 | Lote criado em 10 de janeiro, etapa "Limpar mato" recorrente de 90 dias, vencida em 10 de abril e não executada | 1. Concluir a limpeza em 15 de setembro<br>2. Consultar o próximo vencimento da etapa | O próximo vencimento é **14 de dezembro**, e não julho nem outubro: conta da data real da execução, e não do calendário previsto | Não executado |
| **TA-42** | RF-50 | Lote com etapa recorrente vencida em 10 de abril e não executada | 1. Abrir a agenda do dia em 10 de julho<br>2. Contar as pendências daquela etapa no lote | Existe **uma** pendência, com 91 dias de atraso, e não três nem quatro: a contagem não reiniciou e nenhuma ocorrência nova nasceu | Não executado |
| **TA-43** | RF-51 | Lote com uma etapa concluída, uma vencida e uma ainda sem âncora resolvida | 1. Abrir a ficha do lote | As três aparecem com o estado correspondente: a concluída com a data real, a vencida com o atraso, e a sem âncora **sem vencimento nenhum** | Não executado |
| **TA-44** | RF-25 | Protocolo com classificação em 40 dias e uma espécie com 70 dias próprios | 1. Criar um lote da espécie customizada e outro de espécie sem customização, ambos plantados no mesmo dia<br>2. Consultar o vencimento da classificação nos dois | O primeiro vence 70 dias depois do plantio, o segundo 40: cada um usa o tempo que lhe cabe | Não executado |
| **TA-45** | RF-53 | Lote com tarefas do protocolo lançadas para os próximos dias | 1. Registrar perda que zera o saldo do lote<br>2. Consultar as tarefas daquele lote e as sugestões da semana | O lote encerra, as tarefas ainda não confirmadas aparecem **canceladas** e continuam consultáveis, e o lote deixa de aparecer entre as sugestões | Não executado |
| **TA-46** | RF-40 | Lote com a limpeza executada em 15 de setembro, próximo vencimento em 14 de dezembro | 1. Dividir o lote em dois, em 20 de dezembro<br>2. Consultar o vencimento da limpeza nos dois resultantes<br>3. Concluir a limpeza apenas no primeiro, em 22 de dezembro<br>4. Consultar os dois de novo | Os dois herdam o vencimento **14 de dezembro**, já em atraso, e não recomeçam em 20 de março; depois do passo 3, o primeiro vence em **22 de março** e o segundo continua em atraso desde 14 de dezembro | Não executado |

> **TA-41 e TA-46 são os casos que decidem se o motor está certo.** Os dois separam a contagem a
> partir da **execução real** (RN-32, RN-39) de uma contagem de calendário, e é a diferença que o
> módulo inteiro existe para produzir. Implementação que passe em todos os outros e falhe nestes
> dois entregou uma agenda recorrente comum, e não um protocolo de lote.

> **TA-39 verifica idempotência abrindo a mesma tela duas vezes**, e é de propósito. A geração das
> ordens é preguiçosa, disparada pela abertura da agenda, e a garantia contra duplicação é índice
> único no banco, e não validação de aplicação: duas telas abertas ao mesmo tempo dobrariam as
> ordens do dia, e as horas planejadas dobrariam com elas.

> **TA-37 é o caso que protege o mapa de virar ruído.** Etapa diária com cor deixaria o viveiro
> inteiro em atraso toda manhã (RN-35), e o teste falha se a irrigação receber qualquer indicação
> de situação, mesmo verde.

---

### 5.6 Mapa de lotes

| ID | Requisito | Pré-condição | Passos | Resultado esperado | Situação |
|---|---|---|---|---|---|
| **TA-47** | RF-44 | Duas áreas, com canteiros ocupados e livres, e um canteiro com seis lotes abertos | 1. Abrir o mapa de lotes | As áreas aparecem com os seus canteiros, o canteiro de seis lotes apresenta os seis, e os livres se distinguem dos ocupados | Não executado |
| **TA-48** | RF-45 | Lote com etapa do protocolo vencida há cinco dias | 1. Abrir o mapa<br>2. Apontar o lote<br>3. Concluir a etapa pendente<br>4. Reabrir o mapa | O lote aparece como crítico e exibe a tarefa pendente e os cinco dias de atraso; concluída a etapa, volta a saudável no mesmo dia, sem que ninguém digite a situação | Não executado |

## 6. Clientes e pedidos

| ID | Requisito | Pré-condição | Passos | Resultado esperado | Situação |
|---|---|---|---|---|---|
| **TA-49** | RF-15 | Cliente inexistente no sistema | 1. Iniciar o cadastro de um pedido<br>2. Acionar o cadastro rápido<br>3. Informar apenas nome e telefone<br>4. Concluir o pedido | O pedido é concluído **sem sair da tela** e sem exigir dados fiscais | Não executado |
| **TA-50** | RF-17 | - | 1. Informar um CPF inválido no cadastro completo | Documento é recusado no momento da digitação, preservando os demais campos preenchidos | Não executado |
| **TA-51** | RF-54 | Espécies e recipientes cadastrados | 1. Registrar um pedido com três itens<br>2. Consultar a lista de pedidos | Pedido aparece na lista, com número sequencial e os três itens | Não executado |
| **TA-52** | RF-55 | Pedido em rascunho | 1. Informar preço unitário em cada um dos três itens<br>2. Conferir os totais | O total de cada item é quantidade por preço, e o total do pedido é a soma dos três | Não executado |
| **TA-53** | RF-57 | Pedido em rascunho, com itens | 1. Confirmar o pedido<br>2. Tentar alterar a quantidade de um item | O pedido passa a *confirmado* e a alteração do item é recusada | Não executado |
| **TA-54** | RF-58 | Pedidos de clientes e canais distintos, em datas distintas | 1. Filtrar por cliente<br>2. Filtrar por canal<br>3. Filtrar por período | Cada filtro retorna somente os pedidos correspondentes | Não executado |

## 7. Requisitos não funcionais

| ID | Requisito | Pré-condição | Passos | Resultado esperado | Situação |
|---|---|---|---|---|---|
| **TA-55** | RNF-01 | - | 1. Contar os campos de cada formulário destinado ao uso em campo | Nenhum excede cinco campos | Não executado |
| **TA-56** | RNF-02 | - | 1. Inspecionar cada campo de categoria dos formulários | Nenhum admite entrada livre de texto | Não executado |
| **TA-57** | RNF-06 | Celular de uso corrente | 1. Executar todas as **rotinas de campo** no celular | Nenhuma exige rolagem horizontal nem ampliação | Não executado |
| **TA-58** | RNF-14 | Agenda do dia e mapa de produção preenchidos, com nove funcionários e mais de vinte canteiros | 1. Abrir as duas telas em computador<br>2. Abrir as duas no celular | No computador, o dia inteiro e o viveiro inteiro cabem sem rolagem; no celular, as duas apresentam a mesma informação em lista, e nenhuma exige rolagem horizontal | Não executado |
| **TA-59** | RNF-05 | Registro feito sem conexão | 1. Registrar<br>2. **Recarregar a página**<br>3. Restabelecer a conexão | O registro sobrevive ao recarregamento e é enviado ao reconectar | Não executado |
| **TA-60** | RNF-11 | - | 1. Inspecionar o código entregue ao navegador | Nenhuma credencial de banco e nenhuma regra de autorização presentes | Não executado |
| **TA-61** | RNF-08, RNF-09 | - | 1. Inspecionar o armazenamento de usuários e sessões | Nenhuma senha legível; identificadores de sessão apenas em forma protegida | Não executado |

> **TA-57 e TA-58 verificam coisas opostas, e é de propósito.** TA-57 cobra que o registro em
> campo caiba no celular (RNF-06); TA-58 cobra que a coordenação caiba na tela do computador e
> ainda assim seja legível no celular (RNF-14). Um teste só para os dois obrigaria a escolher qual
> das duas telas seria mal servida.

## 8. Casos acrescentados pela matriz de rastreabilidade

Os seis casos abaixo não constavam da primeira versão deste documento. Foram acrescentados quando a
matriz [`B5`](../B-requisitos/B5-matriz-rastreabilidade.md) confrontou requisitos e testes e apontou
requisitos de prioridade *deve ter* sem verificação correspondente.

| ID | Requisito | Pré-condição | Passos | Resultado esperado | Situação |
|---|---|---|---|---|---|
| **TA-62** | RF-05 | Sessão de administrador | 1. Criar usuário com perfil gerência<br>2. Autenticar-se como o novo usuário<br>3. Tentar acessar tela restrita à chefia | Usuário criado acessa apenas o que seu perfil permite | Não executado |
| **TA-63** | RF-11 | Sessão de chefia | 1. Cadastrar recipiente com nome e volume<br>2. Criar um lote usando o novo recipiente | Recipiente cadastrado fica disponível na criação de lote e no item de pedido | Não executado |
| **TA-64** | RF-43, RF-56 | Lotes prontos, perdas registradas e saída de venda na mesma espécie e recipiente | 1. Consultar o saldo disponível pelo item de pedido<br>2. **Conferir manualmente**: somar os movimentos dos lotes prontos | Os dois valores coincidem | Não executado |
| **TA-65** | RF-39 | Lote com saldo calculado diferente do real | 1. Registrar contagem física do lote com a quantidade real<br>2. Consultar o histórico de movimentos | O saldo passa a ser o contado, e o movimento de ajuste aparece no histórico | Não executado |
| **TA-66** | RF-41 | Perdas registradas em datas distintas | 1. Filtrar as perdas por um intervalo de datas | Retorna somente os registros do intervalo | Não executado |
| **TA-67** | RF-18 | Cliente cadastrado com nome, telefone e documento | 1. Buscar por parte do nome<br>2. Buscar pelo telefone<br>3. Buscar pelo documento | As três buscas retornam o mesmo cliente | Não executado |
| **TA-68** | RF-26, RNF-14 | Semana publicada, em tela de computador, com tarefa planejada na manhã de segunda | 1. Arrastar a barra da tarefa para a tarde de quarta<br>2. Puxar a borda direita dela para uma hora adiante<br>3. Recarregar a página | A tarefa passa a constar em quarta, no turno da tarde, com a hora de início e de fim que o arrasto declarou, e continua assim depois de recarregar | Não executado |
| **TA-69** | RF-26, RNF-14 | Semana publicada, em tela de computador | 1. Clicar num ponto vazio da faixa de uma pessoa, à tarde de quinta<br>2. Preencher o tipo de tarefa e confirmar | O lançamento abre já apontando para quinta, o turno da tarde e a hora do ponto clicado, e a tarefa nasce ali | Não executado |
| **TA-70** | RF-28, RF-26 | Semana fechada, em tela de computador | 1. Tentar arrastar a barra de uma tarefa da semana<br>2. Tentar clicar no vazio da grade | Nada se move e nada é lançado: a semana fechada não se altera | Não executado |

> **TA-64 confronta o número do sistema com uma apuração manual independente.** É o que valida a
> decisão de manter o saldo disponível como quantidade derivada, e não como entidade armazenada:
> se os dois valores divergirem, a derivação está errada.

---

## 9. Cobertura

> Tabela **gerada** por `scripts/build-e2-cobertura.mjs` a partir dos casos acima.
> Não editar à mão: acrescente ou remova o caso, e rode o script.

| Subsistema | Casos | Requisitos cobertos |
|---|---:|---|
| Acesso e segurança | 6 | RF-01, RF-02, RF-03, RF-04, RF-06, RF-07 |
| Configurações do sistema | 2 | RF-09 |
| Cadastro do viveiro | 7 | RF-08, RF-10, RF-12, RF-13, RF-14, RF-16, RF-20, RF-21 |
| Lotes | 6 | RF-32, RF-33, RF-34, RF-35, RF-36, RF-37, RF-46, RNF-01 |
| Perdas | 4 | RF-38, RF-42, RNF-01, RNF-05 |
| Agenda da semana | 9 | RF-26, RF-27, RF-28, RF-29, RF-30, RF-31 |
| Protocolo de atividades por lote | 12 | RF-22, RF-23, RF-24, RF-25, RF-40, RF-46, RF-47, RF-48, RF-49, RF-50, RF-51, RF-52, RF-53 |
| Mapa de lotes | 2 | RF-44, RF-45 |
| Clientes e pedidos | 6 | RF-15, RF-17, RF-54, RF-55, RF-57, RF-58 |
| Requisitos não funcionais | 7 | RNF-01, RNF-02, RNF-05, RNF-06, RNF-08, RNF-09, RNF-11, RNF-14 |
| Casos acrescentados pela matriz de rastreabilidade | 9 | RF-05, RF-11, RF-18, RF-26, RF-28, RF-39, RF-41, RF-43, RF-56, RNF-14 |
| **Total** | **70** | **53 dos 53 requisitos de prioridade *deve ter*** |

**Todos os requisitos de prioridade *deve ter* têm caso de aceite.**

**Sem caso, por prioridade inferior a *deve ter*:** RF-19.
É decisão declarada em §1, não omissão.

## 10. Registro de execução

A execução preenche a coluna **Situação** e acrescenta, para cada caso reprovado: data, executor,
observação e a decisão tomada: corrigir, aceitar com ressalva, ou reclassificar o requisito.

Os casos de aceite são executados **pelos próprios usuários da empresa**, sob observação, o que os
integra à mesma sessão de avaliação de usabilidade descrita em
[`F3`](../F-ux/F3-plano-avaliacao-usabilidade.md). A economia é deliberada: uma única sessão produz
verificação funcional e medição de usabilidade, e a disponibilidade dos usuários é recurso escasso
([`E3`, R-04](E3-analise-de-riscos.md)).
