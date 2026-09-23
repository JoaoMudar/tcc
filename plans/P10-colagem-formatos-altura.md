# P10: altura em centímetros e colagem que entende os formatos de lista do cliente

Plano aprovado em 23/09/2026. Decisões: o preço lido na colagem é reconhecido e descartado (RN-50),
a altura aparece como "1,20 m" e a faixa de tamanho grava o menor valor.

## Fase 1: altura
- [x] `pedidos-rotulos.ts`: `parseAltura` lê centímetros ("80 cm"; inteiro sem unidade a partir de 10); `normalizaCampoAltura`
- [x] Campo de altura formata ao sair: `GradeItens`, `ItemEmFoco`, `ItemDoPedido`, `AdicionarItemForm`
- [x] Lista do celular sem "m" duplicado; colagem tabular grava "1,20 m"
- [x] Testes

## Fase 2: leitor da colagem
- [x] `pedidos-colagem.ts`: itens por linha, `|` e `;`; tamanho, faixa, preço, recipiente; cabeçalho de grupo; número solto depois do tamanho
- [x] `montaLinhasColadas` casa o recipiente com o cadastro
- [x] Testes com os 12 formatos de exemplo

## Fase 3: revisão
- [x] `ColarLista.tsx`: colunas recipiente e altura; recipiente por linha; padrão só nas linhas sem recipiente lido; preço mostrado como descartado
- [x] `NovoPedidoForm.tsx` leva a altura importada
- [x] Testes

## Fase 4: documentação
- [x] `docs/rotinas/3-comercial/pedidos.md`
- [x] `node scripts/verifica-rastreabilidade.mjs`
- Sem migration, portanto sem entrada no `CHANGELOG.md` (que é do banco) e sem mudança em C6, C8 ou `modelo-dados-pt`.
