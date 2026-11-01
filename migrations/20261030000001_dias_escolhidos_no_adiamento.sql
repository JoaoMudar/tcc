-- Migration: 20261030000001_dias_escolhidos_no_adiamento.sql
-- Descricao: O adiamento da etapa guarda tambem os dias que a gerencia escolheu.
--
-- Requisitos: RF-55 · Entidades: C8 `lotes_etapas_acoes`
--
-- POR QUE ESTA MIGRATION EXISTE. Adiar uma etapa vencida conta a partir de hoje,
-- e por isso `dias` guarda o deslocamento real do vencimento: pedir 15 dias numa
-- etapa vencida ha 22 grava 37. A visao `lotes_etapas_vencimento` soma `dias`, e
-- ele precisa continuar sendo o deslocamento. Mas o historico do protocolo
-- mostrava "postergada 37 dias" quando foram escolhidos 15 (TA-82, execucao do
-- E2 de 30/10/2026). A coluna nova guarda o que foi escolhido, para o historico.
--
-- Compatibilidade: coluna nula; as linhas antigas ficam sem ela, e o historico
-- mostra `dias` quando ela falta. Nenhuma visao muda.

ALTER TABLE lotes_etapas_acoes ADD COLUMN dias_escolhidos INTEGER;

ALTER TABLE lotes_etapas_acoes ADD CONSTRAINT lotes_etapas_acoes_dias_escolhidos_do_adiamento CHECK (
  dias_escolhidos IS NULL OR (tipo_acao = 'adiamento' AND dias_escolhidos > 0 AND dias_escolhidos <= dias)
);

COMMENT ON COLUMN lotes_etapas_acoes.dias_escolhidos IS
  'So no adiamento: os dias que a gerencia escolheu, contados de hoje na etapa vencida. Pode ser menor que `dias`, que inclui o atraso ate hoje. Nulo nas linhas anteriores a 30/10/2026 e nas demais acoes.';
