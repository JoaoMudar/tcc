-- Migration: 20260925000001_conferencia_altura_e_quantidade_opcional.sql
-- Descricao: A conferencia registra a altura em que a muda existe, e o "Tem" do item sem quantidade dispensa o numero.
--
-- Requisitos: RF-56
-- Entidades: C8 `pedidos_itens`
--
-- POR QUE ESTA MIGRATION EXISTE. A conferencia passa a ter uma regra so para
-- todo item (plans/P12): "Tem parte" pergunta de novo tudo o que o cliente
-- especificou, e a pessoa troca o que difere. O cliente pede altura desde a
-- 20260922000002, e ate aqui a conferencia nao tinha onde dizer "tem, mas com
-- 0,80". E o item que chegou sem quantidade ("tem ipe?") pode ser respondido
-- so com "tem": quantas, a chefia acerta na negociacao.
--
-- A ORDEM DESTE ARQUIVO E OBRIGATORIA, como em 20260924000001: soltar a
-- constraint, so entao prender a nova. Nenhuma linha precisa migrar: tudo o
-- que a anterior aceitava a nova tambem aceita.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE pedidos_itens ADD COLUMN altura_disponivel_m NUMERIC(4,2);

ALTER TABLE pedidos_itens
  ADD CONSTRAINT pedidos_itens_altura_disponivel_positiva
  CHECK (altura_disponivel_m IS NULL OR (altura_disponivel_m > 0 AND altura_disponivel_m <= 20));

-- Como o recipiente conferido: "nao tem nenhuma" nao tem altura.
ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_altura_disponivel_com_muda CHECK (
  altura_disponivel_m IS NULL OR quantidade_disponivel IS DISTINCT FROM 0
);

COMMENT ON COLUMN pedidos_itens.altura_disponivel_m IS
  'Altura em que a muda existe, em metros, quando difere da pedida. Nula e "igual ao pedido" ou "o cliente nao pediu altura". A aprovacao a copia para altura_m. RF-56.';

ALTER TABLE pedidos_itens DROP CONSTRAINT pedidos_itens_disponibilidade_coerente;

-- O ramo novo e o ultimo: item sem quantidade, "tem", sem numero.
ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_disponibilidade_coerente CHECK (
  (disponivel IS NULL AND quantidade_disponivel IS NULL)
  OR (generico AND disponivel = true AND quantidade_disponivel IS NULL)
  OR (quantidade IS NOT NULL AND (
        (disponivel = true AND quantidade_disponivel IS NULL)
        OR (disponivel = false AND quantidade_disponivel BETWEEN 0 AND quantidade - 1)))
  OR (quantidade IS NULL AND quantidade_disponivel IS NOT NULL AND quantidade_disponivel >= 0
      AND disponivel = (quantidade_disponivel > 0))
  OR (quantidade IS NULL AND disponivel = true AND quantidade_disponivel IS NULL)
);
