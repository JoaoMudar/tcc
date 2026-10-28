-- Migration: 20261028000001_pessoas_no_schema_public.sql
-- Descricao: As tabelas de pessoa saem do schema `cadastro` e vao para o `public`.
--
-- Requisitos: RN-45, RNF-23 · Entidades: C8 `pessoas`, `pessoas_papeis`, `pessoas_enderecos`
--
-- POR QUE ESTA MIGRATION EXISTE. O schema `cadastro` foi criado com o argumento
-- de que a pessoa nao pertence a nenhuma das tres areas. Mas as areas nunca
-- viraram schemas: todo o resto do modelo esta no `public`, e o `cadastro` era a
-- unica excecao, sem permissao, sistema ou camada que dependesse dele. Um schema
-- so, para um banco deste porte, e o criterio que se le sem explicacao.
--
-- O QUE MUDA. `ALTER ... SET SCHEMA` move o objeto inteiro, com dados, indices,
-- restricoes, gatilhos e chaves estrangeiras que apontam para ele. As visoes do
-- `public` que liam `cadastro.pessoas` seguem a tabela, porque guardam o OID.
--
-- COMPATIBILIDADE (RNF-23, expandir e contrair). O codigo publicado escreve
-- `cadastro.pessoas` e converte para `cadastro.tipo_papel`. Para ele continuar
-- rodando ate o deploy, o `cadastro` fica com uma visao por tabela (atualizavel
-- automaticamente: INSERT, UPDATE, DELETE e ON CONFLICT passam para a tabela) e
-- um dominio por tipo. Uma migration posterior apaga o schema inteiro, depois
-- que o codigo que lia `cadastro.` saiu de producao.
--
-- O QUE A PONTE NAO COBRE. O Postgres nao compara o enum com o dominio sobre
-- ele (`papel = ANY($1::cadastro.tipo_papel[])` da "operador nao existe"). Tres
-- consultas de `src/lib/pessoas.ts` da versao anterior fazem isso: o filtro da
-- lista por papel, os enderecos da ficha e a gravacao dos papeis. Elas falham
-- so no intervalo entre esta migration e a publicacao do codigo novo, que e o
-- tempo do build. Declarar o operador `=` entre os dois tipos foi testado e
-- recusado: ele passa a ser escolhido tambem em `papel = 'cliente'` do codigo
-- novo.

ALTER TABLE cadastro.pessoas SET SCHEMA public;
ALTER TABLE cadastro.pessoas_papeis SET SCHEMA public;
ALTER TABLE cadastro.pessoas_enderecos SET SCHEMA public;

ALTER TYPE cadastro.tipo_pessoa SET SCHEMA public;
ALTER TYPE cadastro.tipo_papel SET SCHEMA public;
ALTER TYPE cadastro.tipo_endereco SET SCHEMA public;

ALTER FUNCTION cadastro.pessoas_enderecos_zera_coordenada() SET SCHEMA public;

-- ------------------------------------------------------------
-- Ponte para o codigo anterior (sai na etapa de contrair)
-- ------------------------------------------------------------
CREATE VIEW cadastro.pessoas AS SELECT * FROM public.pessoas;
CREATE VIEW cadastro.pessoas_papeis AS SELECT * FROM public.pessoas_papeis;
CREATE VIEW cadastro.pessoas_enderecos AS SELECT * FROM public.pessoas_enderecos;

CREATE DOMAIN cadastro.tipo_pessoa AS public.tipo_pessoa;
CREATE DOMAIN cadastro.tipo_papel AS public.tipo_papel;
CREATE DOMAIN cadastro.tipo_endereco AS public.tipo_endereco;

COMMENT ON SCHEMA cadastro IS
  'Ponte temporaria para o codigo anterior a 20261028000001: visoes e dominios sobre as tabelas e os tipos de pessoa, que agora estao no public. Sai na etapa de contrair.';
