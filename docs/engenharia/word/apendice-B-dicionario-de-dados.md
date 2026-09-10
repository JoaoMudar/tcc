# Apêndice B, Dicionário de dados

> Gerado a partir de `C-modelagem/C8-dicionario-de-dados.md`.
> **Não edite este arquivo**: edite o artefato de origem e rode `node scripts/build-word.mjs`.

## Como ler

Uma tabela por entidade, na mesma ordem de [`C6`](C6-modelo-entidade-relacionamento.md): os
quatro módulos do sistema, com o Acesso à frente por atravessar os quatro.

| Coluna do dicionário | Significado |
|---|---|
| **Atributo** | Nome do campo no banco, em português |
| **Tipo** | Tipo de dado e precisão |
| **Ob.** | ● obrigatório · ○ opcional |
| **Chave** | PK primária · FK estrangeira · UK única |
| **Descrição** | Significado em português, no vocabulário do [glossário](../A-fundacao/A2-glossario-dominio.md) |

**Convenções gerais**, aplicadas a todas as entidades e não repetidas em cada tabela:

- `id`: identificador universal, chave primária, gerado pelo próprio banco. A escolha por
  identificador universal em vez de sequencial permite gerar a chave no dispositivo antes da
  gravação, requisito do funcionamento sem conexão (RNF-05).
- `criado_em`: momento da criação, preenchido automaticamente.
- `atualizado_em`: momento da última alteração, mantido automaticamente pelo banco, por gatilho.
- `ativo`: indicador de arquivamento. Registro inativo desaparece das listagens sem ser removido,
  preservando a integridade das referências históricas. Onde a entidade tem nome feminino, a coluna
  acompanha: `especies.ativa` e `cadastro.pessoas.ativa`.
- **As três são convenção, e não obrigação**, e a tabela que foge dela declara o atributo (ou a
  ausência dele) na sua própria linha. Quem só registra fato consumado não tem `atualizado_em`, porque
  não se altera: é o caso de `sessoes`, `eventos_login`, `movimentos_lote` e
  `especies_nomes_populares`. As duas tabelas de ligação, `cadastro.pessoas_papeis` e
  `atribuicoes_participantes`, também não têm `id`: a chave é o par que as define, e é ela que impede a
  linha repetida. E `ativo` só existe onde há catálogo a arquivar.
- Nome de entidade fora do esquema `public` vem qualificado (`cadastro.pessoas`), na coluna Chave inclusive.
- A marca *Especificada, não implementada no protótipo* abaixo do título indica entidade que
  pertence ao modelo mas ainda não existe no banco; em entidade já existente, a mesma condição
  aparece como **Especificado, não implementado** na descrição do atributo.

---

## Recorte implementado

Este dicionário descreve o **modelo especificado**, que é maior que o protótipo construído. Das 27
entidades, **23 existem no banco** (mais a visão `situacao_lote`) e **4 estão especificadas e ainda
não implementadas** (mais a visão `lotes_etapas_vencimento`). A distinção é registrada entidade por
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

As 3 do Cadastro único são as do **protocolo de atividades**: `protocolos`, `protocolos_etapas` e
`especies_protocolos_tempos`. A 1 da Produção é
`lotes_etapas`, o percurso de cada lote pelo protocolo, mais a visão
`lotes_etapas_vencimento`.

> **O protocolo é cadastro, e não produção.** É mantido uma vez e consultado sempre, como
> `tipos_tarefa` e `turnos_trabalho`, e por isso mora na área 1 ainda que só a Produção o consuma. O que
> a Produção guarda é o **movimento**: por onde cada lote já passou.

**O protocolo foi especificado inteiro antes de qualquer migration, e por escolha.** Ele envolve um
motor de geração automática de ordens: a regra de contagem a partir da execução real (RN-34) e a
de uma ocorrência em aberto por vez (RN-35) atravessam tabela, visão e Server Action, e modelar
depois de construir custaria reescrevê-las em três lugares.

**Um atributo de entidade já existente está na mesma condição**: `lotes.protocolo_id`, que só passa
a ser preenchido quando `protocolos` existir. Enquanto isso, o lote é criado sem protocolo e não
cobra etapa nenhuma, que é o comportamento descrito em [`C2`](C2-especificacao-casos-de-uso.md)
UC-22 FA-2.

---

# Acesso e configurações: transversal às três áreas

## `usuarios`: usuário do sistema

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `login` | text | ● | UK | Identificador de acesso, único |
| `nome_exibicao` | text | ● | | Nome exibido na interface |
| `senha_hash` | text | ● | | Resumo criptográfico da senha. **A senha em si nunca é armazenada** (RNF-08) |
| `perfil` | enum | ● | | Perfil de acesso: `admin`, `chefia`, `gerencia`. **Não há perfil de campo**: os colaboradores não operam o sistema ([`A1` §5](../A-fundacao/A1-documento-de-visao.md)) |
| `deve_trocar_senha` | boolean | ● | | Obriga a definir senha própria no próximo acesso (RF-02) |
| `ativo` | boolean | ● | | Usuário habilitado |
| `tentativas_login_falhas` | integer | ● | | Tentativas malsucedidas consecutivas |
| `bloqueado_ate` | timestamptz | ○ | | Bloqueio temporário após tentativas sucessivas |
| `pessoa_id` | uuid | ○ | FK → `cadastro.pessoas` | Pessoa do cadastro a que esta credencial pertence. **Opcional:** há funcionário sem login (seis dos nove) e administrador sem vínculo |

## `sessoes`: sessão ativa

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `usuario_id` | uuid | ● | FK → `usuarios` | Usuário da sessão |
| `token_hash` | text | ● | UK | Resumo do identificador de sessão. O valor original só existe no dispositivo (RNF-09) |
| `expira_em` | timestamptz | ● | | Expiração |
| `ultimo_uso_em` | timestamptz | ● | | Último uso, para ordenar a lista de sessões |
| `ip` | text | ○ | | Endereço de origem, para identificar o aparelho |
| `agente_usuario` | text | ○ | | Descrição do dispositivo e navegador |

## `eventos_login`: auditoria de acesso

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `usuario_id` | uuid | ○ | FK → `usuarios` | Usuário, quando o identificador informado existe |
| `login_tentado` | text | ● | | Identificador tentado. **Texto e não referência**, porque a tentativa contra usuário inexistente também precisa ser registrada |
| `sucesso` | boolean | ● | | Resultado da tentativa |
| `ip` | text | ○ | | Endereço de origem |
| `agente_usuario` | text | ○ | | Dispositivo e navegador |

## `parametros`: parâmetro do sistema

Parâmetro escalar em chave e valor tipado. Existe para tirar do código e da variável de ambiente
o que **é regra de negócio e não infraestrutura**: quem decide o limiar de mortalidade, as
coordenadas do viveiro ou a margem mínima de revenda é a chefia, e hoje mudar qualquer um deles
exige uma implantação.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `chave` | text | ● | UK | Chave estável do parâmetro, em minúsculas com ponto: `producao.mortalidade_limite_pct` |
| `valor` | text | ● | | Valor, sempre em texto |
| `tipo_valor` | text | ● | | Tipo em **lista fechada**: `texto`, `numero`, `booleano`, `data`. Diz como interpretar `valor` |
| `descricao` | text | ● | | O que o parâmetro governa, em português, para a tela de configurações |
| `atualizado_em` | timestamptz | ● | | Momento da última alteração |
| `atualizado_por` | uuid | ○ | FK → `usuarios` | Quem alterou |

> **Onde está a fronteira entre `parametros` e cadastro.** Parâmetro que é **um valor** mora aqui.
> Parâmetro que é **uma lista de coisas com atributos** vira entidade: é o caso do período de
> trabalho, que virou `turnos_trabalho` na área 1 em vez de quatro chaves aqui. A regra de corte é a dos Cadastros: se apagar deixa um movimento
> passado sem sentido, é entidade.

> **`valor` é texto e `tipo_valor` diz como lê-lo.** A alternativa, uma coluna por tipo, deixaria
> três nulas em toda linha. O tipo declarado é o que permite a tela de configurações apresentar o
> campo certo e validar antes de gravar.

> **Duas chaves novas com o protocolo de atividades, ainda não implementadas:**
> `producao.protocolo_janela_aviso_pct` (padrão 20), o percentual final do intervalo em que a etapa
> passa a avisar (RN-37), e `producao.protocolo_horizonte_dias` (padrão 14), até quantos dias à
> frente o motor materializa ordens na agenda. **O horizonte é parâmetro, e não constante**, pela
> mesma razão dos demais: emitir um ano de limpezas trimestrais encheria a grade de tarefas que
> ninguém olha por nove meses, e o número certo muda com a estação.

# Área 1 · Cadastro único

## `especies`: espécie *(entidade central)*

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `nome_cientifico` | text | ● | UK | Nome científico binomial, exigido em projetos de compensação ambiental (RNF-22). **É a identidade da espécie**, e por isso é único e obrigatório |
| `caracteristicas` | text[] | ● | | Características da espécie: nativa, exótica, frutífera, ornamental, madeireira, forrageira. **Múltiplas por espécie** |
| `observacoes` | text | ○ | | Observações de manejo |
| `foto_url` | text | ○ | | Referência da fotografia, no formato `/api/fotos/<uuid>`, que aponta para `especies_fotos` |
| `ativa` | boolean | ● | | Espécie em catálogo |

> **Não há coluna de nome popular aqui, e é o que RN-02 exige.** A mesma espécie é chamada por
> nomes diferentes conforme a região e o interlocutor, de modo que o nome popular é lista e não
> campo: mora em `especies_nomes_populares`, e o principal é o que tiver `e_principal`. Uma coluna
> `nome_popular` obrigaria a eleger um nome no cadastro e faria a busca por qualquer um dos outros
> deixar de encontrar a espécie, que é justamente o que RF-10 pede.

> **O tempo de ciclo saiu da espécie.** `dias_germinacao` e `meses_crescimento` existiam
> para calcular a previsão de disponibilidade do lote, que ficou fora do escopo. O que restou de
> tempo por espécie é a customização de etapa do protocolo (`especies_protocolos_tempos`), que é
> mais precisa e tem uso: ela diz em quantos dias **aquela** etapa vence naquela espécie, em vez de
> um número único para o ciclo inteiro.

## `especies_nomes_populares`: nome popular adicional

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `especie_id` | uuid | ● | FK → `especies` | Espécie designada |
| `nome` | text | ● | UK | Nome tal como escrito. Único **dentro da espécie**, pelo par `(especie_id, nome)` |
| `e_principal` | boolean | ● | | Nome principal da espécie. Índice único parcial: **no máximo um principal por espécie** |
| `criado_em` | timestamptz | ● | | Criação |

> **A unicidade é por espécie, e não global.** Duas espécies podem legitimamente compartilhar um
> nome popular no Alto Vale, e proibir isso obrigaria a inventar um desempate na hora do cadastro.
> A busca de RF-10 devolve as duas, e quem cadastra escolhe.

## `especies_fotos`: fotografia da espécie

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador, e também o que aparece na URL `/api/fotos/<uuid>` |
| `conteudo` | bytea | ● | | Conteúdo binário da imagem |
| `tipo_conteudo` | text | ● | | Tipo do arquivo, `image/webp` por padrão |
| `criado_em` | timestamptz | ● | | Criação |

> **Sem `especie_id`, por decisão de projeto.** O envio da foto acontece antes da inserção da
> espécie, então a chave estrangeira não teria a que apontar no momento da gravação. A referência
> fica em `especies.foto_url`. A imagem é guardada no banco e não em disco porque o sistema de
> arquivos da plataforma de publicação é somente leitura e descartado a cada implantação: em disco,
> a foto se perderia. Ver [`C6 §3.2`](C6-modelo-entidade-relacionamento.md).

## `recipientes`: recipiente

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `nome` | text | ● | UK | Designação: tubete, 10x18, 17x22, 20x26, 28x32, balde |
| `volume_litros` | numeric(6,3) | ○ | | Volume do recipiente |
| `ativo` | boolean | ● | | Em uso |

> **O protocolo pendura-se aqui.** É o recipiente que determina o manejo (RN-32), e é dele que
> `protocolos` sai. A entidade intermediária `tipos_recipiente`, que agrupava os quatro sacos num tipo
> só, foi descartada: com seis recipientes no catálogo, ela custava uma tabela e uma tela para
> poupar a repetição de três protocolos.

## `insumos`: insumo

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `nome` | text | ● | | Designação comercial |
| `categoria` | enum | ● | | `substrato`, `adubo`, `defensivo`, `recipiente`, `outros` |
| `unidade_medida` | text | ● | | Unidade de medida: kg, L, saco, unidade |
| `ativo` | boolean | ● | | Em uso |

> **O insumo é catálogo, e nada o consome.** O custo por unidade, o histórico de preço, o saldo em
> estoque e o consumo por tarefa saíram com o custeio. O que resta é a lista do que o viveiro
> aplica na produção, com unidade e categoria: é o que permite que a tarefa passe a referenciá-lo
> quando o consumo voltar ao escopo, sem que o catálogo precise ser refeito.

## `cadastro.pessoas`: identidade

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `tipo` | `cadastro.tipo_pessoa` | ● | | **Natureza da pessoa**: `pf` ou `pj` (RN-45) |
| `documento` | text | ○ | UK | CPF ou CNPJ, só dígitos (RF-17). Opcional porque o cadastro rápido do pedido pede só nome e telefone (RN-46); a unicidade não impede várias identidades sem documento, porque nulos não colidem entre si |
| `nome` | text | ● | | Nome usual: o que aparece nas listas |
| `telefone` | text | ○ | | Telefone, e é por ele que a negociação começa |
| `email` | text | ○ | | Correio eletrônico |
| `observacoes` | text | ○ | | Observações |
| `ativa` | boolean | ● | | Papel ativo; inativar preserva o histórico que excluir apagaria |

> **Razão social e nome fantasia não são colunas.** O conjunto fiscal que RNF-21 exige é o do
> emissor externo, e o que ele pede desta base é nome, documento e endereço. Guardar aqui campos
> que só a nota usa duplicaria o cadastro do sistema fiscal sem que nada neste sistema os lesse.

> **Não há coluna de WhatsApp.** A negociação acontece por WhatsApp e o pedido é registrado depois,
> à mão: não há integração, e um segundo número de telefone só se justificaria se algo aqui
> discasse para ele.

> **Correção de 11/08/2026.** Este dicionário descrevia `tipo` como *natureza do vínculo*
> (cliente, fornecedor, funcionário). Estava errado: um `tipo` único não representa o caso que
> motivou a tabela, a mesma pessoa que vende muda e também compra. O vínculo passou para
> `pessoas_papeis`, que admite N papéis por identidade; `tipo` ficou com a natureza da pessoa.
> Fonte canônica: [`docs/rotinas/1-cadastros/01-cadastro-unico.md`](../../rotinas/1-cadastros/01-cadastro-unico.md).

## `cadastro.pessoas_papeis`: papéis da identidade

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `pessoa_id` | uuid | ● | PK, FK → `cadastro.pessoas` | Identidade |
| `papel` | `cadastro.tipo_papel` | ● | PK | `cliente`, `fornecedor`, `funcionario` |
| `tipo_vinculo` | text | ○ | | `fixo` ou `diarista`, e só quando `papel` é `funcionario` |
| `ativo` | boolean | ● | | Papel ativo |
| `criado_em` | timestamptz | ● | | Criação |

> **A tabela não tem `id` nem `atualizado_em`.** A chave é o par `(pessoa_id, papel)`, o que impõe pela
> estrutura que uma pessoa exerça cada papel no máximo uma vez (RN-47).

> `funcionario` aqui é **vínculo empregatício**, e não nível de acesso. O nível de acesso é
> `usuarios.perfil`, cujos valores são `admin`, `chefia` e `gerencia`. A ambiguidade que existia entre as
> duas palavras deixou de existir com a saída do perfil de campo: `usuarios.perfil` não tem, e não terá
> enquanto essa decisão valer, o valor `colaborador` ([`D4`](../D-arquitetura/D4-matriz-rbac.md) §1).

## `cadastro.pessoas_enderecos`: endereços da identidade

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `pessoa_id` | uuid | ● | FK → `cadastro.pessoas` | Identidade |
| `tipo` | `cadastro.tipo_endereco` | ● | | `entrega`, `cobranca` ou `residencial` |
| `logradouro` | text | ○ | | Logradouro e número |
| `cidade` | text | ○ | | Município |
| `uf` | char(2) | ○ | | Unidade federativa |
| `cep` | text | ○ | | CEP |
| `criado_em`, `atualizado_em` | timestamptz | ● | | Criação e alteração |

> **A entidade existe porque uma pessoa tem mais de um endereço, e o de entrega pode não ser o de
> cobrança** (RN-51). É `tipo` que os distingue, e a tabela não impõe endereço único por tipo: a
> mesma identidade pode ter dois endereços de entrega, o que o viveiro pratica.

## `tipos_tarefa`: tipo de tarefa

Vocabulário fechado da agenda e do encerramento (RF-21). **É o catálogo que comanda o
formulário**: um nome e quatro booleanos, e cada booleano decide um campo que a tela pede ou
deixa de pedir (RF-21).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `nome` | text | ● | UK | Nome da atividade: colher semente, encher saquinho, repicar, limpar mato, separar mudas |
| `categoria` | text | ● | | Categoria em **lista fechada**: `semente`, `terra`, `plantio`, `manutencao`, `pos_morte`, `expedicao` (RN-23). **Classifica, não comanda formulário** |
| `e_quantitativa` | boolean | ● | | "É quantitativa por unidade": quando verdadeiro, o encerramento pede quanto **cada participante** fez (RN-24) |
| `exige_lote` | boolean | ● | | "Lote específico": quando verdadeiro, o encerramento exige o lote, e com ele o canteiro, a espécie e o recipiente (RN-25) |
| `exige_especie` | boolean | ● | | Quando verdadeiro, a atribuição e o encerramento exigem espécie. Tarefa com lote a herda dele |
| `exige_recipiente` | boolean | ● | | Quando verdadeiro, exigem recipiente. Tarefa com lote o herda dele |
| `ativo` | boolean | ● | | Tipo em uso. Inativar é o que retira a tarefa da lista da agenda; excluir deixaria sem sentido toda atribuição passada |

> **Nenhuma tarefa mede tempo, e é decisão.** A agenda registra o turno, e não a hora (RN-12):
> apontamento por relógio seria controle de ponto, e está fora do escopo. `e_quantitativa` diz
> apenas se se conta **quanto** foi feito, e a pergunta do viveiro passou a ser "quantos fez no
> turno".

> **A contagem é por pessoa, e não da tarefa** (RN-24). Quatro pessoas enchendo saquinho gravam
> quatro números em `atribuicoes_participantes.quantidade_feita`, e não um total dividido por quatro. A
> confirmação do grupo (RF-29) é o gesto que preenche as quatro de uma vez.

> **`tipo_medicao`, `minutos_medios_por_unidade` e `unidade_medida` não chegaram ao banco.** O
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
| `letra` | char(1) | ● | UK | Letra da área: A, B, C. Única, e o banco exige maiúscula |
| `nome` | text | ○ | | Nome pelo qual a equipe se refere a ela, quando houver |

## `canteiros`: canteiro

Subdivisão da área, numerada dentro dela. É a segunda metade do endereço, e o que a tarefa de campo
pede para ser executada.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `area_id` | uuid | ● | FK → `areas` | Área a que pertence |
| `numero` | integer | ● | | Número dentro da área. Restrição: maior que zero |
| `capacidade` | integer | ○ | | Quantas mudas o canteiro comporta; serve de aviso ao criar lote, não de trava |

**Restrição de unicidade:** número de canteiro único dentro da área.

> **A unicidade é do par (`area_id`, `numero`), não do número sozinho.** A numeração recomeça em
> cada área: existe o canteiro 4 da área A e o canteiro 4 da área B, e são dois lugares diferentes.
> É o vocabulário que a equipe já usa apontando com o dedo.

> `capacidade` não trava a criação de lote de propósito. O viveiro sabe apertar mais do que a conta
> quando precisa, e uma trava aqui faria a gerência registrar o lote no canteiro errado para
> conseguir registrá-lo.

## `turnos_trabalho`: turno de trabalho

O **período de trabalho** (RF-08). Existe para tirar de dentro do código o número que a RN-12
trazia no próprio enunciado: um turno valia quatro horas por convenção, e convenção que muda com a
estação e com a combinação da equipe é dado, não constante (RN-27).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `nome` | text | ● | UK | Nome do turno: `manha`, `tarde` |
| `inicio` | time | ● | | Hora de início |
| `fim` | time | ● | | Hora de término. Restrição: posterior a `inicio` |
| `ativo` | boolean | ● | | Turno em uso |

**Carga inicial:** `manha` das 07:30 às 11:30, `tarde` das 13:00 às 17:00.

> **A duração do turno é derivada**, `fim` menos `inicio`, e não campo. Guardá-la permitiria
> que ela divergisse dos horários que a própria linha declara.

> **`nome` é a chave de negócio, e não há coluna de código separada.** São dois turnos, e a agenda
> os referencia por `turno_id`: um segundo identificador estável só teria uso se o nome fosse
> editável a ponto de deixar de identificar o turno, o que não é o caso com dois valores fixos.

> **O horário existe, e o registro do trabalho não o usa.** A agenda escala por dia e turno, nunca
> por hora (RN-12): `inicio` e `fim` dizem quando o turno começa e termina para quem lê a
> grade, e não são comparados com relógio nenhum. Apontamento de entrada e saída é controle de
> ponto, e está fora do escopo.

## `protocolos`: protocolo de atividades

**Especificada, não implementada.**

A receita de manejo de um recipiente: a sequência de etapas que todo lote daquele recipiente passa
a seguir sozinho (RF-22).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `recipiente_id` | uuid | ● | FK → `recipientes` | Recipiente que o protocolo rege (RN-32) |
| `nome` | text | ● | | Designação: "Protocolo do tubete" |
| `ativo` | boolean | ● | | Vigente. Restrição: **um vigente por recipiente**, por índice único parcial |
| `observacoes` | text | ○ | | Observação |
| `criado_por` | uuid | ● | FK → `usuarios` | Quem montou |

> **O protocolo não é versionado, e a edição não retroage** (RN-39). Vale um vigente por tipo, e
> a alteração é lida apenas na próxima geração de ordens: ordem já emitida e dia já trabalhado
> permanecem como estão, pela mesma razão da RN-43. Versionar exigiria fotografar a árvore de
> etapas dentro de cada lote, e o viveiro muda o protocolo raramente. **A suposição está declarada
> aqui de propósito**, porque é a que mais custaria reverter depois.

> **`lotes.protocolo_id` fotografa o protocolo na criação**, em vez de o lote consultá-lo a cada
> leitura. Sem isso, trocar o recipiente de um lote trocaria a receita dele no
> meio do caminho, e as datas já cumpridas passariam a pertencer a um protocolo que ele nunca
> seguiu.

## `protocolos_etapas`: etapa do protocolo

**Especificada, não implementada.**

Uma linha da receita. Aponta para uma tarefa do catálogo e declara **quando** ela ocorre (RF-22,
RF-23). É a entidade que carrega a lógica do módulo inteiro.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `protocolo_id` | uuid | ● | FK → `protocolos` | Protocolo a que pertence |
| `tipo_tarefa_id` | uuid | ● | FK → `tipos_tarefa` | Tarefa do catálogo que a etapa manda executar |
| `rotulo` | text | ● | | Rótulo da etapa: "Classificar, pós-germinação" |
| `posicao` | integer | ● | | Ordem de leitura. Restrição: única dentro do protocolo |
| `tipo_agendamento` | text | ● | | **Lista fechada**: `sequencial` ou `recorrente` (RN-36) |
| `tipo_ancora` | text | ● | | **Lista fechada**: `criacao_do_lote` ou `conclusao_de_etapa` (RN-33) |
| `etapa_ancora_id` | uuid | ○ | FK → `protocolos_etapas` | Etapa cuja conclusão inicia a contagem. Obrigatória quando `tipo_ancora` é `conclusao_de_etapa`, nula no outro caso. Restrição: diferente da própria etapa |
| `dias` | integer | ● | | Dias entre a âncora e a primeira ocorrência, que é também a única quando sequencial. Restrição: não negativo |
| `intervalo_dias` | integer | ○ | | Só recorrente: dias entre uma ocorrência e a seguinte, contados da **execução real** (RN-34). Restrição: maior que zero quando preenchido, nulo quando sequencial |
| `turno_id` | uuid | ● | FK → `turnos_trabalho` | Turno que a ordem gerada herda |
| `alerta_ligado` | boolean | ● | | Liga a regra de atraso. Falso nas rotinas diárias (RN-37) |
| `janela_aviso_pct` | numeric(5,2) | ○ | | Janela de aviso própria, em percentual do intervalo. **Nula = usa `producao.protocolo_janela_aviso_pct`** (RN-37). Restrição: entre 0 e 100 |
| `fase_resultante` | text | ○ | | Só sequencial: a fase que a conclusão grava em `lotes.fase`, na mesma lista fechada de lá. Nula = não altera a fase (RN-36) |
| `ativo` | boolean | ● | | Etapa em uso |

> **A âncora é atributo, e não consequência de `posicao`.** Derivar "a etapa anterior" da ordem
> da lista faria "Classificar pós-germinação" contar da criação do lote, e a semente pode ficar
> dias esperando plantio antes de germinar: mandaria classificar muda que ainda não nasceu (RN-33).
> A etapa âncora não precisa ser a imediatamente anterior, e é justamente esse o caso que a coluna
> existe para representar.

> **O ciclo na cadeia de âncoras não cabe em restrição declarativa.** A etapa A ancorando em B e B
> ancorando em A é estruturalmente representável, e a única barreira contra ela é a validação da
> aplicação, com teste dedicado. **Limite conhecido, declarado aqui em vez de descoberto em
> produção.**

> **`turno_id` é obrigatório porque `atribuicoes.turno_id` é `NOT NULL`**, e a ordem gerada
> precisa de um. A pergunta que resolve
> ("esta etapa é de manhã ou de tarde?") a gerência responde sem pensar, e derivá-la de qualquer
> outra coisa obrigaria a escolher entre errar e recusar.

> **A mesma tarefa aparece duas vezes no protocolo, e por isso existe `rotulo`.** "Classificar
> pós-germinação" e "Classificar seleção" são duas etapas com propósitos distintos, e o catálogo já
> as separa desde 24/08/2026. `rotulo` é o que permite ao protocolo distinguir duas manifestações da
> mesma tarefa sem inflar o catálogo com entradas quase iguais.

> **A janela de aviso é percentual, e só percentual.** Um override absoluto em dias conviveria com
> o percentual como duas formas de dizer a mesma coisa, e a segunda forma existe para alguém
> preencher as duas e elas discordarem. **Suposição declarada:** aviso fixo em dias não é
> representável, e a alternativa para quem precisar dele é ajustar o percentual da etapa.

## `especies_protocolos_tempos`: tempo da etapa por espécie

**Especificada, não implementada.**

O que permite a uma espécie de germinação lenta usar setenta dias onde o protocolo diz quarenta,
sem duplicar a receita inteira (RF-25, RN-38).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `especie_id` | uuid | ● | PK, FK → `especies` | Espécie |
| `protocolo_etapa_id` | uuid | ● | PK, FK → `protocolos_etapas` | Etapa customizada |
| `dias` | integer | ○ | | Sobrescreve o da etapa. Nulo = usa o da etapa |
| `intervalo_dias` | integer | ○ | | Sobrescreve o da etapa. Nulo = usa o da etapa |
| `observacoes` | text | ○ | | Por que esta espécie difere |

> **Restrição: pelo menos um dos dois preenchido.** Linha sem nenhum override é ruído que faz a
> consulta de tempo efetivo passar por um caminho a mais para chegar ao mesmo valor.

> **Não são colunas em `especies`.** São 142 espécies contra as etapas de cada protocolo, e a
> maioria não sobrescreve nada: colunas produziriam uma matriz quase toda nula, e cada etapa nova
> exigiria migration em `especies`. É a mesma regra de corte que separa `parametros` de entidade.


# Área 2 · Produção

## `lotes`: lote

**A leva de mudas da mesma espécie, no mesmo recipiente, plantada junta e ocupando um canteiro**
(RN-18). É a entidade que diz *onde* a muda está e *de que leva* ela veio: até 24/08/2026 o modelo
respondia o que a muda era e não onde estava. A revisão de escopo está justificada em
[`A1`](../A-fundacao/A1-documento-de-visao.md) §7.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `codigo` | text | ● | UK | Código legível, gerado pelo sistema, no formato `AAAA-NNNN`: ano de plantio e sequência de quatro dígitos dentro do ano |
| `especie_id` | uuid | ● | FK → `especies` | Espécie da leva |
| `recipiente_id` | uuid | ● | FK → `recipientes` | Recipiente, que define o porte da muda |
| `canteiro_id` | uuid | ○ | FK → `canteiros` | Canteiro ocupado. Nulo quando o lote está encerrado |
| `lote_origem_id` | uuid | ○ | FK → `lotes` | Lote de origem, quando este nasceu de uma repicagem (RN-20) ou de uma divisão (RN-41) |
| `protocolo_id` | uuid | ○ | FK → `protocolos` | Protocolo que rege o lote, fotografado na criação a partir do recipiente (RF-46). Nulo quando o recipiente ainda não tem protocolo. **Especificado, não implementado.** |
| `quantidade_inicial` | integer | ● | | Quantidade que entrou. Restrição: maior que zero |
| `quantidade_atual` | integer | ● | | Saldo vivo. Restrição de banco: não negativo (RN-21). **Mantido pela aplicação** na mesma transação do movimento |
| `fase` | text | ● | | Fase em **lista fechada**: `semeado`, `germinado`, `repicado`, `crescimento`, `rustificacao`, `pronto`, `encerrado` |
| `data_plantio` | date | ● | | Data em que a leva foi plantada e passou a ocupar o canteiro. É a âncora das etapas do protocolo que contam da criação do lote (RN-33) |
| `encerrado_em` | timestamptz | ○ | | Momento do encerramento; a partir dele o lote sai da ocupação |
| `motivo_encerramento` | text | ○ | | Motivo do encerramento em **lista fechada**: `saldo_zero`, `expedido`, `dividido`. Preenchido se e somente se `encerrado_em` o estiver (RN-40) |
| `posicao` | integer | ○ | | Ordem do lote dentro do canteiro, a partir de 1. Dá ao mapa um desenho estável (RF-44) |
| `observacoes` | text | ○ | | Observação |

> **O endereço fica fora do código** (`2026-0147`, e não `2026-A3-004`). O canteiro do lote muda:
> `movimentos_lote` tem o tipo `transferencia`, e o encerramento anula `canteiro_id`. Código com área e
> canteiro dentro passaria a mentir na primeira transferência, e a correção seria renomear o lote,
> invalidando toda referência anterior a ele. Quem responde **onde** o lote está é o par
> `canteiro_id` e `posicao`; o código responde **qual leva** é, e por isso não muda nunca.

> **Um lote ocupa um canteiro, e um canteiro comporta vários lotes** (RN-19, emendada em
> 26/08/2026). A metade que continua de pé é a que interessa: leva que não cabe em um canteiro é
> outro lote, e não o mesmo lote espalhado. A alternativa, uma entidade de ocupação com quantidade
> por canteiro, custaria um nível de indireção em toda tela que pede lote, para representar o que
> dois lotes já representam.
>
> **O que caiu foi a exclusividade**, e com ela o índice `lotes_um_lote_aberto_por_canteiro`. Ela
> nunca existiu no viveiro: o canteiro recebe seis, oito, nove levas, e é o que o mapa de produção
> desenha. O índice proibia exatamente o que a operação faz todo dia, e quem revelou isso foi o
> protótipo da tela, não o banco.

> **`posicao` é ordem, não coordenada.** Conta da esquerda para a direita, como a equipe lê o
> canteiro de pé na frente dele. Sem ela os lotes trocariam de lugar no mapa a cada carregamento, e
> quem opera perderia a referência espacial que a tela existe para dar: reconhece-se o lote pelo
> lugar antes de ler o rótulo. **É nula quando a ordem não foi cuidada**, e o índice
> `lotes_posicao_unica_no_canteiro` é parcial nos dois eixos por isso: exigir posição faria a
> gerência inventar um número só para conseguir registrar o lote, e número inventado desenha o mapa
> errado.

> **`canteiro_id` é opcional apenas para o lote encerrado.** Enquanto aberto, todo lote tem canteiro:
> lote sem lugar é a situação que a entidade existe para eliminar. Ao encerrar, o canteiro é
> liberado para o próximo (RN-22), e o histórico do lote permanece consultável pelos movimentos.

> **`quantidade_atual` é a única quantidade materializada do modelo, e a exceção é declarada.** O
> saldo poderia ser somado de `movimentos_lote` a cada leitura, como o estoque de espécie faz. Aqui
> não: a tela de ocupação lê o saldo de todos os lotes abertos de uma vez, no celular, em rede
> instável. **Quem o mantém é a aplicação**, na mesma transação que grava o movimento, e não um
> gatilho: a migration cria a restrição de não negativo e deixa a atualização com quem já está
> dentro da transação. `movimentos_lote` é a fonte que o audita, e divergência entre os dois é
> defeito detectável, não ambiguidade de modelo.

> **`lote_origem_id` é o que a repicagem produz.** A muda que passa do tubete para o saco mudou de
> recipiente, e recipiente define produto, custo e preço: comercialmente, virou outra coisa. Por
> isso a repicagem não move o lote, baixa parte do de origem e cria um novo apontando para ele.
> Percorrer a cadeia responde **de cada mil sementes semeadas, quantas mudas chegaram à venda**,
> que é a pergunta que o viveiro nunca pôde responder.

## `movimentos_lote`: movimento de lote

O razão que explica o saldo do lote. Toda alteração de `lotes.quantidade_atual` tem uma linha
aqui, com motivo e origem.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `lote_id` | uuid | ● | FK → `lotes` | Lote movimentado |
| `tipo_movimento` | text | ● | | Motivo em **lista fechada**: `entrada`, `perda`, `repicagem_saida`, `repicagem_entrada`, `venda`, `ajuste_contagem`, `transferencia`, `divisao_saida`, `divisao_entrada`. Os dois últimos são **especificados, não implementados** (RN-41) |
| `quantidade` | integer | ● | | Quantidade movimentada, com sinal: positiva na entrada, negativa na saída |
| `data_movimento` | date | ● | | Data do movimento |
| `canteiro_origem_id` | uuid | ○ | FK → `canteiros` | Canteiro de origem, só em `transferencia` |
| `canteiro_destino_id` | uuid | ○ | FK → `canteiros` | Canteiro de destino, só em `transferencia` |
| `causa_perda` | text | ○ | | Causa em **lista fechada**: `seca`, `praga`, `geada`, `manuseio`, `outro` (RN-10). Existe se e somente se `tipo_movimento` for `perda` |
| `atribuicao_id` | uuid | ○ | FK → `atribuicoes` | Atribuição que o originou, quando veio de uma tarefa confirmada |
| `registrado_por` | uuid | ● | FK → `usuarios` | Quem registrou (RN-54) |
| `observacoes` | text | ○ | | Observação |

> **A origem é uma só, e é opcional.** `atribuicao_id` liga o movimento à tarefa que o causou.
> Movimento sem origem é o ajuste manual da gerência, que existe e precisa caber: prendê-lo a uma
> origem obrigatória faria a correção de um erro de digitação ser impossível sem inventar uma perda
> que não houve.

> **Perda, contagem e venda não são entidades: são valores de `tipo_movimento`.** Uma tabela própria
> de perda obrigaria a gravar duas linhas por perda, uma nela e outra aqui, e a divergir no dia em
> que alguém gravasse só uma. É a mesma decisão que faz de `causa_perda` uma coluna deste razão, e
> não de uma entidade `eventos_perda`.

> **A repicagem grava dois movimentos**, `repicagem_saida` no lote de origem e `repicagem_entrada`
> no de destino, e a diferença entre eles, quando houver, é uma `perda` no lote de origem (RN-28).
> A soma "repicadas mais perdidas" tem de igualar a quantidade que saiu: sem isso a diferença
> viraria evaporação silenciosa, e a mortalidade ficaria subestimada exatamente na etapa que mais
> mata.

> **`transferencia` muda o canteiro sem mudar o lote.** É o caso em que a mesma leva é remanejada
> de lugar sem trocar de recipiente, e por isso não gera lote filho: quem muda é o endereço, não a
> identidade. `quantidade` é zero nesse movimento, e `canteiro_origem_id` e `canteiro_destino_id` carregam o que
> mudou.

## `atribuicoes_participantes`: participante da tarefa

Quem foi escalado numa atribuição. Existe porque uma tarefa admite vários executores, e o mesmo
turno admite duas tarefas com grupos diferentes (RN-26).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `atribuicao_id` | uuid | ● | PK, FK → `atribuicoes` | Atribuição |
| `pessoa_id` | uuid | ● | PK, FK → `cadastro.pessoas` | Funcionário escalado |
| `quantidade_feita` | integer | ○ | | Quantidade que **esta pessoa** realizou, pedida na confirmação quando o tipo de tarefa for quantitativo (RF-29, RN-24). Nula enquanto a tarefa não for confirmada |
| `criado_em` | timestamptz | ● | | Criação |

> **A tabela não tem `id` nem `atualizado_em`.** A chave é o par `(atribuicao_id, pessoa_id)`, o que
> impede pela estrutura escalar a mesma pessoa duas vezes na mesma tarefa.

> **`atribuicoes` perdeu `pessoa_id` para cá.** Com a pessoa dentro da própria atribuição, escalar
> quatro funcionários na mesma tarefa criaria quatro atribuições idênticas, e a tarefa deixaria de
> ser uma coisa só para virar quatro coisas parecidas: metade da equipe enchendo saquinho enquanto
> a outra repica é a norma do viveiro, não a exceção.

> **É aqui que a quantidade realizada mora, e não na atribuição** (RN-24). Quatro pessoas enchendo
> saquinho produzem quatro números, e é assim que o viveiro fala: um total na atribuição obrigaria
> a dividir por quatro na hora de ler, e a divisão seria invenção.

> **A tabela não guarda hora.** A unidade do planejamento é o turno, e não o relógio (RN-12): quem
> sai da tarefa antes do grupo não é registrado em lugar nenhum, porque apontamento de entrada e
> saída é controle de ponto e está fora do escopo.

## `semanas`: semana de trabalho

A semana é a unidade real de decisão do viveiro (RF-26, RF-28). Fechada, não se altera: sem isso
o custo do período mudaria depois de apurado (RN-13).

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `inicio_semana` | date | ● | UK | Segunda-feira da semana; única |
| `situacao` | text | ● | | `rascunho`, `publicada`, `fechada` |
| `publicada_por` | uuid | ○ | FK → `usuarios` | Quem publicou a semana para a equipe |
| `fechada_em` | timestamptz | ○ | | Momento do fechamento; a partir dele a semana é imutável |

## `atribuicoes`: atribuição de tarefa

A célula da grade: um dia, um turno, um tipo de tarefa e o grupo escalado. **É o planejado e o
confirmado na mesma linha**: `situacao` é o que distingue os dois, e é o que dispensa uma entidade de
execução separada. A duração do turno vem de `turnos_trabalho` (RN-12, RN-27), e a tarefa que tem hora
marcada declara a sua em `hora_inicio` / `hora_fim`.

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `semana_id` | uuid | ● | FK → `semanas` | Semana a que pertence |
| `data_trabalho` | date | ● | | Dia da tarefa |
| `turno_id` | uuid | ● | FK → `turnos_trabalho` | Turno. Obrigatório mesmo quando há hora: os turnos não cobrem o dia inteiro, e a hora não diz a qual deles a tarefa pertence (RN-12) |
| `hora_inicio` | time | ○ | | Hora de início da tarefa que tem hora marcada, como a irrigação das sete às oito. Nula na maioria das atribuições (RN-12) |
| `hora_fim` | time | ○ | | Hora de fim, quando há início e se sabe o fim. Fim sem início é recusado pelo `CHECK` |
| `tipo_tarefa_id` | uuid | ● | FK → `tipos_tarefa` | Tipo de tarefa |
| `especie_id` | uuid | ○ | FK → `especies` | Espécie, quando o tipo de tarefa a exigir |
| `recipiente_id` | uuid | ○ | FK → `recipientes` | Recipiente, quando o tipo de tarefa o exigir |
| `lote_id` | uuid | ○ | FK → `lotes` | Lote, quando o tipo de tarefa o exigir (RN-25) |
| `area_id` | uuid | ○ | FK → `areas` | Área da tarefa que não exige lote (RF-30) |
| `canteiro_id` | uuid | ○ | FK → `canteiros` | Canteiro da tarefa que não exige lote (RF-30) |
| `quantidade_planejada` | integer | ○ | | Quantidade planejada, quando aplicável |
| `e_recorrente` | boolean | ● | | Marca a atribuição como parte da rotina fixa: ao copiar a semana anterior, ela já vem preenchida (RF-27, RN-31) |
| `lote_etapa_id` | uuid | ○ | | Etapa do protocolo daquele lote que gerou esta ordem. Nula = atribuição lançada à mão (RN-43). A coluna existe; **a chave estrangeira não**, porque `lotes_etapas` ainda não foi criada |
| `vencimento_protocolo` | date | ○ | | Vencimento que esta ordem representa, congelado na geração. Distingue-se de `data_trabalho`, que a gerência pode remarcar |
| `situacao` | text | ● | | `planejada`, `confirmada`, `nao_confirmada`, `cancelada`: a segunda é a que a gerência marca ao registrar que a tarefa foi feita, a terceira é a que o fechamento assume como realizada (RN-14), e a quarta é a ordem que o encerramento do lote invalidou (RN-40) |
| `observacoes` | text | ○ | | Observação livre; único campo aberto da agenda |

> **`pessoa_id` saiu para `atribuicoes_participantes`.** Quem executa deixou de ser coluna e virou lista:
> uma tarefa admite vários executores (RN-26). Ver a entidade para o porquê.

> **A ordem do protocolo nasce sem nenhuma linha em `atribuicoes_participantes`** (RN-43), e é
> intencional. O protocolo responde o que fazer e quando; quem faz continua sendo de quem monta a
> agenda. Enquanto não houver ninguém escalado, ela é pendência do lote, e o fechamento da semana
> **não a assume como realizada** (RN-14): dar por feita uma tarefa que ninguém pegou apagaria
> exatamente o esquecimento que o protocolo existe para denunciar.

> **A recorrência é uma marca, e não uma entidade.** `e_recorrente` diz que a atribuição pertence à
> rotina fixa e, por isso, vem preenchida na cópia da semana. Uma tabela de recorrência, com dias
> da semana, hora e vigência, existiria para gerar dias sozinha: neste modelo, o que gera dia
> sozinho é o protocolo, cujo sujeito é o lote e não a equipe.

> **`semana_id` é `NOT NULL`, e a ordem gerada precisa de um** (RN-43). O motor usa a semana do
> vencimento e a abre em `rascunho` se ela não existir; se a semana do vencimento estiver
> `fechada`, a ordem entra na semana aberta corrente, porque semana fechada não se altera (RN-13).
> **É por isso que `vencimento_protocolo` existe ao lado de `data_trabalho`**: sem separar o vencimento do
> dia em que a ordem coube na agenda, empurrá-la para a semana seguinte apagaria o atraso que ela
> existe para denunciar.

> **A ordem do protocolo carrega `lote_id` sempre**, inclusive quando o tipo de tarefa não declara
> lote específico: irrigar *aquele* lote é o que o protocolo mandou. Não conflita com RF-21, que
> rege o que a tela **pede** a quem preenche: campo já respondido pela origem da tarefa não é campo
> a pedir.

> **`turno` deixou de ser texto e virou chave estrangeira.** O par `manha`/`tarde` continua sendo o
> vocabulário, mas a hora de início e de fim mora agora em `turnos_trabalho`, e é dela que sai a
> duração. O valor de quatro horas saiu do enunciado da RN-12 e virou parâmetro (RN-27).

> **`data_trabalho` mais `turno_id` continuam sendo a unidade de planejamento**, e não `iniciado_em`.
> A agenda planeja por turno porque é assim que o viveiro pensa a semana, e pedir horário exato no
> planejamento garantiria agenda não preenchida.

> **Não há hora de início nem de fim, e é decisão de escopo.** A agenda registra o turno, e a
> confirmação registra que a tarefa foi feita e quanto rendeu. Medir a hora de entrada e de saída
> de cada pessoa seria controle de ponto, que está fora do escopo declarado em
> [`A1` §7](../A-fundacao/A1-documento-de-visao.md), e nada no sistema depende desse número.

> **A ordem do protocolo é atribuição comum, e é isso que a torna editável** (RN-43). Ela nasce da
> etapa e guarda de qual, mas dali em diante vive por conta própria: excluir a ordem de uma quarta
> não altera o protocolo nem as ordens dos demais lotes. Um índice único sobre
> `(lote_etapa_id, vencimento_protocolo)` dá a idempotência da geração: sem ele, abrir a agenda
> duas vezes geraria a ordem duas vezes.

## `situacao_lote`: situação do lote *(não é tabela)*

**Visão.** Devolve, para cada lote aberto, a tarefa pendente mais antiga e a situação que dela
decorre: `saudavel`, `atencao` ou `critico`. É o que pinta o mapa de produção (RF-44 e RF-45).

| Atributo | Origem |
|---|---|
| `lote_id`, `codigo_lote`, `canteiro_id`, `posicao` | `lotes`, restrito aos lotes abertos |
| `atribuicao_pendente_id`, `tipo_tarefa_pendente_id`, `tarefa_pendente` | a atribuição do lote que segue `planejada`, cuja data já passou e que não tem execução concluída |
| `pendente_desde` | `atribuicoes.data_trabalho` da pendência |
| `dias_atraso` | a data de hoje menos `pendente_desde`; zero quando não há pendência |
| `situacao` | `dias_atraso` comparado aos parâmetros `producao.atraso_atencao_dias` e `producao.atraso_critico_dias` de `parametros` |

> **É visão e não coluna** (RN-30): situação gravada envelhece sozinha, e o lote marcado como saudável ontem
> continuaria saudável hoje, que é o contrário do que a tela mostra.

> **A mais antiga manda.** Havendo três pendências no mesmo lote, quem determina a cor é a que
> espera há mais tempo, e é ela que aparece ao apontar o lote (RF-45): resolvê-la é a providência
> que o mapa está pedindo.

> **Pendência é o que segue `planejada`, e a condição é positiva de propósito.** Os outros dois
> situacao saem, cada um pelo seu motivo: `confirmada` é a tarefa que a gerência registrou como feita
> (RF-29), e `nao_confirmada` é a que o fechamento da semana assumiu como feita (RF-31, RN-14). Sem
> a segunda, toda semana fechada deixaria um vermelho permanente atrás de si.
>
> **A primeira versão da visão enumerava pela exclusão** (`situacao <> 'nao_confirmada'`) e deixava
> `confirmada` passar: o lote ficava colorido por um serviço que foi feito, sem nada na tela
> denunciando o erro. É a razão de a condição ser positiva agora: excluir por lista exige lembrar
> de todos os casos, e um deles escapou.

> **Os limites vêm de `parametros`, e não de literal na visão** (RN-27). É o que faz o parâmetro ser
> parâmetro de verdade, e não constante com outro nome. A migration que cria a visão afirma que as
> duas chaves existem: sem elas a subconsulta devolveria nulo e **todo** lote apareceria como
> saudável, que é a falha silenciosa mais cara possível nesta tela.


## `lotes_etapas`: acompanhamento do lote na etapa

**Especificada, não implementada.**

Uma linha por par lote e etapa, criada quando o lote nasce. **Guarda fatos, e nunca o vencimento.**

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `lote_id` | uuid | ● | PK, FK → `lotes` | Lote acompanhado |
| `protocolo_etapa_id` | uuid | ● | PK, FK → `protocolos_etapas` | Etapa do protocolo |
| `data_ancora` | date | ○ | | Data do evento de referência, já resolvido. **Nula = a âncora ainda não ocorreu**, e a etapa não vence nada |
| `ultima_execucao_em` | date | ○ | | Data **real** da última execução. Nula = nunca executada |
| `ocorrencias` | integer | ● | | Ocorrências concluídas. Começa em zero |
| `concluido_em` | timestamptz | ○ | | Só sequencial: quando a etapa se encerrou de vez. Preenchida, a etapa sai da visão de vencimentos |
| `herdado_do_lote_id` | uuid | ○ | FK → `lotes` | Lote de origem, quando o estado veio de uma divisão (RN-41) |

> **`proximo_vencimento` não é coluna, e a ausência é a decisão.** O vencimento é função do que já está
> aqui: âncora, última execução e tempo efetivo. Gravá-lo criaria um número que depende da data de
> hoje e que envelhece sozinho, pela mesma razão de `situacao_lote` não ser tabela (RN-42).

> **`data_ancora` nula é informação, e não dado faltando.** É o estado de "Classificar
> pós-germinação" enquanto o plantio não foi concluído: a etapa existe, está acompanhada, e não
> vence nada. Representa "ainda não germinou", que é diferente de "germinou hoje" e diferente de
> "ninguém preencheu".

> **`ultima_execucao_em` é a data da execução, e não a da ordem.** É o que faz a ocorrência seguinte
> contar de quando o serviço foi de fato feito (RN-34). Usar a data planejada devolveria o
> comportamento de calendário fixo que o módulo existe para não ter.

> **Não há entidade de eventos do protocolo, e é decisão declarada.** O razão que explica este
> estado é a própria `atribuicoes`: a ordem sabe a etapa que a gerou, o vencimento que representa e
> a data em que foi confirmada. Uma segunda tabela criaria duas verdades sobre o mesmo fato.
> **Consequência aceita:** marcar uma etapa como feita fora da agenda tem de gerar a atribuição
> correspondente, e não escrever direto aqui.

## `lotes_etapas_vencimento`: vencimento e situação da etapa *(não é tabela)*

**Especificada, não implementada.**

**Visão.** Devolve, para cada lote aberto e etapa ativa que ainda vence algo, o próximo vencimento
e a situação que dele decorre (RF-51, RF-52).

| Atributo | Origem |
|---|---|
| `lote_id`, `protocolo_etapa_id` | `lotes_etapas`, restrito aos lotes abertos e às etapas ativas |
| `ocorrencia` | `ocorrencias` mais um: a ocorrência que está por vir |
| `dias_efetivos` | o override da espécie quando existe, senão o valor da etapa; `dias` na primeira ocorrência e `intervalo_dias` nas seguintes (RN-38) |
| `proximo_vencimento` | `ultima_execucao_em`, ou `data_ancora` quando nunca executada, mais `dias_efetivos` (RN-42) |
| `dias_aviso` | `dias_efetivos` multiplicado pela janela da etapa, ou pelo parâmetro `producao.protocolo_janela_aviso_pct` quando a etapa não a declara (RN-37) |
| `situacao` | `sem_alerta` quando a etapa tem o alerta desligado; `atraso` quando hoje passou de `proximo_vencimento`; `atencao` quando hoje já entrou na janela; `em_dia` nos demais casos |

> **Linhas sem âncora resolvida e etapas sequenciais já concluídas não aparecem.** Não vencem nada,
> e mantê-las na visão obrigaria toda consulta a filtrá-las de novo.

> **A visão devolve uma linha por etapa, e não uma por lote.** Quem reduz as etapas de um lote a
> uma cor só é `situacao_lote`, e é lá que "a mais antiga manda" continua valendo.

> **`situacao_lote` passa a derivar daqui, e é a correção que motivou o módulo** (RN-30 emendada).
> O critério anterior lia o atraso das tarefas **lançadas** em `atribuicoes`, de modo que o lote
> esquecido por completo aparecia como saudável: não havia tarefa atrasada nele porque não havia
> tarefa nenhuma. `atraso` mapeia para `critico`, `atencao` para `atencao`, e o resto para
> `saudavel`: o vocabulário da tela do mapa não muda.

> **Os parâmetros `producao.atraso_atencao_dias` e `atraso_critico_dias` continuam existindo**, e
> passam a reger apenas as atribuições lançadas à mão. Ordem de protocolo usa a janela
> proporcional, porque limite fixo em dias é cedo demais para o trimestral e tarde demais para o
> semanal (RN-37). **Suposição declarada:** os dois critérios convivem, cada um sobre o seu
> conjunto de tarefas.


# Área 3 · Comercial

## `pedidos`: pedido

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `numero_pedido` | serial | ● | UK | Número sequencial legível, usado na comunicação com o cliente |
| `cliente_id` | uuid | ● | FK → `cadastro.pessoas` | Cliente. Aponta para a **identidade única**, e não para uma tabela de clientes: quem compra e às vezes vende é um cadastro só (RN-47) |
| `canal_venda` | varchar(50) | ● | | Canal de venda, em lista fechada de cinco: `atacado`, `compensacao`, `paisagismo`, `prefeitura`, `varejo` (RN-44) |
| `situacao` | varchar(30) | ● | | `rascunho`, `confirmado`, `cancelado` (RN-50) |
| `data_entrega` | date | ○ | | Data prevista de entrega |
| `observacoes` | text | ○ | | Observações |
| `criado_por` | uuid | ● | FK → `usuarios` | Autor do registro (RN-54) |

**Restrição:** pedido em `confirmado` ou `cancelado` não admite alteração de item (RF-57).

> **Não há tabela de histórico de estados.** São três situações e o que o negócio precisa saber é
> em qual delas o pedido está. Uma tabela de histórico existiria para responder quem mudou o quê e
> quando, pergunta que um viveiro de nove pessoas resolve perguntando.

> **`canal_venda` é enumeração, e não chave estrangeira.** Canal de venda é lista fechada de cinco
> valores sem atributos próprios: virar entidade só se justificaria se o canal carregasse margem ou
> preço, que é justamente o que saiu do escopo.

## `pedidos_itens`: item de pedido

| Atributo | Tipo | Ob. | Chave | Descrição |
|---|---|:--:|:--:|---|
| `id` | uuid | ● | PK | Identificador |
| `pedido_id` | uuid | ● | FK → `pedidos` | Pedido |
| `especie_id` | uuid | ● | FK → `especies` | Espécie |
| `recipiente_id` | uuid | ● | FK → `recipientes` | Recipiente solicitado |
| `quantidade` | integer | ● | | Quantidade pedida. Restrição: maior que zero |
| `preco_unitario` | numeric(10,2) | ● | | **Preço unitário informado por quem registra** (RF-55, RN-52). Restrição: maior que zero |

> **O preço é digitado, e o sistema não o calcula.** Não há referência a tabela de preço, piso
> mínimo nem margem: o valor é o que foi negociado na conversa com o cliente, e ao sistema cabe
> guardá-lo. O total do item e o do pedido são derivados de `quantidade` por `preco_unitario`, e não
> materializados.

> **Não há coluna de disponibilidade.** O saldo que a tela exibe ao lado do item (RF-56) é somado
> dos lotes prontos daquela espécie e recipiente a cada consulta. Guardá-lo aqui congelaria uma
> leitura que muda a cada perda registrada, e o item passaria a mentir sobre o estoque de hoje. É a
> mesma decisão que fez a situação do lote ser visão e não coluna (RN-30).

## Resumo

| Área | Entidades | Observação |
|---|---:|---|
| *(transversal)* Acesso e configurações | 4 | `usuarios`, `sessoes`, `eventos_login` e `parametros`, os parâmetros do sistema |
| 1 · Cadastro único | 15 | catálogo (`especies`, `especies_nomes_populares`, `especies_fotos`, `recipientes`, `insumos`), endereço do viveiro (`areas`, `canteiros`), trabalho (`tipos_tarefa`, `turnos_trabalho`), protocolo (`protocolos`, `protocolos_etapas`, `especies_protocolos_tempos`) e o esquema `cadastro` (`pessoas`, `pessoas_papeis`, `pessoas_enderecos`) |
| 2 · Produção | 6 | `semanas`, `atribuicoes`, `atribuicoes_participantes`, `lotes`, `movimentos_lote`, `lotes_etapas` |
| 3 · Comercial | 2 | `pedidos` e `pedidos_itens` |
| **Total** | **27** | mais `situacao_lote` e `lotes_etapas_vencimento`, que são visões e não tabelas |
