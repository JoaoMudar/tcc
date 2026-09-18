# Changelog do banco

Uma entrada por migration nova, como pede o `CLAUDE.md`. As migrations até `20260901000008` são o
schema inicial em português e estão descritas no `C8`.

## 15/09/2026 · `20260915000001_tipos_tarefa_area_e_unidade.sql`

- `tipos_tarefa.exige_area` (boolean): área e canteiro só aparecem na confirmação do tipo que o
  declara. CHECK `tipos_tarefa_area_ou_lote` impede declarar junto com lote (RN-24).
- `tipos_tarefa.unidade_medida` (text, lista fechada `un`, `kg`, `g`, `L`, `mL`, padrão `un`).
- `atribuicoes.quantidade_planejada` e `atribuicoes_participantes.quantidade_feita` passam de
  `INTEGER` a `NUMERIC(10,2)`, para quilo e litro com fração.
- Nenhum tipo já cadastrado começa com área ligada: o campo só aparece onde a gerência marcar.
- Compatível: os inteiros gravados cabem sem perda no decimal.

## 15/09/2026 · `20260915000002_tipos_tarefa_area_desligada.sql`

- Desliga `exige_area` nos bancos onde a primeira versão da migration anterior o ligou em massa.
  Em banco novo não muda nada.

## 14/09/2026 · `20260914000001_lotes_posicao_unica.sql`

- Índice único parcial `lotes_posicao_unica_no_canteiro` em `lotes (canteiro_id, posicao)`, só para
  lote aberto com posição. O `C8` já o descrevia; faltava no SQL.
- Compatível: nenhuma coluna muda, e nenhum lote gravado fica em conflito.
