-- Migration: 20260922000001_pedido_preco_apos_conferencia.sql
-- Descricao: O preco do item passa a ser digitado depois da conferencia.
--
-- Requisitos: RF-55, RF-57 · Regras: RN-50
-- Entidades: C8 `pedidos_itens`
--
-- POR QUE ESTA MIGRATION EXISTE. Quem registra o pedido esta no meio de uma
-- conversa de WhatsApp e anota o que o cliente quer: especie, recipiente e
-- quantidade. O valor so se fecha depois, quando a gerencia ja disse o que
-- existe de verdade no patio, porque e a conferencia que diz quantas mudas
-- serao vendidas e em que recipiente. Exigir o preco no cadastro obrigava a
-- chutar um numero e corrigi-lo adiante, e numero chutado que ninguem volta
-- para corrigir e venda registrada errada.
--
-- O QUE NAO MUDA. O preco continua DIGITADO (RN-50): nao ha tabela de preco,
-- piso nem margem. So mudou o momento em que ele e digitado.
--
-- NULO E "AINDA NAO PRECIFICADO", e nao "de graca". O CHECK abaixo continua
-- recusando zero e negativo, e a aprovacao do pedido recusa item de topo sem
-- preco (`confirmarPedido`): nenhuma venda e aprovada sem valor.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE pedidos_itens ALTER COLUMN preco_unitario DROP NOT NULL;

ALTER TABLE pedidos_itens DROP CONSTRAINT pedidos_itens_preco_positivo;

ALTER TABLE pedidos_itens
  ADD CONSTRAINT pedidos_itens_preco_positivo
  CHECK (preco_unitario IS NULL OR preco_unitario > 0);

COMMENT ON COLUMN pedidos_itens.preco_unitario IS
  'Preco unitario informado por quem registra, depois da conferencia. Nulo e "ainda nao precificado"; a aprovacao do pedido o exige. RN-50.';
