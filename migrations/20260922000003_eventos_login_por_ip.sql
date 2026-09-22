-- Migration: 20260922000003_eventos_login_por_ip.sql
-- Descricao: Indice para contar as falhas de login recentes de uma mesma origem.
--
-- Requisitos: RF-01, RF-04 · Auditoria: SEC-003 (RELATORIO-SEGURANCA.md)
-- Entidades: C8 `eventos_login`
--
-- POR QUE ESTA MIGRATION EXISTE. O bloqueio de E4 A-01 conta falhas por
-- usuario, e quem testa uma senha contra varios logins nunca chega a cinco
-- erros em nenhum deles. O login passa a contar tambem as falhas da mesma
-- origem nos ultimos 15 minutos, antes de gastar um scrypt. A contagem le
-- `eventos_login`, que ja registra toda tentativa (RF-04): nao precisa de
-- tabela nova, so de um indice que ache as falhas de um IP sem varrer a
-- auditoria inteira.
--
-- PARCIAL EM `NOT sucesso` porque so a falha conta, e o login bem-sucedido
-- e a maior parte das linhas com o tempo.
--
-- Compativel: so acrescenta indice.

CREATE INDEX IF NOT EXISTS eventos_login_ip_recente ON eventos_login (ip, criado_em DESC) WHERE NOT sucesso;
