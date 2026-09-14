# Changelog do banco

Uma entrada por migration nova, como pede o `CLAUDE.md`. As migrations até `20260901000008` são o
schema inicial em português e estão descritas no `C8`.

## 14/09/2026 · `20260914000001_lotes_posicao_unica.sql`

- Índice único parcial `lotes_posicao_unica_no_canteiro` em `lotes (canteiro_id, posicao)`, só para
  lote aberto com posição. O `C8` já o descrevia; faltava no SQL.
- Compatível: nenhuma coluna muda, e nenhum lote gravado fica em conflito.
