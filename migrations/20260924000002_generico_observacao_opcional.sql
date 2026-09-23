-- Migration: 20260924000002_generico_observacao_opcional.sql
-- Descricao: O item generico do pedido pode nascer sem texto.
--
-- Requisitos: RF-54
-- Entidades: C8 `pedidos_itens`
--
-- POR QUE ESTA MIGRATION EXISTE. A 20260924000001 passou a exigir, no item
-- generico, o texto do que o cliente pediu. Na tela esse texto virou
-- "Observacao", e a chefia registra o generico sem nada escrito quando o
-- cliente so disse "manda mudas nativas": quem decide as especies e a
-- conferencia, e o texto e so um apoio a ela.
--
-- A coluna continua `especificacao`, e so no generico: o CHECK
-- `pedidos_itens_especificacao_so_no_generico` (20260921000002) nao muda.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL, como as anteriores.

ALTER TABLE pedidos_itens DROP CONSTRAINT pedidos_itens_generico_com_especificacao;

COMMENT ON COLUMN pedidos_itens.especificacao IS
  'Observacao do item generico: o que o cliente pediu, em texto. Opcional, e so no generico. RF-54.';
