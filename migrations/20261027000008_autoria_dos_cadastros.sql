-- Migration: 20261027000008_autoria_dos_cadastros.sql
-- Descricao: Autor nos cadastros de especie, pessoa e recipiente.
--
-- Requisitos: RNF-15 · Entidades: C8 `especies`, `pessoas`, `recipientes`
--
-- POR QUE ESTA MIGRATION EXISTE. Segunda etapa do RNF-15 (a primeira e a
-- 20261027000006, a das gravacoes de trabalho). Os tres cadastros ja tinham o
-- momento (`criado_em`, e `atualizado_em` mantido pelo gatilho
-- `define_atualizado_em`); faltava quem. Fica o autor da criacao e o da ultima
-- alteracao, que e o par que o momento ja tinha. O historico de cada alteracao
-- nao entra: o cadastro e o estado atual, e o que conta como historico (venda,
-- perda, tarefa) ja tem autor linha a linha.
--
-- NULO PARA O PASSADO E PARA O SISTEMA. As linhas anteriores a esta migration
-- nao tem autor conhecido. A carga inicial e a importacao do legado, que rodam
-- por script e nao por uma pessoa logada, tambem gravam nulo.
--
-- Compatibilidade: colunas novas e nulas; o codigo anterior continua gravando
-- sem elas.

ALTER TABLE especies
  ADD COLUMN criado_por     UUID REFERENCES usuarios(id),
  ADD COLUMN atualizado_por UUID REFERENCES usuarios(id);

ALTER TABLE recipientes
  ADD COLUMN criado_por     UUID REFERENCES usuarios(id),
  ADD COLUMN atualizado_por UUID REFERENCES usuarios(id);

ALTER TABLE cadastro.pessoas
  ADD COLUMN criado_por     UUID REFERENCES usuarios(id),
  ADD COLUMN atualizado_por UUID REFERENCES usuarios(id);

COMMENT ON COLUMN especies.criado_por IS 'Quem cadastrou a especie. Nulo antes de 27/10/2026 e na carga por script. RNF-15.';
COMMENT ON COLUMN especies.atualizado_por IS 'Quem fez a ultima alteracao; o momento e `atualizado_em`. RNF-15.';
COMMENT ON COLUMN recipientes.criado_por IS 'Quem cadastrou o recipiente. Nulo antes de 27/10/2026 e na carga por script. RNF-15.';
COMMENT ON COLUMN recipientes.atualizado_por IS 'Quem fez a ultima alteracao; o momento e `atualizado_em`. RNF-15.';
COMMENT ON COLUMN cadastro.pessoas.criado_por IS 'Quem cadastrou a pessoa. Nulo antes de 27/10/2026 e na carga por script. RNF-15.';
COMMENT ON COLUMN cadastro.pessoas.atualizado_por IS 'Quem fez a ultima alteracao; o momento e `atualizado_em`. RNF-15.';
