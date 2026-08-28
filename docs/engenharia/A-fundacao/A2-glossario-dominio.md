# A2: Glossário do domínio

> **Artefato:** Glossário do domínio · **Bloco:** A, Fundação e escopo
> **Destino no TCC:** Apêndice
> **Fundamentação:** Sommerville (2011) aponta que requisitos mal compreendidos decorrem, em boa
> parte, da dificuldade dos *stakeholders* em articular suas necessidades e da ambiguidade da
> linguagem natural. Fixar um vocabulário único antes da especificação é a medida preventiva contra
> essa ambiguidade.

## Propósito

Este glossário estabelece o vocabulário único do projeto. Cada termo tem **uma** definição, e todos
os demais artefatos: especificação de requisitos, casos de uso, modelo de dados, dicionário de
dados: devem usá-la sem variação.

O viveiro opera há mais de três décadas com um vocabulário oral próprio, no qual o mesmo objeto
recebe nomes diferentes conforme quem fala, e nomes iguais designam coisas diferentes conforme o
contexto. A coluna **"Como a empresa chama"** registra essas variações observadas, e a coluna
**"Forma canônica"** define o termo adotado no sistema e na documentação.

Convenção adotada: o texto e a documentação usam a forma canônica em **português**; o código e o
banco de dados usam o equivalente em **inglês**, indicado entre parênteses quando relevante.

---

## 1. Produção e domínio florestal

| Termo | Definição | Como a empresa chama | Forma canônica |
|---|---|---|---|
| **Espécie** | Entidade central do sistema. Tipo botânico de árvore produzido pelo viveiro, identificado por nome científico e um ou mais nomes populares. Tudo no sistema (lote, tarefa, perda, item de pedido) se refere a uma espécie. | "planta", "muda", pelo nome popular | **Espécie** (`species`) |
| **Nome popular** | Denominação regional da espécie. Uma mesma espécie admite vários; a busca do sistema deve encontrá-la por qualquer um deles. | o nome usado no dia a dia | **Nome popular** |
| **Nome científico** | Denominação binomial da espécie. Identificador não ambíguo, usado em documentos oficiais e projetos de compensação ambiental. | "nome de fora", "nome técnico" | **Nome científico** |
| **Muda** | Exemplar individual de uma espécie, em produção ou pronto para venda. É a unidade de contagem e de venda. | "pé", "planta", "unidade" | **Muda** |
| **Característica da espécie** | Classificação de uso e origem, em catálogo fixo: **nativa, exótica, frutífera, ornamental, madeireira, forrageira**. Uma espécie admite **várias** simultaneamente, uma nativa pode ser ao mesmo tempo frutífera e madeireira, e forçar escolha única falsearia o catálogo. | "tipo", "pra que serve" | **Característica** (`tag`) |
| **Semeadura** | Atividade de deposição da semente no substrato, marco inicial do ciclo produtivo. | "plantar a semente", "semear" | **Semeadura** |
| **Germinação** | Período entre a semeadura e a emergência da plântula. Varia por espécie e é um dos determinantes da duração das etapas do protocolo. | "nascer" | **Germinação** |
| **Repicagem** | Transferência da plântula para recipiente individual definitivo. Segunda etapa do ciclo e ponto de maior consumo de mão de obra e substrato. | "repicar", "passar pro saco" | **Repicagem** |
| **Rustificação** | Fase final, em que a muda é exposta a condições próximas às do campo para ganhar resistência antes da expedição. | "endurecer", "botar no sol" | **Rustificação** |
| **Muda pronta** | Muda que concluiu o ciclo produtivo e está apta à venda. Só a muda pronta compõe estoque comercializável. | "muda boa", "pronta pra sair" | **Muda pronta** |
| **Perda** | Muda que não chegará à venda, por qualquer causa. Registrada como **movimento do lote**, com quantidade e causa. | "morreu", "perdeu" | **Perda** (movimento de tipo `perda`) |
| **Causa da perda** | Motivo da perda, em lista fechada: seca, praga, geada, manuseio, outro. Lista fechada é requisito, campo livre inviabiliza a análise por causa. | - | **Causa** |
| **Mortalidade** | Razão entre as mudas perdidas de um lote e a quantidade inicial dele. Acima de **20%** dispara alerta, é regra de negócio, não convenção de interface. | "perda", "quanto morreu" | **Taxa de mortalidade** |
| **Lote** | **Leva de mudas da mesma espécie, no mesmo recipiente, plantada junta e ocupando um canteiro.** É a unidade de rastreamento da produção: onde a muda está, de onde veio e quanto sobrou dela. Um lote ocupa **um** canteiro; leva que não cabe em um canteiro é outro lote. | "a leva", "aquele canteiro de ipê" | **Lote** (`batch`) |
| **Movimento do lote** | Toda alteração do saldo ou do endereço de um lote: entrada, perda, repicagem que sai, repicagem que entra, venda, ajuste de contagem e transferência de canteiro. É o razão que explica o saldo, e o saldo exibido tem de bater com a soma deles. | "o que entrou e saiu" | **Movimento** (`batch_movement`) |
| **Situação do lote** | Como o lote está indo, em três estados: **saudável**, **atenção** e **crítico**. Não é digitada: sai do atraso das tarefas que estavam planejadas para aquele lote e ninguém executou. Apontar o lote no mapa mostra qual tarefa falta. | "tá atrasado", "esse aí tá bom" | **Situação do lote** (`batch_health`) |
| **Lote de origem** | Lote do qual outro nasceu. A repicagem para recipiente maior **não move** o lote: encerra parte do lote de origem e cria um lote novo que aponta para ele. É o que permite saber quanto de uma leva sobreviveu até a venda. | "veio daquele tubete" | **Lote de origem** (`parent_batch`) |
| **Área** | Divisão física do viveiro, identificada por **letra** (A, B, C…). Contém canteiros. | "área A", "lá em cima" | **Área** (`area`) |
| **Canteiro** | Subdivisão da área, identificada por **número** dentro dela, de 1 até o máximo daquela área. O endereço de uma muda no viveiro é o par letra da área + número do canteiro, escrito **`A-3`**: letra, hífen, número. | "canteiro 4", "o quatro da B" | **Canteiro** (`bed`) |
| **Classificação** | Atividade de separar, dentro de um lote, as mudas mortas das vivas e as maiores das menores. Ocorre em dois momentos: **pós-germinação** e **seleção**, esta quando a muda troca de bandeja. A parte morta vira perda do lote no mesmo registro. | "classificar", "escolher" | **Classificação** |
| **Ocupação** | Quais canteiros estão ocupados, por qual lote e com qual saldo. É a leitura do viveiro como espaço físico, e não como catálogo. | "o que tem lá" | **Ocupação** |

## 2. Recipientes e medidas

| Termo | Definição | Como a empresa chama | Forma canônica |
|---|---|---|---|
| **Recipiente** | Vasilhame em que a muda é produzida. **Determina o porte da muda e, por consequência, o preço.** Espécie e recipiente formam o par que identifica um produto comercializável: a mesma espécie em dois recipientes é, comercialmente, dois produtos. É também por ele que o protocolo de atividades chega ao lote. | "saco", "embalagem", "tubete" | **Recipiente** (`container`) |
| **Tubete** | Recipiente cônico rígido e reutilizável, de menor volume. Usado na fase inicial e em produção de larga escala para restauração. | "tubete" | **Tubete** |
| **Saco** | Recipiente plástico flexível, identificado pelas medidas em centímetros: **10x18, 17x22, 20x26, 28x32**. O número maior indica muda de maior porte, mais cara e de ciclo mais longo. | pelo tamanho: "dez por dezoito" | **Saco 10x18**, **Saco 17x22**, **Saco 20x26**, **Saco 28x32** |
| **Balde** | Recipiente de maior volume, para mudas de grande porte destinadas a paisagismo. | "balde", "vaso grande" | **Balde** |
| **Substrato** | Meio de cultivo que preenche o recipiente. Principal insumo por volume. | "terra" | **Substrato** |
| **Insumo** | Todo material consumível aplicado na produção. Lista fechada de categorias: substrato, adubo, defensivo, recipiente, outros. | "material" | **Insumo** (`input`) |

## 3. Comercial

| Termo | Definição | Como a empresa chama | Forma canônica |
|---|---|---|---|
| **Pessoa** | Identidade única de quem se relaciona com o viveiro, cadastrada **uma vez** e reaproveitada em todos os papéis que ela exerça. | "o cadastro" | **Pessoa** (`party`) |
| **Papel** | O que uma pessoa é para o viveiro: **cliente**, **fornecedor** ou **funcionário**. Uma mesma pessoa acumula mais de um, e é por isso que o cadastro é único e o papel é que se multiplica. | - | **Papel** (`party_role`) |
| **Cliente** | Papel de quem compra mudas. | "comprador", "freguês" | **Cliente** (papel de pessoa) |
| **Fornecedor** | Papel de quem vende mudas ou insumos ao viveiro. | "parceiro", "outro viveiro" | **Fornecedor** (papel de pessoa) |
| **Funcionário** | Papel de quem trabalha no viveiro. Aparece na agenda como quem executa a tarefa, e **não implica acesso ao sistema**: dos nove, três têm usuário. | "o pessoal" | **Funcionário** (papel de pessoa) |
| **Canal de venda** | Segmento comercial a que a venda pertence. Lista fechada: **atacado** (padrão), **compensação ambiental**, **paisagismo**, **prefeitura**, **varejo**. O mesmo produto costuma sair por preços diferentes conforme o canal, e registrar o canal é o que torna essa diferença analisável. | "tipo de venda", "pra quem é" | **Canal de venda** |
| **Atacado** | Canal padrão. Venda em volume, majoritariamente negociada por WhatsApp. | "venda normal" | **Atacado** |
| **Compensação ambiental** | Canal em que a compra atende exigência legal de recuperação de área. Costuma exigir nome científico das espécies. | "projeto", "compensação" | **Compensação ambiental** |
| **Pedido** | Registro de uma intenção de compra, com cliente, canal e um ou mais itens. | "encomenda", "pedido" | **Pedido** (`order`) |
| **Item de pedido** | Linha do pedido: espécie, recipiente, quantidade e **preço unitário digitado** por quem registra. | "linha", "item" | **Item de pedido** |
| **Preço** | Valor de venda unitário do item, **informado no pedido**. O sistema registra o que foi negociado; não o calcula. | "valor", "quanto tá" | **Preço** |
| **Saldo disponível** | Quantidade de muda pronta que a produção tem daquela espécie e recipiente, exibida ao lado do item do pedido. É **leitura derivada dos lotes**, não um número digitado, e é o ponto em que a Produção alimenta o Comercial. | "tem quanto?" | **Saldo disponível** |

## 4. Usuários, acesso e sistema

| Termo | Definição | Como a empresa chama | Forma canônica |
|---|---|---|---|
| **Perfil** | Papel de acesso atribuído ao usuário, que determina o que ele pode ver e fazer. São dois perfis de negócio (chefia e gerência) mais um papel técnico de administração. | "permissão", "acesso" | **Perfil** (`role`) |
| **Chefia** | Perfil responsável por vendas, pedidos, parâmetros do sistema e decisões. | "o Gilberto" | **Chefia** |
| **Gerência** | Perfil responsável pela operação: coordenação, agenda da semana, lotes e planejamento de produção. | "quem coordena" | **Gerência** |
| **Administrador** | Papel técnico de administração do sistema, gestão de usuários e manutenção. Não corresponde a uma função da empresa e não participa das rotinas de negócio. | - | **Administrador** |
| **Configuração** | Parâmetro do sistema mantido em tela própria, cujo valor a operação altera mas cuja existência ela não cria. Distingue-se do cadastro: **valor solto é configuração, lista de coisas com atributos é entidade**. | "ajuste", "parâmetro" | **Configuração** (`setting`) |
| **Rotina** | Processo de negócio recorrente do viveiro, decomposto em etapas com perfil responsável por cada uma. As rotinas se agrupam nas **três áreas de negócio** do sistema (Cadastro único, Produção e Comercial), com Acesso e Configurações atravessando as três. | "o jeito que se faz" | **Rotina** |
| **Formulário de campo** | Tela projetada para uso em ambiente de trabalho, sob as restrições de no máximo cinco campos, listas fechadas em vez de campo aberto, botões grandes e resposta visual imediata. | - | **Formulário de campo** |
| **Uso offline** | Capacidade de registrar dados sem conexão, com envio posterior automático. Necessário porque a conexão no viveiro é instável. | "sem internet" | **Uso offline** |

## 5. Trabalho e agenda

| Termo | Definição | Como a empresa chama | Forma canônica |
|---|---|---|---|
| **Turno** | Metade do dia de trabalho, **manhã** ou **tarde**. É a unidade de planejamento da agenda: o viveiro nunca planejou por hora marcada. A hora de início e de fim de cada turno é **parâmetro mantido em Configurações**, não constante de código, e é dela que sai a duração do turno. | "de manhã", "de tarde" | **Turno** (`work_shift`) |
| **Período de trabalho** | O conjunto dos turnos e a jornada diária que deles resulta. É o padrão do viveiro, alterado quando a estação muda, e mora em **Configurações do sistema**. | "o horário" | **Período de trabalho** |
| **Tarefa** | Tipo de trabalho do viveiro, em catálogo mantido pela gerência, agrupado em seis categorias: **semente, terra, plantio, manutenção, pós-morte, expedição**. Parte das tarefas é **contada por unidade**, e nessas a agenda registra a quantidade realizada. | "serviço", "função" | **Tipo de tarefa** (`task_type`) |
| **Atribuição** | O que a gerência planejou: uma tarefa, num dia, num turno, para um ou mais funcionários. É a célula da agenda. | "o que tá marcado" | **Atribuição** (`assignment`) |
| **Situação da atribuição** | Em que pé está a célula da agenda: **planejada**, **confirmada** (a gerência registrou que foi feita, com a quantidade) ou **não confirmada** (a semana fechou sem ninguém confirmar, e o sistema assume como realizada, marcando a condição). | "foi feito?" | **Situação da atribuição** |
| **Semana** | A unidade de planejamento da agenda, com três estados: **rascunho**, **publicada** e **fechada**. Semana fechada não aceita alteração. | "a semana" | **Semana** (`week_plan`) |
| **Tarefa recorrente** | Atribuição marcada como fixa da rotina. Ao copiar a semana anterior, ela já vem preenchida, em vez de ser lançada de novo. **Repete por calendário, e o sujeito é a equipe**: é o que a distingue do protocolo de atividades. | "todo dia de manhã", "é fixo" | **Tarefa recorrente** |
| **Protocolo de atividades** | A **receita de manejo de um recipiente**: a sequência ordenada de etapas que todo lote daquele recipiente passa a seguir sozinho. Diferente da tarefa recorrente, **o sujeito é o lote** e a repetição conta a partir da execução real, e não do calendário. | "o que tem que fazer no tubete" | **Protocolo de atividades** (`protocol`) |
| **Etapa do protocolo** | Uma linha do protocolo: aponta para uma tarefa do catálogo e diz **quando** ela ocorre. **Sequencial** ocorre uma vez e avança a fase do lote; **recorrente** repete indefinidamente e não avança fase nenhuma. | "a classificação", "a limpeza" | **Etapa do protocolo** (`protocol_step`) |
| **Evento de referência** | O acontecimento a partir do qual a etapa conta o prazo: a **criação do lote** ou a **conclusão de uma etapa específica**, que **não é necessariamente a anterior**. "Classificar pós-germinação" conta do plantio, e não da criação do lote, porque a semente pode ficar dias esperando plantio antes de germinar. | "a partir de quando conta" | **Evento de referência**, ou **âncora** (`anchor`) |
| **Ordem do protocolo** | A ocorrência de uma etapa, já materializada na agenda. **É atribuição comum**, do mesmo tipo que a gerência lança à mão, e nasce **sem ninguém escalado**: o protocolo diz o que e quando, quem faz continua sendo de quem monta a agenda. | "apareceu na agenda" | **Ordem do protocolo** (`assignment` com etapa) |

---

## Termos deliberadamente não adotados

Registrar o que **não** entra no vocabulário evita que reapareça em revisões futuras.

| Termo evitado | Motivo |
|---|---|
| **Produto** | Ambíguo entre a espécie e o par espécie + recipiente. Usar sempre o termo específico. |
| **Estoque** (como entidade) | Estoque é uma **quantidade derivada** da soma dos lotes prontos, não uma entidade própria. Tratá-lo como entidade cria duas verdades sobre o mesmo número. |
| **Usuário** (como sinônimo de perfil) | Usuário é a pessoa; perfil é o papel. Um não substitui o outro. |
| **Cadastro** | Genérico demais. Usar o nome da entidade: cadastro de pessoa, de espécie, de recipiente. |
| **Apontamento de horas** | O sistema não mede a hora de entrada e saída de ninguém. A agenda registra que a tarefa planejada foi feita, e a quantidade; o relógio fica de fora. |

> **"Lote" saiu desta lista.** Ficou fora do vocabulário até 24/08/2026 justamente pela ambiguidade
> registrada aqui: a mesma palavra designava uma leva de semeadura, um conjunto à venda e uma
> carga. O levantamento da rotina de produção desfez a ambiguidade ao amarrar o termo a um
> canteiro e a uma leva plantada junta, e a partir daí ele passou a ter definição única, na
> seção 1. O conjunto à venda continua sendo **item de pedido**: é o sentido que a palavra
> deixou de carregar.

---

## Manutenção

Termo novo que apareça em qualquer artefato entra primeiro aqui. Se um termo do glossário for
alterado, os artefatos que o utilizam precisam ser revistos: a matriz de rastreabilidade
([`B5`](../B-requisitos/B5-matriz-rastreabilidade.md)) permite localizar onde.
