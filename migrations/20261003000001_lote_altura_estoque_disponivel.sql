-- Migration: 20261003000001_lote_altura_estoque_disponivel.sql
-- Descricao: O lote passa a registrar a altura da muda, e o estoque disponivel deixa de depender da fase.
--
-- Requisitos: RF-43, RF-56, RF-65 · Regras: RN-06, RN-62
-- Entidades: C8 `lotes`
--
-- POR QUE ESTA MIGRATION EXISTE. O saldo vendavel somava so os lotes na fase
-- `pronto`, e o resto aparecia como "em producao". O viveiro nao trabalha
-- assim: toda muda de lote aberto esta a venda a qualquer momento, e o que diz
-- se ela atende o item e a especie, o recipiente e a altura. O lote nao tinha
-- altura, entao o pedido de "ipe de 1,20" nao tinha com o que ser comparado.
--
-- A FASE `pronto` CONTINUA, como etapa do manejo. So deixa de ter efeito sobre
-- a venda, e por isso o indice parcial `lotes_prontos_idx` da lugar a um
-- indice sobre todos os lotes abertos.
--
-- NULA E "AINDA NAO MEDIDA". O lote existente nasce assim, e a altura e
-- atualizada na ficha do lote conforme a muda cresce. A coluna guarda a
-- medida mais recente, e nao o historico. Mesmas unidade e faixa de
-- `pedidos_itens.altura_m`, que e com quem ela e comparada.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE lotes ADD COLUMN altura_m NUMERIC(4,2);

ALTER TABLE lotes
  ADD CONSTRAINT lotes_altura_positiva
  CHECK (altura_m IS NULL OR (altura_m > 0 AND altura_m <= 20));

COMMENT ON COLUMN lotes.altura_m IS
  'Altura atual da muda do lote, em metros, medida na ficha. Nula e "ainda nao medida". RF-65.';

DROP INDEX lotes_prontos_idx;

-- RF-43, RF-56: o estoque disponivel e a soma dos lotes abertos daquela especie
-- e recipiente, em qualquer fase.
CREATE INDEX lotes_disponiveis_idx
  ON lotes (especie_id, recipiente_id) WHERE encerrado_em IS NULL;
