-- Migration: 20261006000001_pedido_item_suplente.sql
-- Descricao: O item sem quantidade guarda, na conferencia, os outros recipientes em que a especie tambem esta.
--
-- Requisitos: RF-56
-- Entidades: C8 `pedidos_itens`
--
-- POR QUE ESTA MIGRATION EXISTE. O cliente pede "pitanga" sem dizer quantas, e
-- a gerencia acha a especie em saco 20x26 e tambem em 17x22. Ate aqui o segundo
-- recipiente virava complemento (`complementa_item_id`), que e linha propria do
-- orcamento, e o pedido de uma especie aparecia como duas, pedindo quantidade e
-- preco em cada uma. Sem quantidade pedida nao ha o que somar: o segundo
-- recipiente e a reserva para o caso de faltar quando a chefia combinar a
-- quantidade com o cliente (plans/P18).
--
-- O SUPLENTE E UM COMPLEMENTO QUE AINDA NAO E LINHA. Nasce da mesma especie,
-- apontando para o item que completa, sem quantidade e sem preco. A ficha o
-- mostra abaixo do item ("se faltar, tambem tem em 17x22"), e o "Usar" da chefia
-- desliga a marca: dali em diante e complemento comum, com quantidade e preco a
-- digitar. O suplente que ninguem usou e apagado na aprovacao.
--
-- Compatibilidade: coluna nova com default false; nenhuma linha muda de sentido.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE pedidos_itens
  ADD COLUMN suplente BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_suplente_sem_linha CHECK (
  NOT suplente OR (complementa_item_id IS NOT NULL AND quantidade IS NULL AND preco_unitario IS NULL)
);

COMMENT ON COLUMN pedidos_itens.suplente IS
  'Complemento de item sem quantidade: outro recipiente em que a especie tambem esta, guardado para o caso de faltar. Nao e linha do orcamento ate a chefia o usar, e e apagado na aprovacao. RF-56.';
