-- Migration: 20260930000002_fuso_do_banco.sql
-- Descricao: O banco passa a contar o dia no fuso do viveiro.
--
-- POR QUE ESTA MIGRATION EXISTE. As visoes de situacao do lote e de vencimento
-- de etapa usam CURRENT_DATE, que segue o `timezone` da sessao. O Neon e o
-- Postgres do CI rodam em UTC: das 21h a meia-noite de Brasilia o banco ja esta
-- no dia seguinte, e o atraso da etapa sai com um dia a mais do que o
-- aplicativo (que usa `hojeNoViveiro`) mostra. Gravar o fuso no banco faz o
-- CURRENT_DATE e os DEFAULT CURRENT_DATE concordarem com o aplicativo.
--
-- VALE PARA SESSAO NOVA. Conexao ja aberta segue no fuso antigo ate ser
-- reaberta. O pg_restore num banco criado a parte nao traz o ALTER DATABASE, e
-- a _migrations restaurada diz que esta migration ja rodou: no banco
-- restaurado, repetir o ALTER DATABASE abaixo a mao.
--
-- SEM BEGIN/COMMIT PROPRIOS: ALTER DATABASE ... SET roda dentro da transacao do
-- runner.

DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'America/Sao_Paulo');
END
$$;
