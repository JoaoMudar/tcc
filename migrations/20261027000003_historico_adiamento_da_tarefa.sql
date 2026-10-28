-- Migration: 20261027000003_historico_adiamento_da_tarefa.sql
-- Descricao: Adiar a tarefa ja lancada fica no historico do protocolo do lote.
--
-- Requisitos: RF-55 · Entidades: C8 `lotes_etapas_acoes`
--
-- POR QUE ESTA MIGRATION EXISTE. Adiar a etapa (antes de virar tarefa) ja
-- deixava linha em `lotes_etapas_acoes`; adiar a tarefa lancada a partir dela
-- nao deixava nada, e o criterio de RF-55 ("tarefa atrasada postergada em um
-- dia fica no historico") falhava. A auditoria de 24/10/2026 apontou o desvio.
--
-- TIPO PROPRIO, E NAO `adiamento`. O `adiamento` soma dias ao vencimento da
-- etapa (a visao `lotes_etapas_vencimento` o le). Adiar a tarefa nao muda o
-- vencimento: a tarefa guarda o vencimento congelado do aceite, e o atraso
-- continua contando dele (RF-52). Gravar `adiamento` aqui moveria o vencimento
-- e faria a etapa reaparecer como sugestao, duplicada. `adiamento_tarefa` e so
-- registro: `dias` diz quantos dias a tarefa andou.
--
-- Compatibilidade: amplia os CHECK; nenhuma linha existente muda.

ALTER TABLE lotes_etapas_acoes DROP CONSTRAINT lotes_etapas_acoes_tipo_valido;
ALTER TABLE lotes_etapas_acoes ADD CONSTRAINT lotes_etapas_acoes_tipo_valido
  CHECK (tipo_acao IN ('adiamento', 'conclusao_sem_agenda', 'adiamento_tarefa'));

ALTER TABLE lotes_etapas_acoes DROP CONSTRAINT lotes_etapas_acoes_dias_do_adiamento;
ALTER TABLE lotes_etapas_acoes ADD CONSTRAINT lotes_etapas_acoes_dias_do_adiamento CHECK (
  (tipo_acao IN ('adiamento', 'adiamento_tarefa') AND dias > 0)
  OR (tipo_acao = 'conclusao_sem_agenda' AND dias IS NULL)
);

COMMENT ON COLUMN lotes_etapas_acoes.dias IS
  'No adiamento: dias somados ao vencimento da ocorrencia. No adiamento_tarefa: dias que a tarefa lancada andou, sem mexer no vencimento. Nulo na conclusao sem agenda.';
