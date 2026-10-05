# Changelog do banco

Uma entrada por migration nova, como pede o `CLAUDE.md`. As migrations até `20260901000008` são o
schema inicial em português e estão descritas no `C8`.

## 04/10/2026 · `20261004000001_lotes_etapas_acoes.sql`

- **Tabela nova `lotes_etapas_acoes`** (RF-66): o histórico do que a gerência faz com a etapa do
  protocolo fora da agenda, uma linha por ação. `tipo_acao` é `adiamento` (com `dias` > 0) ou
  `conclusao_sem_agenda`; `ocorrencia` guarda a ocorrência afetada; `registrado_por` aponta para
  `usuarios`. Chave estrangeira composta para `lotes_etapas`, com exclusão em cascata.
- **`lotes_etapas_vencimento` soma o adiamento** (RN-63): `proximo_vencimento` passa a incluir os
  dias adiados da ocorrência que está por vir. Concluída a etapa, o adiamento deixa de contar sem
  que nada seja apagado. As colunas da visão não mudam, e `situacao_lote` herda o efeito.
- `COMMENT ON COLUMN atribuicoes.e_recorrente` reescrito: a cópia manual da semana saiu (RF-27), e a
  recorrente nasce sozinha na semana seguinte.
- Compatível: tabela nova e visão com as mesmas colunas.
- Na mesma alteração, fora do banco: "Pedem providência" entra abaixo da agenda da semana, e cada
  item, como cada sugestão do protocolo, abre postergar, adicionar na agenda e concluir sem agenda; a
  tarefa atrasada se posterga mesmo para a semana seguinte. Sai "Copiar semana passada"; o ⋯ da
  semana vira o botão "+ Tarefa"; saem a linha da jornada da agenda e a observação do estoque
  disponível; no celular, as setas de semana deixam de aparecer duplicadas.
- 05/10/2026, sem migration: as saídas viram Postergar, Marcar na agenda e Confirmar tarefa, cada
  uma na sua tela. Confirmar a etapa feita fora da agenda lança a tarefa já confirmada em
  `atribuicoes`, e `conclusao_sem_agenda` deixa de ser gravado (o valor continua aceito, para as
  linhas antigas).
- 05/10/2026, sem migration: postergar conta de hoje quando o prazo já passou (RN-63). Na etapa
  vencida, `lotes_etapas_acoes.dias` passa a incluir o atraso até a data da ação, e a visão segue
  só somando. "Marcar na agenda" da tarefa atrasada a traz para a semana de hoje
  (`atribuicoes.semana_id` muda na alteração), num dia que não seja anterior a hoje. Na semana que
  já pode ser fechada, a grade pinta a não confirmada de amarelo com "?" e a confirmada de verde.

## 03/10/2026 · `20261003000001_lote_altura_estoque_disponivel.sql`

- **Não existe mais "muda pronta" como condição de venda** (RN-06). Toda muda de lote aberto está
  à venda, em qualquer fase, e o que diz se ela atende o item é a espécie, o recipiente e a altura.
  A fase `pronto` continua como etapa do manejo.
- **O lote ganha a altura da muda** (RF-65). Coluna nova `lotes.altura_m` (numeric(4,2), nula =
  "ainda não medida", de 0 a 20 m, como `pedidos_itens.altura_m`), registrada na ficha do lote e
  guardando só a medida mais recente.
- O índice parcial `lotes_prontos_idx` (só fase `pronto`) dá lugar a `lotes_disponiveis_idx`, sobre
  todos os lotes abertos.
- Compatível: a coluna é opcional, e quem não a conhece segue gravando lote sem ela.
- Na mesma alteração, fora do banco: o item do pedido mostra "Disponível" (lotes com altura igual ou
  maior que a pedida) e, faltando, quanto há com até 20 cm a menos e quanto está sem altura medida
  (RN-62). Sai o "Pronto" e o "em produção". `/producao/saldo` passa a "Estoque disponível".

## 01/10/2026 · `20261001000002_atribuicoes_prioridade_opcional.sql`

- **A precedência de desenho vira escolha manual** (RF-26). `atribuicoes.prioridade_em` perde o
  NOT NULL e o padrão, e todas as linhas voltam a nulo. Nula segue a regra calculada na tela: onde
  duas tarefas da mesma pessoa se cruzam, a de maior duração fica com a faixa de cima (60% da
  altura) e a outra com a de baixo (40%); no empate, a que começa primeiro. "Tornar principal"
  grava o valor, e entre duas escolhidas a mais recente vence.
- Compatível: quem grava a coluna continua gravando; quem lê precisa aceitar nulo.
- Na mesma alteração, fora do banco: o Gantt da semana comprime o almoço num divisor, o dia sob o
  mouse se expande, o card adapta o conteúdo à largura sem quebrar palavra, a borda tracejada sai,
  e entram a linha do agora, o balão de horário no arrasto, o ímã nas bordas da jornada, a barra
  de ocupação por pessoa e dia e o Ctrl+Z. O parágrafo de instruções sob a grade sai.

## 01/10/2026 · `20261001000001_atribuicoes_prioridade.sql`

- **A tarefa ganha a precedência de desenho na grade da semana** (RF-26). Coluna nova
  `atribuicoes.prioridade_em` (timestamptz, NOT NULL, padrão `now()`), preenchida com `criado_em`
  nas linhas existentes. Onde duas tarefas da mesma pessoa se cruzam, a de valor maior aparece
  inteira e a outra minimizada embaixo; arrastar a minimizada para cima renova o valor dela.
- Compatível: a coluna tem padrão, e quem não a conhece segue gravando sem ela.
- Na mesma alteração, fora do banco: a linha da pessoa no Gantt deixa de crescer com a
  sobreposição, e qualquer ponto vazio da grade lança tarefa, já com a hora livre do turno quando
  ele tem outra tarefa.
- Depois, ainda fora do banco: no arrasto, a tarefa de um grupo se move ao mesmo tempo na linha de
  cada pessoa, e a barra minimizada ganha a borda para mudar a duração.

## 30/09/2026 · `20260930000003_semana_aberta_fechada.sql`

- **A semana passa a ter dois estados, `aberta` e `fechada`.** `rascunho` e `publicada` viram
  `aberta`; o padrão de `semanas.situacao` passa a ser `aberta`, e a constraint
  `semanas_situacao_valida` aceita só os dois. Sai a coluna `publicada_por` (e a relação
  `usuarios` → `semanas`): publicar não tinha público, e abrir era redundante, porque o primeiro
  lançamento já cria a semana.
- **Não é compatível**: código que grave `rascunho` ou `publicada`, ou leia `publicada_por`, falha.
  A migration converte as linhas existentes antes de prender a constraint nova.
- Na mesma alteração, fora do banco: saem os botões "Abrir semana" e "Publicar", e o seletor
  Dia/Semana. A aba Agenda de `/producao` mostra o dia em cima e a semana dele embaixo;
  `/producao/agenda` redireciona para lá.
## 30/09/2026 · `20260930000002_dia_do_viveiro_nas_visoes.sql`

- **O "hoje" das visões é o dia do viveiro.** Função nova `hoje_no_viveiro()` (o dia em
  `America/Sao_Paulo`), no lugar de `CURRENT_DATE` em `situacao_lote` e `lotes_etapas_vencimento`.
  Com o banco em UTC (Neon), das 21h à meia-noite o atraso saía com um dia a mais. O padrão de
  `movimentos_lote.data_movimento` passa a usar a mesma função.
- Compatível: as visões mantêm as mesmas colunas (`CREATE OR REPLACE`).

## 30/09/2026 · `20260930000001_envios_recebidos.sql`

- **A chave de idempotência do registro feito sem conexão** (RNF-05, UC-20 FA-3). Tabela nova
  `envios_recebidos`: `chave` (uuid, PK, gerada no aparelho), `tipo` com CHECK em `perda`,
  `contagem` e `confirmacao_tarefa`, `usuario_id` (FK `usuarios`), `resposta` (jsonb, o que o
  servidor respondeu da primeira vez) e `recebido_em`. A chave grava na mesma transação do
  registro; o reenvio recebe a resposta guardada e não grava de novo.
- Compatível: tabela nova, nasce vazia.
- Na mesma alteração, fora do banco (plano P1, Fase 9): manifest e ícones gerados por código, service
  worker em `public/sw.js`, página `/offline`, a rota `POST /api/registros` no lugar das Server
  Actions de perda, contagem e confirmação de tarefa, a fila no IndexedDB do aparelho, o indicador
  de pendentes e a limpeza do aparelho ao sair. Dependência nova de desenvolvimento: `fake-indexeddb`.

## 29/09/2026 · `20260929000001_viagens.sql`

- **A viagem de entrega.** Tabelas novas `viagens` (dia, partida em texto com coordenada opcional,
  `situacao` em `montando`, `roteirizando`, `carregando` e `pronta`, que é também a etapa em que o
  planejamento parou, `sugerir_ordem`, distância e tempo da rota sugerida, `criado_por`) e
  `viagens_paradas` (ordem com `UNIQUE (viagem_id, ordem)` deferível, pedido opcional com
  `UNIQUE (viagem_id, pedido_id)`, descrição e endereço da parada avulsa, CHECK de pedido ou
  descrição).
- **Coordenada guardada no endereço.** `cadastro.pessoas_enderecos` ganha `lat`, `lng` e
  `geocodificado_em`, e o gatilho `pessoas_enderecos_zera_coordenada` as apaga quando o texto do
  endereço muda. `geocodificado_em` com coordenada nula é "o serviço procurou e não achou".
- **Dois parâmetros de texto**: `comercial.viagem_partida_agrolandia` e
  `comercial.viagem_partida_itapema`.
- **`pedidos_historico_muda_de_situacao` afrouxada**: a linha sem troca de situação passa a entrar
  quando traz observação. É a nota da data de entrega marcada no planejamento da viagem.
- Compatível: tabelas e colunas novas nascem vazias, e tudo o que a restrição anterior aceitava a
  nova aceita.
- Na mesma alteração, fora do banco (plano P14): a rotina `/pedidos/planejar/[data]` em três etapas
  (carga, rota, carregamento), a sugestão de ordem pelo OpenRouteService (`ORS_API_KEY`, só no
  servidor), o link do Google Maps, o calendário abrindo a rotina e mostrando "Continuar", e
  `concluirCarga` levando a viagem a pronta. Dependências novas: `@dnd-kit/core`, `@dnd-kit/sortable`
  e `@dnd-kit/utilities`.

## 27/09/2026 · `20260927000001_conferencia_complemento.sql`

- **"Tem parte" completa em outro recipiente.** Nova coluna `pedidos_itens.complementa_item_id`
  (uuid, opcional, FK para `pedidos_itens` com `ON DELETE CASCADE`) e índice parcial. O complemento
  é um item da mesma espécie, de topo, já respondido e sem preço, que a chefia precifica na
  negociação. O CHECK `pedidos_itens_complemento_especifico` o impede de ser genérico, filho ou
  complemento de si mesmo.
- Compatível: a coluna nasce nula, que é "item pedido pelo cliente", e nada é migrado.
- Na mesma alteração, fora do banco (plano P13): o cartão da conferência pinta no toque; "Nada
  difere do pedido." perde o conselho; saem os textos "Vai junto com a resposta do item.", "Grava
  ao sair do campo.", "Gravando…", "Gravado." e "Se não contou, deixe em branco.".

## 24/09/2026 · `20260925000001_conferencia_altura_e_quantidade_opcional.sql`

- **A conferência registra a altura encontrada.** Nova coluna `pedidos_itens.altura_disponivel_m`
  (numeric(4,2), opcional), com os CHECKs `pedidos_itens_altura_disponivel_positiva` (0 a 20 m) e
  `pedidos_itens_altura_disponivel_com_muda` (não existe com `quantidade_disponivel` zero). Só é
  gravada quando difere da pedida, e a aprovação a copia para `altura_m`.
- **"Tem", sem número, no item sem quantidade.** `pedidos_itens_disponibilidade_coerente` ganha o
  ramo `quantidade IS NULL AND disponivel = true AND quantidade_disponivel IS NULL`: a gerência
  diz que tem sem contar, e a chefia acerta o número na negociação.
- Compatível: nada é migrado, e tudo o que a constraint anterior aceitava a nova aceita.
- Na mesma alteração, fora do banco (plano P12): a conferência passa a ter uma regra só para todo
  item, com "Tem parte" perguntando tudo o que o cliente especificou; o genérico ganha "Não tem" e
  "Tem parte", e a composição com soma menor grava o pai como parcial.

## 24/09/2026 · `20260924000002_generico_observacao_opcional.sql`

- **O texto do item genérico passa a ser opcional.** Sai o CHECK
  `pedidos_itens_generico_com_especificacao`, posto pela `20260924000001`. Na tela o campo se chama
  **Observação**; a coluna continua `especificacao`, e só no genérico
  (`pedidos_itens_especificacao_so_no_generico` não muda).
- Compatível: nada é migrado, e todo item gravado continua válido.
- Na mesma alteração, fora do banco: os rótulos deixam de dizer "(opcional)" e o campo obrigatório
  ganha um asterisco vermelho depois do rótulo.

## 24/09/2026 · `20260924000001_pedido_orcamento_incompleto.sql`

- **O item do pedido pode nascer sem recipiente.** `pedidos_itens.recipiente_id` perde o
  `NOT NULL`: nulo é "o cliente não disse o tamanho". A aprovação exige o recipiente em todo item
  vendável, e a trava é do código (`confirmarPedido`).
- **A conferência responde sobre o item sem quantidade.** `pedidos_itens_disponibilidade_coerente`
  é trocada por uma que aceita, no item sem quantidade, `quantidade_disponivel` de zero em diante
  com `disponivel` verdadeiro exatamente quando ela passa de zero ("tenho 350"). O item com
  quantidade segue as regras de antes, e o genérico composto fica verdadeiro e sem número.
- `pedidos_itens_recipiente_disponivel_com_muda` passa a ser
  `recipiente_disponivel_id IS NULL OR quantidade_disponivel IS DISTINCT FROM 0`, o que admite
  "tem tudo, em 17x22" sem mudar o sentido de "não tem nenhuma".
- Novo CHECK `pedidos_itens_generico_com_especificacao`: o genérico precisa dizer o que foi pedido.
- **Deixou de valer**: a exigência de quantidade para abrir a conferência (`mudarSituacao`), que a
  migration `20260923000001` tinha posto no código.
- Migração de linhas, antes das constraints novas: genérico sem `especificacao` recebe
  `'Mudas nativas'`; item não genérico sem quantidade e com resposta gravada volta a "por conferir".
- Compatível: todo item já gravado tem recipiente, e continua como estava.

## 23/09/2026 · `20260923000001_pedido_item_quantidade_opcional.sql`

- **A quantidade do item do pedido passa a ser opcional no cadastro.** `pedidos_itens.quantidade`
  perde o `NOT NULL`; o CHECK `pedidos_itens_quantidade_positiva` continua recusando zero e
  negativo.
- O cliente costuma dizer as espécies antes de dizer quantas quer de cada uma. Exigir o número no
  cadastro obrigava a inventar um valor provisório, pela mesma razão que já tinha tirado o preço
  do cadastro.
- **A quantidade é exigida antes da conferência**: `mudarSituacao` recusa passar o pedido a
  `verificando` enquanto houver item sem quantidade. A trava é do código porque depende da
  situação do pedido, que o CHECK de linha não enxerga.
- `definirPrecos` também recusa preço em item sem quantidade, para que a regra "preço pede
  quantidade" não dependa só da ordem das situações.
- Compatível: todo item já gravado tem quantidade, e continua como estava.

## 22/09/2026 · `20260922000003_eventos_login_por_ip.sql`

- **Índice parcial `eventos_login_ip_recente`** em `eventos_login (ip, criado_em DESC) WHERE NOT sucesso`.
- O login passa a recusar a origem com 20 falhas nos últimos 15 minutos, somadas entre todos os
  logins, antes de gastar o scrypt (SEC-003 do relatório de segurança). O bloqueio por usuário
  continua como estava; este fecha a varredura de uma senha contra vários usuários.
- Compatível: só acrescenta índice, nenhuma coluna muda.

## 22/09/2026 · `20260922000002_pedido_item_altura.sql`

- **O item do pedido passa a registrar a altura da muda pedida.** `pedidos_itens` ganha
  `altura_m NUMERIC(4,2)`, opcional, com o CHECK `pedidos_itens_altura_positiva` aceitando de zero
  exclusive até 20 metros.
- O cliente não pede só espécie e recipiente: pede "ipê de 1,20". Até aqui a altura ia para a
  observação do pedido, em texto solto, ou se perdia na conversa, e a conferência no pátio não
  tinha como saber qual muda separar quando o mesmo par espécie e recipiente tem levas de tamanhos
  diferentes.
- **Em metros, porque é como o viveiro fala**: 0,80, 1,20. Dois decimais são precisão de sobra para
  o que se mede com trena.
- **Nula é "o cliente não pediu altura"**, que é o caso comum, já que o recipiente costuma
  determinar o porte. O limite de 20 metros não é regra de negócio: é defesa contra a quantidade
  digitada no campo errado.
- O filho do item genérico herda a altura do pai, pela mesma razão que já herdava o preço.
- Compatível: a coluna nasce nula, e todo item já gravado continua como estava.

## 22/09/2026 · `20260922000001_pedido_preco_apos_conferencia.sql`

- **O preço do item passa a ser digitado depois da conferência.** `pedidos_itens.preco_unitario`
  perde o `NOT NULL`, e o CHECK `pedidos_itens_preco_positivo` passa a aceitar nulo, continuando a
  recusar zero e negativo.
- Quem registra o pedido está no meio de uma conversa de WhatsApp e anota espécie, recipiente e
  quantidade. O valor se fecha quando a gerência já disse o que existe no pátio, porque é a
  conferência que determina quantas mudas serão vendidas e em que recipiente. Exigir o preço no
  cadastro obrigava a escrever um número provisório, e número provisório que ninguém volta para
  corrigir é venda registrada errada.
- **Nulo é "ainda não precificado", e não "de graça".** A aprovação do pedido recusa item de topo
  sem preço (`confirmarPedido`), e é essa recusa, e não a coluna, que impede uma venda de ser
  registrada sem valor. O total do pedido também fica indefinido enquanto faltar um preço: uma soma
  parcial anunciaria uma venda menor que a verdadeira.
- O preço continua **digitado** (RN-50): nada de tabela de preço, piso ou margem. Só mudou o momento.
- Compatível: nenhuma coluna saiu, e todo item já gravado continua com o preço que tinha.

## 21/09/2026 · `20260921000002_pedidos_verificacao_e_cargas.sql`

- **As duas etapas de campo do pedido ganham onde ser registradas.** A migration anterior deu ao
  pedido oito situações, mas `verificando`, `separando` e `pronto_envio` eram só nomes: o trabalho
  que acontece dentro de cada uma não tinha coluna nenhuma.
- `pedidos_itens` ganha `disponivel`, `quantidade_disponivel`, `recipiente_disponivel_id` e
  `observacoes_disponibilidade`: o que a gerência responde item a item, andando no pátio.
  **Parcial e indisponível compartilham `disponivel = false`**, e quem os distingue é a quantidade,
  zero ou maior que zero, com o CHECK `pedidos_itens_disponibilidade_coerente` garantindo a forma.
- **Isto não contradiz a `20260901000006`**, que declarou não haver coluna de disponibilidade: o
  saldo continua somado dos lotes a cada consulta (RF-56). Estas colunas não são o saldo, são a
  resposta de uma pessoa, com autor e hora no histórico.
- Item genérico: `generico`, `item_pai_id`, `especificacao` e a tabela
  `pedidos_itens_especies_permitidas`, mais `especie_id` anulável. O cliente pede "500 mudas
  nativas" e é a gerência quem escolhe as espécies na conferência. **Sem nenhuma linha de escopo,
  qualquer espécie serve**, e é por isso que o escopo é representado pela ausência.
- `pedidos_cargas` e `pedidos_cargas_itens`: uma carga é uma viagem do caminhão, e o pedido só fica
  pronto quando todas estão. A situação da carga tem **dois valores, `pendente` e `pronto`**, e não
  três: um estado intermediário seria gravado no primeiro item marcado e não diria nada que o
  progresso de itens separados já não diga.
- `separado` é confirmação, e não contagem: quantas contar já está em `quantidade`, e um segundo
  número abriria a pergunta do que fazer quando os dois divergem.
- Compatível: nenhuma coluna saiu, e todo item existente nasce com `disponivel` nulo, que é
  "ninguém conferiu ainda".

## 21/09/2026 · `20260921000001_pedidos_fluxo_situacao.sql`

*Entrada escrita em 21/09/2026, junto com a migration seguinte: a original ficou faltando.*

- O pedido passa de três situações a **oito**: `cadastrado`, `verificando`, `verificado`,
  `pendente_alteracao`, `aprovado`, `separando`, `pronto_envio` e `cancelado`. `rascunho` virou
  `cadastrado` e `confirmado` virou `aprovado`, com as linhas existentes migradas antes de a
  constraint nova ser presa.
- `pedidos.precisa_nota` (boolean, **nula** enquanto ninguém respondeu): a pergunta acontece na
  aprovação.
- `pedidos_historico`: toda mudança de situação com autor, data e observação (RN-52). A
  `20260901000006` dispensara o histórico, e o argumento valia para duas transições feitas pela
  mesma pessoa; com oito situações e dois perfis se revezando, "a gerência já conferiu?" deixa de
  ter resposta óbvia.
- Backfill sintético: uma linha por pedido existente, com a situação em que ele está e o autor do
  cadastro, para a ficha não precisar de um caso especial para "pedido antigo sem histórico".

## 19/09/2026 · `20260919000002_situacao_lote_com_protocolo.sql`

- `situacao_lote` recriada com **duas fontes de pendência**: a atribuição planejada atrasada, que já
  existia, e a etapa do protocolo vencida ou em atenção que ninguém lançou (RF-45). A visão nasceu
  antes do protocolo, e como o protocolo sugere sem lançar (RN-41), o mapa pintava de verde
  justamente o lote que ninguém olhou.
- Coluna nova `protocolo_etapa_pendente_id`; `atribuicao_pendente_id` passa a ser nula quando a
  pendência vem do protocolo. Nenhuma coluna saiu, e nada em `src/` lia a visão ainda: o mapa é a
  Fase 7.
- A etapa que já virou tarefa não conta duas vezes: a tarefa carrega `lote_etapa_id`, e a etapa
  correspondente sai da fonte do protocolo.
- A etapa **em atenção** entra como `atencao` sem passar pelos parâmetros `producao.atraso_*`: a
  janela dela é percentual do intervalo (RN-35), e um limite em dias devolveria o calendário fixo.

## 19/09/2026 · `20260919000001_divisao_de_lote.sql`

- `movimentos_lote_tipo_valido` passa a aceitar `divisao_saida` e `divisao_entrada` (RF-40, RN-39).
  O `C8` já os descrevia na lista fechada como especificados e não implementados, e a marca saiu de
  lá na mesma alteração.
- Reusar os tipos da repicagem teria sido mais barato e estaria errado: repicagem é troca de
  recipiente, e a divisão mantém o recipiente. A ficha do lote afirmaria uma troca de vasilhame que
  não houve, e a análise por tipo somaria as duas operações como se fossem a mesma.
- Compatível: nenhuma linha existente muda, e a lista só cresce.

## 18/09/2026 · `20260918000001_protocolo_de_atividades.sql`

- `protocolos`, `protocolos_etapas`, `especies_protocolos_tempos` e `lotes_etapas`: as quatro
  entidades que o `C6` e o `C8` descreviam como especificadas e não implementadas (RF-22 a RF-25,
  RF-46 a RF-53). Onde o `C6` e as figuras discordavam do `C8`, prevaleceu o `C8`: `lotes_etapas`
  tem chave composta, guarda fatos e **não** tem coluna de vencimento.
- Visão `lotes_etapas_vencimento`: próximo vencimento, janela de aviso e situação de cada etapa,
  derivados a cada leitura (RN-40). O tempo efetivo sai da espécie quando ela o sobrescreve (RN-36).
- As chaves estrangeiras que esperavam desde `20260901000004` e `20260901000005`:
  `lotes.protocolo_id` e `atribuicoes.lote_etapa_id`.
- Índice único `atribuicoes_uma_ordem_por_vencimento`: uma ordem em aberto por etapa e vencimento
  (RN-33, RF-50). A garantia é do banco, e não da aplicação: duas telas abertas ao mesmo tempo
  dobrariam a tarefa do dia.
- Dois parâmetros novos: `producao.protocolo_janela_aviso_pct` (20) e
  `producao.protocolo_horizonte_dias` (14).
- **Incompatível, e é o ponto de atenção desta migration:** `lotes.data_plantio` passou a
  `lotes.data_criacao`, e `data_plantio` renasceu anulável, para a data real do plantio que o
  protocolo grava (TA-38). O `DEFAULT CURRENT_DATE` foi retirado de `data_criacao` de propósito: com
  ele, código que escrevesse no nome antigo gravaria hoje em silêncio e deixaria as duas datas
  trocadas, sem nenhuma consulta acusar.

## 15/09/2026 · `20260915000001_tipos_tarefa_area_e_unidade.sql`

- `tipos_tarefa.exige_area` (boolean): área e canteiro só aparecem na confirmação do tipo que o
  declara. CHECK `tipos_tarefa_area_ou_lote` impede declarar junto com lote (RN-24).
- `tipos_tarefa.unidade_medida` (text, lista fechada `un`, `kg`, `g`, `L`, `mL`, padrão `un`).
- `atribuicoes.quantidade_planejada` e `atribuicoes_participantes.quantidade_feita` passam de
  `INTEGER` a `NUMERIC(10,2)`, para quilo e litro com fração.
- Nenhum tipo já cadastrado começa com área ligada: o campo só aparece onde a gerência marcar.
- Compatível: os inteiros gravados cabem sem perda no decimal.

## 15/09/2026 · `20260915000002_tipos_tarefa_area_desligada.sql`

- Desliga `exige_area` nos bancos onde a primeira versão da migration anterior o ligou em massa.
  Em banco novo não muda nada.

## 14/09/2026 · `20260914000001_lotes_posicao_unica.sql`

- Índice único parcial `lotes_posicao_unica_no_canteiro` em `lotes (canteiro_id, posicao)`, só para
  lote aberto com posição. O `C8` já o descrevia; faltava no SQL.
- Compatível: nenhuma coluna muda, e nenhum lote gravado fica em conflito.
