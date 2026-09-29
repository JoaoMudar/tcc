-- Migration: 20260930000001_envios_recebidos.sql
-- Descricao: A chave de idempotencia do registro feito sem conexao.
--
-- Requisitos: RNF-05 · Casos de uso: UC-20 FA-3, UC-25, UC-26
-- Entidades: C8 `envios_recebidos`
--
-- POR QUE ESTA MIGRATION EXISTE. O registro de campo (perda, contagem e
-- confirmacao de tarefa) pode ser feito sem rede: o aparelho guarda o registro
-- numa fila e envia quando a rede volta (plans/P1, Fase 9). Reenviar e da
-- natureza da fila: a resposta pode se perder no caminho depois de o servidor
-- ter gravado, e o aparelho, sem saber, manda de novo. Sem a chave, a perda
-- reenviada seria baixada duas vezes do lote, e a confirmacao reenviada seria
-- recusada por a tarefa ja estar confirmada.
--
-- A CHAVE E GERADA NO APARELHO, antes de qualquer tentativa de envio, e o
-- servidor a grava na mesma transacao do registro. Chave ja vista devolve a
-- resposta guardada, sem executar nada de novo.
--
-- TABELA PROPRIA, E NAO COLUNA EM `movimentos_lote`: a confirmacao de tarefa sem
-- perda e a contagem igual ao saldo nao gravam movimento nenhum, e tambem
-- precisam responder "ja recebido" ao reenvio.
--
-- SO FATO CONSUMADO: sem `atualizado_em` nem `ativo`.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE TABLE envios_recebidos (
  -- Gerada no aparelho (crypto.randomUUID), e nao pelo banco: e ela que
  -- identifica o reenvio.
  chave       UUID PRIMARY KEY,
  tipo        TEXT NOT NULL,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id),

  -- O que o servidor respondeu da primeira vez (mensagem e, na confirmacao, o
  -- destino da tela), devolvido igual ao reenvio.
  resposta    JSONB NOT NULL,

  recebido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT envios_recebidos_tipo_valido
    CHECK (tipo IN ('perda', 'contagem', 'confirmacao_tarefa'))
);
