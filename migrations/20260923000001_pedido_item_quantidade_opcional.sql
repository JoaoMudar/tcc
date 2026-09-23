-- Migration: 20260923000001_pedido_item_quantidade_opcional.sql
-- Descricao: A quantidade do item do pedido passa a ser opcional no cadastro.
--
-- Requisitos: RF-54, RF-57
-- Entidades: C8 `pedidos_itens`
--
-- POR QUE ESTA MIGRATION EXISTE. Quem registra o pedido esta no meio da
-- conversa, e o cliente muitas vezes diz as especies antes de fechar quantas
-- quer de cada uma. Exigir o numero no cadastro obrigava a inventar um valor
-- provisorio, e numero provisorio que ninguem volta para corrigir e venda
-- registrada errada. E a mesma razao que tirou o preco do cadastro
-- (20260922000001).
--
-- A QUANTIDADE CONTINUA EXIGIDA ANTES DA CONFERENCIA. A gerencia precisa do
-- numero para dizer se o patio tem a muda; essa trava e do codigo
-- (`mudarSituacao` recusa passar a `verificando` com item sem quantidade),
-- porque depende da situacao do pedido, que o CHECK de linha nao enxerga.
--
-- OS CHECKs EXISTENTES CONTINUAM VALENDO. `quantidade > 0` e `BETWEEN 0 AND
-- quantidade - 1` dao NULL com quantidade nula, e CHECK que da NULL aceita a
-- linha: zero e negativo continuam recusados.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE pedidos_itens ALTER COLUMN quantidade DROP NOT NULL;

COMMENT ON COLUMN pedidos_itens.quantidade IS
  'Quantidade pedida. Nula e "o cliente ainda nao disse quantas"; exigida antes da conferencia. RF-54.';
