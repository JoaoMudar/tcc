# Changelog do banco

Uma entrada por migration nova, como pede o `CLAUDE.md`. As migrations até `20260901000008` são o
schema inicial em português e estão descritas no `C8`.

## 19/09/2026 · `20260919000001_divisao_de_lote.sql`

- `movimentos_lote_tipo_valido` passa a aceitar `divisao_saida` e `divisao_entrada` (RF-40, RN-39).
  O `C8` já os descrevia na lista fechada como especificados e não implementados, e a marca saiu de
  lá na mesma alteração.
- Reusar os tipos da repicagem teria sido mais barato e estaria errado: repicagem é troca de
  recipiente, e a divisão mantém o recipiente. A ficha do lote afirmaria uma troca de vasilhame que
  não houve, e a análise por tipo somaria as duas operações como se fossem a mesma.
- Compatível: nenhuma linha existente muda, e a lista só cresce.

## 18/09/2026 · `20260918000001_protocolo_de_atividades.sql`

- `protocolos`, `protocolos_etapas`, `especies_protocolos_tempos` e `lotes_etapas`: as quatro
  entidades que o `C6` e o `C8` descreviam como especificadas e não implementadas (RF-22 a RF-25,
  RF-46 a RF-53). Onde o `C6` e as figuras discordavam do `C8`, prevaleceu o `C8`: `lotes_etapas`
  tem chave composta, guarda fatos e **não** tem coluna de vencimento.
- Visão `lotes_etapas_vencimento`: próximo vencimento, janela de aviso e situação de cada etapa,
  derivados a cada leitura (RN-40). O tempo efetivo sai da espécie quando ela o sobrescreve (RN-36).
- As chaves estrangeiras que esperavam desde `20260901000004` e `20260901000005`:
  `lotes.protocolo_id` e `atribuicoes.lote_etapa_id`.
- Índice único `atribuicoes_uma_ordem_por_vencimento`: uma ordem em aberto por etapa e vencimento
  (RN-33, RF-50). A garantia é do banco, e não da aplicação: duas telas abertas ao mesmo tempo
  dobrariam a tarefa do dia.
- Dois parâmetros novos: `producao.protocolo_janela_aviso_pct` (20) e
  `producao.protocolo_horizonte_dias` (14).
- **Incompatível, e é o ponto de atenção desta migration:** `lotes.data_plantio` passou a
  `lotes.data_criacao`, e `data_plantio` renasceu anulável, para a data real do plantio que o
  protocolo grava (TA-38). O `DEFAULT CURRENT_DATE` foi retirado de `data_criacao` de propósito: com
  ele, código que escrevesse no nome antigo gravaria hoje em silêncio e deixaria as duas datas
  trocadas, sem nenhuma consulta acusar.

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
