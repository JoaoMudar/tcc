-- Migration: 20261004000001_lotes_etapas_acoes.sql
-- Descricao: Historico das acoes sobre a etapa do protocolo do lote: adiar X dias e concluir sem agenda.
--
-- Requisitos: RF-66, RF-27 · Regras: RN-63, RN-29
-- Entidades: C8 `lotes_etapas_acoes`, `lotes_etapas_vencimento`, `atribuicoes`
--
-- POR QUE ESTA MIGRATION EXISTE. A lista "Pedem providencia" so mostrava a
-- pendencia, e o unico caminho para resolve-la era lancar uma tarefa na agenda.
-- A gerencia precisa de mais dois: adiar a etapa por alguns dias (a muda ainda
-- nao esta no ponto) e dar a etapa por feita sem que ela tenha passado pela
-- agenda (foi feita no meio de outro servico). Os dois ficam registrados aqui,
-- uma linha por acao, e e esta tabela que a ficha do lote mostra como historico.
--
-- O ADIAMENTO VALE PARA UMA OCORRENCIA SO (RN-63). A linha guarda a ocorrencia
-- que adiou, e a visao soma so os adiamentos da ocorrencia que esta por vir.
-- Concluida a etapa, a ocorrencia muda e o adiamento antigo deixa de contar
-- sozinho: nada precisa ser zerado, e o historico continua inteiro. O
-- vencimento continua calculado, nunca digitado (RN-40): o adiamento e uma
-- parcela da conta, e nao uma data que a substitui.
--
-- Compatibilidade: tabela nova; a visao mantem as mesmas colunas, por isso
-- CREATE OR REPLACE. `situacao_lote` le a visao e herda o adiamento sem mudar.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE TABLE lotes_etapas_acoes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id            UUID NOT NULL,
  protocolo_etapa_id UUID NOT NULL,

  -- A ocorrencia que a acao afetou: e ela que limita o adiamento a uma vez so.
  ocorrencia         INTEGER NOT NULL,

  tipo_acao          TEXT NOT NULL,

  -- So no adiamento: quantos dias somar ao vencimento daquela ocorrencia.
  dias               INTEGER,

  data_acao          DATE NOT NULL DEFAULT hoje_no_viveiro(),

  -- RN-52: todo registro tem autor identificado.
  registrado_por     UUID NOT NULL REFERENCES usuarios(id),

  observacoes        TEXT,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT lotes_etapas_acoes_etapa_fk
    FOREIGN KEY (lote_id, protocolo_etapa_id) REFERENCES lotes_etapas (lote_id, protocolo_etapa_id) ON DELETE CASCADE,

  CONSTRAINT lotes_etapas_acoes_tipo_valido
    CHECK (tipo_acao IN ('adiamento', 'conclusao_sem_agenda')),

  CONSTRAINT lotes_etapas_acoes_ocorrencia_positiva CHECK (ocorrencia > 0),

  -- Dias so no adiamento, e sempre para a frente
  CONSTRAINT lotes_etapas_acoes_dias_do_adiamento CHECK (
    (tipo_acao = 'adiamento' AND dias > 0) OR (tipo_acao <> 'adiamento' AND dias IS NULL)
  )
);

CREATE INDEX lotes_etapas_acoes_etapa_idx ON lotes_etapas_acoes (lote_id, protocolo_etapa_id, ocorrencia);

COMMENT ON TABLE lotes_etapas_acoes IS
  'Historico das acoes da gerencia sobre a etapa do protocolo do lote fora da agenda: adiar e concluir sem agenda. RF-66, RN-63.';
COMMENT ON COLUMN lotes_etapas_acoes.ocorrencia IS
  'Ocorrencia da etapa que a acao afetou. O adiamento so conta enquanto ela e a que esta por vir (RN-63).';
COMMENT ON COLUMN lotes_etapas_acoes.dias IS
  'So no adiamento: dias somados ao vencimento da ocorrencia. Nulo nas demais acoes.';

-- RF-27: a copia manual da semana saiu; a marca segue trazendo a rotina fixa.
COMMENT ON COLUMN atribuicoes.e_recorrente IS
  'Marca de rotina fixa: nasce sozinha na semana seguinte, no primeiro lancamento dela. Nao e regra de calendario. RN-29.';

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
  -- houve. RN-63: mais os adiamentos desta ocorrencia.
  vence.data AS proximo_vencimento,

  FLOOR(efetivo.dias_efetivos * COALESCE(pe.janela_aviso_pct, p.janela_pct) / 100)::INTEGER AS dias_aviso,

  CASE
    WHEN NOT pe.alerta_ligado THEN 'sem_alerta'
    WHEN hoje_no_viveiro() > vence.data THEN 'atraso'
    WHEN hoje_no_viveiro() >= vence.data
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

-- RN-63: so o adiamento da ocorrencia que esta por vir
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(ac.dias), 0)::INTEGER AS dias
    FROM lotes_etapas_acoes ac
   WHERE ac.lote_id = le.lote_id
     AND ac.protocolo_etapa_id = le.protocolo_etapa_id
     AND ac.ocorrencia = le.ocorrencias + 1
     AND ac.tipo_acao = 'adiamento'
) AS adiado

CROSS JOIN LATERAL (
  SELECT COALESCE(le.ultima_execucao_em, le.data_ancora) + efetivo.dias_efetivos + adiado.dias AS data
) AS vence

-- Lote aberto, etapa ativa, ancora resolvida e etapa nao concluida: o resto nao
-- vence nada, e mante-lo aqui obrigaria toda consulta a filtra-lo de novo.
WHERE b.encerrado_em IS NULL
  AND pe.ativo
  AND le.data_ancora IS NOT NULL
  AND le.concluido_em IS NULL
  AND efetivo.dias_efetivos IS NOT NULL;
