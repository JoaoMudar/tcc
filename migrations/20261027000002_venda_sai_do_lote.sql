-- Migration: 20261027000002_venda_sai_do_lote.sql
-- Descricao: O item da carga diz de que lote saem as mudas, e a venda baixa o lote.
--
-- Requisitos: RF-24, RF-34, RF-32, RF-62, RN-44 · Entidades: C8 `pedidos_cargas_itens`
--
-- POR QUE ESTA MIGRATION EXISTE. O tipo `venda` de `movimentos_lote` existia
-- desde o schema inicial, e nenhum codigo o gravava: o pedido entregue nao
-- baixava o saldo do lote, e o estoque disponivel superestimava o viveiro. A
-- auditoria de conformidade de 24/10/2026 apontou o desvio (RF-24).
--
-- DECISAO DE 27/10/2026: a baixa sai na conclusao da viagem (o caminhao
-- carregado), e o lote e escolhido na separacao ou no carregamento, com uma
-- sugestao pronta (mesma especie e recipiente, altura mais proxima). Por isso o
-- lote fica no item da carga, e nao no item do pedido: e na carga que alguem
-- vai ao canteiro buscar as mudas.
--
-- UM LOTE POR ITEM DE CARGA. As 500 mudas que saem de dois lotes viram duas
-- linhas so quando a carga for dividida; dividir uma linha entre lotes nao e
-- do escopo desta migration.
--
-- Compatibilidade: coluna nova e nula. A carga anterior a esta migration fica
-- sem lote, e a viagem dela pede o lote antes de concluir.

ALTER TABLE pedidos_cargas_itens
  ADD COLUMN lote_id UUID REFERENCES lotes(id);

CREATE INDEX pedidos_cargas_itens_lote_idx ON pedidos_cargas_itens (lote_id) WHERE lote_id IS NOT NULL;

COMMENT ON COLUMN pedidos_cargas_itens.lote_id IS
  'Lote de onde saem as mudas deste item da carga. Sugerido ao criar a carga, trocado na separacao ou no carregamento; a conclusao da viagem grava a venda nele. RF-24.';
