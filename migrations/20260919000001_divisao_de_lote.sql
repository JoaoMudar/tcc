-- Migration: 20260919000001_divisao_de_lote.sql
-- Descricao: Os dois tipos de movimento que a divisao de lote usa.
--
-- Requisitos: RF-40, RF-53 · Regras: RN-38, RN-39
-- Entidades: C8 `movimentos_lote` (lista fechada de `tipo_movimento`)
--
-- O C8 JA OS ESPECIFICAVA. `divisao_saida` e `divisao_entrada` estavam na lista
-- fechada do dicionario desde o schema inicial, marcados como *especificados, nao
-- implementados* (RN-39). Esta migration os implementa, e a marca sai do C8 na
-- mesma alteracao.
--
-- POR QUE NAO REUSAR OS TIPOS DA REPICAGEM. Repicagem e troca de recipiente, e e
-- isso que o rotulo diz na ficha do lote. A divisao mantem o recipiente e separa a
-- leva em dois lugares: gravada como repicagem, a ficha afirmaria uma troca de
-- vasilhame que nao houve, e a analise por tipo de movimento somaria as duas
-- operacoes como se fossem a mesma. O razao existe para explicar o saldo, e
-- explicar errado e pior do que nao explicar.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE movimentos_lote
  DROP CONSTRAINT movimentos_lote_tipo_valido;

ALTER TABLE movimentos_lote
  ADD CONSTRAINT movimentos_lote_tipo_valido CHECK (tipo_movimento IN
    ('entrada', 'perda', 'repicagem_saida', 'repicagem_entrada',
     'venda', 'ajuste_contagem', 'transferencia',
     'divisao_saida', 'divisao_entrada'));

COMMENT ON COLUMN movimentos_lote.tipo_movimento IS
  'Motivo do movimento, em lista fechada do C8. A divisao usa divisao_saida no original e divisao_entrada em cada resultante. RN-39.';
