-- Migration: 20260927000001_conferencia_complemento.sql
-- Descricao: "Tem parte" pode completar o item com outro recipiente, e o complemento e um item proprio.
--
-- Requisitos: RF-56
-- Entidades: C8 `pedidos_itens`
--
-- POR QUE ESTA MIGRATION EXISTE. O saco pedido nem sempre tem a quantidade
-- toda, e o viveiro oferece completar com outro ("tem 300 em 17x22 + 200 em
-- 20x26", plans/P13). A segunda linha nao cabe nas colunas de conferencia do
-- item, que guardam uma resposta so. Ela vira um item da mesma especie, ja
-- respondido e sem preco: saco diferente tem preco diferente, e a chefia o
-- digita na negociacao, como em qualquer item.
--
-- ON DELETE CASCADE: o complemento so existe por causa do item que ele
-- completa. Tirado o original, tirar o complemento e o que a pessoa esperaria.
--
-- Nenhuma linha precisa migrar: a coluna nasce nula, que e "nao e complemento".
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE pedidos_itens
  ADD COLUMN complementa_item_id UUID REFERENCES pedidos_itens(id) ON DELETE CASCADE;

-- O complemento e um item com especie, de topo: o generico se resolve pela
-- composicao, e o filho do generico ja e ele mesmo uma linha da resposta.
ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_complemento_especifico CHECK (
  complementa_item_id IS NULL OR (NOT generico AND item_pai_id IS NULL AND complementa_item_id <> id)
);

CREATE INDEX pedidos_itens_complementa_item_id_idx ON pedidos_itens (complementa_item_id)
  WHERE complementa_item_id IS NOT NULL;

COMMENT ON COLUMN pedidos_itens.complementa_item_id IS
  'Item que este completa em outro recipiente, na resposta "Tem parte" da conferencia. Nulo e "item pedido pelo cliente". RF-56.';
