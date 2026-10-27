-- Migration: 20261027000006_autoria_das_gravacoes.sql
-- Descricao: Autor e momento nas gravacoes de campo e de pedido que ainda nao os tinham.
--
-- Requisitos: RNF-15 · Entidades: C8 `atribuicoes`, `semanas`, `pedidos_cargas_itens`,
--             `pedidos_itens`, `lotes`
--
-- POR QUE ESTA MIGRATION EXISTE. O RNF-15 pede autor e momento em toda
-- gravacao. Os movimentos do lote, o historico do pedido, as acoes sobre a
-- etapa e os parametros ja os tinham; a auditoria de conformidade de 24/10/2026
-- listou as gravacoes sem autor. Esta e a primeira etapa, a das gravacoes de
-- trabalho: quem lancou e quem confirmou a tarefa, quem fechou a semana, quem
-- separou e quem carregou o item da carga, quem conferiu e quem precificou o
-- item do pedido, e quem mediu a altura do lote. Os cadastros (especies,
-- pessoas, recipientes) ficam para a segunda etapa.
--
-- NULO PARA O PASSADO. As linhas gravadas antes desta migration nao tem como
-- saber o autor, e inventar um seria pior que deixar em branco. A tarefa
-- copiada da semana anterior (recorrente) tambem nasce sem `criado_por`: quem a
-- criou foi o sistema.
--
-- `semanas.fechada_por` volta com outro nome do que a migration
-- 20260930000003 apagou (`publicada_por`): fechar e o unico ato sobre a semana.
--
-- Compatibilidade: colunas novas e nulas.

ALTER TABLE atribuicoes
  ADD COLUMN criado_por     UUID REFERENCES usuarios(id),
  ADD COLUMN confirmado_por UUID REFERENCES usuarios(id),
  ADD COLUMN confirmado_em  TIMESTAMPTZ;

ALTER TABLE semanas
  ADD COLUMN fechada_por UUID REFERENCES usuarios(id);

ALTER TABLE pedidos_cargas_itens
  ADD COLUMN separado_por  UUID REFERENCES usuarios(id),
  ADD COLUMN separado_em   TIMESTAMPTZ,
  ADD COLUMN carregado_por UUID REFERENCES usuarios(id),
  ADD COLUMN carregado_em  TIMESTAMPTZ;

ALTER TABLE pedidos_itens
  ADD COLUMN conferido_por   UUID REFERENCES usuarios(id),
  ADD COLUMN conferido_em    TIMESTAMPTZ,
  ADD COLUMN precificado_por UUID REFERENCES usuarios(id),
  ADD COLUMN precificado_em  TIMESTAMPTZ;

ALTER TABLE lotes
  ADD COLUMN altura_medida_por UUID REFERENCES usuarios(id),
  ADD COLUMN altura_medida_em  TIMESTAMPTZ;

COMMENT ON COLUMN atribuicoes.criado_por IS 'Quem lancou a tarefa. Nulo na copiada da semana anterior e nas anteriores a 27/10/2026. RNF-15.';
COMMENT ON COLUMN atribuicoes.confirmado_por IS 'Quem confirmou que a tarefa foi feita. RNF-15.';
COMMENT ON COLUMN semanas.fechada_por IS 'Quem fechou a semana. RNF-15.';
COMMENT ON COLUMN pedidos_cargas_itens.separado_por IS 'Quem marcou o item separado; nulo quando a marcacao e desfeita. RNF-15.';
COMMENT ON COLUMN pedidos_cargas_itens.carregado_por IS 'Quem marcou o item carregado; nulo quando a marcacao e desfeita. RNF-15.';
COMMENT ON COLUMN pedidos_itens.conferido_por IS 'Quem respondeu a disponibilidade do item na conferencia. RNF-15.';
COMMENT ON COLUMN pedidos_itens.precificado_por IS 'Quem digitou o preco do item na negociacao. RNF-15.';
COMMENT ON COLUMN lotes.altura_medida_por IS 'Quem registrou a ultima altura. RNF-15.';
