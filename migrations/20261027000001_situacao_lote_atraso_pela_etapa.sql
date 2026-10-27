-- Migration: 20261027000001_situacao_lote_atraso_pela_etapa.sql
-- Descricao: A tarefa que nasceu de sugestao mede o atraso pelo vencimento da etapa.
--
-- Requisitos: RF-52, RN-40 · Entidades: C8 `situacao_lote`
--
-- POR QUE ESTA MIGRATION EXISTE. A B2 §2.4.3 diz que adiar o lancamento nao
-- apaga o atraso. Ate aqui, a etapa vencida que a gerencia aceitava e lancava
-- para um dia futuro saia da fonte `do_protocolo` (o NOT EXISTS a tirava, porque
-- ja virou tarefa) e nao entrava em `da_agenda` (que exigia `data_trabalho`
-- passada): o lote ficava saudavel ate o dia da tarefa. A auditoria de
-- conformidade de 24/10/2026 apontou o desvio.
--
-- O QUE MUDA, so na fonte `da_agenda`: a tarefa planejada conta tambem quando o
-- vencimento congelado da etapa (`vencimento_protocolo`) ja passou, mesmo com o
-- dia de trabalho no futuro, e o atraso conta desde o vencimento, e nao desde o
-- dia escolhido. A tarefa lancada a mao, sem vencimento, segue como antes.
--
-- Compatibilidade: a visao mantem as mesmas colunas, por isso CREATE OR REPLACE.

CREATE OR REPLACE VIEW situacao_lote AS
WITH limites AS (
  SELECT
    (SELECT valor::INTEGER FROM parametros WHERE chave = 'producao.atraso_atencao_dias') AS atencao,
    (SELECT valor::INTEGER FROM parametros WHERE chave = 'producao.atraso_critico_dias') AS critico
),
-- Fonte 1: a tarefa que alguem lancou e ninguem confirmou (RN-31). A que veio
-- de sugestao atrasa desde o vencimento da etapa (RF-52).
da_agenda AS (
  SELECT
    a.lote_id,
    a.id                             AS atribuicao_id,
    NULL::UUID                       AS protocolo_etapa_id,
    a.tipo_tarefa_id,
    tt.nome                          AS nome_tarefa,
    LEAST(a.data_trabalho, COALESCE(a.vencimento_protocolo, a.data_trabalho)) AS desde,
    (hoje_no_viveiro() - LEAST(a.data_trabalho, COALESCE(a.vencimento_protocolo, a.data_trabalho))) AS dias_atraso,
    false                            AS so_atencao
  FROM atribuicoes a
  JOIN tipos_tarefa tt ON tt.id = a.tipo_tarefa_id
  WHERE a.situacao = 'planejada'
    AND a.lote_id IS NOT NULL
    AND LEAST(a.data_trabalho, COALESCE(a.vencimento_protocolo, a.data_trabalho)) < hoje_no_viveiro()
),
-- Fonte 2: a etapa que o protocolo cobra e que ninguem lancou (RF-52, RF-53).
do_protocolo AS (
  SELECT
    v.lote_id,
    NULL::UUID           AS atribuicao_id,
    v.protocolo_etapa_id,
    pe.tipo_tarefa_id,
    pe.rotulo            AS nome_tarefa,
    v.proximo_vencimento AS desde,
    GREATEST(0, hoje_no_viveiro() - v.proximo_vencimento) AS dias_atraso,
    (v.situacao = 'atencao') AS so_atencao
  FROM lotes_etapas_vencimento v
  JOIN protocolos_etapas pe ON pe.id = v.protocolo_etapa_id
  WHERE v.situacao IN ('atraso', 'atencao')
    -- A etapa que ja virou tarefa e cobrada pela fonte 1, e nao por esta
    AND NOT EXISTS (
      SELECT 1 FROM atribuicoes a
       WHERE a.lote_id = v.lote_id
         AND a.lote_etapa_id = v.protocolo_etapa_id
         AND a.vencimento_protocolo = v.proximo_vencimento
         AND a.situacao <> 'cancelada')
),
pendencia AS (
  -- A MAIS ANTIGA MANDA, venha de onde vier (RF-52).
  SELECT DISTINCT ON (lote_id) *
    FROM (SELECT * FROM da_agenda UNION ALL SELECT * FROM do_protocolo) AS tudo
   ORDER BY lote_id, desde ASC
)
SELECT
  b.id                       AS lote_id,
  b.codigo                   AS codigo_lote,
  b.canteiro_id,
  b.posicao,
  p.atribuicao_id            AS atribuicao_pendente_id,
  p.protocolo_etapa_id       AS protocolo_etapa_pendente_id,
  p.tipo_tarefa_id           AS tipo_tarefa_pendente_id,
  p.nome_tarefa              AS tarefa_pendente,
  p.desde                    AS pendente_desde,
  COALESCE(p.dias_atraso, 0) AS dias_atraso,
  CASE
    WHEN p.lote_id IS NULL          THEN 'saudavel'
    WHEN p.so_atencao               THEN 'atencao'
    WHEN p.dias_atraso >= l.critico THEN 'critico'
    WHEN p.dias_atraso >= l.atencao THEN 'atencao'
    ELSE 'saudavel'
  END AS situacao
FROM lotes b
CROSS JOIN limites l
LEFT JOIN pendencia p ON p.lote_id = b.id
WHERE b.encerrado_em IS NULL;
