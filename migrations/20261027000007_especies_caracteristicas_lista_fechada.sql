-- Migration: 20261027000007_especies_caracteristicas_lista_fechada.sql
-- Descricao: A lista fechada das caracteristicas da especie passa a ser conferida tambem pelo banco.
--
-- Requisitos: RN-06, RNF-06 · Entidades: C8 `especies`
--
-- POR QUE ESTA MIGRATION EXISTE. A lista (nativa, exotica, frutifera,
-- ornamental, madeireira, forrageira) so era conferida pela aplicacao: qualquer
-- chamada futura que gravasse direto poderia por um valor fora dela. A
-- auditoria de conformidade de 24/10/2026 sugeriu a restricao no banco.
--
-- NOT VALID: confere toda gravacao daqui em diante sem reler as linhas que ja
-- existem. A aplicacao sempre gravou dentro da lista, e assim a migration nao
-- falha num banco com dado antigo inesperado; quem quiser a conferencia
-- completa roda `ALTER TABLE especies VALIDATE CONSTRAINT especies_caracteristicas_validas`.
--
-- Compatibilidade: nenhuma linha muda.

ALTER TABLE especies
  ADD CONSTRAINT especies_caracteristicas_validas
  CHECK (caracteristicas <@ ARRAY['nativa', 'exotica', 'frutifera', 'ornamental', 'madeireira', 'forrageira']::text[])
  NOT VALID;
