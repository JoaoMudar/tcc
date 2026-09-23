# P11: o pedido aceita os 7 tipos (orçamento incompleto até o Fechar)

Plano aprovado em 23/09/2026. Decisões: genérico sem quantidade vira lista montada, com preço por item; só o rótulo de `cadastrado` passa a "Orçamento".

## Contexto
`docs/rotinas/3-comercial/pedidos-como-chegam.md` descreve 7 formas de pedido chegar pelo WhatsApp.
A regra: no cadastro basta espécie **ou** descrição; tudo o que falta (recipiente, quantidade,
preço) é preenchido pelo viveiro no caminho, e só o **Fechar** (aprovar) exige tudo. Hoje o sistema
trava em quatro pontos, e isso bloqueia os tipos 1, 2, 3 e 7.

| Trava hoje | Onde |
|---|---|
| `recipiente_id NOT NULL` | migration `20260901000006`; `pedidos/actions.ts:47`; `NovoItem.recipienteId: string`; `listItens` faz `JOIN recipientes` |
| Quantidade exigida para ir a `verificando` | `mudarSituacao` em `src/lib/pedidos.ts:456` |
| Verificação só responde sobre o que já está no item | `resolveDisponibilidade` (`pedidos-rotulos.ts:295`), CHECKs `pedidos_itens_disponibilidade_coerente` e `pedidos_itens_recipiente_disponivel_com_muda` |
| Genérico exige quantidade (a composição fecha na soma) e recipiente | `validarComposicaoGenerico` (`pedidos-rotulos.ts:337`), `definirComposicaoGenerico` |
| Chefia não mexe em quantidade depois da verificação sem reenviar | `exigirCadastrado`, `atualizarItem`; `definirPrecos` recusa preço sem quantidade |

Decisões tomadas com o usuário:
- **Tipo 7**: genérico **sem quantidade** vira uma **lista montada**: os filhos que a gerência cria
  são itens de venda próprios, cada um com seu preço. Genérico **com** quantidade (tipos 5 e 6)
  continua com preço único herdado pelos filhos.
- **"Orçamento"**: só o rótulo de `cadastrado` muda. Nenhuma situação nova.

## Modelo resultante (o que cada etapa exige)
| Etapa | Exige |
|---|---|
| Cadastrar | específico: espécie. Genérico: especificação (texto) não vazia. Recipiente, quantidade, altura: opcionais |
| Verificar | nada novo. Item sem quantidade ou sem recipiente: a gerência responde **quantas tem e em que recipiente** |
| Negociar (`verificado`/`pendente_alteracao`) | chefia preenche quantidade (até o que a gerência confirmou), escolhe o recipiente dentre o conferido, põe preço, pode baixar quantidade ou tirar item **sem reenviar** |
| Fechar | todo item vendável com espécie, recipiente, quantidade e preço |

"Item vendável" = item de topo não genérico, genérico **com** quantidade, e filho de genérico **sem**
quantidade (lista montada). Uma condição SQL só, reusada no total, na precificação e na aprovação.

## Fase 1: banco (migration `20260924000001_pedido_orcamento_incompleto.sql`)
- [x] `pedidos_itens.recipiente_id DROP NOT NULL` (comentário: nulo é "o cliente não disse o tamanho").
- [x] Trocar `pedidos_itens_disponibilidade_coerente` por uma que cubra o item sem quantidade:
  - `disponivel IS NULL` → `quantidade_disponivel IS NULL`;
  - `quantidade IS NOT NULL` → regras atuais (true = `qd NULL`; false = `qd BETWEEN 0 AND quantidade-1`);
  - `quantidade IS NULL` → `qd IS NOT NULL AND qd >= 0 AND disponivel = (qd > 0)` ("tenho 350").
- [x] Trocar `pedidos_itens_recipiente_disponivel_com_muda` por `recipiente_disponivel_id IS NULL OR quantidade_disponivel IS DISTINCT FROM 0`: permite "tem tudo, em 17x22" (tipo 2) sem mudar o sentido de "não tem nenhuma".
- [x] `CHECK (NOT generico OR especificacao IS NOT NULL)`: o genérico precisa dizer o que foi pedido. Antes, `UPDATE` que preenche `especificacao` nula dos genéricos existentes com `'Mudas nativas'` (o banco de produção pode ter algum).
- [x] Ordem obrigatória como em `20260921000001`: soltar constraints, migrar linhas, prender as novas. Sem BEGIN/COMMIT.
- [x] `CHANGELOG.md`; C6 (cardinalidade `pedidos_itens` → `recipientes` vira 0..1), C8 (colunas e CHECKs), figura do `modelo-dados-pt` + `mede-figuras.mjs` + `confere-modelo-pt.mjs`.

## Fase 2: cadastro (tipos 1, 2, 3 e 7)
- [x] `src/lib/pedidos.ts`: `NovoItem.recipienteId: string | null`; `ItemPedido.recipiente: string | null`; `listItens` com `LEFT JOIN recipientes` (e o `ORDER BY` com `NULLS LAST`).
- [x] `inserirItens`: genérico exige `especificacao`.
- [x] `pedidos/actions.ts` (criar e adicionar item): recipiente opcional (vazio → `null`, preenchido tem de ser UUID); genérico exige especificação.
- [x] Telas do cadastro aceitam recipiente em branco: `GradeItens`, `ItemEmFoco`, `ColarLista` (o padrão de recipiente deixa de ser obrigatório), `AdicionarItemForm`, `ItemDoPedido`. Texto "a definir" em `ItensDoPedido` para recipiente e quantidade vazios.
- [x] `novo/page.tsx:49`: o aviso de "precisa de recipiente cadastrado" deixa de bloquear.
- [x] `atualizarItem` passa a aceitar recipiente (a chefia completa o que o cliente disse depois, ainda em `cadastrado`).

## Fase 3: verificação preenche o que está em branco
- [x] `mudarSituacao`: remover a exigência de quantidade para `verificando`.
- [x] `resolveDisponibilidade(estado, item, extras)` recebe o item (`quantidade`, `recipienteId`) e devolve:
  - item completo: igual a hoje, e "tem tudo" aceita recipiente conferido opcional;
  - item sem quantidade: estados viram **"Tem" (quantas + recipiente)** e **"Não tem"**; grava `disponivel = qd > 0`, `quantidade_disponivel`, `recipiente_disponivel_id`;
  - item sem recipiente e com resposta positiva: recipiente conferido obrigatório.
- [x] `marcarDisponibilidade` e `verificar/actions.ts` levam os campos novos; `VerificacaoItem.tsx` mostra o formulário "quantas / em que recipiente" quando o item veio incompleto (e tira o `?? 0` de `verificar/page.tsx:88`).
- [x] Genérico: `validarComposicaoGenerico(quantidadePai: number | null, ...)` só confere a soma quando o pai tem quantidade. `definirComposicaoGenerico`: pai sem quantidade → filhos sem preço herdado (`preco_unitario NULL`); pai com quantidade → como hoje. Genérico sem recipiente não muda nada (o recipiente é de cada filho).

## Fase 4: negociação e Fechar
- [x] Constante SQL `ITEM_VENDAVEL` em `pedidos.ts` (ver definição acima), usada em `TOTAL_SQL` (total nulo também quando falta quantidade), em `definirPrecos` e em `confirmarPedido`.
- [x] `negociarItens` (substitui `definirPrecos`, mesmo guard de situação e perfil): por linha, preço, quantidade e recipiente.
  - Quantidade: até o confirmado (`quantidade` se `disponivel`, senão `quantidade_disponivel`); zero remove o item. Ao gravar, normaliza a conferência: `disponivel = true`, `quantidade_disponivel = NULL`, mantém `recipiente_disponivel_id`. Assim o CHECK continua verdadeiro e a aprovação não reinterpreta.
  - Recipiente: só o do item ou o conferido. Pedir mais do que o confirmado ou outro recipiente continua sendo "Salvar e reenviar para verificação".
  - Pai com quantidade: preço propaga aos filhos (como hoje). Filho de lista montada: preço próprio.
- [x] `PrecosForm.tsx` vira o formulário de negociação (quantidade pré-preenchida com o confirmado, recipiente, preço); `pedidos/actions.ts` ajustada.
- [x] `confirmarPedido`: depois de consumir indisponível/parcial, `recipiente_id = COALESCE(recipiente_disponivel_id, recipiente_id)` em todos, e recusa com mensagem contada: item vendável sem quantidade, sem recipiente ou sem preço; genérico sem composição.

## Fase 5: rótulo e documentação
- [x] `SITUACOES_PEDIDO.cadastrado = 'Orçamento'` (`pedidos-rotulos.ts:35`); revisar mensagens que dizem "cadastrado".
- [x] `docs/rotinas/3-comercial/pedidos.md` e `pedidos-como-chegam.md` (a seção "O que o sistema ainda não deixa" vira "Como o sistema trata"); requisitos RF-54/56/57 e casos de uso afetados; `node scripts/verifica-rastreabilidade.mjs` e os `build-*` que dependerem deles.

## Testes (Vitest, junto do código)
- `pedidos-rotulos.test`/`pedidos.test`: `resolveDisponibilidade` nos três formatos de item; `validarComposicaoGenerico` com pai sem quantidade; cálculo do confirmado.
- `pedidos/__tests__/actions.test.ts`, `verificar/__tests__/actions.test.ts`: recipiente vazio aceito, genérico sem especificação recusado, respostas "tem 350 em 17x22".
- `pedidos.db.test.ts` (banco real): um pedido de cada um dos 7 tipos percorre cadastro → verificação → negociação → aprovação; aprovação recusa item sem quantidade/recipiente/preço; CHECKs novos aceitam e recusam os casos certos; migration aplicada sobre banco com linhas antigas.
- Componentes: `VerificacaoItem.test`, `PrecosForm.test`, `GradeItens.test`, `ColarLista.test`.

## Verificação
1. `npm run migrate` no Postgres local; `npm test`.
2. Rodar o app (`/run`) e fazer à mão o tipo 1 ("ipê, aroeira"), o tipo 2 e o tipo 7 até "Aprovado" e "Organizar cargas", conferindo total e cargas.

## Fora do escopo
- A colagem transformar linha sem espécie reconhecida em item genérico com o texto como descrição (útil para o tipo 7, mas é outro passo).
- Agrupar a lista em "Orçamentos" e "Vendas".
