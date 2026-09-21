-- Migration: 20260921000002_pedidos_verificacao_e_cargas.sql
-- Descricao: A verificacao de disponibilidade por item e a contagem para carregar.
--
-- Requisitos: RF-56, RF-57 · Regras: RN-52
-- Entidades: C8 `pedidos_itens`, `pedidos_itens_especies_permitidas`,
--            `pedidos_cargas`, `pedidos_cargas_itens`
--
-- POR QUE ESTA MIGRATION EXISTE. A 20260921000001 deu ao pedido oito situacoes,
-- mas elas ficaram sendo so nomes: `verificando`, `verificado`, `separando` e
-- `pronto_envio` eram alcancadas por um botao que trocava a coluna e gravava o
-- historico. O trabalho que acontece dentro de cada uma nao tinha onde ser
-- registrado. Esta migration da corpo as duas etapas de campo: a gerencia anda
-- no patio e responde item a item se tem a muda, e depois separa a carga,
-- contando o que vai em cada viagem.
--
-- O QUE NAO ENTRA AQUI. Nao ha entrega, roteiro nem motorista: a carga termina
-- quando o pedido fica pronto para envio, e o que acontece na estrada continua
-- fora do sistema.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

-- ------------------------------------------------------------
-- 1. Disponibilidade e item generico em `pedidos_itens`
-- ------------------------------------------------------------
-- A 20260901000006 registrou que nao havia coluna de disponibilidade, e o
-- argumento era bom: o saldo exibido ao lado do item (RF-56) e somado dos lotes
-- a cada consulta, e grava-lo congelaria uma leitura que muda a cada perda.
-- ISSO CONTINUA VERDADE, E ESTAS COLUNAS NAO SAO AQUELE SALDO. O saldo diz o
-- que o viveiro tem; estas colunas dizem o que uma pessoa foi ate o patio
-- conferir e respondeu, com nome e hora no historico. Sao respostas de alguem,
-- nao leitura de estoque, e por isso sao gravadas.

-- O GENERICO NAO TEM ESPECIE, e e o unico motivo de a coluna deixar de ser
-- obrigatoria. "500 mudas nativas, no minimo saco 10x18" e um pedido que o
-- cliente faz sem escolher especie, e e a gerencia quem decide quais entram,
-- na verificacao. O CHECK abaixo devolve a obrigatoriedade para todo o resto.
ALTER TABLE pedidos_itens ALTER COLUMN especie_id DROP NOT NULL;

ALTER TABLE pedidos_itens
  ADD COLUMN disponivel                  BOOLEAN,
  ADD COLUMN quantidade_disponivel       INTEGER,
  ADD COLUMN recipiente_disponivel_id    UUID REFERENCES recipientes(id),
  ADD COLUMN observacoes_disponibilidade TEXT,
  ADD COLUMN generico                    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN item_pai_id                 UUID REFERENCES pedidos_itens(id) ON DELETE CASCADE,
  ADD COLUMN especificacao               TEXT;

-- NULO E "NINGUEM PERGUNTOU AINDA", pelo mesmo motivo de `pedidos.precisa_nota`:
-- os itens que ja existem nunca passaram pela conferencia, e grava-los como
-- `false` seria afirmar uma resposta que ninguem deu. E o nulo que a tela usa
-- para saber o que ainda falta conferir, e que impede concluir a verificacao
-- pela metade.
COMMENT ON COLUMN pedidos_itens.disponivel IS
  'Se o viveiro tem a muda. NULO enquanto a gerencia nao conferiu. Falso com quantidade_disponivel 0 e indisponivel, e com quantidade maior que 0 e parcial.';

-- PARCIAL E INDISPONIVEL COMPARTILHAM `disponivel = false`, e quem os distingue
-- e a quantidade: 0 e "nao tem nenhuma", maior que 0 e "tem so isto". Dois
-- estados numa coluna booleana dariam um terceiro valor que o banco nao tem.
ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_disponibilidade_coerente CHECK (
  (disponivel IS DISTINCT FROM false AND quantidade_disponivel IS NULL)
  OR (disponivel = false AND quantidade_disponivel BETWEEN 0 AND quantidade - 1)
);

-- O recipiente conferido so existe quando ha muda a entregar, e pode ser outro:
-- a gerencia acha as 300 do ipe em saco 17x22 quando o pedido dizia 10x18. Nao
-- e bloqueio, e informacao para a chefia ver na aprovacao.
ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_recipiente_disponivel_com_muda CHECK (
  recipiente_disponivel_id IS NULL OR quantidade_disponivel > 0
);

ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_generico_sem_especie CHECK (
  NOT generico OR especie_id IS NULL
);

ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_especifico_com_especie CHECK (
  generico OR especie_id IS NOT NULL
);

-- A COMPOSICAO TEM UM NIVEL SO. O generico e sempre item de topo, e os filhos
-- que a gerencia cria a partir dele nunca sao genericos. Sem isto, nada impede
-- uma arvore de generico dentro de generico, que nenhuma tela saberia mostrar.
ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_generico_sem_pai CHECK (
  NOT generico OR item_pai_id IS NULL
);

ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_especificacao_so_no_generico CHECK (
  generico OR especificacao IS NULL
);

-- O que o CHECK nao alcanca, e fica com o codigo: que `item_pai_id` aponte para
-- um item generico, e do mesmo pedido. Restricao entre linhas da mesma tabela
-- exigiria trigger, e trigger nao conhece o usuario nem a transacao da tela.
CREATE INDEX pedidos_itens_pai_idx ON pedidos_itens (item_pai_id);

COMMENT ON COLUMN pedidos_itens.generico IS
  'Item sem especie escolhida pelo cliente. A gerencia o decompoe em filhos na verificacao.';
COMMENT ON COLUMN pedidos_itens.item_pai_id IS
  'Item generico que este filho compoe. Nulo no item de topo.';
COMMENT ON COLUMN pedidos_itens.especificacao IS
  'O que o cliente pediu no generico, em texto. So no item generico.';

-- ------------------------------------------------------------
-- 2. Escopo do generico
-- ------------------------------------------------------------
-- SEM NENHUMA LINHA, QUALQUER ESPECIE SERVE. A ausencia e o caso comum ("mudas
-- nativas, quaisquer"), e representa-la como ausencia evita ter de listar as
-- cerca de 150 especies do catalogo toda vez que o cliente nao restringiu nada.
-- Quando ha linhas, e bloqueio rigido: o servidor recusa especie de fora, e nao
-- so deixa de oferece-la na busca da tela.
CREATE TABLE pedidos_itens_especies_permitidas (
  item_id    UUID NOT NULL REFERENCES pedidos_itens(id) ON DELETE CASCADE,
  especie_id UUID NOT NULL REFERENCES especies(id),
  PRIMARY KEY (item_id, especie_id)
);

COMMENT ON TABLE pedidos_itens_especies_permitidas IS
  'Especies que o cliente admite num item generico. Sem linha nenhuma, qualquer especie serve.';

-- ------------------------------------------------------------
-- 3. Cargas
-- ------------------------------------------------------------
-- UMA CARGA E UMA VIAGEM DO CAMINHAO. O pedido de 5.000 mudas que nao cabe de
-- uma vez vira duas ou tres, e cada uma e separada e conferida por inteiro
-- antes de sair. Por isso a carga tem situacao propria: o pedido so fica pronto
-- quando todas estiverem.
CREATE TABLE pedidos_cargas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id     UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,

  -- Sequencial dentro do pedido, e nao global: quem conta no galpao fala em
  -- "carga 1" e "carga 2" deste pedido.
  numero_carga  INTEGER NOT NULL,

  situacao      VARCHAR(20) NOT NULL DEFAULT 'pendente',
  observacoes   TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (pedido_id, numero_carga),

  -- DOIS VALORES, E NAO TRES. Um estado intermediario "separando" seria gravado
  -- no primeiro item marcado e nao mudaria nada: o progresso ja e legivel na
  -- contagem de itens separados da carga, que e o que a tela mostra. Valor que
  -- o codigo nunca escreve e constraint que mente sobre o modelo.
  CONSTRAINT pedidos_cargas_situacao_valida CHECK (situacao IN ('pendente', 'pronto')),
  CONSTRAINT pedidos_cargas_numero_positivo CHECK (numero_carga > 0)
);

CREATE INDEX pedidos_cargas_pedido_idx ON pedidos_cargas (pedido_id, numero_carga);

CREATE TRIGGER pedidos_cargas_define_atualizado_em
  BEFORE UPDATE ON pedidos_cargas
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- O QUE VAI EM CADA VIAGEM. A quantidade pode ser parte do item: as 500 mudas
-- do ipe saem 300 numa carga e 200 na outra, e a soma das cargas tem de
-- reproduzir a quantidade do item, que e conferido no codigo antes de inserir.
--
-- SO ITEM REAL ENTRA AQUI: o pai generico nao e separado nem carregado, quem vai
-- para o caminhao sao os filhos que a gerencia criou na verificacao. Tambem nao
-- da para exprimir em CHECK, e fica com o codigo.
CREATE TABLE pedidos_cargas_itens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carga_id   UUID NOT NULL REFERENCES pedidos_cargas(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES pedidos_itens(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL,

  -- A CONTAGEM E UMA CONFIRMACAO, E NAO UM NUMERO. `separado` diz "conferi",
  -- nao "contei 287 das 300": o numero a contar ja esta em `quantidade`, e
  -- guardar um segundo numero abriria a pergunta do que fazer quando os dois
  -- divergem, que hoje se resolve a chefia editando o pedido. Se um dia a
  -- diferenca precisar ficar registrada, a evolucao e uma coluna ao lado desta.
  separado   BOOLEAN NOT NULL DEFAULT false,

  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (carga_id, item_id),
  CONSTRAINT pedidos_cargas_itens_quantidade_positiva CHECK (quantidade > 0)
);

CREATE INDEX pedidos_cargas_itens_carga_idx ON pedidos_cargas_itens (carga_id);
CREATE INDEX pedidos_cargas_itens_item_idx  ON pedidos_cargas_itens (item_id);

COMMENT ON TABLE pedidos_cargas IS
  'Viagem do caminhao. O pedido fica pronto para envio quando todas as cargas estao prontas.';
COMMENT ON TABLE pedidos_cargas_itens IS
  'Quanto de cada item vai nesta viagem, e se ja foi separado e conferido.';
COMMENT ON COLUMN pedidos_cargas_itens.separado IS
  'Confirmacao de que o item foi contado e posto no lugar de carregamento.';
