-- Migration: 20261001000001_atribuicoes_prioridade.sql
-- Descricao: A tarefa ganha a precedencia de desenho na grade da semana.
--
-- Requisitos: RF-26, RNF-14
-- Entidades: C8 `atribuicoes`
--
-- POR QUE ESTA MIGRATION EXISTE. RF-26 admite duas tarefas ao mesmo tempo para a
-- mesma pessoa. A grade da semana nao empilha mais uma sob a outra: onde se
-- cruzam, a de maior precedencia aparece inteira e a coberta fica minimizada
-- embaixo. A precedencia comeca na ordem de lancamento (a ultima lancada
-- prevalece) e muda quando a gerencia traz a coberta para cima.
--
-- POR QUE NAO `criado_em` NEM `atualizado_em`. `criado_em` nao muda, e trazer a
-- tarefa para cima precisa mudar a ordem. `atualizado_em` muda em qualquer
-- alteracao, confirmacao inclusive, e confirmar nao e escolher qual aparece.
--
-- E SO DESENHO. Os horarios da tarefa coberta nao mudam; nenhuma regra de
-- negocio le esta coluna.
--
-- A ORDEM DESTE ARQUIVO E OBRIGATORIA: criar nula, preencher com `criado_em`,
-- so entao prender o DEFAULT e o NOT NULL.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE atribuicoes ADD COLUMN prioridade_em TIMESTAMPTZ;

UPDATE atribuicoes SET prioridade_em = criado_em;

ALTER TABLE atribuicoes ALTER COLUMN prioridade_em SET DEFAULT NOW();

ALTER TABLE atribuicoes ALTER COLUMN prioridade_em SET NOT NULL;
