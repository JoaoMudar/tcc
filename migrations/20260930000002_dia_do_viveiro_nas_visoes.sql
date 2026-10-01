-- Migration: 20260930000002_dia_do_viveiro_nas_visoes.sql
-- Descricao: O "hoje" das visoes passa a ser o dia do viveiro, e nao o do banco.
--
-- Requisitos: RF-45, RF-51, RF-52 · Entidades: C8 `situacao_lote`, `lotes_etapas_vencimento`
--
-- POR QUE ESTA MIGRATION EXISTE. As duas visoes mediam o atraso com
-- `CURRENT_DATE`, que e o dia no fuso da sessao do banco. O Neon roda em UTC:
-- das 21h a meia-noite de Brasilia ele ja esta no dia seguinte, e o lote
-- aparecia com um dia de atraso a mais (e podia mudar de cor antes da hora). A
-- aplicacao ja evitava o `CURRENT_DATE` (`hojeNoViveiro`, em `src/lib/datas.ts`);
-- faltava o banco. O CI pegou o erro rodando as 00:48 UTC.
--
-- A FUNCAO FIXA O FUSO, e nao a sessao: `SET timezone` dependeria de cada
-- conexao (e o pooler do Neon nao garante opcao de inicializacao).
--
-- Compatibilidade: as visoes mantem as mesmas colunas, por isso CREATE OR
-- REPLACE. `movimentos_lote.data_movimento` troca so o valor padrao.

CREATE OR REPLACE FUNCTION hoje_no_viveiro() RETURNS DATE
  LANGUAGE sql STABLE
  AS $$ SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE $$;

COMMENT ON FUNCTION hoje_no_viveiro() IS
  'Hoje no fuso do viveiro (America/Sao_Paulo). Usar no lugar de CURRENT_DATE, que segue o fuso da sessao.';

ALTER TABLE movimentos_lote ALTER COLUMN data_movimento SET DEFAULT hoje_no_viveiro();

CREATE OR REPLACE VIEW lotes_etapas_vencimento AS
WITH padrao AS (
  SELECT (SELECT valor::NUMERIC FROM parametros
           WHERE chave = 'producao.protocolo_janela_aviso_pct') AS janela_pct
)
SELECT
  le.lote_id,
  le.protocolo_etapa_id,

  -- A ocorrencia que esta por vir, e nao a que passou.
  le.ocorrencias + 1 AS ocorrencia,

  efetivo.dias_efetivos,

  -- RN-40: conta da execucao real quando ja houve uma, e da ancora quando nunca
  -- houve. E o que separa o protocolo de uma agenda de calendario.
  (COALESCE(le.ultima_execucao_em, le.data_ancora) + efetivo.dias_efetivos) AS proximo_vencimento,

  FLOOR(efetivo.dias_efetivos * COALESCE(pe.janela_aviso_pct, p.janela_pct) / 100)::INTEGER AS dias_aviso,

  CASE
    WHEN NOT pe.alerta_ligado THEN 'sem_alerta'
    WHEN hoje_no_viveiro() > COALESCE(le.ultima_execucao_em, le.data_ancora) + efetivo.dias_efetivos
      THEN 'atraso'
    WHEN hoje_no_viveiro() >= COALESCE(le.ultima_execucao_em, le.data_ancora) + efetivo.dias_efetivos
                         - FLOOR(efetivo.dias_efetivos * COALESCE(pe.janela_aviso_pct, p.janela_pct) / 100)::INTEGER
      THEN 'atencao'
    ELSE 'em_dia'
  END AS situacao

FROM lotes_etapas le
JOIN lotes b             ON b.id = le.lote_id
JOIN protocolos_etapas pe ON pe.id = le.protocolo_etapa_id
CROSS JOIN padrao p

-- O TEMPO EFETIVO E O DA ESPECIE QUANDO ELA O DECLARA (RN-36), e `dias` vale na
-- primeira ocorrencia enquanto `intervalo_dias` vale nas seguintes.
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN le.ocorrencias = 0 THEN COALESCE(ept.dias, pe.dias)
    ELSE COALESCE(ept.intervalo_dias, pe.intervalo_dias)
  END AS dias_efetivos
  FROM (SELECT 1) AS _
  LEFT JOIN especies_protocolos_tempos ept
    ON ept.protocolo_etapa_id = le.protocolo_etapa_id AND ept.especie_id = b.especie_id
) AS efetivo

-- Lote aberto, etapa ativa, ancora resolvida e etapa nao concluida: o resto nao
-- vence nada, e mante-lo aqui obrigaria toda consulta a filtra-lo de novo.
WHERE b.encerrado_em IS NULL
  AND pe.ativo
  AND le.data_ancora IS NOT NULL
  AND le.concluido_em IS NULL
  AND efetivo.dias_efetivos IS NOT NULL;

CREATE OR REPLACE VIEW situacao_lote AS
WITH limites AS (
  SELECT
    (SELECT valor::INTEGER FROM parametros WHERE chave = 'producao.atraso_atencao_dias') AS atencao,
    (SELECT valor::INTEGER FROM parametros WHERE chave = 'producao.atraso_critico_dias') AS critico
),
-- Fonte 1: a tarefa que alguem lancou e ninguem confirmou (RN-14).
da_agenda AS (
  SELECT
    a.lote_id,
    a.id                             AS atribuicao_id,
    NULL::UUID                       AS protocolo_etapa_id,
    a.tipo_tarefa_id,
    tt.nome                          AS nome_tarefa,
    a.data_trabalho                  AS desde,
    (hoje_no_viveiro() - a.data_trabalho) AS dias_atraso,
    false                            AS so_atencao
  FROM atribuicoes a
  JOIN tipos_tarefa tt ON tt.id = a.tipo_tarefa_id
  WHERE a.situacao = 'planejada'
    AND a.lote_id IS NOT NULL
    AND a.data_trabalho < hoje_no_viveiro()
),
-- Fonte 2: a etapa que o protocolo cobra e que ninguem lancou (RF-45, RF-47).
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
  -- A MAIS ANTIGA MANDA, venha de onde vier: havendo tarefa atrasada e etapa
  -- vencida no mesmo lote, quem determina a cor e a que espera ha mais tempo, e e
  -- ela que aparece ao apontar o lote (RF-45).
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
    -- A etapa dentro da janela percentual avisa sem passar pelo limite em dias
    WHEN p.so_atencao               THEN 'atencao'
    WHEN p.dias_atraso >= l.critico THEN 'critico'
    WHEN p.dias_atraso >= l.atencao THEN 'atencao'
    ELSE 'saudavel'
  END AS situacao
FROM lotes b
CROSS JOIN limites l
LEFT JOIN pendencia p ON p.lote_id = b.id
WHERE b.encerrado_em IS NULL;
