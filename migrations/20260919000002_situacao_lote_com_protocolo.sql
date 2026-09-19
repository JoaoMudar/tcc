-- Migration: 20260919000002_situacao_lote_com_protocolo.sql
-- Descricao: A situacao do lote passa a enxergar a etapa do protocolo vencida,
-- mesmo sem tarefa nenhuma lancada na agenda.
--
-- Requisitos: RF-45, RF-44 · Regras: RN-35, RN-40, RN-41
-- Entidades: C8 `situacao_lote` (visao recriada)
--
-- O QUE ESTAVA ERRADO. A visao de 20260901000007 nasceu antes do protocolo, e so
-- conhecia uma fonte de pendencia: a atribuicao `planejada` cuja data passou.
-- Desde que o protocolo sugere sem lancar (RF-47, RN-41), a etapa vencida nao
-- produz linha nenhuma em `atribuicoes` ate alguem aceitar a sugestao, e o mapa
-- pintava de verde justamente o lote que ninguem olhou. O RF-45 pede o contrario:
-- lote com etapa vencida aparece critico AINDA QUE NADA tenha sido lancado, e o
-- G2 ja descrevia a fonte do indicador como `atribuicoes` e `lotes_etapas`.
--
-- DUAS FONTES, E A MAIS ANTIGA MANDA. A pendencia passa a ser a uniao das duas, e
-- vence a que espera ha mais tempo: e ela que aparece ao apontar o lote. A etapa
-- que ja virou tarefa nao entra duas vezes, porque a tarefa lancada carrega
-- `lote_etapa_id` e a etapa correspondente e excluida da fonte do protocolo.
--
-- AS DUAS ESCALAS DE ATRASO, E A DECISAO E DE 19/09/2026. A etapa VENCIDA entra
-- com o seu atraso em dias e e comparada a `producao.atraso_atencao_dias` e
-- `producao.atraso_critico_dias`, como qualquer pendencia. A etapa em ATENCAO,
-- que ainda nao venceu, entra direto como `atencao` e com zero dia de atraso: a
-- janela dela e percentual do intervalo (RN-35), e passa-la por um limite em dias
-- devolveria o limite fixo que o protocolo existe para nao ter. A etapa de alerta
-- desligado nao pinta nada, pelo mesmo motivo por que nao colore na ficha: a
-- irrigacao diaria deixaria o viveiro inteiro vermelho toda manha.
--
-- COLUNAS NOVAS, E NENHUMA REMOVIDA. `atribuicao_pendente_id` passa a ser nula na
-- pendencia que vem do protocolo, e `protocolo_etapa_pendente_id` diz de que
-- etapa ela veio. Nada em `src/` lia a visao ainda: o mapa e a Fase 7.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

-- Assercao: os dois parametros de atraso continuam sendo lidos aqui. Sem eles a
-- subconsulta devolveria nulo e TODO lote apareceria saudavel, que e a falha
-- silenciosa mais cara possivel nesta tela.
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM parametros
   WHERE chave IN ('producao.atraso_atencao_dias', 'producao.atraso_critico_dias');
  IF n <> 2 THEN
    RAISE EXCEPTION 'situacao_lote exige os dois parametros de atraso na tabela parametros (achei %)', n;
  END IF;
END $$;

DROP VIEW situacao_lote;

CREATE VIEW situacao_lote AS
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
    (CURRENT_DATE - a.data_trabalho) AS dias_atraso,
    false                            AS so_atencao
  FROM atribuicoes a
  JOIN tipos_tarefa tt ON tt.id = a.tipo_tarefa_id
  WHERE a.situacao = 'planejada'
    AND a.lote_id IS NOT NULL
    AND a.data_trabalho < CURRENT_DATE
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
    GREATEST(0, CURRENT_DATE - v.proximo_vencimento) AS dias_atraso,
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

COMMENT ON VIEW situacao_lote IS
  'Situacao do lote: saudavel, atencao, critico. Derivada do atraso da tarefa lancada e da etapa do protocolo vencida, nunca digitada. RF-45.';
