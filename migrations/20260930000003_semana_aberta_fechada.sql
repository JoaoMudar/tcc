-- Migration: 20260930000003_semana_aberta_fechada.sql
-- Descricao: A semana passa a ter dois estados, aberta e fechada.
--
-- Requisitos: RF-28, RF-31 · Regras: RN-13, RN-14
-- Entidades: C8 `semanas`
--
-- POR QUE ESTA MIGRATION EXISTE. A 20260901000005 declarou tres estados
-- (`rascunho`, `publicada`, `fechada`). Publicar nao tem publico: os
-- colaboradores de campo nao acessam o sistema, e quem monta a semana e quem a
-- le sao as mesmas tres pessoas. Abrir tambem era cerimonia: o primeiro
-- lancamento ja cria a semana. Sobra o que separa o feito do suposto, que e
-- fechar (RN-14).
--
-- O QUE MUDA NO ESTADO. `rascunho` e `publicada` viram `aberta`; `fechada`
-- fica. `publicada_por` sai junto, porque nao ha mais o ato que ela registrava.
--
-- A ORDEM DESTE ARQUIVO E OBRIGATORIA: soltar a constraint antiga, migrar as
-- linhas, so entao trocar o DEFAULT e prender a constraint nova.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE semanas DROP CONSTRAINT semanas_situacao_valida;

UPDATE semanas SET situacao = 'aberta' WHERE situacao IN ('rascunho', 'publicada');

ALTER TABLE semanas ALTER COLUMN situacao SET DEFAULT 'aberta';

ALTER TABLE semanas ADD CONSTRAINT semanas_situacao_valida CHECK (situacao IN ('aberta', 'fechada'));

ALTER TABLE semanas DROP COLUMN publicada_por;

COMMENT ON TABLE semanas IS
  'Semana de trabalho: aberta ou fechada. Nasce aberta no primeiro lancamento. Semana fechada nao se altera. RN-13.';
