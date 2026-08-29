-- Migration: 20260901000007_situacao_do_lote.sql
-- Descricao: A visao que pinta o lote no mapa.
--
-- Requisitos: RF-54 a RF-57 · Regras: RN-30, RN-31, RN-32
-- Entidades: C8 `batch_health` (visao)
--
-- E VISAO, E NAO COLUNA (RN-31). Status gravado envelhece sozinho: o lote que
-- estava verde ontem continuaria verde no banco hoje, e a tela existe justamente
-- para dizer o contrario. E a mesma razao de o saldo disponivel e a mortalidade
-- tambem serem derivados.
--
-- A COR SAI DO ATRASO DE TAREFA, e de nada mais. A mortalidade tem alerta proprio
-- (RF-52, RF-57); somar tudo numa cor so produziria um vermelho que nao diz o que
-- fazer. O que o mapa mostra ao apontar o lote e uma acao pendente:
-- "Irrigacao, atrasada 3 dias".
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

-- Assercao: os dois parametros tem de existir, porque a visao os le. Sem eles a
-- subconsulta devolveria nulo e TODO lote apareceria como saudavel, que e a falha
-- silenciosa mais cara possivel nesta tela.
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM settings
   WHERE key IN ('producao.atraso_atencao_dias', 'producao.atraso_critico_dias');
  IF n <> 2 THEN
    RAISE EXCEPTION 'batch_health exige os dois parametros de atraso em settings (achei %)', n;
  END IF;
END $$;

CREATE VIEW batch_health AS
WITH limites AS (
  SELECT
    (SELECT value::INTEGER FROM settings WHERE key = 'producao.atraso_atencao_dias') AS atencao,
    (SELECT value::INTEGER FROM settings WHERE key = 'producao.atraso_critico_dias') AS critico
),
pendencia AS (
  -- PENDENCIA E O QUE SEGUE `planejada`, e a condicao e positiva de proposito. Os
  -- outros status saem, cada um pelo seu motivo: `confirmada` e a tarefa que a
  -- gerencia registrou como feita, e `nao_confirmada` e a que o fechamento da
  -- semana assumiu como feita (RN-14). Sem a segunda, toda semana fechada deixaria
  -- um vermelho permanente atras de si.
  --
  -- A MAIS ANTIGA MANDA: havendo tres pendencias no mesmo lote, quem determina a
  -- cor e a que espera ha mais tempo, e e ela que aparece ao apontar o lote
  -- (RF-56).
  SELECT DISTINCT ON (a.batch_id)
    a.batch_id,
    a.id           AS assignment_id,
    a.task_type_id,
    tt.name        AS task_name,
    a.work_date,
    (CURRENT_DATE - a.work_date) AS days_late
  FROM assignments a
  JOIN task_types tt ON tt.id = a.task_type_id
  WHERE a.status = 'planejada'
    AND a.batch_id IS NOT NULL
    AND a.work_date < CURRENT_DATE
  ORDER BY a.batch_id, a.work_date ASC
)
SELECT
  b.id        AS batch_id,
  b.code      AS batch_code,
  b.bed_id,
  b.position,
  p.assignment_id          AS pending_assignment_id,
  p.task_type_id           AS pending_task_type_id,
  p.task_name              AS pending_task_name,
  p.work_date              AS pending_since,
  COALESCE(p.days_late, 0) AS days_late,
  CASE
    WHEN p.days_late IS NULL            THEN 'saudavel'
    WHEN p.days_late >= l.critico       THEN 'critico'
    WHEN p.days_late >= l.atencao       THEN 'atencao'
    ELSE 'saudavel'
  END AS health
FROM batches b
CROSS JOIN limites l
LEFT JOIN pendencia p ON p.batch_id = b.id
WHERE b.closed_at IS NULL;

COMMENT ON VIEW batch_health IS
  'Situacao do lote: saudavel, atencao, critico. Derivada do atraso da tarefa, nunca digitada. RN-31.';
