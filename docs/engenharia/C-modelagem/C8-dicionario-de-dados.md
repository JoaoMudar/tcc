# C8: Dicionário de dados

> **Artefato:** Dicionário de dados · **Bloco:** C, Modelagem
> **Destino no TCC:** Capítulo 4, seção 4.5 (amostra de duas ou três entidades) e Apêndice (integral)
> **Fundamentação:** Elmasri e Navathe (2011) situam a definição dos tipos de dados, estruturas e
> restrições como primeiro passo da criação de um banco de dados. Este documento é o registro dessa
> definição, entidade por entidade.

> ⚠️ **Alterou este documento? O [`modelo-dados-pt`](../modelo-dados-pt/README.md) muda junto.**
> Ele é o mesmo modelo com tabelas e colunas em português, e é **fonte separada, renderizada à
> mão**: nenhum script o regenera. Entidade, atributo, chave ou cardinalidade que muda aqui muda
> lá, no `.mmd` da figura correspondente, com o `.png` regerado pelo comando do README de lá.

---

## Como ler

Uma tabela por entidade, na mesma ordem de [`C6`](C6-modelo-entidade-relacionamento.md): os
quatro módulos do sistema, com o Acesso à frente por atravessar os quatro.

| Coluna do dicionário | Significado |
|---|---|
| **Atributo** | Nome do campo no banco (inglês, conforme RNF-15) |
| **Tipo** | Tipo de dado e precisão |
| **Ob.** | ● obrigatório · ○ opcional |
| **Chave** | PK primária · FK estrangeira · UK única |
| **Descrição** | Significado em português, no vocabulário do [glossário](../A-fundacao/A2-glossario-dominio.md) |

**Convenções gerais**, aplicadas a todas as entidades e não repetidas em cada tabela:

- `id`: identificador universal, chave primária, gerado pelo próprio banco. A escolha por
  identificador universal em vez de sequencial permite gerar a chave no dispositivo antes da
  gravação, requisito do funcionamento sem conexão (RNF-05).
- `created_at`: momento da criação, preenchido automaticamente.
- `updated_at`: momento da última alteração, mantido automaticamente pelo banco, por gatilho.
- `active`: indicador de arquivamento. Registro inativo desaparece das listagens sem ser removido,
  preservando a integridade das referências históricas.
- **As três são convenção, e não obrigação**, e a tabela que foge dela declara o atributo (ou a
  ausência dele) na sua própria linha. Quem só registra fato consumado não tem `updated_at`, porque
  não se altera: é o caso de `sessions`, `login_events`, `batch_movements` e
  `species_popular_names`. As duas tabelas de ligação, `cadastro.party_roles` e
  `assignment_members`, também não têm `id`: a chave é o par que as define, e é ela que impede a
  linha repetida. E `active` só existe onde há catálogo a arquivar.
- Nome de entidade fora do esquema `public` vem qualificado (`cadastro.parties`), na coluna Chave inclusive.
- A marca *Especificada, não implementada no protótipo* abaixo do título indica entidade que
  pertence ao modelo mas ainda não existe no banco; em entidade já existente, a mesma condição
  aparece como **Especificado, não implementado** na descrição do atributo.

---

## Recorte implementado

Este dicionário descreve o **modelo especificado**, que é maior que o protótipo construído. Das 27
entidades, **23 existem no banco** (mais a visão `batch_health`) e **4 estão especificadas e ainda
não implementadas** (mais a visão `batch_protocol_due`). A distinção é registrada entidade por
entidade, e não é defeito de modelagem: o modelo responde à especificação completa de requisitos, e
a construção segue a priorização declarada em
[`B2`](../B-requisitos/B2-especificacao-requisitos.md).

| Área | No banco | Só especificadas |
|---|---:|---:|
| *(transversal)* Acesso e configurações | 4 | 0 |
| 1 · Cadastro único | 12 | 3 |
| 2 · Produção | 5 | 1 |
| 3 · Comercial | 2 | 0 |
| **Total** | **23** | **4** |

As 3 do Cadastro único são as do **protocolo de atividades**: `protocols`, `protocol_steps` e
`species_protocol_overrides`. A 1 da Produção é
`batch_protocol_steps`, o percurso de cada lote pelo protocolo, mais a visão
`batch_protocol_due`.

> **O protocolo é cadastro, e não produção.** É mantido uma vez e consultado sempre, como
> `task_types` e `work_shifts`, e por isso mora na área 1 ainda que só a Produção o consuma. O que
> a Produção guarda é o **movimento**: por onde cada lote já passou.

**O protocolo foi especificado inteiro antes de qualquer migration, e por escolha.** Ele envolve um
motor de geração automática de ordens: a regra de contagem a partir da execução real (RN-34) e a
de uma ocorrência em aberto por vez (RN-35) atravessam tabela, visão e Server Action, e modelar
depois de construir custaria reescrevê-las em três lugares.

**Um atributo de entidade já existente está na mesma condição**: `batches.protocol_id`, que só passa
a ser preenchido quando `protocols` existir. Enquanto isso, o lote é criado sem protocolo e não
cobra etapa nenhuma, que é o comportamento descrito em [`C2`](C2-especificacao-casos-de-uso.md)
UC-22 FA-2.

---

# Acesso e configurações: transversal às três áreas

## `users`: usuário do sistema

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `username` | text | ● | UK | Identificador de acesso, único |
| `display_name` | text | ● | | Nome exibido na interface |
| `password_hash` | text | ● | | Resumo criptográfico da senha. **A senha em si nunca é armazenada** (RNF-08) |
| `role` | enum | ● | | Perfil de acesso: `admin`, `chefia`, `gerencia`. **Não há perfil de campo**: os colaboradores não operam o sistema ([`A1` §5](../A-fundacao/A1-documento-de-visao.md)) |
| `must_change_password` | boolean | ● | | Obriga a definir senha própria no próximo acesso (RF-02) |
| `active` | boolean | ● | | Usuário habilitado |
| `failed_login_attempts` | integer | ● | | Tentativas malsucedidas consecutivas |
| `locked_until` | timestamptz | ○ | | Bloqueio temporário após tentativas sucessivas |
| `party_id` | uuid | ○ | FK → `cadastro.parties` | Pessoa do cadastro a que esta credencial pertence. **Opcional:** há funcionário sem login (seis dos nove) e administrador sem vínculo |

## `sessions`: sessão ativa

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `user_id` | uuid | ● | FK → `users` | Usuário da sessão |
| `token_hash` | text | ● | UK | Resumo do identificador de sessão. O valor original só existe no dispositivo (RNF-09) |
| `expires_at` | timestamptz | ● | | Expiração |
| `last_seen_at` | timestamptz | ● | | Último uso, para ordenar a lista de sessões |
| `ip` | text | ○ | | Endereço de origem, para identificar o aparelho |
| `user_agent` | text | ○ | | Descrição do dispositivo e navegador |

## `login_events`: auditoria de acesso

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `user_id` | uuid | ○ | FK → `users` | Usuário, quando o identificador informado existe |
| `username_attempted` | text | ● | | Identificador tentado. **Texto e não referência**, porque a tentativa contra usuário inexistente também precisa ser registrada |
| `success` | boolean | ● | | Resultado da tentativa |
| `ip` | text | ○ | | Endereço de origem |
| `user_agent` | text | ○ | | Dispositivo e navegador |

## `settings`: parâmetro do sistema

Parâmetro escalar em chave e valor tipado. Existe para tirar do código e da variável de ambiente
o que **é regra de negócio e não infraestrutura**: quem decide o limiar de mortalidade, as
coordenadas do viveiro ou a margem mínima de revenda é a chefia, e hoje mudar qualquer um deles
exige uma implantação.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `key` | text | ● | UK | Chave estável do parâmetro, em minúsculas com ponto: `producao.mortalidade_limite_pct` |
| `value` | text | ● | | Valor, sempre em texto |
| `value_type` | text | ● | | Tipo em **lista fechada**: `texto`, `numero`, `booleano`, `data`. Diz como interpretar `value` |
| `description` | text | ● | | O que o parâmetro governa, em português, para a tela de configurações |
| `updated_at` | timestamptz | ● | | Momento da última alteração |
| `updated_by` | uuid | ○ | FK → `users` | Quem alterou |

> **Onde está a fronteira entre `settings` e cadastro.** Parâmetro que é **um valor** mora aqui.
> Parâmetro que é **uma lista de coisas com atributos** vira entidade: é o caso do período de
> trabalho, que virou `work_shifts` na área 1 em vez de quatro chaves aqui. A regra de corte é a dos Cadastros: se apagar deixa um movimento
> passado sem sentido, é entidade.

> **`value` é texto e `value_type` diz como lê-lo.** A alternativa, uma coluna por tipo, deixaria
> três nulas em toda linha. O tipo declarado é o que permite a tela de configurações apresentar o
> campo certo e validar antes de gravar.

> **Duas chaves novas com o protocolo de atividades, ainda não implementadas:**
> `producao.protocolo_janela_aviso_pct` (padrão 20), o percentual final do intervalo em que a etapa
> passa a avisar (RN-37), e `producao.protocolo_horizonte_dias` (padrão 14), até quantos dias à
> frente o motor materializa ordens na agenda. **O horizonte é parâmetro, e não constante**, pela
> mesma razão dos demais: emitir um ano de limpezas trimestrais encheria a grade de tarefas que
> ninguém olha por nove meses, e o número certo muda com a estação.

# Área 1 · Cadastro único

## `species`: espécie *(entidade central)*

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `scientific_name` | text | ● | UK | Nome científico binomial, exigido em projetos de compensação ambiental (RNF-23). **É a identidade da espécie**, e por isso é único e obrigatório |
| `tags` | text[] | ● | | Características da espécie: nativa, exótica, frutífera, ornamental, madeireira, forrageira. **Múltiplas por espécie** |
| `notes` | text | ○ | | Observações de manejo |
| `photo_url` | text | ○ | | Referência da fotografia, no formato `/api/fotos/<uuid>`, que aponta para `species_photos` |
| `active` | boolean | ● | | Espécie em catálogo |

> **Não há coluna de nome popular aqui, e é o que RN-02 exige.** A mesma espécie é chamada por
> nomes diferentes conforme a região e o interlocutor, de modo que o nome popular é lista e não
> campo: mora em `species_popular_names`, e o principal é o que tiver `is_primary`. Uma coluna
> `common_name` obrigaria a eleger um nome no cadastro e faria a busca por qualquer um dos outros
> deixar de encontrar a espécie, que é justamente o que RF-10 pede.

> **O tempo de ciclo saiu da espécie.** `germination_time_days` e `growth_time_months` existiam
> para calcular a previsão de disponibilidade do lote, que ficou fora do escopo. O que restou de
> tempo por espécie é a customização de etapa do protocolo (`species_protocol_overrides`), que é
> mais precisa e tem uso: ela diz em quantos dias **aquela** etapa vence naquela espécie, em vez de
> um número único para o ciclo inteiro.

## `species_popular_names`: nome popular adicional

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `species_id` | uuid | ● | FK → `species` | Espécie designada |
| `name` | text | ● | UK | Nome tal como escrito. Único **dentro da espécie**, pelo par `(species_id, name)` |
| `is_primary` | boolean | ● | | Nome principal da espécie. Índice único parcial: **no máximo um principal por espécie** |
| `created_at` | timestamptz | ● | | Criação |

> **A unicidade é por espécie, e não global.** Duas espécies podem legitimamente compartilhar um
> nome popular no Alto Vale, e proibir isso obrigaria a inventar um desempate na hora do cadastro.
> A busca de RF-10 devolve as duas, e quem cadastra escolhe.

## `species_photos`: fotografia da espécie

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador, e também o que aparece na URL `/api/fotos/<uuid>` |
| `content` | bytea | ● | | Conteúdo binário da imagem |
| `content_type` | text | ● | | Tipo do arquivo, `image/webp` por padrão |
| `created_at` | timestamptz | ● | | Criação |

> **Sem `species_id`, por decisão de projeto.** O envio da foto acontece antes da inserção da
> espécie, então a chave estrangeira não teria a que apontar no momento da gravação. A referência
> fica em `species.photo_url`. A imagem é guardada no banco e não em disco porque o sistema de
> arquivos da plataforma de publicação é somente leitura e descartado a cada implantação: em disco,
> a foto se perderia. Ver [`C6 §3.2`](C6-modelo-entidade-relacionamento.md).

## `containers`: recipiente

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `name` | text | ● | UK | Designação: tubete, 10x18, 17x22, 20x26, 28x32, balde |
| `volume_liters` | numeric(6,3) | ○ | | Volume do recipiente |
| `active` | boolean | ● | | Em uso |

> **O protocolo pendura-se aqui.** É o recipiente que determina o manejo (RN-32), e é dele que
> `protocols` sai. A entidade intermediária `container_types`, que agrupava os quatro sacos num tipo
> só, foi descartada: com seis recipientes no catálogo, ela custava uma tabela e uma tela para
> poupar a repetição de três protocolos.

## `inputs`: insumo

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `name` | text | ● | | Designação comercial |
| `category` | enum | ● | | `substrato`, `adubo`, `defensivo`, `recipiente`, `outros` |
| `unit_of_measure` | text | ● | | Unidade de medida: kg, L, saco, unidade |
| `active` | boolean | ● | | Em uso |

> **O insumo é catálogo, e nada o consome.** O custo por unidade, o histórico de preço, o saldo em
> estoque e o consumo por tarefa saíram com o custeio. O que resta é a lista do que o viveiro
> aplica na produção, com unidade e categoria: é o que permite que a tarefa passe a referenciá-lo
> quando o consumo voltar ao escopo, sem que o catálogo precise ser refeito.

## `cadastro.parties`: identidade

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `kind` | `cadastro.party_kind` | ● | | **Natureza da pessoa**: `pf` ou `pj` (RN-45) |
| `document` | text | ○ | UK | CPF ou CNPJ, só dígitos (RF-17). Opcional porque o cadastro rápido do pedido pede só nome e telefone (RN-46); a unicidade não impede várias identidades sem documento, porque nulos não colidem entre si |
| `name` | text | ● | | Nome usual: o que aparece nas listas |
| `phone` | text | ○ | | Telefone, e é por ele que a negociação começa |
| `email` | text | ○ | | Correio eletrônico |
| `notes` | text | ○ | | Observações |
| `active` | boolean | ● | | Papel ativo; inativar preserva o histórico que excluir apagaria |

> **Razão social e nome fantasia não são colunas.** O conjunto fiscal que RNF-22 exige é o do
> emissor externo, e o que ele pede desta base é nome, documento e endereço. Guardar aqui campos
> que só a nota usa duplicaria o cadastro do sistema fiscal sem que nada neste sistema os lesse.

> **Não há coluna de WhatsApp.** A negociação acontece por WhatsApp e o pedido é registrado depois,
> à mão: não há integração, e um segundo número de telefone só se justificaria se algo aqui
> discasse para ele.

> **Correção de 11/08/2026.** Este dicionário descrevia `kind` como *natureza do vínculo*
> (cliente, fornecedor, funcionário). Estava errado: um `kind` único não representa o caso que
> motivou a tabela, a mesma pessoa que vende muda e também compra. O vínculo passou para
> `party_roles`, que admite N papéis por identidade; `kind` ficou com a natureza da pessoa.
> Fonte canônica: [`docs/rotinas/1-cadastros/01-cadastro-unico.md`](../../rotinas/1-cadastros/01-cadastro-unico.md).

## `cadastro.party_roles`: papéis da identidade

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `party_id` | uuid | ● | PK, FK → `cadastro.parties` | Identidade |
| `role` | `cadastro.party_role_kind` | ● | PK | `cliente`, `fornecedor`, `funcionario` |
| `employment_kind` | text | ○ | | `fixo` ou `diarista`, e só quando `role` é `funcionario` |
| `active` | boolean | ● | | Papel ativo |
| `created_at` | timestamptz | ● | | Criação |

> **A tabela não tem `id` nem `updated_at`.** A chave é o par `(party_id, role)`, o que impõe pela
> estrutura que uma pessoa exerça cada papel no máximo uma vez (RN-47).

> `funcionario` aqui é **vínculo empregatício**, e não nível de acesso. O nível de acesso é
> `users.role`, cujos valores são `admin`, `chefia` e `gerencia`. A ambiguidade que existia entre as
> duas palavras deixou de existir com a saída do perfil de campo: `users.role` não tem, e não terá
> enquanto essa decisão valer, o valor `colaborador` ([`D4`](../D-arquitetura/D4-matriz-rbac.md) §1).

## `cadastro.addresses`: endereços da identidade

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `party_id` | uuid | ● | FK → `cadastro.parties` | Identidade |
| `kind` | `cadastro.address_kind` | ● | | `entrega`, `cobranca` ou `residencial` |
| `street` | text | ○ | | Logradouro e número |
| `city` | text | ○ | | Município |
| `state` | char(2) | ○ | | Unidade federativa |
| `zip` | text | ○ | | CEP |
| `created_at`, `updated_at` | timestamptz | ● | | Criação e alteração |

> **A entidade existe porque uma pessoa tem mais de um endereço, e o de entrega pode não ser o de
> cobrança** (RN-51). É `kind` que os distingue, e a tabela não impõe endereço único por tipo: a
> mesma identidade pode ter dois endereços de entrega, o que o viveiro pratica.

## `task_types`: tipo de tarefa

Vocabulário fechado da agenda e do encerramento (RF-21). **É o catálogo que comanda o
formulário**: um nome e quatro booleanos, e cada booleano decide um campo que a tela pede ou
deixa de pedir (RF-21).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `name` | text | ● | UK | Nome da atividade: colher semente, encher saquinho, repicar, limpar mato, separar mudas |
| `category` | text | ● | | Categoria em **lista fechada**: `semente`, `terra`, `plantio`, `manutencao`, `pos_morte`, `expedicao` (RN-23). **Classifica, não comanda formulário** |
| `is_quantitative` | boolean | ● | | "É quantitativa por unidade": quando verdadeiro, o encerramento pede quanto **cada participante** fez (RN-24) |
| `requires_batch` | boolean | ● | | "Lote específico": quando verdadeiro, o encerramento exige o lote, e com ele o canteiro, a espécie e o recipiente (RN-25) |
| `requires_species` | boolean | ● | | Quando verdadeiro, a atribuição e o encerramento exigem espécie. Tarefa com lote a herda dele |
| `requires_container` | boolean | ● | | Quando verdadeiro, exigem recipiente. Tarefa com lote o herda dele |
| `active` | boolean | ● | | Tipo em uso. Inativar é o que retira a tarefa da lista da agenda; excluir deixaria sem sentido toda atribuição passada |

> **Nenhuma tarefa mede tempo, e é decisão.** A agenda registra o turno, e não a hora (RN-12):
> apontamento por relógio seria controle de ponto, e está fora do escopo. `is_quantitative` diz
> apenas se se conta **quanto** foi feito, e a pergunta do viveiro passou a ser "quantos fez no
> turno".

> **A contagem é por pessoa, e não da tarefa** (RN-24). Quatro pessoas enchendo saquinho gravam
> quatro números em `assignment_members.quantity_done`, e não um total dividido por quatro. A
> confirmação do grupo (RF-29) é o gesto que preenche as quatro de uma vez.

> **`measurement_type`, `avg_minutes_per_unit` e `unit_of_measure` não chegaram ao banco.** O
> primeiro tinha três valores (`tempo`, `saco`, `tubete`) para uma pergunta de dois estados: o
> recipiente já vem do lote e do próprio nome da tarefa, e alguém acabaria escrevendo a condição
> para `'saco'` esquecendo `'tubete'`. O segundo nunca teve fonte, porque ninguém cronometrou tempo
> por unidade, e coluna sem fonte fica nula para sempre até que alguém a confunda com dado real. O
> terceiro era texto livre ("muda", "bandeja", "metro") e não decidia comportamento algum.

**Carga inicial: as 15 tarefas do viveiro.** O catálogo nasce preenchido, e não vazio, porque tipo
de tarefa digitado por quem monta a agenda produziria "limpar mato", "limpeza de mato" e "capina"
como três tarefas distintas, e a contagem por tarefa deixaria de existir.

| Categoria | Tarefas | Quantitativa | Lote específico |
|---|---|:--:|:--:|
| `semente` | Colher semente · Beneficiar semente | **sim** | não |
| `terra` | Peneirar terra | não | não |
| `terra` | Encher saquinho · Encher bandeja | **sim** | não |
| `plantio` | Semear · Repicar | **sim** | **sim** |
| `manutencao` | Irrigar · Adubar · Capinar · Limpar canteiro · Rustificar | não | **sim** |
| `pos_morte` | Classificar | **sim** | **sim** |
| `expedicao` | Separar para entrega | **sim** | **sim** |
| `expedicao` | Carregar caminhão | não | não |

**Oito das 15 são quantitativas**, e as duas de semente são as únicas que exigem espécie sem exigir
lote: colhe-se e beneficia-se semente de uma espécie antes de existir leva. Encher saquinho e
encher bandeja exigem recipiente pelo mesmo motivo invertido: contam recipiente, e não muda.

> **Semear já exige lote, e é o ponto em que a leva ganha identidade.** A semeadura é o primeiro
> movimento que soma ao estoque (RN-16), e um lote sem semeadura não teria quantidade inicial de
> onde sair. Por isso `Semear` é `plantio` e não `semente`: a categoria `semente` cobre o que se faz
> **antes** de existir lote, colher e beneficiar.

> **`Classificar` é `pos_morte` porque produz perda no mesmo gesto** (RN-28). Separar as vivas das
> mortas é o momento em que a parte morta vira movimento de `perda` do lote, e classificá-la como
> manutenção esconderia justamente a etapa que mais mata.

## `areas`: área do viveiro

Divisão física do viveiro, identificada por letra. É a primeira metade do endereço de uma muda
(RN-17).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `letter` | char(1) | ● | UK | Letra da área: A, B, C. Única, e o banco exige maiúscula |
| `name` | text | ○ | | Nome pelo qual a equipe se refere a ela, quando houver |

## `beds`: canteiro

Subdivisão da área, numerada dentro dela. É a segunda metade do endereço, e o que a tarefa de campo
pede para ser executada.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `area_id` | uuid | ● | FK → `areas` | Área a que pertence |
| `number` | integer | ● | | Número dentro da área. Restrição: maior que zero |
| `capacity` | integer | ○ | | Quantas mudas o canteiro comporta; serve de aviso ao criar lote, não de trava |

**Restrição de unicidade:** número de canteiro único dentro da área.

> **A unicidade é do par (`area_id`, `number`), não do número sozinho.** A numeração recomeça em
> cada área: existe o canteiro 4 da área A e o canteiro 4 da área B, e são dois lugares diferentes.
> É o vocabulário que a equipe já usa apontando com o dedo.

> `capacity` não trava a criação de lote de propósito. O viveiro sabe apertar mais do que a conta
> quando precisa, e uma trava aqui faria a gerência registrar o lote no canteiro errado para
> conseguir registrá-lo.

## `work_shifts`: turno de trabalho

O **período de trabalho** (RF-08). Existe para tirar de dentro do código o número que a RN-12
trazia no próprio enunciado: um turno valia quatro horas por convenção, e convenção que muda com a
estação e com a combinação da equipe é dado, não constante (RN-27).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `name` | text | ● | UK | Nome do turno: `manha`, `tarde` |
| `starts_at` | time | ● | | Hora de início |
| `ends_at` | time | ● | | Hora de término. Restrição: posterior a `starts_at` |
| `active` | boolean | ● | | Turno em uso |

**Carga inicial:** `manha` das 07:30 às 11:30, `tarde` das 13:00 às 17:00.

> **A duração do turno é derivada**, `ends_at` menos `starts_at`, e não campo. Guardá-la permitiria
> que ela divergisse dos horários que a própria linha declara.

> **`name` é a chave de negócio, e não há coluna de código separada.** São dois turnos, e a agenda
> os referencia por `shift_id`: um segundo identificador estável só teria uso se o nome fosse
> editável a ponto de deixar de identificar o turno, o que não é o caso com dois valores fixos.

> **O horário existe, e o registro do trabalho não o usa.** A agenda escala por dia e turno, nunca
> por hora (RN-12): `starts_at` e `ends_at` dizem quando o turno começa e termina para quem lê a
> grade, e não são comparados com relógio nenhum. Apontamento de entrada e saída é controle de
> ponto, e está fora do escopo.

## `protocols`: protocolo de atividades

**Especificada, não implementada.**

A receita de manejo de um recipiente: a sequência de etapas que todo lote daquele recipiente passa
a seguir sozinho (RF-22).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `container_id` | uuid | ● | FK → `containers` | Recipiente que o protocolo rege (RN-32) |
| `name` | text | ● | | Designação: "Protocolo do tubete" |
| `active` | boolean | ● | | Vigente. Restrição: **um vigente por recipiente**, por índice único parcial |
| `notes` | text | ○ | | Observação |
| `created_by` | uuid | ● | FK → `users` | Quem montou |

> **O protocolo não é versionado, e a edição não retroage** (RN-39). Vale um vigente por tipo, e
> a alteração é lida apenas na próxima geração de ordens: ordem já emitida e dia já trabalhado
> permanecem como estão, pela mesma razão da RN-43. Versionar exigiria fotografar a árvore de
> etapas dentro de cada lote, e o viveiro muda o protocolo raramente. **A suposição está declarada
> aqui de propósito**, porque é a que mais custaria reverter depois.

> **`batches.protocol_id` fotografa o protocolo na criação**, em vez de o lote consultá-lo a cada
> leitura. Sem isso, trocar o recipiente de um lote trocaria a receita dele no
> meio do caminho, e as datas já cumpridas passariam a pertencer a um protocolo que ele nunca
> seguiu.

## `protocol_steps`: etapa do protocolo

**Especificada, não implementada.**

Uma linha da receita. Aponta para uma tarefa do catálogo e declara **quando** ela ocorre (RF-22,
RF-23). É a entidade que carrega a lógica do módulo inteiro.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `protocol_id` | uuid | ● | FK → `protocols` | Protocolo a que pertence |
| `task_type_id` | uuid | ● | FK → `task_types` | Tarefa do catálogo que a etapa manda executar |
| `label` | text | ● | | Rótulo da etapa: "Classificar, pós-germinação" |
| `sort_order` | integer | ● | | Ordem de leitura. Restrição: única dentro do protocolo |
| `schedule_type` | text | ● | | **Lista fechada**: `sequencial` ou `recorrente` (RN-36) |
| `anchor_type` | text | ● | | **Lista fechada**: `criacao_do_lote` ou `conclusao_de_etapa` (RN-33) |
| `anchor_step_id` | uuid | ○ | FK → `protocol_steps` | Etapa cuja conclusão inicia a contagem. Obrigatória quando `anchor_type` é `conclusao_de_etapa`, nula no outro caso. Restrição: diferente da própria etapa |
| `offset_days` | integer | ● | | Dias entre a âncora e a primeira ocorrência, que é também a única quando sequencial. Restrição: não negativo |
| `interval_days` | integer | ○ | | Só recorrente: dias entre uma ocorrência e a seguinte, contados da **execução real** (RN-34). Restrição: maior que zero quando preenchido, nulo quando sequencial |
| `shift_id` | uuid | ● | FK → `work_shifts` | Turno que a ordem gerada herda |
| `alert_enabled` | boolean | ● | | Liga a regra de atraso. Falso nas rotinas diárias (RN-37) |
| `warning_pct` | numeric(5,2) | ○ | | Janela de aviso própria, em percentual do intervalo. **Nula = usa `producao.protocolo_janela_aviso_pct`** (RN-37). Restrição: entre 0 e 100 |
| `resulting_stage` | text | ○ | | Só sequencial: a fase que a conclusão grava em `batches.stage`, na mesma lista fechada de lá. Nula = não altera a fase (RN-36) |
| `active` | boolean | ● | | Etapa em uso |

> **A âncora é atributo, e não consequência de `sort_order`.** Derivar "a etapa anterior" da ordem
> da lista faria "Classificar pós-germinação" contar da criação do lote, e a semente pode ficar
> dias esperando plantio antes de germinar: mandaria classificar muda que ainda não nasceu (RN-33).
> A etapa âncora não precisa ser a imediatamente anterior, e é justamente esse o caso que a coluna
> existe para representar.

> **O ciclo na cadeia de âncoras não cabe em restrição declarativa.** A etapa A ancorando em B e B
> ancorando em A é estruturalmente representável, e a única barreira contra ela é a validação da
> aplicação, com teste dedicado. **Limite conhecido, declarado aqui em vez de descoberto em
> produção.**

> **`shift_id` é obrigatório porque `assignments.shift_id` é `NOT NULL`**, e a ordem gerada
> precisa de um. A pergunta que resolve
> ("esta etapa é de manhã ou de tarde?") a gerência responde sem pensar, e derivá-la de qualquer
> outra coisa obrigaria a escolher entre errar e recusar.

> **A mesma tarefa aparece duas vezes no protocolo, e por isso existe `label`.** "Classificar
> pós-germinação" e "Classificar seleção" são duas etapas com propósitos distintos, e o catálogo já
> as separa desde 24/08/2026. `label` é o que permite ao protocolo distinguir duas manifestações da
> mesma tarefa sem inflar o catálogo com entradas quase iguais.

> **A janela de aviso é percentual, e só percentual.** Um override absoluto em dias conviveria com
> o percentual como duas formas de dizer a mesma coisa, e a segunda forma existe para alguém
> preencher as duas e elas discordarem. **Suposição declarada:** aviso fixo em dias não é
> representável, e a alternativa para quem precisar dele é ajustar o percentual da etapa.

## `species_protocol_overrides`: tempo da etapa por espécie

**Especificada, não implementada.**

O que permite a uma espécie de germinação lenta usar setenta dias onde o protocolo diz quarenta,
sem duplicar a receita inteira (RF-25, RN-38).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `species_id` | uuid | ● | PK, FK → `species` | Espécie |
| `step_id` | uuid | ● | PK, FK → `protocol_steps` | Etapa customizada |
| `offset_days` | integer | ○ | | Sobrescreve o da etapa. Nulo = usa o da etapa |
| `interval_days` | integer | ○ | | Sobrescreve o da etapa. Nulo = usa o da etapa |
| `notes` | text | ○ | | Por que esta espécie difere |

> **Restrição: pelo menos um dos dois preenchido.** Linha sem nenhum override é ruído que faz a
> consulta de tempo efetivo passar por um caminho a mais para chegar ao mesmo valor.

> **Não são colunas em `species`.** São 142 espécies contra as etapas de cada protocolo, e a
> maioria não sobrescreve nada: colunas produziriam uma matriz quase toda nula, e cada etapa nova
> exigiria migration em `species`. É a mesma regra de corte que separa `settings` de entidade.


# Área 2 · Produção

## `batches`: lote

**A leva de mudas da mesma espécie, no mesmo recipiente, plantada junta e ocupando um canteiro**
(RN-18). É a entidade que diz *onde* a muda está e *de que leva* ela veio: até 24/08/2026 o modelo
respondia o que a muda era e não onde estava. A revisão de escopo está justificada em
[`A1`](../A-fundacao/A1-documento-de-visao.md) §7.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `code` | text | ● | UK | Código legível, gerado pelo sistema, no formato `AAAA-NNNN`: ano de plantio e sequência de quatro dígitos dentro do ano |
| `species_id` | uuid | ● | FK → `species` | Espécie da leva |
| `container_id` | uuid | ● | FK → `containers` | Recipiente, que define o porte da muda |
| `bed_id` | uuid | ○ | FK → `beds` | Canteiro ocupado. Nulo quando o lote está encerrado |
| `parent_batch_id` | uuid | ○ | FK → `batches` | Lote de origem, quando este nasceu de uma repicagem (RN-20) ou de uma divisão (RN-41) |
| `protocol_id` | uuid | ○ | FK → `protocols` | Protocolo que rege o lote, fotografado na criação a partir do recipiente (RF-46). Nulo quando o recipiente ainda não tem protocolo. **Especificado, não implementado.** |
| `initial_quantity` | integer | ● | | Quantidade que entrou. Restrição: maior que zero |
| `current_quantity` | integer | ● | | Saldo vivo. Restrição de banco: não negativo (RN-21). **Mantido pela aplicação** na mesma transação do movimento |
| `stage` | text | ● | | Fase em **lista fechada**: `semeado`, `germinado`, `repicado`, `crescimento`, `rustificacao`, `pronto`, `encerrado` |
| `planted_at` | date | ● | | Data em que a leva foi plantada e passou a ocupar o canteiro. É a âncora das etapas do protocolo que contam da criação do lote (RN-33) |
| `closed_at` | timestamptz | ○ | | Momento do encerramento; a partir dele o lote sai da ocupação |
| `closed_reason` | text | ○ | | Motivo do encerramento em **lista fechada**: `saldo_zero`, `expedido`, `dividido`. Preenchido se e somente se `closed_at` o estiver (RN-40) |
| `position` | integer | ○ | | Ordem do lote dentro do canteiro, a partir de 1. Dá ao mapa um desenho estável (RF-44) |
| `notes` | text | ○ | | Observação |

> **O endereço fica fora do código** (`2026-0147`, e não `2026-A3-004`). O canteiro do lote muda:
> `batch_movements` tem o tipo `transferencia`, e o encerramento anula `bed_id`. Código com área e
> canteiro dentro passaria a mentir na primeira transferência, e a correção seria renomear o lote,
> invalidando toda referência anterior a ele. Quem responde **onde** o lote está é o par
> `bed_id` e `position`; o código responde **qual leva** é, e por isso não muda nunca.

> **Um lote ocupa um canteiro, e um canteiro comporta vários lotes** (RN-19, emendada em
> 26/08/2026). A metade que continua de pé é a que interessa: leva que não cabe em um canteiro é
> outro lote, e não o mesmo lote espalhado. A alternativa, uma entidade de ocupação com quantidade
> por canteiro, custaria um nível de indireção em toda tela que pede lote, para representar o que
> dois lotes já representam.
>
> **O que caiu foi a exclusividade**, e com ela o índice `batches_um_lote_aberto_por_canteiro`. Ela
> nunca existiu no viveiro: o canteiro recebe seis, oito, nove levas, e é o que o mapa de produção
> desenha. O índice proibia exatamente o que a operação faz todo dia, e quem revelou isso foi o
> protótipo da tela, não o banco.

> **`position` é ordem, não coordenada.** Conta da esquerda para a direita, como a equipe lê o
> canteiro de pé na frente dele. Sem ela os lotes trocariam de lugar no mapa a cada carregamento, e
> quem opera perderia a referência espacial que a tela existe para dar: reconhece-se o lote pelo
> lugar antes de ler o rótulo. **É nula quando a ordem não foi cuidada**, e o índice
> `batches_posicao_unica_no_canteiro` é parcial nos dois eixos por isso: exigir posição faria a
> gerência inventar um número só para conseguir registrar o lote, e número inventado desenha o mapa
> errado.

> **`bed_id` é opcional apenas para o lote encerrado.** Enquanto aberto, todo lote tem canteiro:
> lote sem lugar é a situação que a entidade existe para eliminar. Ao encerrar, o canteiro é
> liberado para o próximo (RN-22), e o histórico do lote permanece consultável pelos movimentos.

> **`current_quantity` é a única quantidade materializada do modelo, e a exceção é declarada.** O
> saldo poderia ser somado de `batch_movements` a cada leitura, como o estoque de espécie faz. Aqui
> não: a tela de ocupação lê o saldo de todos os lotes abertos de uma vez, no celular, em rede
> instável. **Quem o mantém é a aplicação**, na mesma transação que grava o movimento, e não um
> gatilho: a migration cria a restrição de não negativo e deixa a atualização com quem já está
> dentro da transação. `batch_movements` é a fonte que o audita, e divergência entre os dois é
> defeito detectável, não ambiguidade de modelo.

> **`parent_batch_id` é o que a repicagem produz.** A muda que passa do tubete para o saco mudou de
> recipiente, e recipiente define produto, custo e preço: comercialmente, virou outra coisa. Por
> isso a repicagem não move o lote, baixa parte do de origem e cria um novo apontando para ele.
> Percorrer a cadeia responde **de cada mil sementes semeadas, quantas mudas chegaram à venda**,
> que é a pergunta que o viveiro nunca pôde responder.

## `batch_movements`: movimento de lote

O razão que explica o saldo do lote. Toda alteração de `batches.current_quantity` tem uma linha
aqui, com motivo e origem.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `batch_id` | uuid | ● | FK → `batches` | Lote movimentado |
| `movement_type` | text | ● | | Motivo em **lista fechada**: `entrada`, `perda`, `repicagem_saida`, `repicagem_entrada`, `venda`, `ajuste_contagem`, `transferencia`, `divisao_saida`, `divisao_entrada`. Os dois últimos são **especificados, não implementados** (RN-41) |
| `quantity` | integer | ● | | Quantidade movimentada, com sinal: positiva na entrada, negativa na saída |
| `movement_date` | date | ● | | Data do movimento |
| `from_bed_id` | uuid | ○ | FK → `beds` | Canteiro de origem, só em `transferencia` |
| `to_bed_id` | uuid | ○ | FK → `beds` | Canteiro de destino, só em `transferencia` |
| `loss_cause` | text | ○ | | Causa em **lista fechada**: `seca`, `praga`, `geada`, `manuseio`, `outro` (RN-10). Existe se e somente se `movement_type` for `perda` |
| `assignment_id` | uuid | ○ | FK → `assignments` | Atribuição que o originou, quando veio de uma tarefa confirmada |
| `recorded_by` | uuid | ● | FK → `users` | Quem registrou (RN-54) |
| `notes` | text | ○ | | Observação |

> **A origem é uma só, e é opcional.** `assignment_id` liga o movimento à tarefa que o causou.
> Movimento sem origem é o ajuste manual da gerência, que existe e precisa caber: prendê-lo a uma
> origem obrigatória faria a correção de um erro de digitação ser impossível sem inventar uma perda
> que não houve.

> **Perda, contagem e venda não são entidades: são valores de `movement_type`.** Uma tabela própria
> de perda obrigaria a gravar duas linhas por perda, uma nela e outra aqui, e a divergir no dia em
> que alguém gravasse só uma. É a mesma decisão que faz de `loss_cause` uma coluna deste razão, e
> não de uma entidade `loss_events`.

> **A repicagem grava dois movimentos**, `repicagem_saida` no lote de origem e `repicagem_entrada`
> no de destino, e a diferença entre eles, quando houver, é uma `perda` no lote de origem (RN-28).
> A soma "repicadas mais perdidas" tem de igualar a quantidade que saiu: sem isso a diferença
> viraria evaporação silenciosa, e a mortalidade ficaria subestimada exatamente na etapa que mais
> mata.

> **`transferencia` muda o canteiro sem mudar o lote.** É o caso em que a mesma leva é remanejada
> de lugar sem trocar de recipiente, e por isso não gera lote filho: quem muda é o endereço, não a
> identidade. `quantity` é zero nesse movimento, e `from_bed_id` e `to_bed_id` carregam o que
> mudou.

## `assignment_members`: participante da tarefa

Quem foi escalado numa atribuição. Existe porque uma tarefa admite vários executores, e o mesmo
turno admite duas tarefas com grupos diferentes (RN-26).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `assignment_id` | uuid | ● | PK, FK → `assignments` | Atribuição |
| `party_id` | uuid | ● | PK, FK → `cadastro.parties` | Funcionário escalado |
| `quantity_done` | integer | ○ | | Quantidade que **esta pessoa** realizou, pedida na confirmação quando o tipo de tarefa for quantitativo (RF-29, RN-24). Nula enquanto a tarefa não for confirmada |
| `created_at` | timestamptz | ● | | Criação |

> **A tabela não tem `id` nem `updated_at`.** A chave é o par `(assignment_id, party_id)`, o que
> impede pela estrutura escalar a mesma pessoa duas vezes na mesma tarefa.

> **`assignments` perdeu `party_id` para cá.** Com a pessoa dentro da própria atribuição, escalar
> quatro funcionários na mesma tarefa criaria quatro atribuições idênticas, e a tarefa deixaria de
> ser uma coisa só para virar quatro coisas parecidas: metade da equipe enchendo saquinho enquanto
> a outra repica é a norma do viveiro, não a exceção.

> **É aqui que a quantidade realizada mora, e não na atribuição** (RN-24). Quatro pessoas enchendo
> saquinho produzem quatro números, e é assim que o viveiro fala: um total na atribuição obrigaria
> a dividir por quatro na hora de ler, e a divisão seria invenção.

> **A tabela não guarda hora.** A unidade do planejamento é o turno, e não o relógio (RN-12): quem
> sai da tarefa antes do grupo não é registrado em lugar nenhum, porque apontamento de entrada e
> saída é controle de ponto e está fora do escopo.

## `week_plans`: semana de trabalho

A semana é a unidade real de decisão do viveiro (RF-26, RF-28). Fechada, não se altera: sem isso
o custo do período mudaria depois de apurado (RN-13).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `week_start` | date | ● | UK | Segunda-feira da semana; única |
| `status` | text | ● | | `rascunho`, `publicada`, `fechada` |
| `published_by` | uuid | ○ | FK → `users` | Quem publicou a semana para a equipe |
| `closed_at` | timestamptz | ○ | | Momento do fechamento; a partir dele a semana é imutável |

## `assignments`: atribuição de tarefa

A célula da grade: um dia, um turno, um tipo de tarefa e o grupo escalado. **É o planejado e o
confirmado na mesma linha**: `status` é o que distingue os dois, e é o que dispensa uma entidade de
execução separada. A duração do turno vem de `work_shifts` (RN-12, RN-27), e a tarefa que tem hora
marcada declara a sua em `start_time` / `end_time`.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `week_plan_id` | uuid | ● | FK → `week_plans` | Semana a que pertence |
| `work_date` | date | ● | | Dia da tarefa |
| `shift_id` | uuid | ● | FK → `work_shifts` | Turno. Obrigatório mesmo quando há hora: os turnos não cobrem o dia inteiro, e a hora não diz a qual deles a tarefa pertence (RN-12) |
| `start_time` | time | ○ | | Hora de início da tarefa que tem hora marcada, como a irrigação das sete às oito. Nula na maioria das atribuições (RN-12) |
| `end_time` | time | ○ | | Hora de fim, quando há início e se sabe o fim. Fim sem início é recusado pelo `CHECK` |
| `task_type_id` | uuid | ● | FK → `task_types` | Tipo de tarefa |
| `species_id` | uuid | ○ | FK → `species` | Espécie, quando o tipo de tarefa a exigir |
| `container_id` | uuid | ○ | FK → `containers` | Recipiente, quando o tipo de tarefa o exigir |
| `batch_id` | uuid | ○ | FK → `batches` | Lote, quando o tipo de tarefa o exigir (RN-25) |
| `area_id` | uuid | ○ | FK → `areas` | Área da tarefa que não exige lote (RF-30) |
| `bed_id` | uuid | ○ | FK → `beds` | Canteiro da tarefa que não exige lote (RF-30) |
| `planned_quantity` | integer | ○ | | Quantidade planejada, quando aplicável |
| `is_recurring` | boolean | ● | | Marca a atribuição como parte da rotina fixa: ao copiar a semana anterior, ela já vem preenchida (RF-27, RN-31) |
| `batch_protocol_step_id` | uuid | ○ | | Etapa do protocolo daquele lote que gerou esta ordem. Nula = atribuição lançada à mão (RN-43). A coluna existe; **a chave estrangeira não**, porque `batch_protocol_steps` ainda não foi criada |
| `protocol_due_on` | date | ○ | | Vencimento que esta ordem representa, congelado na geração. Distingue-se de `work_date`, que a gerência pode remarcar |
| `status` | text | ● | | `planejada`, `confirmada`, `nao_confirmada`, `cancelada`: a segunda é a que a gerência marca ao registrar que a tarefa foi feita, a terceira é a que o fechamento assume como realizada (RN-14), e a quarta é a ordem que o encerramento do lote invalidou (RN-40) |
| `notes` | text | ○ | | Observação livre; único campo aberto da agenda |

> **`party_id` saiu para `assignment_members`.** Quem executa deixou de ser coluna e virou lista:
> uma tarefa admite vários executores (RN-26). Ver a entidade para o porquê.

> **A ordem do protocolo nasce sem nenhuma linha em `assignment_members`** (RN-43), e é
> intencional. O protocolo responde o que fazer e quando; quem faz continua sendo de quem monta a
> agenda. Enquanto não houver ninguém escalado, ela é pendência do lote, e o fechamento da semana
> **não a assume como realizada** (RN-14): dar por feita uma tarefa que ninguém pegou apagaria
> exatamente o esquecimento que o protocolo existe para denunciar.

> **A recorrência é uma marca, e não uma entidade.** `is_recurring` diz que a atribuição pertence à
> rotina fixa e, por isso, vem preenchida na cópia da semana. Uma tabela de recorrência, com dias
> da semana, hora e vigência, existiria para gerar dias sozinha: neste modelo, o que gera dia
> sozinho é o protocolo, cujo sujeito é o lote e não a equipe.

> **`week_plan_id` é `NOT NULL`, e a ordem gerada precisa de um** (RN-43). O motor usa a semana do
> vencimento e a abre em `rascunho` se ela não existir; se a semana do vencimento estiver
> `fechada`, a ordem entra na semana aberta corrente, porque semana fechada não se altera (RN-13).
> **É por isso que `protocol_due_on` existe ao lado de `work_date`**: sem separar o vencimento do
> dia em que a ordem coube na agenda, empurrá-la para a semana seguinte apagaria o atraso que ela
> existe para denunciar.

> **A ordem do protocolo carrega `batch_id` sempre**, inclusive quando o tipo de tarefa não declara
> lote específico: irrigar *aquele* lote é o que o protocolo mandou. Não conflita com RF-21, que
> rege o que a tela **pede** a quem preenche: campo já respondido pela origem da tarefa não é campo
> a pedir.

> **`shift` deixou de ser texto e virou chave estrangeira.** O par `manha`/`tarde` continua sendo o
> vocabulário, mas a hora de início e de fim mora agora em `work_shifts`, e é dela que sai a
> duração. O valor de quatro horas saiu do enunciado da RN-12 e virou parâmetro (RN-27).

> **`work_date` mais `shift_id` continuam sendo a unidade de planejamento**, e não `started_at`.
> A agenda planeja por turno porque é assim que o viveiro pensa a semana, e pedir horário exato no
> planejamento garantiria agenda não preenchida.

> **Não há hora de início nem de fim, e é decisão de escopo.** A agenda registra o turno, e a
> confirmação registra que a tarefa foi feita e quanto rendeu. Medir a hora de entrada e de saída
> de cada pessoa seria controle de ponto, que está fora do escopo declarado em
> [`A1` §7](../A-fundacao/A1-documento-de-visao.md), e nada no sistema depende desse número.

> **A ordem do protocolo é atribuição comum, e é isso que a torna editável** (RN-43). Ela nasce da
> etapa e guarda de qual, mas dali em diante vive por conta própria: excluir a ordem de uma quarta
> não altera o protocolo nem as ordens dos demais lotes. Um índice único sobre
> `(batch_protocol_step_id, protocol_due_on)` dá a idempotência da geração: sem ele, abrir a agenda
> duas vezes geraria a ordem duas vezes.

## `batch_health`: situação do lote *(não é tabela)*

**Visão.** Devolve, para cada lote aberto, a tarefa pendente mais antiga e a situação que dela
decorre: `saudavel`, `atencao` ou `critico`. É o que pinta o mapa de produção (RF-44 e RF-45).

| Atributo | Origem |
|---|---|
| `batch_id`, `batch_code`, `bed_id`, `position` | `batches`, restrito aos lotes abertos |
| `pending_assignment_id`, `pending_task_type_id`, `pending_task_name` | a atribuição do lote que segue `planejada`, cuja data já passou e que não tem execução concluída |
| `pending_since` | `assignments.work_date` da pendência |
| `days_late` | a data de hoje menos `pending_since`; zero quando não há pendência |
| `health` | `days_late` comparado aos parâmetros `producao.atraso_atencao_dias` e `producao.atraso_critico_dias` de `settings` |

> **É visão e não coluna** (RN-30): situação gravada envelhece sozinha, e o lote marcado como saudável ontem
> continuaria saudável hoje, que é o contrário do que a tela mostra.

> **A mais antiga manda.** Havendo três pendências no mesmo lote, quem determina a cor é a que
> espera há mais tempo, e é ela que aparece ao apontar o lote (RF-45): resolvê-la é a providência
> que o mapa está pedindo.

> **Pendência é o que segue `planejada`, e a condição é positiva de propósito.** Os outros dois
> status saem, cada um pelo seu motivo: `confirmada` é a tarefa que a gerência registrou como feita
> (RF-29), e `nao_confirmada` é a que o fechamento da semana assumiu como feita (RF-31, RN-14). Sem
> a segunda, toda semana fechada deixaria um vermelho permanente atrás de si.
>
> **A primeira versão da visão enumerava pela exclusão** (`status <> 'nao_confirmada'`) e deixava
> `confirmada` passar: o lote ficava colorido por um serviço que foi feito, sem nada na tela
> denunciando o erro. É a razão de a condição ser positiva agora: excluir por lista exige lembrar
> de todos os casos, e um deles escapou.

> **Os limites vêm de `settings`, e não de literal na visão** (RN-27). É o que faz o parâmetro ser
> parâmetro de verdade, e não constante com outro nome. A migration que cria a visão afirma que as
> duas chaves existem: sem elas a subconsulta devolveria nulo e **todo** lote apareceria como
> saudável, que é a falha silenciosa mais cara possível nesta tela.


## `batch_protocol_steps`: acompanhamento do lote na etapa

**Especificada, não implementada.**

Uma linha por par lote e etapa, criada quando o lote nasce. **Guarda fatos, e nunca o vencimento.**

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `batch_id` | uuid | ● | PK, FK → `batches` | Lote acompanhado |
| `step_id` | uuid | ● | PK, FK → `protocol_steps` | Etapa do protocolo |
| `anchor_date` | date | ○ | | Data do evento de referência, já resolvido. **Nula = a âncora ainda não ocorreu**, e a etapa não vence nada |
| `last_done_on` | date | ○ | | Data **real** da última execução. Nula = nunca executada |
| `occurrences` | integer | ● | | Ocorrências concluídas. Começa em zero |
| `completed_at` | timestamptz | ○ | | Só sequencial: quando a etapa se encerrou de vez. Preenchida, a etapa sai da visão de vencimentos |
| `inherited_from_batch_id` | uuid | ○ | FK → `batches` | Lote de origem, quando o estado veio de uma divisão (RN-41) |

> **`next_due_on` não é coluna, e a ausência é a decisão.** O vencimento é função do que já está
> aqui: âncora, última execução e tempo efetivo. Gravá-lo criaria um número que depende da data de
> hoje e que envelhece sozinho, pela mesma razão de `batch_health` não ser tabela (RN-42).

> **`anchor_date` nula é informação, e não dado faltando.** É o estado de "Classificar
> pós-germinação" enquanto o plantio não foi concluído: a etapa existe, está acompanhada, e não
> vence nada. Representa "ainda não germinou", que é diferente de "germinou hoje" e diferente de
> "ninguém preencheu".

> **`last_done_on` é a data da execução, e não a da ordem.** É o que faz a ocorrência seguinte
> contar de quando o serviço foi de fato feito (RN-34). Usar a data planejada devolveria o
> comportamento de calendário fixo que o módulo existe para não ter.

> **Não há entidade de eventos do protocolo, e é decisão declarada.** O razão que explica este
> estado é a própria `assignments`: a ordem sabe a etapa que a gerou, o vencimento que representa e
> a data em que foi confirmada. Uma segunda tabela criaria duas verdades sobre o mesmo fato.
> **Consequência aceita:** marcar uma etapa como feita fora da agenda tem de gerar a atribuição
> correspondente, e não escrever direto aqui.

## `batch_protocol_due`: vencimento e situação da etapa *(não é tabela)*

**Especificada, não implementada.**

**Visão.** Devolve, para cada lote aberto e etapa ativa que ainda vence algo, o próximo vencimento
e a situação que dele decorre (RF-51, RF-52).

| Atributo | Origem |
|---|---|
| `batch_id`, `step_id` | `batch_protocol_steps`, restrito aos lotes abertos e às etapas ativas |
| `occurrence` | `occurrences` mais um: a ocorrência que está por vir |
| `effective_days` | o override da espécie quando existe, senão o valor da etapa; `offset_days` na primeira ocorrência e `interval_days` nas seguintes (RN-38) |
| `next_due_on` | `last_done_on`, ou `anchor_date` quando nunca executada, mais `effective_days` (RN-42) |
| `warning_days` | `effective_days` multiplicado pela janela da etapa, ou pelo parâmetro `producao.protocolo_janela_aviso_pct` quando a etapa não a declara (RN-37) |
| `situacao` | `sem_alerta` quando a etapa tem o alerta desligado; `atraso` quando hoje passou de `next_due_on`; `atencao` quando hoje já entrou na janela; `em_dia` nos demais casos |

> **Linhas sem âncora resolvida e etapas sequenciais já concluídas não aparecem.** Não vencem nada,
> e mantê-las na visão obrigaria toda consulta a filtrá-las de novo.

> **A visão devolve uma linha por etapa, e não uma por lote.** Quem reduz as etapas de um lote a
> uma cor só é `batch_health`, e é lá que "a mais antiga manda" continua valendo.

> **`batch_health` passa a derivar daqui, e é a correção que motivou o módulo** (RN-30 emendada).
> O critério anterior lia o atraso das tarefas **lançadas** em `assignments`, de modo que o lote
> esquecido por completo aparecia como saudável: não havia tarefa atrasada nele porque não havia
> tarefa nenhuma. `atraso` mapeia para `critico`, `atencao` para `atencao`, e o resto para
> `saudavel`: o vocabulário da tela do mapa não muda.

> **Os parâmetros `producao.atraso_atencao_dias` e `atraso_critico_dias` continuam existindo**, e
> passam a reger apenas as atribuições lançadas à mão. Ordem de protocolo usa a janela
> proporcional, porque limite fixo em dias é cedo demais para o trimestral e tarde demais para o
> semanal (RN-37). **Suposição declarada:** os dois critérios convivem, cada um sobre o seu
> conjunto de tarefas.


# Área 3 · Comercial

## `orders`: pedido

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `order_number` | serial | ● | UK | Número sequencial legível, usado na comunicação com o cliente |
| `customer_id` | uuid | ● | FK → `cadastro.parties` | Cliente. Aponta para a **identidade única**, e não para uma tabela de clientes: quem compra e às vezes vende é um cadastro só (RN-47) |
| `sale_channel` | varchar(50) | ● | | Canal de venda, em lista fechada de cinco: `atacado`, `compensacao`, `paisagismo`, `prefeitura`, `varejo` (RN-44) |
| `status` | varchar(30) | ● | | `rascunho`, `confirmado`, `cancelado` (RN-50) |
| `delivery_date` | date | ○ | | Data prevista de entrega |
| `notes` | text | ○ | | Observações |
| `created_by` | uuid | ● | FK → `users` | Autor do registro (RN-54) |

**Restrição:** pedido em `confirmado` ou `cancelado` não admite alteração de item (RF-57).

> **Não há tabela de histórico de estados.** São três situações e o que o negócio precisa saber é
> em qual delas o pedido está. Uma tabela de histórico existiria para responder quem mudou o quê e
> quando, pergunta que um viveiro de nove pessoas resolve perguntando.

> **`sale_channel` é enumeração, e não chave estrangeira.** Canal de venda é lista fechada de cinco
> valores sem atributos próprios: virar entidade só se justificaria se o canal carregasse margem ou
> preço, que é justamente o que saiu do escopo.

## `order_items`: item de pedido

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `order_id` | uuid | ● | FK → `orders` | Pedido |
| `species_id` | uuid | ● | FK → `species` | Espécie |
| `container_id` | uuid | ● | FK → `containers` | Recipiente solicitado |
| `quantity` | integer | ● | | Quantidade pedida. Restrição: maior que zero |
| `unit_price` | numeric(10,2) | ● | | **Preço unitário informado por quem registra** (RF-55, RN-52). Restrição: maior que zero |

> **O preço é digitado, e o sistema não o calcula.** Não há referência a tabela de preço, piso
> mínimo nem margem: o valor é o que foi negociado na conversa com o cliente, e ao sistema cabe
> guardá-lo. O total do item e o do pedido são derivados de `quantity` por `unit_price`, e não
> materializados.

> **Não há coluna de disponibilidade.** O saldo que a tela exibe ao lado do item (RF-56) é somado
> dos lotes prontos daquela espécie e recipiente a cada consulta. Guardá-lo aqui congelaria uma
> leitura que muda a cada perda registrada, e o item passaria a mentir sobre o estoque de hoje. É a
> mesma decisão que fez a situação do lote ser visão e não coluna (RN-30).

## Resumo

| Área | Entidades | Observação |
|---|---:|---|
| *(transversal)* Acesso e configurações | 4 | `users`, `sessions`, `login_events` e `settings`, os parâmetros do sistema |
| 1 · Cadastro único | 15 | catálogo (`species`, `species_popular_names`, `species_photos`, `containers`, `inputs`), endereço do viveiro (`areas`, `beds`), trabalho (`task_types`, `work_shifts`), protocolo (`protocols`, `protocol_steps`, `species_protocol_overrides`) e o esquema `cadastro` (`parties`, `party_roles`, `addresses`) |
| 2 · Produção | 6 | `week_plans`, `assignments`, `assignment_members`, `batches`, `batch_movements`, `batch_protocol_steps` |
| 3 · Comercial | 2 | `orders` e `order_items` |
| **Total** | **27** | mais `batch_health` e `batch_protocol_due`, que são visões e não tabelas |
