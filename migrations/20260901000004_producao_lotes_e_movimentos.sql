-- Migration: 20260901000004_producao_lotes_e_movimentos.sql
-- Descricao: O lote e o razao que explica o seu saldo.
--
-- Requisitos: RF-40 a RF-46, RF-48, RF-47, RF-58, RF-49 · Regras: RN-08 a RN-11, RN-18 a RN-22, RN-28, RN-30
-- Entidades: C8 `batches`, `batch_movements`
--
-- O LOTE E O ENDERECO DA MUDA. Especie e recipiente dizem O QUE a muda e; `bed_id`
-- diz ONDE ela esta. Ate 24/08/2026 o modelo nao tinha resposta para a segunda
-- pergunta, e a rotina de campo nao opera sem ela: a tarefa de repicagem e dada
-- apontando um canteiro, nao uma especie. Justificativa em A1 §7.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE TABLE batches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL UNIQUE,
  species_id         UUID NOT NULL REFERENCES species(id),
  container_id       UUID NOT NULL REFERENCES containers(id),

  -- Nulo APENAS no lote encerrado. Enquanto aberto, todo lote tem canteiro: lote
  -- sem lugar e a situacao que a entidade existe para eliminar. Ao encerrar, o
  -- canteiro e liberado (RN-22).
  bed_id             UUID REFERENCES beds(id),

  -- Reflexivo: e o que a repicagem produz (RN-20) e o que a divisao produz
  -- (RN-44). A muda que passa do tubete para o saco mudou de recipiente, e
  -- recipiente define produto e preco: comercialmente, virou outra coisa.
  -- Percorrer esta cadeia responde, de cada mil sementes semeadas, quantas mudas
  -- chegaram a venda.
  parent_batch_id    UUID REFERENCES batches(id),

  -- Protocolo que rege o lote, fotografado na criacao a partir do recipiente
  -- (RF-58). Nulo enquanto `protocols` nao existir, e tambem quando o recipiente
  -- nao tiver protocolo: o lote e criado e nao cobra etapa nenhuma (C2 UC-22 FA-2).
  protocol_id        UUID,

  initial_quantity   INTEGER NOT NULL,

  -- UNICA QUANTIDADE MATERIALIZADA DO MODELO, e a excecao e declarada em C6 §4. O
  -- saldo poderia ser somado de `batch_movements` a cada leitura. Aqui nao: a tela
  -- de ocupacao le o saldo de todos os lotes abertos de uma vez, no celular, em
  -- rede instavel. `batch_movements` e a fonte que o audita, e divergencia entre os
  -- dois e defeito detectavel.
  current_quantity   INTEGER NOT NULL,

  stage              TEXT NOT NULL DEFAULT 'semeado',

  -- Data em que a leva foi plantada e passou a ocupar o canteiro. E a ancora das
  -- etapas do protocolo que contam da criacao do lote (RN-35).
  planted_at         DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Ordem do lote dentro do canteiro, a partir de 1. Da ao mapa um desenho estavel
  -- (RF-54).
  position           INTEGER,

  closed_at          TIMESTAMPTZ,
  closed_reason      TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT batches_initial_positivo CHECK (initial_quantity > 0),

  -- RN-21: nenhum lote tem saldo negativo. Movimento que levaria o saldo abaixo de
  -- zero significa que a contagem esta errada, e gravar o negativo propagaria o
  -- erro para o estoque.
  CONSTRAINT batches_saldo_nao_negativo CHECK (current_quantity >= 0),

  CONSTRAINT batches_stage_valido CHECK (stage IN
    ('semeado', 'germinado', 'repicado', 'crescimento', 'rustificacao', 'pronto', 'encerrado')),

  -- RN-22: lote encerrado nao ocupa canteiro, e lote aberto ocupa. Os dois lados da
  -- regra, numa restricao so.
  CONSTRAINT batches_encerrado_sem_canteiro CHECK (
    (closed_at IS NULL AND bed_id IS NOT NULL)
    OR (closed_at IS NOT NULL AND bed_id IS NULL)
  ),

  -- RN-43: o motivo do encerramento existe se e somente se o lote estiver
  -- encerrado.
  CONSTRAINT batches_motivo_com_encerramento CHECK (
    (closed_at IS NULL AND closed_reason IS NULL)
    OR (closed_at IS NOT NULL AND closed_reason IN ('saldo_zero', 'expedido', 'dividido'))
  ),

  CONSTRAINT batches_origem_nao_e_ele_mesmo CHECK (parent_batch_id <> id)
);

CREATE INDEX batches_species_idx ON batches (species_id);
CREATE INDEX batches_parent_idx  ON batches (parent_batch_id) WHERE parent_batch_id IS NOT NULL;
CREATE INDEX batches_abertos_idx ON batches (bed_id) WHERE closed_at IS NULL;

-- RF-53: o saldo disponivel e a soma dos lotes PRONTOS daquela especie e
-- recipiente. Este indice e o que torna a consulta do item de pedido barata.
CREATE INDEX batches_prontos_idx
  ON batches (species_id, container_id) WHERE closed_at IS NULL AND stage = 'pronto';

CREATE TRIGGER batches_set_updated_at
  BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- O razao que explica o saldo
-- ------------------------------------------------------------
-- TODO MOVIMENTO PASSA PELA MESMA PORTA. Perda, repicagem, venda, ajuste de
-- contagem e transferencia de canteiro sao linhas daqui, e nao tabelas separadas.
-- Uma entidade propria de perda obrigaria a gravar duas linhas por perda, uma nela
-- e outra aqui, e a divergir quando alguem gravasse so uma.
CREATE TABLE batch_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          UUID NOT NULL REFERENCES batches(id),
  movement_type     TEXT NOT NULL,

  -- Com sinal: positiva na entrada, negativa na saida. Zero apenas em
  -- `transferencia`, em que o que muda e o canteiro, nao a quantidade.
  quantity          INTEGER NOT NULL,

  movement_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  from_bed_id       UUID REFERENCES beds(id),
  to_bed_id         UUID REFERENCES beds(id),

  -- Causa da perda em LISTA FECHADA (RN-10). Campo livre inviabilizaria a analise
  -- por causa, que e para o que RF-50 existe.
  loss_cause        TEXT,

  -- Liga o movimento a tarefa que o causou, e e OPCIONAL: movimento sem origem e o
  -- ajuste manual da gerencia, que existe e precisa caber. Prende-lo a uma origem
  -- obrigatoria faria a correcao de um erro de digitacao ser impossivel sem
  -- inventar uma perda que nao houve. A FK e acrescentada na migration da agenda.
  assignment_id     UUID,

  -- RN-60: todo registro tem autor identificado.
  recorded_by       UUID NOT NULL REFERENCES users(id),

  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT batch_movements_type_valido CHECK (movement_type IN
    ('entrada', 'perda', 'repicagem_saida', 'repicagem_entrada',
     'venda', 'ajuste_contagem', 'transferencia')),

  -- A causa existe se e somente se o movimento for perda.
  CONSTRAINT batch_movements_causa_so_em_perda CHECK (
    (movement_type = 'perda' AND loss_cause IN ('seca', 'praga', 'geada', 'manuseio', 'outro'))
    OR (movement_type <> 'perda' AND loss_cause IS NULL)
  ),

  -- Transferencia muda o canteiro sem mudar o saldo; todo o resto muda o saldo sem
  -- mudar o canteiro.
  CONSTRAINT batch_movements_transferencia_coerente CHECK (
    (movement_type = 'transferencia'
       AND quantity = 0 AND from_bed_id IS NOT NULL AND to_bed_id IS NOT NULL)
    OR
    (movement_type <> 'transferencia'
       AND quantity <> 0 AND from_bed_id IS NULL AND to_bed_id IS NULL)
  )
);

CREATE INDEX batch_movements_batch_idx ON batch_movements (batch_id, movement_date);

-- RF-50, RF-51: a analise de perdas filtra por periodo e causa, e a mortalidade
-- soma as perdas do lote.
CREATE INDEX batch_movements_perdas_idx
  ON batch_movements (movement_date, loss_cause) WHERE movement_type = 'perda';

COMMENT ON TABLE batches IS
  'A leva de mudas da mesma especie, no mesmo recipiente, ocupando um canteiro. RN-18, RN-19.';
COMMENT ON COLUMN batches.current_quantity IS
  'Saldo vivo, materializado de proposito. batch_movements e a fonte que o audita.';
COMMENT ON COLUMN batches.parent_batch_id IS
  'Lote de origem. A repicagem nao move o lote: cria um novo apontando para ele. RN-20.';
COMMENT ON TABLE batch_movements IS
  'Razao do saldo do lote. Toda alteracao de current_quantity tem uma linha aqui. Perda e ajuste sao tipos, e nao tabelas. RN-10, RN-09.';
