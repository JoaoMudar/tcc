# Changelog do banco

Uma entrada por migration nova, como pede o `CLAUDE.md`. As migrations até `20260901000008` são o
schema inicial em português e estão descritas no `C8`.

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
