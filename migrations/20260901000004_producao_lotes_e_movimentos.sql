-- Migration: 20260901000004_producao_lotes_e_movimentos.sql
-- Descricao: O lote e o razao que explica o seu saldo.
--
-- Requisitos: RF-32 a RF-40, RF-46 · Regras: RN-08 a RN-11, RN-18 a RN-22, RN-28, RN-24
-- Entidades: C8 `lotes`, `movimentos_lote`
--
-- O LOTE E O ENDERECO DA MUDA. Especie e recipiente dizem O QUE a muda e; `canteiro_id`
-- diz ONDE ela esta. Ate 24/08/2026 o modelo nao tinha resposta para a segunda
-- pergunta, e a rotina de campo nao opera sem ela: a tarefa de repicagem e dada
-- apontando um canteiro, nao uma especie. Justificativa em A1 §7.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE TABLE lotes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              TEXT NOT NULL UNIQUE,
  especie_id          UUID NOT NULL REFERENCES especies(id),
  recipiente_id       UUID NOT NULL REFERENCES recipientes(id),

  -- Nulo APENAS no lote encerrado. Enquanto aberto, todo lote tem canteiro: lote
  -- sem lugar e a situacao que a entidade existe para eliminar. Ao encerrar, o
  -- canteiro e liberado (RN-22).
  canteiro_id         UUID REFERENCES canteiros(id),

  -- Reflexivo: e o que a repicagem produz (RN-20) e o que a divisao produz
  -- (RN-41). A muda que passa do tubete para o saco mudou de recipiente, e
  -- recipiente define produto e preco: comercialmente, virou outra coisa.
  -- Percorrer esta cadeia responde, de cada mil sementes semeadas, quantas mudas
  -- chegaram a venda.
  lote_origem_id      UUID REFERENCES lotes(id),

  -- Protocolo que rege o lote, fotografado na criacao a partir do recipiente
  -- (RF-46). Nulo enquanto `protocolos` nao existir, e tambem quando o recipiente
  -- nao tiver protocolo: o lote e criado e nao cobra etapa nenhuma (C2 UC-22 FA-2).
  protocolo_id        UUID,

  quantidade_inicial  INTEGER NOT NULL,

  -- UNICA QUANTIDADE MATERIALIZADA DO MODELO, e a excecao e declarada em C6 §4. O
  -- saldo poderia ser somado de `movimentos_lote` a cada leitura. Aqui nao: a tela
  -- de ocupacao le o saldo de todos os lotes abertos de uma vez, no celular, em
  -- rede instavel. `movimentos_lote` e a fonte que o audita, e divergencia entre os
  -- dois e defeito detectavel.
  quantidade_atual    INTEGER NOT NULL,

  fase                TEXT NOT NULL DEFAULT 'semeado',

  -- Data em que a leva foi plantada e passou a ocupar o canteiro. E a ancora das
  -- etapas do protocolo que contam da criacao do lote (RN-33).
  data_plantio        DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Ordem do lote dentro do canteiro, a partir de 1. Da ao mapa um desenho estavel
  -- (RF-44).
  posicao             INTEGER,

  encerrado_em        TIMESTAMPTZ,
  motivo_encerramento TEXT,
  observacoes         TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT lotes_inicial_positivo CHECK (quantidade_inicial > 0),

  -- RN-21: nenhum lote tem saldo negativo. Movimento que levaria o saldo abaixo de
  -- zero significa que a contagem esta errada, e gravar o negativo propagaria o
  -- erro para o estoque.
  CONSTRAINT lotes_saldo_nao_negativo CHECK (quantidade_atual >= 0),

  CONSTRAINT lotes_fase_valida CHECK (fase IN
    ('semeado', 'germinado', 'repicado', 'crescimento', 'rustificacao', 'pronto', 'encerrado')),

  -- RN-22: lote encerrado nao ocupa canteiro, e lote aberto ocupa. Os dois lados da
  -- regra, numa restricao so.
  CONSTRAINT lotes_encerrado_sem_canteiro CHECK (
    (encerrado_em IS NULL AND canteiro_id IS NOT NULL)
    OR (encerrado_em IS NOT NULL AND canteiro_id IS NULL)
  ),

  -- RN-40: o motivo do encerramento existe se e somente se o lote estiver
  -- encerrado.
  CONSTRAINT lotes_motivo_com_encerramento CHECK (
    (encerrado_em IS NULL AND motivo_encerramento IS NULL)
    OR (encerrado_em IS NOT NULL AND motivo_encerramento IN ('saldo_zero', 'expedido', 'dividido'))
  ),

  CONSTRAINT lotes_origem_nao_e_ele_mesmo CHECK (lote_origem_id <> id)
);

CREATE INDEX lotes_especie_idx ON lotes (especie_id);
CREATE INDEX lotes_origem_idx  ON lotes (lote_origem_id) WHERE lote_origem_id IS NOT NULL;
CREATE INDEX lotes_abertos_idx ON lotes (canteiro_id) WHERE encerrado_em IS NULL;

-- RF-43: o saldo disponivel e a soma dos lotes PRONTOS daquela especie e
-- recipiente. Este indice e o que torna a consulta do item de pedido barata.
CREATE INDEX lotes_prontos_idx
  ON lotes (especie_id, recipiente_id) WHERE encerrado_em IS NULL AND fase = 'pronto';

CREATE TRIGGER lotes_define_atualizado_em
  BEFORE UPDATE ON lotes
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- ------------------------------------------------------------
-- O razao que explica o saldo
-- ------------------------------------------------------------
-- TODO MOVIMENTO PASSA PELA MESMA PORTA. Perda, repicagem, venda, ajuste de
-- contagem e transferencia de canteiro sao linhas daqui, e nao tabelas separadas.
-- Uma entidade propria de perda obrigaria a gravar duas linhas por perda, uma nela
-- e outra aqui, e a divergir quando alguem gravasse so uma.
CREATE TABLE movimentos_lote (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id             UUID NOT NULL REFERENCES lotes(id),
  tipo_movimento      TEXT NOT NULL,

  -- Com sinal: positiva na entrada, negativa na saida. Zero apenas em
  -- `transferencia`, em que o que muda e o canteiro, nao a quantidade.
  quantidade          INTEGER NOT NULL,

  data_movimento      DATE NOT NULL DEFAULT CURRENT_DATE,
  canteiro_origem_id  UUID REFERENCES canteiros(id),
  canteiro_destino_id UUID REFERENCES canteiros(id),

  -- Causa da perda em LISTA FECHADA (RN-10). Campo livre inviabilizaria a analise
  -- por causa, que e para o que RF-41 existe.
  causa_perda         TEXT,

  -- Liga o movimento a tarefa que o causou, e e OPCIONAL: movimento sem origem e o
  -- ajuste manual da gerencia, que existe e precisa caber. Prende-lo a uma origem
  -- obrigatoria faria a correcao de um erro de digitacao ser impossivel sem
  -- inventar uma perda que nao houve. A FK e acrescentada na migration da agenda.
  atribuicao_id       UUID,

  -- RN-54: todo registro tem autor identificado.
  registrado_por      UUID NOT NULL REFERENCES usuarios(id),

  observacoes         TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT movimentos_lote_tipo_valido CHECK (tipo_movimento IN
    ('entrada', 'perda', 'repicagem_saida', 'repicagem_entrada',
     'venda', 'ajuste_contagem', 'transferencia')),

  -- A causa existe se e somente se o movimento for perda.
  CONSTRAINT movimentos_lote_causa_so_em_perda CHECK (
    (tipo_movimento = 'perda' AND causa_perda IN ('seca', 'praga', 'geada', 'manuseio', 'outro'))
    OR (tipo_movimento <> 'perda' AND causa_perda IS NULL)
  ),

  -- Transferencia muda o canteiro sem mudar o saldo; todo o resto muda o saldo sem
  -- mudar o canteiro.
  CONSTRAINT movimentos_lote_transferencia_coerente CHECK (
    (tipo_movimento = 'transferencia'
       AND quantidade = 0 AND canteiro_origem_id IS NOT NULL AND canteiro_destino_id IS NOT NULL)
    OR
    (tipo_movimento <> 'transferencia'
       AND quantidade <> 0 AND canteiro_origem_id IS NULL AND canteiro_destino_id IS NULL)
  )
);

CREATE INDEX movimentos_lote_lote_idx ON movimentos_lote (lote_id, data_movimento);

-- RF-41, RF-42: a analise de perdas filtra por periodo e causa, e a mortalidade
-- soma as perdas do lote.
CREATE INDEX movimentos_lote_perdas_idx
  ON movimentos_lote (data_movimento, causa_perda) WHERE tipo_movimento = 'perda';

COMMENT ON TABLE lotes IS
  'A leva de mudas da mesma especie, no mesmo recipiente, ocupando um canteiro. RN-18, RN-19.';
COMMENT ON COLUMN lotes.quantidade_atual IS
  'Saldo vivo, materializado de proposito. movimentos_lote e a fonte que o audita.';
COMMENT ON COLUMN lotes.lote_origem_id IS
  'Lote de origem. A repicagem nao move o lote: cria um novo apontando para ele. RN-20.';
COMMENT ON TABLE movimentos_lote IS
  'Razao do saldo do lote. Toda alteracao de quantidade_atual tem uma linha aqui. Perda e ajuste sao tipos, e nao tabelas. RN-10, RN-09.';
