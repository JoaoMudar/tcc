-- Migration: 20260914000001_lotes_posicao_unica.sql
-- Descricao: Dois lotes abertos nao ocupam a mesma posicao do canteiro.
--
-- Requisitos: RF-44 · Entidades: C8 `lotes`
--
-- O C8 descreve este indice desde 26/08/2026, e nenhuma migration o criava. E
-- parcial nos dois eixos: posicao nula e a ordem que ninguem cuidou, e lote
-- encerrado ja nao ocupa canteiro. A aplicacao da ao lote a posicao do fim da
-- fila travando o canteiro (src/lib/movimentos.ts); o indice e o que segura quando
-- alguem escrever por fora dela.
--
-- Compativel: nenhuma coluna muda.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE UNIQUE INDEX lotes_posicao_unica_no_canteiro
  ON lotes (canteiro_id, posicao)
  WHERE encerrado_em IS NULL AND posicao IS NOT NULL;
