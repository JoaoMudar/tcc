-- Migration: 20260918000001_protocolo_de_atividades.sql
-- Descricao: O protocolo de manejo do recipiente, e o percurso do lote por ele.
--
-- Requisitos: RF-22 a RF-25, RF-40, RF-45 a RF-53 · Regras: RN-30 a RN-41
-- Entidades: C8 `protocolos`, `protocolos_etapas`, `especies_protocolos_tempos`,
--            `lotes_etapas`, `lotes_etapas_vencimento` (visao); `lotes` e
--            `atribuicoes` emendadas
--
-- O PROTOCOLO PERTENCE AO RECIPIENTE, E NAO A ESPECIE (RN-30). E o vasilhame que
-- determina o manejo: o mesmo ipe em tubete e em saco 20x26 segue receitas
-- diferentes. Por isso `protocolos.recipiente_id` existe e `especie_id` nao; o que
-- a especie pode fazer e sobrescrever o TEMPO de uma etapa (RN-36), que e o que
-- `especies_protocolos_tempos` guarda.
--
-- `lotes_etapas` GUARDA FATOS, E NUNCA O VENCIMENTO (RN-40). O vencimento e funcao
-- da ancora, da ultima execucao e do tempo efetivo: gravado, seria um numero que
-- depende do dia de hoje e envelhece sozinho, pela mesma razao de `situacao_lote`
-- nao ser tabela. Quem o calcula e a visao `lotes_etapas_vencimento`.
--
-- O PROTOCOLO SUGERE, E NAO LANCA (RF-47, RN-41). Nada aqui escreve em
-- `atribuicoes`: a tarefa so existe quando a gerencia aceita a sugestao e a
-- preenche por inteiro. `atribuicoes.lote_etapa_id` e `vencimento_protocolo` ja
-- esperavam por esta migration desde 20260901000005, sem chave estrangeira.
--
-- AS DUAS DATAS DO LOTE. `data_plantio` nascia NOT NULL e gravada na criacao, mas
-- o que ela sempre significou foi a data em que a leva passou a OCUPAR CANTEIRO:
-- e dela que sai o ano do codigo e a data do movimento de entrada. Ela vira
-- `data_criacao`, e `data_plantio` renasce anulavel, gravada pelo protocolo ao
-- concluir a etapa de plantio. Vazia e informacao: significa "ainda nao germinou",
-- e as etapas ancoradas nela nao vencem nada (TA-38).
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

-- ------------------------------------------------------------
-- As duas datas do lote
-- ------------------------------------------------------------
ALTER TABLE lotes RENAME COLUMN data_plantio TO data_criacao;

-- O DEFAULT SAI JUNTO COM O NOME, e a razao merece registro. Mantido, ele faria a
-- escrita que esquecesse `data_criacao` gravar HOJE em silencio, enquanto a data
-- escolhida cairia na `data_plantio` recem-criada: o lote ficaria com as duas datas
-- trocadas e nenhuma consulta acusaria. Sem o default, a mesma escrita falha na
-- hora, que e o comportamento que se quer de uma coluna obrigatoria.
ALTER TABLE lotes ALTER COLUMN data_criacao DROP DEFAULT;

ALTER TABLE lotes ADD COLUMN data_plantio DATE;

-- ------------------------------------------------------------
-- A receita do recipiente
-- ------------------------------------------------------------
CREATE TABLE protocolos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipiente_id UUID NOT NULL REFERENCES recipientes(id),
  nome          TEXT NOT NULL,

  -- Um vigente por recipiente, garantido pelo indice parcial abaixo: dois
  -- vigentes tornariam indeterminado qual deles o lote novo segue (C2 UC-17 FE-3).
  ativo         BOOLEAN NOT NULL DEFAULT true,

  observacoes   TEXT,

  -- RN-52: todo registro tem autor identificado.
  criado_por    UUID NOT NULL REFERENCES usuarios(id),

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX protocolos_um_vigente_por_recipiente
  ON protocolos (recipiente_id) WHERE ativo;

CREATE TRIGGER protocolos_define_atualizado_em
  BEFORE UPDATE ON protocolos
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- ------------------------------------------------------------
-- A linha da receita
-- ------------------------------------------------------------
-- A ANCORA E ATRIBUTO, E NAO CONSEQUENCIA DE `posicao` (RN-31). Derivar "a etapa
-- anterior" da ordem da lista faria "Classificar pos-germinacao" contar da criacao
-- do lote, e a semente pode ficar dias esperando plantio antes de germinar:
-- mandaria classificar muda que ainda nao nasceu. A etapa ancora nao precisa ser a
-- imediatamente anterior, e e esse o caso que a coluna existe para representar.
--
-- O CICLO NA CADEIA DE ANCORAS NAO CABE EM RESTRICAO DECLARATIVA. A etapa A
-- ancorando em B e B ancorando em A e estruturalmente representavel, e a unica
-- barreira contra ela e a validacao da aplicacao, com teste dedicado (C2 UC-17
-- FE-1). Limite conhecido, declarado aqui em vez de descoberto em producao.
CREATE TABLE protocolos_etapas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id     UUID NOT NULL REFERENCES protocolos(id) ON DELETE CASCADE,
  tipo_tarefa_id   UUID NOT NULL REFERENCES tipos_tarefa(id),

  -- A MESMA TAREFA APARECE DUAS VEZES NO PROTOCOLO, e por isso existe `rotulo`.
  -- "Classificar pos-germinacao" e "Classificar selecao" sao duas etapas com
  -- propositos distintos, e o rotulo as distingue sem inflar o catalogo.
  rotulo           TEXT NOT NULL,

  posicao          INTEGER NOT NULL,

  -- RN-34: a sequencial acontece uma vez e avanca a fase do lote; a recorrente se
  -- repete e nunca avanca fase.
  tipo_agendamento TEXT NOT NULL,

  -- RN-31: de que evento a contagem parte.
  tipo_ancora      TEXT NOT NULL,
  etapa_ancora_id  UUID REFERENCES protocolos_etapas(id),

  -- Dias entre a ancora e a primeira ocorrencia, que e tambem a unica quando
  -- sequencial. Zero e valido: e a etapa que vence no proprio dia da ancora.
  dias             INTEGER NOT NULL,

  -- So recorrente: dias entre uma ocorrencia e a seguinte, contados da EXECUCAO
  -- REAL (RN-32).
  intervalo_dias   INTEGER,

  -- Obrigatorio porque `atribuicoes.turno_id` e NOT NULL, e a sugestao chega ao
  -- formulario com ele ja respondido.
  turno_id         UUID NOT NULL REFERENCES turnos_trabalho(id),

  -- RN-35: liga a regra de atraso. Falso nas rotinas diarias, que nao recebem cor
  -- nenhuma: etapa diaria colorida deixaria o viveiro inteiro em atraso toda manha.
  alerta_ligado    BOOLEAN NOT NULL DEFAULT true,

  -- Janela de aviso propria, em percentual do intervalo. Nula usa o parametro
  -- `producao.protocolo_janela_aviso_pct` (RN-35). E percentual e so percentual:
  -- um override absoluto em dias existiria para discordar do percentual.
  janela_aviso_pct NUMERIC(5,2),

  -- So sequencial: a fase que a conclusao grava em `lotes.fase`, na mesma lista
  -- fechada de la. Nula nao altera a fase (RN-34).
  fase_resultante  TEXT,

  ativo            BOOLEAN NOT NULL DEFAULT true,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT protocolos_etapas_agendamento_valido CHECK (tipo_agendamento IN
    ('sequencial', 'recorrente')),

  CONSTRAINT protocolos_etapas_ancora_valida CHECK (tipo_ancora IN
    ('criacao_do_lote', 'conclusao_de_etapa')),

  -- A etapa ancora existe se e somente se a ancora for a conclusao de outra.
  CONSTRAINT protocolos_etapas_ancora_coerente CHECK (
    (tipo_ancora = 'conclusao_de_etapa' AND etapa_ancora_id IS NOT NULL)
    OR (tipo_ancora = 'criacao_do_lote' AND etapa_ancora_id IS NULL)
  ),

  CONSTRAINT protocolos_etapas_ancora_nao_e_ela_mesma CHECK (etapa_ancora_id <> id),

  CONSTRAINT protocolos_etapas_dias_nao_negativo CHECK (dias >= 0),

  -- Recorrente sem intervalo nao produz a ocorrencia seguinte, e se apresentaria
  -- como se repetisse (C2 UC-17 FE-2). Sequencial com intervalo prometeria uma
  -- repeticao que nao acontece.
  CONSTRAINT protocolos_etapas_intervalo_coerente CHECK (
    (tipo_agendamento = 'recorrente' AND intervalo_dias > 0)
    OR (tipo_agendamento = 'sequencial' AND intervalo_dias IS NULL)
  ),

  CONSTRAINT protocolos_etapas_janela_valida CHECK (
    janela_aviso_pct IS NULL OR (janela_aviso_pct >= 0 AND janela_aviso_pct <= 100)
  ),

  -- RN-34: so a sequencial avanca fase, e a fase tem de existir na lista de `lotes`.
  CONSTRAINT protocolos_etapas_fase_coerente CHECK (
    fase_resultante IS NULL
    OR (tipo_agendamento = 'sequencial' AND fase_resultante IN
      ('semeado', 'germinado', 'repicado', 'crescimento', 'rustificacao', 'pronto'))
  )
);

CREATE UNIQUE INDEX protocolos_etapas_posicao_unica_no_protocolo
  ON protocolos_etapas (protocolo_id, posicao);

CREATE INDEX protocolos_etapas_protocolo_idx ON protocolos_etapas (protocolo_id);
CREATE INDEX protocolos_etapas_ancora_idx
  ON protocolos_etapas (etapa_ancora_id) WHERE etapa_ancora_id IS NOT NULL;

CREATE TRIGGER protocolos_etapas_define_atualizado_em
  BEFORE UPDATE ON protocolos_etapas
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- ------------------------------------------------------------
-- O tempo que a especie sobrescreve
-- ------------------------------------------------------------
-- NAO SAO COLUNAS EM `especies` (RN-36). Sao 142 especies contra as etapas de cada
-- protocolo, e a maioria nao sobrescreve nada: colunas produziriam uma matriz quase
-- toda nula, e cada etapa nova exigiria migration em `especies`.
CREATE TABLE especies_protocolos_tempos (
  especie_id         UUID NOT NULL REFERENCES especies(id) ON DELETE CASCADE,
  protocolo_etapa_id UUID NOT NULL REFERENCES protocolos_etapas(id) ON DELETE CASCADE,

  -- Nulos usam o valor da etapa. Ao menos um dos dois vem preenchido: linha sem
  -- nenhum override faz a consulta de tempo efetivo percorrer um caminho a mais
  -- para chegar ao mesmo numero (C2 UC-18 FE-1).
  dias               INTEGER,
  intervalo_dias     INTEGER,

  observacoes        TEXT,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (especie_id, protocolo_etapa_id),

  CONSTRAINT especies_protocolos_tempos_algum_valor CHECK (
    dias IS NOT NULL OR intervalo_dias IS NOT NULL
  ),

  CONSTRAINT especies_protocolos_tempos_dias_nao_negativo CHECK (dias IS NULL OR dias >= 0),

  CONSTRAINT especies_protocolos_tempos_intervalo_positivo CHECK (
    intervalo_dias IS NULL OR intervalo_dias > 0
  )
);

CREATE INDEX especies_protocolos_tempos_etapa_idx
  ON especies_protocolos_tempos (protocolo_etapa_id);

CREATE TRIGGER especies_protocolos_tempos_define_atualizado_em
  BEFORE UPDATE ON especies_protocolos_tempos
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- ------------------------------------------------------------
-- O percurso do lote pela etapa
-- ------------------------------------------------------------
-- NAO HA ENTIDADE DE EVENTOS DO PROTOCOLO, e e decisao declarada. O razao que
-- explica este estado e a propria `atribuicoes`: a ordem sabe a etapa que a gerou,
-- o vencimento que representa e a data em que foi confirmada. Uma segunda tabela
-- criaria duas verdades sobre o mesmo fato. CONSEQUENCIA ACEITA: marcar uma etapa
-- como feita fora da agenda tem de gerar a atribuicao correspondente, e nao
-- escrever direto aqui.
CREATE TABLE lotes_etapas (
  lote_id            UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  protocolo_etapa_id UUID NOT NULL REFERENCES protocolos_etapas(id),

  -- Data do evento de referencia, ja resolvido. NULA SIGNIFICA QUE A ANCORA AINDA
  -- NAO OCORREU, e a etapa nao vence nada: e o estado de "Classificar
  -- pos-germinacao" enquanto o plantio nao foi concluido. Representa "ainda nao
  -- germinou", que e diferente de "germinou hoje" e de "ninguem preencheu".
  data_ancora        DATE,

  -- Data REAL da ultima execucao, e nao a da ordem (RN-32). Usar a data planejada
  -- devolveria o comportamento de calendario fixo que o modulo existe para nao ter.
  ultima_execucao_em DATE,

  ocorrencias        INTEGER NOT NULL DEFAULT 0,

  -- So sequencial: quando a etapa se encerrou de vez. Preenchida, a etapa sai da
  -- visao de vencimentos.
  concluido_em       TIMESTAMPTZ,

  -- Lote de origem, quando o estado veio de uma divisao (RN-39).
  herdado_do_lote_id UUID REFERENCES lotes(id),

  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (lote_id, protocolo_etapa_id),

  CONSTRAINT lotes_etapas_ocorrencias_nao_negativas CHECK (ocorrencias >= 0),

  CONSTRAINT lotes_etapas_herdado_nao_e_ele_mesmo CHECK (herdado_do_lote_id <> lote_id)
);

CREATE INDEX lotes_etapas_etapa_idx ON lotes_etapas (protocolo_etapa_id);

-- A visao percorre as etapas que ainda vencem algo: com ancora resolvida e nao
-- concluidas. Este indice parcial e o que a torna barata.
CREATE INDEX lotes_etapas_vencendo_idx
  ON lotes_etapas (lote_id) WHERE data_ancora IS NOT NULL AND concluido_em IS NULL;

CREATE TRIGGER lotes_etapas_define_atualizado_em
  BEFORE UPDATE ON lotes_etapas
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- ------------------------------------------------------------
-- As chaves que esperavam por esta migration
-- ------------------------------------------------------------
ALTER TABLE lotes
  ADD CONSTRAINT lotes_protocolo_fk
  FOREIGN KEY (protocolo_id) REFERENCES protocolos(id);

ALTER TABLE atribuicoes
  ADD CONSTRAINT atribuicoes_lote_etapa_fk
  FOREIGN KEY (lote_etapa_id, lote_id) REFERENCES lotes_etapas(protocolo_etapa_id, lote_id);

-- UMA ORDEM EM ABERTO POR ETAPA E POR VENCIMENTO (RN-33, RF-50). A garantia e
-- indice unico, e nao validacao de aplicacao: duas telas abertas ao mesmo tempo
-- dobrariam a tarefa do dia, e as horas planejadas dobrariam com elas (E2, nota de
-- TA-39). A ordem cancelada sai do indice, porque cancelar e o que permite lancar
-- de novo (RN-38).
CREATE UNIQUE INDEX atribuicoes_uma_ordem_por_vencimento
  ON atribuicoes (lote_etapa_id, lote_id, vencimento_protocolo)
  WHERE lote_etapa_id IS NOT NULL AND situacao <> 'cancelada';

-- ------------------------------------------------------------
-- Os parametros do protocolo
-- ------------------------------------------------------------
-- A JANELA E PERCENTUAL, E NAO LIMITE FIXO EM DIAS (RN-35). Limite fixo e cedo
-- demais para o trimestral e tarde demais para o semanal: 20% de 90 dias sao 18
-- dias de aviso, e 20% de 7 dias sao pouco mais de um. Os parametros
-- `producao.atraso_*` continuam existindo e passam a reger apenas as atribuicoes
-- lancadas a mao.
INSERT INTO parametros (chave, valor, tipo_valor, descricao) VALUES
  ('producao.protocolo_janela_aviso_pct', '20', 'numero',
   'Percentual do intervalo da etapa em que ela entra em atencao antes de vencer (RF-24, RN-35)'),
  ('producao.protocolo_horizonte_dias', '14', 'numero',
   'Ate quantos dias a frente as etapas aparecem como sugestao ao lado da semana (RF-47)');

-- ------------------------------------------------------------
-- O vencimento, que e derivado
-- ------------------------------------------------------------
-- Assercao: os dois parametros tem de existir, porque a visao os le. Sem eles a
-- subconsulta devolveria nulo e nenhuma etapa avisaria coisa alguma, que e a falha
-- silenciosa que esta tela existe para evitar.
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM parametros
   WHERE chave IN ('producao.protocolo_janela_aviso_pct', 'producao.protocolo_horizonte_dias');
  IF n <> 2 THEN
    RAISE EXCEPTION 'lotes_etapas_vencimento exige os dois parametros do protocolo na tabela parametros (achei %)', n;
  END IF;
END $$;

CREATE VIEW lotes_etapas_vencimento AS
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
    WHEN CURRENT_DATE > COALESCE(le.ultima_execucao_em, le.data_ancora) + efetivo.dias_efetivos
      THEN 'atraso'
    WHEN CURRENT_DATE >= COALESCE(le.ultima_execucao_em, le.data_ancora) + efetivo.dias_efetivos
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

-- ------------------------------------------------------------
-- Comentarios
-- ------------------------------------------------------------
COMMENT ON TABLE protocolos IS
  'Receita de manejo de um recipiente. Um vigente por recipiente, e a edicao nao retroage. RN-30, RN-37.';
COMMENT ON TABLE protocolos_etapas IS
  'Linha da receita: a tarefa, quando ela ocorre e de que evento conta. RN-31, RN-34.';
COMMENT ON COLUMN protocolos_etapas.etapa_ancora_id IS
  'Etapa cuja conclusao inicia a contagem. O ciclo e barrado na aplicacao, nao aqui. RN-31.';
COMMENT ON COLUMN protocolos_etapas.janela_aviso_pct IS
  'Janela de aviso propria, em percentual. Nula usa producao.protocolo_janela_aviso_pct. RN-35.';
COMMENT ON TABLE especies_protocolos_tempos IS
  'Tempo de etapa sobrescrito por especie. Ao menos um dos dois valores vem preenchido. RN-36.';
COMMENT ON TABLE lotes_etapas IS
  'Acompanhamento do lote na etapa. Guarda fatos, e nunca o vencimento. RN-40.';
COMMENT ON COLUMN lotes_etapas.data_ancora IS
  'Data do evento de referencia. Nula significa que a ancora ainda nao ocorreu. RN-31.';
COMMENT ON COLUMN lotes_etapas.ultima_execucao_em IS
  'Data real da ultima execucao, e nao a da ordem. RN-32.';
COMMENT ON VIEW lotes_etapas_vencimento IS
  'Proximo vencimento e situacao de cada etapa do lote. Derivada, nunca digitada. RF-51, RF-52, RN-40.';
COMMENT ON COLUMN lotes.data_criacao IS
  'Data em que a leva passou a ocupar canteiro. Ancora das etapas que contam da criacao. RN-31.';
COMMENT ON COLUMN lotes.data_plantio IS
  'Data real da conclusao do plantio, gravada pelo protocolo. Vazia significa que ainda nao germinou.';
