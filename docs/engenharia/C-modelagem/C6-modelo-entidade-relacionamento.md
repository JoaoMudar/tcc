# C6: Modelo Entidade-Relacionamento

> **Artefato:** MER conceitual, lógico e físico · **Bloco:** C, Modelagem
> **Destino no TCC:** Capítulo 4, seção 4.5, Modelagem de dados
> **Fundamentação:** Elmasri e Navathe (2011) definem o modelo Entidade-Relacionamento como modelo
> conceitual de alto nível que abstrai objetos do mundo real em entidades descritas por atributos.
> A progressão conceitual → lógico → físico e os critérios de normalização seguem os mesmos autores.

> ⚠️ **Alterou este documento? O [`modelo-dados-pt`](../modelo-dados-pt/README.md) muda junto.**
> Ele é o mesmo modelo com tabelas e colunas em português, e é **fonte separada, renderizada à
> mão**: nenhum script o regenera. Entidade, atributo, chave ou cardinalidade que muda aqui muda
> lá, no `.mmd` da figura correspondente, com o `.png` regerado pelo comando do README de lá.

---

## 1. Estratégia de modelagem

**A espécie é a entidade central.** Lote, atribuição de tarefa, etapa de protocolo e item de pedido
referenciam-na por chave estrangeira. Essa centralidade não é preferência de projeto: é a tradução
direta da regra de negócio de que tudo no viveiro gira em torno da espécie (RN-01).

O modelo é apresentado em **quatro agrupamentos**: as três áreas de negócio do sistema, mais o
Acesso, que atravessa todas. Usar aqui o mesmo agrupamento dos requisitos
([`B2 §2`](../B-requisitos/B2-especificacao-requisitos.md)) e da matriz de acesso
([`D4 §2`](../D-arquitetura/D4-matriz-rbac.md)) permite ler os três documentos lado a lado sem
traduzir de um para o outro.

| Agrupamento | Entidades | Papel |
|---|---:|---|
| *(transversal)* **Acesso e configurações** | 4 | Autenticação, sessão, auditoria e parâmetros do sistema |
| **1 · Cadastro único** | 15 | Catálogo de produção, endereço do viveiro, identidade das pessoas e protocolo de manejo: não consome nada, alimenta tudo |
| **2 · Produção** | 6 | Agenda da semana, lote, movimento e percurso pelo protocolo |
| **3 · Comercial** | 2 | Pedido e item |
| **Total** | **27** | mais 2 visões derivadas (`batch_health` e `batch_protocol_due`), documentadas em [`C8`](C8-dicionario-de-dados.md) |

**O preço da escolha, declarado:** agrupar por propósito faz relacionamentos cruzarem a fronteira
do diagrama: `assignments` é da Produção e aponta para `species`, `containers`, `task_types` e
`work_shifts`, que são do Cadastro único. A convenção do §3 resolve isso sem duplicar conteúdo: a
entidade estrangeira aparece como **caixa vazia**, só para a aresta existir.

Uma realocação merece nota, porque contraria a intuição de onde a entidade nasceu:

- **O esquema `cadastro` (`parties`, `party_roles`, `addresses`) resolve um problema anterior ao de
  qualquer módulo.** Cliente, fornecedor e funcionário são papéis de **uma identidade só**, e o
  viveiro tem gente que é os três ao mesmo tempo. Modelar três tabelas de pessoa produziria três
  verdades sobre o mesmo telefone.

Convenções adotadas, conforme Elmasri e Navathe (2011): tabelas nomeadas no **plural**, chaves
primárias e estrangeiras declaradas explicitamente, e identificadores universais como chave
primária: o que permite gerar a chave no cliente antes da gravação, requisito do funcionamento sem
conexão (RNF-05).

---

## 2. Modelo conceitual: visão geral

Apenas entidades e relacionamentos, sem atributos. É a visão que responde "de que o sistema trata".

```mermaid
erDiagram
  ESPECIE      ||--o{ LOTE        : "é plantada em"
  RECIPIENTE   ||--o{ LOTE        : "define o porte de"
  CANTEIRO     ||--o{ LOTE        : "abriga"
  AREA         ||--o{ CANTEIRO    : "contém"

  RECIPIENTE   ||--o| PROTOCOLO        : "define"
  PROTOCOLO    ||--o{ ETAPA_PROTOCOLO  : "compõe-se de"
  ETAPA_PROTOCOLO ||--o{ ETAPA_PROTOCOLO : "é âncora de"
  ESPECIE      ||--o{ ETAPA_PROTOCOLO : "customiza o tempo de"
  PROTOCOLO    ||--o{ LOTE            : "rege"
  ETAPA_PROTOCOLO ||--o{ ETAPA_DO_LOTE : "materializa-se em"
  LOTE         ||--o{ ETAPA_DO_LOTE   : "percorre"
  ETAPA_DO_LOTE ||--o{ ATRIBUICAO     : "gera ordem de"

  LOTE         ||--o{ LOTE            : "dá origem a"
  LOTE         ||--o{ MOVIMENTO_LOTE  : "é explicado por"

  SEMANA       ||--o{ ATRIBUICAO   : "organiza"
  TIPO_TAREFA  ||--o{ ATRIBUICAO   : "classifica"
  TURNO        ||--o{ ATRIBUICAO   : "situa"
  LOTE         ||--o{ ATRIBUICAO   : "recebe trabalho de"
  FUNCIONARIO  ||--o{ ATRIBUICAO   : "executa"
  ATRIBUICAO   ||--o{ MOVIMENTO_LOTE : "produz"

  ESPECIE      ||--o{ ITEM_PEDIDO : "é vendida em"
  RECIPIENTE   ||--o{ ITEM_PEDIDO : "define porte de"
  CLIENTE      ||--o{ PEDIDO      : "faz"
  PEDIDO       ||--o{ ITEM_PEDIDO : "compõe-se de"
  LOTE         ||--o{ ITEM_PEDIDO : "dá saldo a"

  PESSOA       ||--o| CLIENTE     : "é papel de"
  PESSOA       ||--o| FUNCIONARIO : "é papel de"
  USUARIO      ||--o{ PEDIDO      : "registra"
  USUARIO      ||--o{ MOVIMENTO_LOTE : "registra"
```

O diagrama conceitual apresenta **dezenove entidades**, e não as vinte e sete do modelo
completo. A redução é deliberada: Sommerville (2011) observa que a ausência de detalhe excessivo é
característica central do modelo, cujo objetivo é destacar o mais relevante e não especificar por
inteiro. Entidades associativas, de histórico e de auditoria aparecem apenas nos modelos lógicos por
área, na seção seguinte.

Seis leituras que o modelo conceitual já entrega:

- **A espécie participa de quatro relacionamentos e está presente nas três áreas**: o lote e a
  etapa do protocolo na Produção, o item de pedido no Comercial, e o próprio catálogo no Cadastro
  único. É a confirmação estrutural da centralidade declarada em RN-01. Um deles é de outra
  natureza que os demais: em `ESPECIE customiza o tempo de ETAPA_PROTOCOLO`, a espécie deixa de
  apenas participar do ciclo produtivo e passa a **parametrizá-lo**, decidindo em quantos dias
  cada etapa do manejo vence naquela espécie (RN-41).
- **O modelo tem duas entidades reflexivas.** `LOTE dá origem a LOTE` é a repicagem: a leva que
  muda de recipiente vira outra leva, ligada à primeira. Percorrer essa cadeia responde de quantas
  sementes semeadas saiu cada muda vendida, que é a pergunta que o viveiro nunca pôde responder. É
  também a entidade que dá **lugar** à muda: até 24/08/2026 o modelo dizia o que a muda era e não
  onde ela estava. A outra reflexiva é `ETAPA_PROTOCOLO é âncora de ETAPA_PROTOCOLO`, e ela diz
  **quando**: uma etapa do protocolo conta o prazo a partir da conclusão de outra, que não precisa
  ser a imediatamente anterior (RN-35).
- **O protocolo é o que liga a receita ao relógio.** `RECIPIENTE define PROTOCOLO`: o manejo é
  determinado pelo vasilhame em que a muda cresce (RN-34). É o que permite ao lote cobrar sozinho o
  que tem de receber, em vez de depender de alguém lembrar de lançar a tarefa.
- **O lote é o único caminho entre a Produção e o Comercial.** `LOTE dá saldo a ITEM_PEDIDO` é uma
  aresta de leitura, e não de chave estrangeira: o item não guarda de qual lote a muda saiu, ele
  consulta quanto existe. É a tradução no modelo do que o sistema existe para provar, e é
  deliberado que seja a única: nenhuma outra entidade das duas áreas se toca.
- **Nada aponta para dinheiro.** O preço é atributo do item de pedido, digitado por quem registra,
  e não há entidade de custo, de margem ou de lançamento. O sistema guarda por quanto se vendeu, e
  o que se gastou continua fora dele.
- **A pessoa é uma, e os papéis é que se multiplicam.** `PESSOA é papel de CLIENTE` e
  `PESSOA é papel de FUNCIONARIO` desenham a mesma identidade vista de dois lados. Quem vende muda
  ao viveiro e às vezes compra dele é um cadastro só (RN-52).

---

### 2.1 Recorte implementado

O modelo descrito aqui é o **especificado**. Das 27 entidades, **23 existem no banco** (mais a
visão `batch_health`) e **4 permanecem só especificadas**: as três do protocolo, mais o percurso do
lote por ele e a visão que daí deriva.

| Área | No banco | Só especificadas | Quais faltam |
|---|---:|---:|---|
| *(transversal)* Acesso e configurações | 4 | 0 | - |
| 1 · Cadastro único | 12 | 3 | `protocols`, `protocol_steps`, `species_protocol_overrides` |
| 2 · Produção | 5 | 1 | `batch_protocol_steps`, mais a visão `batch_protocol_due` |
| 3 · Comercial | 2 | 0 | - |
| **Total** | **23** | **4** | |

O [`C8`](C8-dicionario-de-dados.md) marca a condição entidade por entidade.

**O que falta é o protocolo, e a razão é declarada.** Ele foi especificado inteiro **antes de
qualquer migration**, porque envolve um motor de geração automática de ordens: modelar depois de
construir, aqui, custaria reescrever a regra de contagem em três lugares. É também a parte do
sistema em que o erro é mais caro, e é por isso que dois dos dez casos de uso detalhados em
[`C2`](C2-especificacao-casos-de-uso.md) são dele.

---

## 3. Modelo lógico por área

Convenção dos diagramas: entidade de **outra** área aparece como **caixa vazia**, apenas para que
a aresta exista. Os atributos dela estão no diagrama da área a que pertence.

Atributos comuns à maioria das entidades, omitidos dos diagramas para não repetir vinte e sete
vezes: `id` (chave primária), `created_at` e `updated_at`. Onde `active` aparece, é a marca de
inativação que substitui a exclusão. As exceções, tabelas sem `updated_at` porque nada nelas se
altera, e as duas de ligação, sem `id` porque a chave é o par que as define, estão registradas uma
a uma no [dicionário](C8-dicionario-de-dados.md).

**`text` na coluna de tipo, com lista fechada de valores, é `TEXT` mais restrição `CHECK` no
banco; `enum` é tipo enumerado de verdade.** A distinção importa na manutenção: acrescentar valor a
um `CHECK` é reescrever a restrição, e a um `ENUM` é `ALTER TYPE`. Os cinco tipos enumerados são
`user_role`, `input_category` e os três do esquema `cadastro`.

### 3.1 Acesso e configurações: transversal às três áreas

```mermaid
erDiagram
  users {
    uuid    id PK
    text    username UK
    text    display_name
    text    password_hash
    enum    role
    boolean must_change_password
    boolean active
    int     failed_login_attempts
    timestamptz locked_until
    uuid    party_id FK
  }
  sessions {
    uuid id PK
    uuid user_id FK
    text token_hash UK
    timestamptz expires_at
    timestamptz last_seen_at
    text ip
    text user_agent
  }
  login_events {
    uuid id PK
    uuid user_id FK
    text username_attempted
    boolean success
    text ip
    text user_agent
  }
  settings {
    uuid id PK
    text key UK
    text value
    text value_type
    text description
    timestamptz updated_at
    uuid updated_by FK
  }
  parties {}

  users ||--o{ sessions     : "mantém"
  users ||--o{ login_events : "gera"
  users ||--o{ settings     : "ajusta"
  parties ||--o| users : "pode ter login"
```

**`users.party_id` é opcional, e a opcionalidade é a regra.** Usuário é *credencial*; funcionário é
*vínculo* (`cadastro.parties`). Há pessoa com login e sem vínculo (o administrador), e pessoa com
vínculo e sem login: são seis delas, os colaboradores de campo, que aparecem na agenda sem nunca
abrir o aplicativo. Fundir as duas numa tabela só obrigaria a inventar um dos dois lados.

**O enum `role` tem três valores**: `chefia`, `gerencia` e `admin`. O quarto, `colaborador`, saiu
com a decisão de escopo de que o campo não opera o sistema ([`A1` §5](../A-fundacao/A1-documento-de-visao.md)).
Note que `cadastro.party_roles.role` continua tendo o valor `funcionario`, e **não é o mesmo
conceito**: ali é vínculo de trabalho, aqui é permissão de acesso.

**`settings` é transversal e não é cadastro.** Guarda parâmetro escalar do sistema em chave e valor
tipado: o limite de mortalidade, os limites de atraso que pintam o lote no mapa. Todos morariam em
constante de código, e **são regra de negócio, não infraestrutura**: quem os decide é a chefia, e
mudar qualquer um deles exigiria uma implantação (RF-09, RN-32).

> **Onde está a fronteira entre `settings` e cadastro.** Parâmetro que é **um valor** vai para
> `settings`. Parâmetro que é **uma lista de coisas com atributos** vira entidade: é o caso do
> período de trabalho, que é `work_shifts` no Cadastro único e não duas chaves aqui, ainda que a
> **tela** dos dois seja a mesma, em Configurações do sistema. A regra de corte é a do Cadastro
> único: se apagar deixa um movimento passado sem sentido, é entidade.

### 3.2 Área 1 · Cadastro único

O que é estável e se repete. Não consome nada e alimenta as outras duas: as únicas arestas que
saem daqui apontam para entidades da Produção e do Comercial, e é por isso que `assignments`,
`batches`, `batch_protocol_steps` e `order_items` aparecem como caixa vazia no fim do diagrama.

**O protocolo de atividades é cadastro, e não Produção.** É a mesma regra que já colocava
`task_types` e `work_shifts` aqui: o que é **mantido uma vez e consultado sempre** é cadastro,
ainda que só a Produção o consuma. O que a Produção guarda é o percurso de **cada lote** pelo
protocolo (`batch_protocol_steps`), que é dado de movimento e fica na §3.3.

```mermaid
erDiagram
  species {
    uuid    id PK
    text    scientific_name UK
    text[]  tags
    text    photo_url
    text    notes
    boolean active
  }
  species_popular_names {
    uuid    id PK
    uuid    species_id FK
    text    name
    boolean is_primary
  }
  species_photos {
    uuid  id PK
    text  content_type
    bytea content
  }
  containers {
    uuid    id PK
    text    name UK
    numeric volume_liters
    boolean active
  }
  inputs {
    uuid    id PK
    text    name
    enum    category
    text    unit_of_measure
    boolean active
  }
  areas {
    uuid    id PK
    char    letter UK
    text    name
  }
  beds {
    uuid id PK
    uuid area_id FK
    int  number
    int  capacity
  }
  work_shifts {
    uuid    id PK
    text    name
    time    starts_at
    time    ends_at
    boolean active
  }
  task_types {
    uuid    id PK
    text    name
    text    category
    boolean is_quantitative
    boolean requires_batch
    boolean requires_species
    boolean requires_container
    boolean active
  }
  protocols {
    uuid    id PK
    uuid    container_id FK
    int     version
    boolean active
  }
  protocol_steps {
    uuid    id PK
    uuid    protocol_id FK
    uuid    task_type_id FK
    text    label
    int     position
    enum    schedule_kind
    int     days
    int     interval_days
    uuid    anchor_step_id FK
    boolean alert_enabled
    numeric warn_window_pct
    text    resulting_stage
  }
  species_protocol_overrides {
    uuid id PK
    uuid species_id FK
    uuid protocol_step_id FK
    int  days
  }
  parties {
    uuid    id PK
    enum    kind
    text    name
    text    document UK
    text    phone
    text    email
    boolean active
  }
  party_roles {
    uuid    party_id FK
    enum    role
    text    employment_kind
    boolean active
  }
  addresses {
    uuid id PK
    uuid party_id FK
    enum kind
    text street
    text city
    char state
    text zip
  }
  assignments {}
  batches {}
  batch_protocol_steps {}
  order_items {}

  species ||--o{ species_popular_names : "é conhecida por"
  species ||--o| species_photos        : "é ilustrada por"
  species ||--o{ species_protocol_overrides : "customiza o tempo de"
  areas   ||--o{ beds                   : "contém"
  containers ||--o| protocols           : "define o manejo de"
  protocols  ||--o{ protocol_steps      : "compõe-se de"
  protocol_steps ||--o{ protocol_steps  : "é âncora de"
  protocol_steps ||--o{ species_protocol_overrides : "tem tempo sobrescrito em"
  task_types ||--o{ protocol_steps      : "é executada em"
  parties ||--o{ party_roles            : "exerce"
  parties ||--o{ addresses              : "reside em"

  species    ||--o{ batches      : "é plantada em"
  containers ||--o{ batches      : "define o porte de"
  beds       ||--o{ batches      : "abriga"
  protocols  ||--o{ batches      : "rege"
  task_types ||--o{ assignments  : "classifica"
  work_shifts||--o{ assignments  : "situa"
  parties    ||--o{ assignment_members : "executa"
  protocol_steps ||--o{ batch_protocol_steps : "materializa-se em"
  species    ||--o{ order_items  : "é vendida em"
  containers ||--o{ order_items  : "define porte de"
```

**`inputs` não tem aresta neste diagrama, e é informação.** O insumo é catálogo: o sistema registra
que ele existe, com unidade e categoria, e nada o consome. O consumo de insumo por tarefa e o saldo
em estoque ficaram fora do escopo, e mantê-lo no cadastro é o que permite que a tarefa o
referencie quando isso deixar de ser verdade.

**A espécie tem nomes, e não um nome.** `species_popular_names` existe porque a busca precisa
encontrar a espécie por qualquer denominação regional (RF-11, RN-02), e um campo de texto com nomes
separados por vírgula não se indexa nem se valida. `is_primary` marca o nome que as telas exibem.

**A foto é linha de tabela, e não arquivo em disco.** `species_photos` guarda os bytes porque o
sistema de arquivos do ambiente de publicação é somente-leitura e é descartado a cada implantação:
a imagem gravada em disco desapareceria na semana seguinte. O ganho colateral é que a foto entra no
mesmo backup do banco.

**`species é ilustrada por species_photos` é aresta de leitura, e não de chave estrangeira**, do
mesmo tipo que `LOTE dá saldo a ITEM_PEDIDO` no diagrama conceitual. `species_photos` não tem
`species_id`: o envio da foto acontece antes de a espécie existir, e a chave estrangeira não teria
a que apontar no momento da gravação. Quem liga as duas é o texto de `species.photo_url`, no
formato `/api/fotos/<uuid>`.

**O canteiro tem capacidade, e ela não é restrição.** `beds.capacity` existe para o aviso de
RN-30, que informa que a leva talvez não caiba, e não para recusar o lote: quem sabe se cabe é
quem está com a muda na mão.

**`party_roles` é chave composta, e o papel é que carrega o vínculo.** `employment_kind` (fixo ou
diarista) só faz sentido no papel `funcionario`, e fica nele em vez de poluir `parties` com uma
coluna que é nula em toda pessoa que só compra.

#### O protocolo: o que o lote tem de receber, lembre alguém ou não

`protocol_steps` é a entidade com mais atributos do modelo, e cada um resolve uma pergunta que o
viveiro faz em voz alta.

- **`schedule_kind`** separa a etapa **sequencial**, que ocorre uma vez e pode avançar a fase do
  lote, da **recorrente**, que repete indefinidamente e não avança fase nenhuma (RN-38).
- **`anchor_step_id`** é a âncora, e é reflexiva: a etapa conta o prazo a partir da conclusão de
  **outra etapa declarada**, e não da anterior na lista (RN-35). Classificar pós-germinação conta
  do plantio, e não da criação do lote, porque a semente pode ficar dias esperando plantio.
  Âncora nula significa contar da criação do lote.
- **`days` e `interval_days`** são o prazo e, na recorrente, o intervalo entre ocorrências.
- **`warn_window_pct`** é a janela de aviso **em percentual do intervalo**, e não em dias fixos
  (RN-39): três dias de antecedência não servem à etapa trimestral e à diária ao mesmo tempo.
- **`alert_enabled`** desliga a cor de uma etapa que se repete tanto que sinalizá-la seria ruído
  (RN-40).
- **`resulting_stage`** é opcional: nem toda etapa sequencial promove o lote de fase, e obrigar a
  escolher uma faria inventar transições que o ciclo produtivo não tem.

**A âncora circular é validação de aplicação, e não do banco.** Duas etapas que se ancoram
mutuamente não violam nenhuma restrição declarativa, e nenhuma das duas jamais venceria: a
verificação mora no código, e o caso de exceção está escrito em [`C2`](C2-especificacao-casos-de-uso.md)
UC-17 FE-1.

### 3.3 Área 2 · Produção

O que acontece uma vez. Consome o Cadastro único inteiro e não é consumido por ninguém, exceto pelo
saldo que o Comercial lê.

```mermaid
erDiagram
  week_plans {
    uuid        id PK
    date        week_start UK
    text        status
    uuid        published_by FK
    timestamptz closed_at
  }
  assignments {
    uuid    id PK
    uuid    week_plan_id FK
    date    work_date
    uuid    shift_id FK
    uuid    task_type_id FK
    uuid    species_id FK
    uuid    container_id FK
    uuid    batch_id FK
    uuid    area_id FK
    uuid    bed_id FK
    uuid    batch_protocol_step_id FK
    date    protocol_due_on
    int     planned_quantity
    boolean is_recurring
    text    status
    text    notes
  }
  assignment_members {
    uuid assignment_id FK
    uuid party_id FK
    int  quantity_done
  }
  batches {
    uuid        id PK
    text        code UK
    uuid        species_id FK
    uuid        container_id FK
    uuid        bed_id FK
    uuid        parent_batch_id FK
    uuid        protocol_id FK
    int         initial_quantity
    int         current_quantity
    text        stage
    date        planted_at
    int         position
    timestamptz closed_at
    text        closed_reason
    text        notes
  }
  batch_movements {
    uuid id PK
    uuid batch_id FK
    text movement_type
    int  quantity
    date movement_date
    uuid from_bed_id FK
    uuid to_bed_id FK
    uuid assignment_id FK
    text loss_cause
    uuid recorded_by FK
    text notes
  }
  batch_protocol_steps {
    uuid id PK
    uuid batch_id FK
    uuid protocol_step_id FK
    date last_done_at
    date due_at
    enum status
  }
  species {}
  containers {}
  areas {}
  beds {}
  task_types {}
  work_shifts {}
  parties {}
  protocol_steps {}
  users {}

  week_plans ||--o{ assignments        : "organiza"
  assignments ||--o{ assignment_members : "escala"
  assignments ||--o{ batch_movements    : "produz"
  batches    ||--o{ batch_movements    : "é explicado por"
  batches    ||--o{ batches            : "dá origem a"
  batches    ||--o{ batch_protocol_steps : "percorre"
  batches    ||--o{ assignments        : "recebe trabalho de"
  batch_protocol_steps ||--o{ assignments : "gera ordem de"

  species    ||--o{ batches : "é plantada em"
  containers ||--o{ batches : "define o porte de"
  beds       ||--o{ batches : "abriga"
  beds       ||--o{ batch_movements : "origem e destino da transferência"
  task_types ||--o{ assignments : "classifica"
  work_shifts||--o{ assignments : "situa"
  species    ||--o{ assignments : "é objeto de"
  containers ||--o{ assignments : "é objeto de"
  areas      ||--o{ assignments : "localiza"
  beds       ||--o{ assignments : "localiza"
  parties    ||--o{ assignment_members : "executa"
  users      ||--o{ week_plans : "publica"
  protocol_steps ||--o{ batch_protocol_steps : "materializa-se em"
  users      ||--o{ batch_movements : "registra"
```

#### O lote: onde a muda está e de que leva veio

**`batches.current_quantity` é a única quantidade materializada do modelo, e a exceção é
declarada.** O saldo poderia ser somado de `batch_movements` a cada leitura. Aqui não: a tela de
ocupação lê o saldo de todos os lotes abertos de uma vez, no celular, em rede instável.
`batch_movements` é a fonte que o audita, e **divergência entre os dois é defeito detectável**, que
é o que justifica manter os dois.

**`bed_id` é nulo apenas no lote encerrado.** Enquanto aberto, todo lote tem canteiro: lote sem
lugar é a situação que a entidade existe para eliminar. Ao encerrar, o canteiro é liberado (RN-22),
e a restrição que garante os dois lados da regra é uma só.

**`parent_batch_id` é a repicagem.** A muda que passa do tubete para o saco mudou de recipiente, e
recipiente define produto e preço: comercialmente, virou outra coisa (RN-20). Percorrer esta cadeia
responde, de cada mil sementes semeadas, quantas mudas chegaram à venda.

**Um lote ocupa um canteiro; um canteiro comporta vários lotes** (RN-19). A exclusividade que o
modelo garante é a do lote, não a do canteiro: um canteiro recebe seis, oito, nove levas ao longo
do tempo, e é assim que ele é usado.

#### O movimento: o razão que explica o saldo

**Toda alteração de `current_quantity` tem uma linha em `batch_movements`.** `movement_type` aceita
`entrada`, `perda`, `repicagem_saida`, `repicagem_entrada`, `venda`, `ajuste_contagem` e
`transferencia`. A quantidade é assinada: positiva na entrada, negativa na saída, e zero apenas na
transferência, em que o que muda é o canteiro e não o saldo.

**A perda não tem tabela própria, e é decisão de modelagem.** Ela é um `movement_type`, com
`loss_cause` em lista fechada (RN-10). Uma entidade separada de perda obrigaria a gravar duas
linhas por perda, uma nela e outra no razão do lote, e a divergir quando alguém gravasse só uma.
Pelo mesmo motivo a contagem física é um movimento de `ajuste_contagem` (RN-09) e não uma entidade
de contagem: o que interessa da contagem é o ajuste que ela produziu.

**A mortalidade é derivada daqui**, e não guardada: é a soma dos movimentos de tipo `perda` sobre
`initial_quantity` (RN-11). Guardá-la criaria duas verdades sobre o mesmo número, e ela mudaria a
cada perda registrada.

**`assignment_id` liga o movimento à tarefa que o causou, e é opcional.** Movimento sem origem é o
ajuste manual da gerência, que existe e precisa caber: prendê-lo a uma origem obrigatória faria a
correção de um erro de digitação ser impossível sem inventar uma perda que não houve.

#### A agenda: o planejado e o confirmado, na mesma linha

**`assignments` é a célula da agenda, e carrega as duas coisas.** `status` percorre `planejada`,
`confirmada` e `nao_confirmada`, e é isso que dispensa uma entidade de execução separada: o
realizado é o planejado com a marca de que aconteceu. `nao_confirmada` é o que o fechamento da
semana grava no que ninguém confirmou (RN-14), e é o que preserva a distinção entre o que se
confirmou e o que se presumiu.

**A quantidade é de cada pessoa, e por isso mora em `assignment_members`** (RN-29). Quatro pessoas
enchendo saquinho produzem quatro números, e é assim que o viveiro fala. Guardar um total na
atribuição perderia justamente o dado que ele quer.

**`is_recurring` é uma marca, e não uma regra de calendário.** Ela diz que a atribuição faz parte da
rotina fixa e, por isso, vem preenchida quando se copia a semana anterior (RF-32, RN-33). Uma
entidade de recorrência, com dias da semana e vigência, existiria para gerar dias sozinha, e o que
gera dia sozinho neste modelo é o protocolo, cujo sujeito é o lote e não a equipe.

**`batch_protocol_step_id` é o que faz a ordem do protocolo ser atribuição comum** (RN-46). A
ordem gerada não é uma entidade nova: é uma linha de `assignments` que sabe de que etapa veio, e
que nasce **sem ninguém em `assignment_members`**, porque o protocolo diz o que e quando, e quem faz
continua sendo de quem monta a agenda (RN-48).

#### O percurso do lote pelo protocolo

`batch_protocol_steps` é a única entidade de movimento do protocolo, e guarda três datas por etapa
e por lote: a última execução, o próximo vencimento e a situação.

**`due_at` é derivado, nunca digitado** (RN-45): sai da âncora, da última execução e do tempo
declarado, com a customização por espécie sobrescrevendo o tempo do protocolo quando existir
(RN-41). É o que a visão `batch_protocol_due` calcula, e é dela que sai a cor do lote no mapa.

**Uma etapa tem no máximo uma ocorrência em aberto** (RN-37). Etapa trimestral esquecida há cinco
meses apresenta **uma** pendência, e não cinco: gerar uma ordem por trimestre vencido encheria a
agenda com um passado que ninguém vai executar.

**A situação do lote é visão, e não coluna** (RN-31). `batch_health` é calculada a cada leitura
porque status gravado envelhece sozinho: o lote que estava verde ontem continuaria verde no banco
hoje, e a tela existe justamente para dizer o contrário. É a mesma razão de a mortalidade e o saldo
disponível também serem derivados.

### 3.4 Área 3 · Comercial

Duas entidades, e é o tamanho certo. O pedido registra o que foi negociado fora do sistema.

```mermaid
erDiagram
  orders {
    uuid    id PK
    serial  order_number UK
    uuid    customer_id FK
    text    sale_channel
    text    status
    date    delivery_date
    text    notes
    uuid    created_by FK
  }
  order_items {
    uuid    id PK
    uuid    order_id FK
    uuid    species_id FK
    uuid    container_id FK
    int     quantity
    numeric unit_price
  }
  parties {}
  species {}
  containers {}
  users {}

  orders  ||--o{ order_items : "compõe-se de"
  parties ||--o{ orders      : "faz"
  users   ||--o{ orders      : "registra"
  species    ||--o{ order_items : "é vendida em"
  containers ||--o{ order_items : "define porte de"
```

**`orders.customer_id` aponta para `cadastro.parties`, e não para uma tabela de clientes.** É a
materialização do cadastro único (RN-52): o cliente é uma pessoa que exerce o papel de cliente, e o
pedido referencia a pessoa. Uma tabela `customers` própria duplicaria nome, telefone e documento de
quem também é fornecedor.

**`unit_price` é digitado, e não referencia tabela de preço** (RN-58). Não há entidade de canal de
venda nem de tabela de preços: `sale_channel` é enumeração em `orders`, porque canal de venda é uma
lista fechada de cinco valores sem atributos próprios (RN-49), e o preço é o que foi acordado na
conversa.

**Não há entidade de disponibilidade.** O saldo que o item exibe (RF-68) é calculado dos lotes
prontos daquela espécie e recipiente, a cada consulta. Guardá-lo no item congelaria uma leitura que
muda a cada perda registrada, e o item passaria a mentir sobre o estoque de hoje.

**Não há histórico de estados do pedido.** `status` percorre `rascunho`, `confirmado` e
`cancelado`, e o que o negócio precisa saber é em qual deles o pedido está. Uma tabela de histórico
existiria para responder quem mudou o quê e quando, pergunta que o viveiro de nove pessoas resolve
perguntando.

---

## 4. Nota de normalização

O modelo está na **terceira forma normal**, com duas exceções deliberadas, ambas de desempenho de
leitura e ambas auditáveis:

| Exceção | Por quê | Como se audita |
|---|---|---|
| `batches.current_quantity` | A tela de ocupação lê o saldo de dezenas de lotes de uma vez, no celular, em rede instável. Somar `batch_movements` a cada leitura tornaria a tela inutilizável no dispositivo em que ela é usada | A soma dos movimentos do lote tem de reproduzir o saldo. Divergência é defeito, e é detectável por consulta |
| `species_popular_names.is_primary` | Evita subconsulta em toda listagem de espécie | Índice único parcial garante um só nome primário por espécie |

**As demais derivações não foram materializadas**, e é a decisão que o modelo mais repete: saldo
disponível, mortalidade, ocupação do canteiro, situação do lote e vencimento da etapa são todos
calculados na leitura. O critério é sempre o mesmo: **o valor guardado envelhece sozinho**. O saldo
do lote é a exceção porque ele só muda quando alguém grava um movimento, e o movimento é a própria
prova.

---

## 5. Observação sobre a origem deste artefato

O modelo não foi desenhado antes da implementação nem extraído dela: as duas coisas andaram juntas.
O que está aqui é o modelo **especificado**, e o §2.1 declara o que dele existe no banco.

A alteração deste documento obriga a três lugares, e o aviso do topo existe porque os três já
divergiram: o dicionário de dados ([`C8`](C8-dicionario-de-dados.md)), as figuras em português
([`modelo-dados-pt`](../modelo-dados-pt/README.md)) e as migrações em `migrations/`.
