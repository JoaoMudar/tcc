-- Migration: 20260901000007_situacao_do_lote.sql
-- Descricao: A visao que pinta o lote no mapa.
--
-- Requisitos: RF-44, RF-45, RF-42 · Regras: RN-28, RN-26
-- Entidades: C8 `situacao_lote` (visao)
--
-- E VISAO, E NAO COLUNA (RF-45). Situacao gravada envelhece sozinha: o lote que
-- estava verde ontem continuaria verde no banco hoje, e a tela existe justamente
-- para dizer o contrario. E a mesma razao de o saldo disponivel e a mortalidade
-- tambem serem derivados.
--
-- A COR SAI DO ATRASO DE TAREFA, e de nada mais. A mortalidade tem alerta proprio
-- (RF-42); somar tudo numa cor so produziria um vermelho que nao diz o que
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
  SELECT COUNT(*) INTO n FROM parametros
   WHERE chave IN ('producao.atraso_atencao_dias', 'producao.atraso_critico_dias');
  IF n <> 2 THEN
    RAISE EXCEPTION 'situacao_lote exige os dois parametros de atraso na tabela parametros (achei %)', n;
  END IF;
END $$;

CREATE VIEW situacao_lote AS
WITH limites AS (
  SELECT
    (SELECT valor::INTEGER FROM parametros WHERE chave = 'producao.atraso_atencao_dias') AS atencao,
    (SELECT valor::INTEGER FROM parametros WHERE chave = 'producao.atraso_critico_dias') AS critico
),
pendencia AS (
  -- PENDENCIA E O QUE SEGUE `planejada`, e a condicao e positiva de proposito. As
  -- outras situacoes saem, cada uma pelo seu motivo: `confirmada` e a tarefa que a
  -- gerencia registrou como feita, e `nao_confirmada` e a que o fechamento da
  -- semana assumiu como feita (RN-14). Sem a segunda, toda semana fechada deixaria
  -- um vermelho permanente atras de si.
  --
  -- A MAIS ANTIGA MANDA: havendo tres pendencias no mesmo lote, quem determina a
  -- cor e a que espera ha mais tempo, e e ela que aparece ao apontar o lote
  -- (RF-45).
  SELECT DISTINCT ON (a.lote_id)
    a.lote_id,
    a.id             AS atribuicao_id,
    a.tipo_tarefa_id,
    tt.nome          AS nome_tarefa,
    a.data_trabalho,
    (CURRENT_DATE - a.data_trabalho) AS dias_atraso
  FROM atribuicoes a
  JOIN tipos_tarefa tt ON tt.id = a.tipo_tarefa_id
  WHERE a.situacao = 'planejada'
    AND a.lote_id IS NOT NULL
    AND a.data_trabalho < CURRENT_DATE
  ORDER BY a.lote_id, a.data_trabalho ASC
)
SELECT
  b.id                       AS lote_id,
  b.codigo                   AS codigo_lote,
  b.canteiro_id,
  b.posicao,
  p.atribuicao_id            AS atribuicao_pendente_id,
  p.tipo_tarefa_id           AS tipo_tarefa_pendente_id,
  p.nome_tarefa              AS tarefa_pendente,
  p.data_trabalho            AS pendente_desde,
  COALESCE(p.dias_atraso, 0) AS dias_atraso,
  CASE
    WHEN p.dias_atraso IS NULL            THEN 'saudavel'
    WHEN p.dias_atraso >= l.critico       THEN 'critico'
    WHEN p.dias_atraso >= l.atencao       THEN 'atencao'
    ELSE 'saudavel'
  END AS situacao
FROM lotes b
CROSS JOIN limites l
LEFT JOIN pendencia p ON p.lote_id = b.id
WHERE b.encerrado_em IS NULL;

COMMENT ON VIEW situacao_lote IS
  'Situacao do lote: saudavel, atencao, critico. Derivada do atraso da tarefa, nunca digitada. RF-45.';
