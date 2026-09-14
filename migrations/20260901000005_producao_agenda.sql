-- Migration: 20260901000005_producao_agenda.sql
-- Descricao: A agenda da semana: o planejado e o confirmado, na mesma linha.
--
-- Requisitos: RF-26 a RF-31 · Regras: RN-12 a RN-14, RN-24 a RN-26, RN-31
-- Entidades: C8 `semanas`, `atribuicoes`, `atribuicoes_participantes`
--
-- NAO HA APONTAMENTO POR RELOGIO. `atribuicoes.situacao` percorre planejada,
-- confirmada e nao_confirmada, e e isso que dispensa uma entidade de execucao
-- separada: o realizado e o planejado com a marca de que aconteceu. Medir a hora de
-- entrada e de saida de cada pessoa seria controle de ponto, fora do escopo (A1 §7).
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE TABLE semanas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inicio_semana DATE NOT NULL UNIQUE,
  situacao      TEXT NOT NULL DEFAULT 'rascunho',
  publicada_por UUID REFERENCES usuarios(id),
  fechada_em    TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT semanas_situacao_valida CHECK (situacao IN ('rascunho', 'publicada', 'fechada')),

  -- RN-13: a semana fecha e, fechada, nao se altera. O momento do fechamento
  -- existe se e somente se ela estiver fechada.
  CONSTRAINT semanas_fechamento_coerente CHECK (
    (situacao = 'fechada' AND fechada_em IS NOT NULL)
    OR (situacao <> 'fechada' AND fechada_em IS NULL)
  )
);

CREATE TRIGGER semanas_define_atualizado_em
  BEFORE UPDATE ON semanas
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- ------------------------------------------------------------
-- A celula da grade
-- ------------------------------------------------------------
CREATE TABLE atribuicoes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id            UUID NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
  data_trabalho        DATE NOT NULL,

  -- OBRIGATORIO (RN-12): a unidade do planejamento e o turno, e a duracao dele sai
  -- de `turnos_trabalho`. A tarefa que tem hora marcada a declara em `hora_inicio` /
  -- `hora_fim` (20260901000008), sem dispensar o turno: os turnos nao cobrem o dia
  -- inteiro, e a hora nao diz a qual deles a tarefa pertence.
  turno_id             UUID NOT NULL REFERENCES turnos_trabalho(id),

  tipo_tarefa_id       UUID NOT NULL REFERENCES tipos_tarefa(id),

  -- Preenchidos conforme o tipo de tarefa declarar exigir (RF-21, RN-25).
  especie_id           UUID REFERENCES especies(id),
  recipiente_id        UUID REFERENCES recipientes(id),
  lote_id              UUID REFERENCES lotes(id),

  -- Area ou canteiro da tarefa que NAO exige lote (RF-30). Quando ha lote, ele ja
  -- carrega o canteiro, e pedi-lo de novo e redundancia.
  area_id              UUID REFERENCES areas(id),
  canteiro_id          UUID REFERENCES canteiros(id),

  quantidade_planejada INTEGER,

  -- E UMA MARCA, E NAO UMA REGRA DE CALENDARIO (RN-31). Diz que a atribuicao faz
  -- parte da rotina fixa e, por isso, vem preenchida ao copiar a semana anterior
  -- (RF-27). Uma entidade de recorrencia existiria para gerar dias sozinha, e o que
  -- gera dia sozinho neste modelo e o protocolo, cujo sujeito e o lote.
  e_recorrente         BOOLEAN NOT NULL DEFAULT false,

  -- Etapa do protocolo daquele lote que gerou esta ordem (RN-43). Nula = lancada a
  -- mao. A FK entra com `lotes_etapas`, quando o protocolo existir.
  lote_etapa_id        UUID,

  -- Vencimento que a ordem representa, congelado na geracao. Distingue-se de
  -- `data_trabalho`, que a gerencia pode remarcar: sem separar os dois, empurrar a
  -- ordem para a semana seguinte apagaria o atraso que ela existe para denunciar
  -- (RN-43).
  vencimento_protocolo DATE,

  situacao             TEXT NOT NULL DEFAULT 'planejada',
  observacoes          TEXT,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- `nao_confirmada` e a que o fechamento da semana assume como realizada (RN-14),
  -- e `cancelada` e a ordem que o encerramento do lote invalidou (RN-40).
  CONSTRAINT atribuicoes_situacao_valida CHECK (situacao IN
    ('planejada', 'confirmada', 'nao_confirmada', 'cancelada')),

  CONSTRAINT atribuicoes_quantidade_positiva
    CHECK (quantidade_planejada IS NULL OR quantidade_planejada > 0)
);

CREATE INDEX atribuicoes_semana_idx ON atribuicoes (semana_id, data_trabalho);
CREATE INDEX atribuicoes_lote_idx   ON atribuicoes (lote_id) WHERE lote_id IS NOT NULL;

-- RF-45: a situacao do lote sai da atribuicao que segue planejada e cuja data ja
-- passou. Este indice e o que torna o mapa barato.
CREATE INDEX atribuicoes_pendentes_idx
  ON atribuicoes (lote_id, data_trabalho) WHERE situacao = 'planejada';

CREATE TRIGGER atribuicoes_define_atualizado_em
  BEFORE UPDATE ON atribuicoes
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- ------------------------------------------------------------
-- Quem executa, e quanto cada um fez
-- ------------------------------------------------------------
-- A QUANTIDADE E DE CADA PESSOA, E NAO DA TAREFA (RN-24). Quatro pessoas enchendo
-- saquinho produzem quatro numeros, e e assim que o viveiro fala. Guardar um total
-- na atribuicao perderia justamente o dado que ela quer.
--
-- A ordem do protocolo nasce SEM NENHUMA LINHA AQUI (RN-43): o protocolo diz o que
-- fazer e quando, e quem faz continua sendo de quem monta a agenda.
CREATE TABLE atribuicoes_participantes (
  atribuicao_id    UUID NOT NULL REFERENCES atribuicoes(id) ON DELETE CASCADE,
  pessoa_id        UUID NOT NULL REFERENCES cadastro.pessoas(id),

  -- Nula quando a tarefa nao e quantitativa, e tambem quando a gerencia nao soube
  -- quantos aquela pessoa fez: tarefa registrada sem contagem vale mais do que
  -- nenhum registro (C2 UC-20 FA-4).
  quantidade_feita INTEGER,

  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (atribuicao_id, pessoa_id),

  CONSTRAINT atribuicoes_participantes_quantidade_nao_negativa
    CHECK (quantidade_feita IS NULL OR quantidade_feita >= 0)
);

CREATE INDEX atribuicoes_participantes_pessoa_idx ON atribuicoes_participantes (pessoa_id);

-- O movimento de lote passa a poder apontar para a tarefa que o causou.
ALTER TABLE movimentos_lote
  ADD CONSTRAINT movimentos_lote_atribuicao_fk
  FOREIGN KEY (atribuicao_id) REFERENCES atribuicoes(id);

COMMENT ON TABLE semanas IS
  'Semana de trabalho: rascunho, publicada, fechada. Semana fechada nao se altera. RN-13.';
COMMENT ON TABLE atribuicoes IS
  'A celula da agenda. O planejado e o confirmado na mesma linha: situacao distingue os dois. RN-14.';
COMMENT ON COLUMN atribuicoes.e_recorrente IS
  'Marca de rotina fixa: vem preenchida ao copiar a semana. Nao e regra de calendario. RN-31.';
COMMENT ON TABLE atribuicoes_participantes IS
  'Quem executou e quanto fez. A quantidade e de cada pessoa. RN-26, RN-24.';
