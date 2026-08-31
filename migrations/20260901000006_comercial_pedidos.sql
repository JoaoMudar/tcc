-- Migration: 20260901000006_comercial_pedidos.sql
-- Descricao: Cadastro de pedidos.
--
-- Requisitos: RF-58 a RF-62 · Regras: RN-44, RN-50, RN-52
-- Entidades: C8 `orders`, `order_items`
--
-- DUAS TABELAS, E E O TAMANHO CERTO. Nao ha carga, separacao, entrega, cotacao nem
-- historico de estados: essas etapas existem na operacao e continuam acontecendo
-- fora do sistema. O que o sistema garante e que o registro do que foi vendido nao
-- mude depois de fechado, que e a condicao para ele servir de historico.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE TABLE orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number  SERIAL NOT NULL UNIQUE,

  -- APONTA PARA A IDENTIDADE UNICA, e nao para uma tabela de clientes (RN-47): o
  -- cliente e uma pessoa que exerce o papel de cliente. Uma tabela propria
  -- duplicaria nome, telefone e documento de quem tambem e fornecedor.
  customer_id   UUID NOT NULL REFERENCES cadastro.parties(id),

  -- ENUMERACAO, E NAO CHAVE ESTRANGEIRA (RN-44). Canal de venda e lista fechada de
  -- cinco valores sem atributos proprios: virar entidade so se justificaria se ele
  -- carregasse margem ou preco, que e justamente o que saiu do escopo.
  sale_channel  VARCHAR(50) NOT NULL DEFAULT 'atacado',

  status        VARCHAR(30) NOT NULL DEFAULT 'rascunho',
  delivery_date DATE,
  notes         TEXT,

  -- RN-54: todo registro tem autor identificado.
  created_by    UUID NOT NULL REFERENCES users(id),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT orders_canal_valido CHECK (sale_channel IN
    ('atacado', 'compensacao', 'paisagismo', 'prefeitura', 'varejo')),

  -- RN-50: tres situacoes, e o que o negocio precisa saber e em qual delas o pedido
  -- esta. Uma tabela de historico existiria para responder quem mudou o que e
  -- quando, pergunta que um viveiro de nove pessoas resolve perguntando.
  CONSTRAINT orders_status_valido CHECK (status IN ('rascunho', 'confirmado', 'cancelado'))
);

CREATE INDEX orders_cliente_idx ON orders (customer_id);
CREATE INDEX orders_periodo_idx ON orders (created_at DESC);
CREATE INDEX orders_canal_idx   ON orders (sale_channel);

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  species_id   UUID NOT NULL REFERENCES species(id),
  container_id UUID NOT NULL REFERENCES containers(id),
  quantity     INTEGER NOT NULL,

  -- O PRECO E DIGITADO, e o sistema nao o calcula (RF-59, RN-52). Nao ha
  -- referencia a tabela de preco, piso minimo nem margem: o valor e o que foi
  -- negociado na conversa com o cliente, e ao sistema cabe guarda-lo.
  unit_price   NUMERIC(10,2) NOT NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT order_items_quantidade_positiva CHECK (quantity > 0),
  CONSTRAINT order_items_preco_positivo CHECK (unit_price > 0)
);

CREATE INDEX order_items_order_idx ON order_items (order_id);

CREATE TRIGGER order_items_set_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- NAO HA COLUNA DE DISPONIBILIDADE. O saldo que a tela exibe ao lado do item
-- (RF-60) e somado dos lotes prontos daquela especie e recipiente a cada consulta.
-- Guarda-lo aqui congelaria uma leitura que muda a cada perda registrada, e o item
-- passaria a mentir sobre o estoque de hoje. E a mesma decisao que fez a situacao
-- do lote ser visao e nao coluna (RN-30).

COMMENT ON TABLE orders IS
  'Pedido. Tres situacoes; confirmado nao aceita alteracao de item. RF-61, RN-50.';
COMMENT ON COLUMN orders.customer_id IS
  'Pessoa do cadastro unico que exerce o papel de cliente. RN-47.';
COMMENT ON COLUMN order_items.unit_price IS
  'Preco unitario informado por quem registra. O sistema nao o calcula. RN-52.';
