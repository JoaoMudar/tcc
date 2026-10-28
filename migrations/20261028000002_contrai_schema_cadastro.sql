-- Migration: 20261028000002_contrai_schema_cadastro.sql
-- Descricao: Apaga o schema `cadastro`, a ponte deixada pela 20261028000001.
--
-- Requisitos: RNF-23 · Entidades: C8 `pessoas`, `pessoas_papeis`, `pessoas_enderecos`
--
-- POR QUE ESTA MIGRATION EXISTE. Etapa de contrair da mudanca de schema. A
-- 20261028000001 levou as tabelas de pessoa para o `public` e deixou no
-- `cadastro` visoes e dominios de mesmo nome, para o codigo anterior seguir
-- rodando. Nenhum codigo publicado le mais `cadastro.`, e a ponte sai.
--
-- SO DEPOIS DO DEPLOY DA 20261028000001. Aplicada no mesmo build, ela tira a
-- ponte antes de o codigo novo entrar no ar, e o codigo anterior perde as
-- tabelas de pessoa inteiras durante o build.
--
-- O QUE O CASCADE APAGA. So o que esta no schema: tres visoes e tres dominios.
-- Nenhuma coluna usa os dominios e nenhuma visao do `public` le as do
-- `cadastro`, e por isso nada de fora cai junto. As tabelas e os enums de
-- verdade estao no `public` e nao dependem do schema.

DROP SCHEMA cadastro CASCADE;
