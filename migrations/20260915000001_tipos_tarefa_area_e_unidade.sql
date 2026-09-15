-- Migration: 20260915000001_tipos_tarefa_area_e_unidade.sql
-- Descricao: O tipo de tarefa declara se registra area e canteiro, e em que unidade
-- se conta a quantidade. As quantidades da agenda passam a aceitar decimal.
--
-- Requisitos: RF-21, RF-29, RF-30 · Regras: RN-24, RN-25
-- Entidades: C8 `tipos_tarefa`, `atribuicoes`, `atribuicoes_participantes`
--
-- POR QUE ESTA MIGRATION EXISTE. Ate aqui, toda tarefa sem lote pedia area e
-- canteiro na confirmacao. Colher semente e feita no mato, fora de qualquer area
-- do viveiro, e o campo aparecia sem ter o que responder. Quem decide se o lugar
-- importa e o tipo de tarefa, como ja decide lote, especie e recipiente (RF-21).
--
-- A UNIDADE VOLTA, AGORA COMO LISTA FECHADA. `unidade_medida` tinha sido cortada
-- por ser texto livre ("muda", "bandeja", "metro") que nao decidia nada. Semente se
-- conta em quilo e grama, e "2,5" sem unidade nao diz nada a quem le. A lista
-- fechada evita "kg", "Kg" e "quilo" para a mesma coisa (RNF-02).
--
-- DECIMAL. Quilo e litro tem fracao; a unidade `un` segue exigindo inteiro, e isso
-- e validado na aplicacao. NUMERIC(10,2) guarda os inteiros ja gravados sem perda.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

-- NENHUM TIPO JA CADASTRADO COMECA COM AREA LIGADA. O campo so aparece onde
-- alguem marcar, que e o que o booleano existe para dizer. Ligar em massa "para
-- manter como estava" traria de volta, calado, o campo que esta migration veio
-- tirar de onde ele nao faz sentido.
ALTER TABLE tipos_tarefa
  ADD COLUMN exige_area     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN unidade_medida TEXT    NOT NULL DEFAULT 'un';

ALTER TABLE tipos_tarefa
  -- RN-25: com lote, o canteiro vem dele, e pedi-lo de novo e redundancia.
  ADD CONSTRAINT tipos_tarefa_area_ou_lote CHECK (NOT (exige_lote AND exige_area)),
  ADD CONSTRAINT tipos_tarefa_unidade_valida CHECK (unidade_medida IN ('un', 'kg', 'g', 'L', 'mL'));

ALTER TABLE atribuicoes
  ALTER COLUMN quantidade_planejada TYPE NUMERIC(10,2);

ALTER TABLE atribuicoes_participantes
  ALTER COLUMN quantidade_feita TYPE NUMERIC(10,2);

COMMENT ON COLUMN tipos_tarefa.exige_area IS
  'Faz a confirmacao oferecer area e canteiro. Nunca junto com exige_lote: o lote ja da o canteiro. RF-30, RN-25.';
COMMENT ON COLUMN tipos_tarefa.unidade_medida IS
  'Unidade da quantidade por pessoa: un, kg, g, L, mL. So un exige inteiro. RN-24.';
