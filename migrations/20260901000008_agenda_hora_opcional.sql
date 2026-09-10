-- Migration: 20260901000008_agenda_hora_opcional.sql
-- Descricao: A atribuicao passa a poder declarar a hora da tarefa.
--
-- Requisitos: RF-26 · Regras: RN-12
-- Entidades: C8 `atribuicoes`
--
-- POR QUE ESTA MIGRATION EXISTE. RN-12 afirmava que o viveiro planeja "por turno,
-- nao por horario", e isso e falso: a irrigacao das sete as oito TEM horario na
-- vida real, e a carga de terra que chega meio-dia tambem. O enunciado antigo
-- confundia duas coisas diferentes: registrar a hora da TAREFA, que o viveiro faz,
-- e apontar a hora de entrada e de saida da PESSOA, que e controle de ponto e
-- segue fora do escopo (A1 §7). A primeira tinha sido excluida de carona com a
-- segunda.
--
-- O TURNO CONTINUA OBRIGATORIO. Os turnos nao cobrem o dia inteiro: entre as 11h e
-- as 13h nao ha turno nenhum, e a hora sozinha nao diz a qual deles a tarefa
-- pertence. Quem sabe se a carga do meio-dia conta como manha ou como tarde e quem
-- monta a agenda, e nao o relogio.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE atribuicoes
  ADD COLUMN hora_inicio TIME,
  ADD COLUMN hora_fim   TIME;

-- Os tres casos reais: sem hora (a maioria das tarefas), so inicio (a carga que
-- chega meio-dia e ninguem sabe quando termina) e inicio com fim (a irrigacao das
-- sete as oito). Fim sem inicio nao e nenhum deles.
ALTER TABLE atribuicoes
  ADD CONSTRAINT atribuicoes_hora_coerente CHECK (
    hora_fim IS NULL OR (hora_inicio IS NOT NULL AND hora_fim > hora_inicio)
  );

COMMENT ON COLUMN atribuicoes.hora_inicio IS
  'Hora de inicio da tarefa que tem hora marcada. Nula na maioria: a unidade do planejamento e o turno. RN-12.';
COMMENT ON COLUMN atribuicoes.hora_fim IS
  'Hora de fim, quando ha inicio e se sabe o fim. Nao mede jornada de ninguem: nao ha apontamento por relogio. RN-12.';
