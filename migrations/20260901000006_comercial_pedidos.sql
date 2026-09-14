-- Migration: 20260901000006_comercial_pedidos.sql
-- Descricao: Cadastro de pedidos.
--
-- Requisitos: RF-54 a RF-58 · Regras: RN-44, RN-50, RN-52
-- Entidades: C8 `pedidos`, `pedidos_itens`
--
-- DUAS TABELAS, E E O TAMANHO CERTO. Nao ha carga, separacao, entrega, cotacao nem
-- historico de estados: essas etapas existem na operacao e continuam acontecendo
-- fora do sistema. O que o sistema garante e que o registro do que foi vendido nao
-- mude depois de fechado, que e a condicao para ele servir de historico.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE TABLE pedidos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido SERIAL NOT NULL UNIQUE,

  -- APONTA PARA A IDENTIDADE UNICA, e nao para uma tabela de clientes (RN-47): o
  -- cliente e uma pessoa que exerce o papel de cliente. Uma tabela propria
  -- duplicaria nome, telefone e documento de quem tambem e fornecedor.
  cliente_id    UUID NOT NULL REFERENCES cadastro.pessoas(id),

  -- ENUMERACAO, E NAO CHAVE ESTRANGEIRA (RN-44). Canal de venda e lista fechada de
  -- cinco valores sem atributos proprios: virar entidade so se justificaria se ele
  -- carregasse margem ou preco, que e justamente o que saiu do escopo.
  canal_venda   VARCHAR(50) NOT NULL DEFAULT 'atacado',

  situacao      VARCHAR(30) NOT NULL DEFAULT 'rascunho',
  data_entrega  DATE,
  observacoes   TEXT,

  -- RN-54: todo registro tem autor identificado.
  criado_por    UUID NOT NULL REFERENCES usuarios(id),

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pedidos_canal_valido CHECK (canal_venda IN
    ('atacado', 'compensacao', 'paisagismo', 'prefeitura', 'varejo')),

  -- RN-50: tres situacoes, e o que o negocio precisa saber e em qual delas o pedido
  -- esta. Uma tabela de historico existiria para responder quem mudou o que e
  -- quando, pergunta que um viveiro de nove pessoas resolve perguntando.
  CONSTRAINT pedidos_situacao_valida CHECK (situacao IN ('rascunho', 'confirmado', 'cancelado'))
);

CREATE INDEX pedidos_cliente_idx ON pedidos (cliente_id);
CREATE INDEX pedidos_periodo_idx ON pedidos (criado_em DESC);
CREATE INDEX pedidos_canal_idx   ON pedidos (canal_venda);

CREATE TRIGGER pedidos_define_atualizado_em
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

CREATE TABLE pedidos_itens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id      UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  especie_id     UUID NOT NULL REFERENCES especies(id),
  recipiente_id  UUID NOT NULL REFERENCES recipientes(id),
  quantidade     INTEGER NOT NULL,

  -- O PRECO E DIGITADO, e o sistema nao o calcula (RF-55, RN-52). Nao ha
  -- referencia a tabela de preco, piso minimo nem margem: o valor e o que foi
  -- negociado na conversa com o cliente, e ao sistema cabe guarda-lo.
  preco_unitario NUMERIC(10,2) NOT NULL,

  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pedidos_itens_quantidade_positiva CHECK (quantidade > 0),
  CONSTRAINT pedidos_itens_preco_positivo CHECK (preco_unitario > 0)
);

CREATE INDEX pedidos_itens_pedido_idx ON pedidos_itens (pedido_id);

CREATE TRIGGER pedidos_itens_define_atualizado_em
  BEFORE UPDATE ON pedidos_itens
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- NAO HA COLUNA DE DISPONIBILIDADE. O saldo que a tela exibe ao lado do item
-- (RF-56) e somado dos lotes prontos daquela especie e recipiente a cada consulta.
-- Guarda-lo aqui congelaria uma leitura que muda a cada perda registrada, e o item
-- passaria a mentir sobre o estoque de hoje. E a mesma decisao que fez a situacao
-- do lote ser visao e nao coluna (RN-30).

COMMENT ON TABLE pedidos IS
  'Pedido. Tres situacoes; confirmado nao aceita alteracao de item. RF-57, RN-50.';
COMMENT ON COLUMN pedidos.cliente_id IS
  'Pessoa do cadastro unico que exerce o papel de cliente. RN-47.';
COMMENT ON COLUMN pedidos_itens.preco_unitario IS
  'Preco unitario informado por quem registra. O sistema nao o calcula. RN-52.';
