-- Migration: 20261007000001_carregamento_e_entrega_do_pedido.sql
-- Descricao: A contagem de carregar, separada da de separar, e o endereco de
-- entrega proprio do pedido.
--
-- Requisitos: RF-63, RF-64, RF-67 · Regras: RN-64
-- Entidades: C8 `pedidos_cargas_itens`, `pedidos`
--
-- POR QUE ESTA MIGRATION EXISTE (1). Separar e carregar sao duas contagens.
-- Separar e deixar as mudas ao lado do carro; carregar e po-las no caminhao, na
-- aba 3 do planejar. As duas marcavam `separado`, e o pedido ja separado chegava
-- ao carregamento todo marcado, sem ninguem contar o que subia no caminhao.
-- `carregado` e a segunda confirmacao. A separacao continua opcional: o pedido
-- carregado direto e dado como separado quando a viagem fecha.
--
-- A VIAGEM JA PRONTA NAO REABRE. Os itens das viagens prontas nascem carregados,
-- que e o que de fato aconteceu com eles.
--
-- POR QUE ESTA MIGRATION EXISTE (2). O destino e do pedido. O cliente pede para
-- entregar num lugar diferente a cada pedido, e o frete e a rota usavam sempre
-- o primeiro endereco de entrega do cadastro, e o completavam la. As colunas
-- `entrega_*` guardam o destino deste pedido: tem prioridade sobre o endereco do
-- cliente e nao o substituem. Nulas, vale o do cliente, e e assim que os pedidos
-- existentes passam a ser lidos.
--
-- A COORDENADA SEGUE A REGRA DO ENDERECO DO CLIENTE: vem junto com o endereco
-- escolhido na lista, ou e procurada pelo texto na hora da sugestao, e
-- `entrega_geocodificado_em` com a coordenada nula e "procurado e nao achado".
-- Quem troca o texto sem ponto apaga a coordenada no proprio UPDATE, no codigo.
--
-- Compatibilidade: colunas novas, a booleana com padrao falso e as demais
-- nulaveis.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

-- ------------------------------------------------------------
-- 1. A contagem de carregar
-- ------------------------------------------------------------
ALTER TABLE pedidos_cargas_itens
  ADD COLUMN carregado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN pedidos_cargas_itens.carregado IS
  'Confirmacao de que o item foi contado e posto no caminhao, no carregamento da viagem.';
COMMENT ON COLUMN pedidos_cargas_itens.separado IS
  'Confirmacao de que o item foi contado e posto ao lado do carro, antes de carregar.';

UPDATE pedidos_cargas_itens ci
   SET carregado = true
  FROM pedidos_cargas c
  JOIN viagens_paradas vp ON vp.pedido_id = c.pedido_id
  JOIN viagens v ON v.id = vp.viagem_id
 WHERE ci.carga_id = c.id AND v.situacao = 'pronta';

-- ------------------------------------------------------------
-- 2. O endereco de entrega do pedido
-- ------------------------------------------------------------
ALTER TABLE pedidos
  ADD COLUMN entrega_logradouro       TEXT,
  ADD COLUMN entrega_cidade           TEXT,
  ADD COLUMN entrega_uf               CHAR(2),
  ADD COLUMN entrega_cep              TEXT,
  ADD COLUMN entrega_lat              NUMERIC(9, 6),
  ADD COLUMN entrega_lng              NUMERIC(9, 6),
  ADD COLUMN entrega_geocodificado_em TIMESTAMPTZ,
  ADD CONSTRAINT pedidos_entrega_coordenada_inteira CHECK ((entrega_lat IS NULL) = (entrega_lng IS NULL)),
  ADD CONSTRAINT pedidos_entrega_so_com_logradouro CHECK (
    entrega_logradouro IS NOT NULL
    OR (entrega_cidade IS NULL AND entrega_uf IS NULL AND entrega_cep IS NULL
        AND entrega_lat IS NULL AND entrega_geocodificado_em IS NULL));

COMMENT ON COLUMN pedidos.entrega_logradouro IS
  'Destino deste pedido. Tem prioridade sobre o endereco de entrega do cliente; nulo e usar o do cliente.';
COMMENT ON COLUMN pedidos.entrega_lat IS
  'Latitude do destino deste pedido, achada pela API de mapas ou vinda do endereco escolhido.';
COMMENT ON COLUMN pedidos.entrega_geocodificado_em IS
  'Quando a API de mapas foi consultada. Preenchido com lat nula: a API nao achou o destino.';
