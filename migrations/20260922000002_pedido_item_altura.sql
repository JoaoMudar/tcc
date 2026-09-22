-- Migration: 20260922000002_pedido_item_altura.sql
-- Descricao: O item do pedido passa a registrar a altura da muda pedida, em metros.
--
-- Requisitos: RF-54, RF-57 · Regras: RN-04
-- Entidades: C8 `pedidos_itens`
--
-- POR QUE ESTA MIGRATION EXISTE. O cliente nao pede so a especie e o
-- recipiente: pede "ipe de 1,20". A altura e parte do que foi combinado, e
-- ate agora nao tinha onde ser anotada, entao ia parar na observacao do
-- pedido, em texto solto, ou se perdia na conversa. Sem ela, a conferencia no
-- patio nao sabe qual muda separar quando o mesmo par especie e recipiente
-- tem levas de tamanhos diferentes.
--
-- POR QUE EM METROS, e nao em centimetros. E como o viveiro fala: muda de
-- 0,80, de 1,20. NUMERIC(4,2) guarda ate 99,99 m com dois decimais, que e
-- precisao de sobra para o que se mede com trena no patio.
--
-- NULA E "O CLIENTE NAO PEDIU ALTURA", que e o caso comum: o recipiente ja
-- determina o tamanho da muda na maior parte das vendas. Por isso a coluna
-- nasce opcional, e nao com um valor padrao que se passaria por combinado.
--
-- O LIMITE DE 20 METROS nao e regra de negocio, e defesa contra o dedo que
-- digita a quantidade no campo da altura.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE pedidos_itens ADD COLUMN altura_m NUMERIC(4,2);

ALTER TABLE pedidos_itens
  ADD CONSTRAINT pedidos_itens_altura_positiva
  CHECK (altura_m IS NULL OR (altura_m > 0 AND altura_m <= 20));

COMMENT ON COLUMN pedidos_itens.altura_m IS
  'Altura da muda pedida pelo cliente, em metros. Nula e "o cliente nao pediu altura". RF-54.';
