-- Migration: 20261027000005_envios_altura_e_tarefa_feita.sql
-- Descricao: A altura do lote e a tarefa feita fora da agenda tambem funcionam sem conexao.
--
-- Requisitos: RNF-04 · Entidades: C8 `envios_recebidos`
--
-- POR QUE ESTA MIGRATION EXISTE. So perda, contagem e confirmacao de tarefa
-- passavam pela fila do aparelho. A auditoria de conformidade de 24/10/2026
-- apontou que a altura e a tarefa feita fora da agenda, registradas no viveiro
-- com o celular na mao, dependiam de rede. Decisao de 27/10/2026: as duas
-- entram na fila, e o RNF-04 passa a listar os cinco registros cobertos. A
-- separacao e o carregamento de pedido continuam com rede.
--
-- Compatibilidade: so amplia o CHECK.

ALTER TABLE envios_recebidos DROP CONSTRAINT envios_recebidos_tipo_valido;
ALTER TABLE envios_recebidos ADD CONSTRAINT envios_recebidos_tipo_valido
  CHECK (tipo IN ('perda', 'contagem', 'confirmacao_tarefa', 'altura', 'tarefa_feita'));
