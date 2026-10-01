-- Migration: 20261001000002_atribuicoes_prioridade_opcional.sql
-- Descricao: A precedencia de desenho da tarefa passa a ser opcional.
--
-- Requisitos: RF-26, RNF-14
-- Entidades: C8 `atribuicoes`
--
-- POR QUE ESTA MIGRATION EXISTE. A `20261001000001` fez a precedencia nascer
-- com o lancamento: a ultima lancada ficava por cima. A grade da semana passou a
-- dividir o trecho cruzado em duas faixas, e a regra virou outra: sem escolha da
-- gerencia, a principal e a de maior duracao (no empate, a que comeca primeiro).
-- Essa regra se calcula na tela a partir dos horarios, e nao precisa de coluna.
-- O que precisa ser guardado e so a escolha manual ("Tornar principal"), e para
-- distinguir quem foi escolhida de quem segue a regra a coluna precisa aceitar
-- nulo.
--
-- NULO = SEGUE A REGRA. Preenchida = escolhida a mao; entre duas escolhidas, a
-- mais recente vence. Todas as linhas voltam a nulo: a ordem de lancamento
-- gravada pela `0001` nao era escolha de ninguem.
--
-- E SO DESENHO. Os horarios das tarefas nao mudam; nenhuma regra de negocio le
-- esta coluna.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE atribuicoes ALTER COLUMN prioridade_em DROP NOT NULL;

ALTER TABLE atribuicoes ALTER COLUMN prioridade_em DROP DEFAULT;

UPDATE atribuicoes SET prioridade_em = NULL;
