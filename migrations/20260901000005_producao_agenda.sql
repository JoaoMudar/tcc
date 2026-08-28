-- Migration: 20260901000005_producao_agenda.sql
-- Descricao: A agenda da semana: o planejado e o confirmado, na mesma linha.
--
-- Requisitos: RF-71 a RF-75, RF-92, RF-98, RF-99, RF-107, RF-113 · Regras: RN-48, RN-50, RN-51, RN-82, RN-84, RN-91, RN-95
-- Entidades: C8 `week_plans`, `assignments`, `assignment_members`
--
-- NAO HA APONTAMENTO POR RELOGIO. `assignments.status` percorre planejada,
-- confirmada e nao_confirmada, e e isso que dispensa uma entidade de execucao
-- separada: o realizado e o planejado com a marca de que aconteceu. Medir a hora de
-- entrada e de saida de cada pessoa seria controle de ponto, fora do escopo (A1 §7).
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE TABLE week_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start   DATE NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'rascunho',
  published_by UUID REFERENCES users(id),
  closed_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT week_plans_status_valido CHECK (status IN ('rascunho', 'publicada', 'fechada')),

  -- RN-50: a semana fecha e, fechada, nao se altera. O momento do fechamento
  -- existe se e somente se ela estiver fechada.
  CONSTRAINT week_plans_fechamento_coerente CHECK (
    (status = 'fechada' AND closed_at IS NOT NULL)
    OR (status <> 'fechada' AND closed_at IS NULL)
  )
);

CREATE TRIGGER week_plans_set_updated_at
  BEFORE UPDATE ON week_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- A celula da grade
-- ------------------------------------------------------------
CREATE TABLE assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_plan_id     UUID NOT NULL REFERENCES week_plans(id) ON DELETE CASCADE,
  work_date        DATE NOT NULL,

  -- NUNCA HORA MARCADA (RN-48): o viveiro planeja por turno, e a duracao sai de
  -- `work_shifts`.
  shift_id         UUID NOT NULL REFERENCES work_shifts(id),

  task_type_id     UUID NOT NULL REFERENCES task_types(id),

  -- Preenchidos conforme o tipo de tarefa declarar exigir (RF-82, RN-82).
  species_id       UUID REFERENCES species(id),
  container_id     UUID REFERENCES containers(id),
  batch_id         UUID REFERENCES batches(id),

  -- Area ou canteiro da tarefa que NAO exige lote (RF-113). Quando ha lote, ele ja
  -- carrega o canteiro, e pedi-lo de novo e redundancia.
  area_id          UUID REFERENCES areas(id),
  bed_id           UUID REFERENCES beds(id),

  planned_quantity INTEGER,

  -- E UMA MARCA, E NAO UMA REGRA DE CALENDARIO (RN-95). Diz que a atribuicao faz
  -- parte da rotina fixa e, por isso, vem preenchida ao copiar a semana anterior
  -- (RF-72). Uma entidade de recorrencia existiria para gerar dias sozinha, e o que
  -- gera dia sozinho neste modelo e o protocolo, cujo sujeito e o lote.
  is_recurring     BOOLEAN NOT NULL DEFAULT false,

  -- Etapa do protocolo daquele lote que gerou esta ordem (RN-111). Nula = lancada a
  -- mao. A FK entra com `batch_protocol_steps`, quando o protocolo existir.
  batch_protocol_step_id UUID,

  -- Vencimento que a ordem representa, congelado na geracao. Distingue-se de
  -- `work_date`, que a gerencia pode remarcar: sem separar os dois, empurrar a
  -- ordem para a semana seguinte apagaria o atraso que ela existe para denunciar
  -- (RN-112).
  protocol_due_on  DATE,

  status           TEXT NOT NULL DEFAULT 'planejada',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- `nao_confirmada` e a que o fechamento da semana assume como realizada (RN-51),
  -- e `cancelada` e a ordem que o encerramento do lote invalidou (RN-108).
  CONSTRAINT assignments_status_valido CHECK (status IN
    ('planejada', 'confirmada', 'nao_confirmada', 'cancelada')),

  CONSTRAINT assignments_quantidade_positiva
    CHECK (planned_quantity IS NULL OR planned_quantity > 0)
);

CREATE INDEX assignments_semana_idx ON assignments (week_plan_id, work_date);
CREATE INDEX assignments_lote_idx   ON assignments (batch_id) WHERE batch_id IS NOT NULL;

-- RF-118: a situacao do lote sai da atribuicao que segue planejada e cuja data ja
-- passou. Este indice e o que torna o mapa barato.
CREATE INDEX assignments_pendentes_idx
  ON assignments (batch_id, work_date) WHERE status = 'planejada';

CREATE TRIGGER assignments_set_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Quem executa, e quanto cada um fez
-- ------------------------------------------------------------
-- A QUANTIDADE E DE CADA PESSOA, E NAO DA TAREFA (RN-91). Quatro pessoas enchendo
-- saquinho produzem quatro numeros, e e assim que o viveiro fala. Guardar um total
-- na atribuicao perderia justamente o dado que ela quer.
--
-- A ordem do protocolo nasce SEM NENHUMA LINHA AQUI (RN-113): o protocolo diz o que
-- fazer e quando, e quem faz continua sendo de quem monta a agenda.
CREATE TABLE assignment_members (
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  party_id      UUID NOT NULL REFERENCES cadastro.parties(id),

  -- Nula quando a tarefa nao e quantitativa, e tambem quando a gerencia nao soube
  -- quantos aquela pessoa fez: tarefa registrada sem contagem vale mais do que
  -- nenhum registro (C2 UC-51 FA-4).
  quantity_done INTEGER,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (assignment_id, party_id),

  CONSTRAINT assignment_members_quantidade_nao_negativa
    CHECK (quantity_done IS NULL OR quantity_done >= 0)
);

CREATE INDEX assignment_members_pessoa_idx ON assignment_members (party_id);

-- O movimento de lote passa a poder apontar para a tarefa que o causou.
ALTER TABLE batch_movements
  ADD CONSTRAINT batch_movements_assignment_fk
  FOREIGN KEY (assignment_id) REFERENCES assignments(id);

COMMENT ON TABLE week_plans IS
  'Semana de trabalho: rascunho, publicada, fechada. Semana fechada nao se altera. RN-50.';
COMMENT ON TABLE assignments IS
  'A celula da agenda. O planejado e o confirmado na mesma linha: status distingue os dois. RN-51.';
COMMENT ON COLUMN assignments.is_recurring IS
  'Marca de rotina fixa: vem preenchida ao copiar a semana. Nao e regra de calendario. RN-95.';
COMMENT ON TABLE assignment_members IS
  'Quem executou e quanto fez. A quantidade e de cada pessoa. RN-84, RN-91.';
