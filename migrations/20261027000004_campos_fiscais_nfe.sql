-- Migration: 20261027000004_campos_fiscais_nfe.sql
-- Descricao: O cadastro ganha os campos que a NF-e pede do destinatario.
--
-- Requisitos: RF-19, RNF-20, RN-46 · Entidades: C8 `cadastro.pessoas`, `cadastro.pessoas_enderecos`
--
-- POR QUE ESTA MIGRATION EXISTE. O criterio de RF-19 confere o cadastro "contra
-- os campos exigidos pelo emissor de nota externo", e nenhum documento dizia
-- quais eram. A auditoria de 24/10/2026 apontou o desvio, e em 27/10/2026 o
-- usuario definiu o emissor: o leiaute da NF-e (emissor da SEFAZ/SC ou
-- equivalente). Do destinatario, a nota pede: CPF ou CNPJ, razao social (na
-- PJ), inscricao estadual ou a indicacao de isento ou nao contribuinte, e o
-- endereco com logradouro, numero, bairro, municipio com o codigo IBGE, UF e
-- CEP. O cadastro tinha documento, logradouro (com o numero junto), cidade, UF
-- e CEP. A lista completa esta no C8.
--
-- TUDO OPCIONAL. Nome e telefone continuam bastando para o pedido (RN-48); a
-- ficha se completa quando a nota for emitida. Dado fiscal segue so para quem
-- ve dado fiscal (D4 §3.1), como o documento.
--
-- Compatibilidade: colunas novas e nulas; nada existente muda.

ALTER TABLE cadastro.pessoas
  ADD COLUMN razao_social       TEXT,
  ADD COLUMN inscricao_estadual TEXT;

ALTER TABLE cadastro.pessoas
  -- Digitos da inscricao, ou ISENTO. Nulo e "nao contribuinte", ou ainda nao informado.
  ADD CONSTRAINT pessoas_inscricao_estadual_valida
    CHECK (inscricao_estadual IS NULL OR inscricao_estadual = 'ISENTO' OR inscricao_estadual ~ '^[0-9]{2,14}$');

ALTER TABLE cadastro.pessoas_enderecos
  ADD COLUMN numero      TEXT,
  ADD COLUMN bairro      TEXT,
  ADD COLUMN codigo_ibge CHAR(7);

ALTER TABLE cadastro.pessoas_enderecos
  ADD CONSTRAINT pessoas_enderecos_codigo_ibge_valido CHECK (codigo_ibge IS NULL OR codigo_ibge ~ '^[0-9]{7}$');

COMMENT ON COLUMN cadastro.pessoas.razao_social IS
  'Razao social da PJ, quando difere do nome usado no dia a dia. Dado fiscal (D4). RF-19.';
COMMENT ON COLUMN cadastro.pessoas.inscricao_estadual IS
  'Inscricao estadual, so digitos, ou ISENTO. Nulo: nao contribuinte ou nao informado. Dado fiscal. RF-19.';
COMMENT ON COLUMN cadastro.pessoas_enderecos.numero IS 'Numero do endereco, separado do logradouro como a NF-e pede. RF-19.';
COMMENT ON COLUMN cadastro.pessoas_enderecos.bairro IS 'Bairro, como a NF-e pede. RF-19.';
COMMENT ON COLUMN cadastro.pessoas_enderecos.codigo_ibge IS 'Codigo IBGE do municipio, 7 digitos, como a NF-e pede. RF-19.';
