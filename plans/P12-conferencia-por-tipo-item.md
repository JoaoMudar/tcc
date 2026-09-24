# P12: conferência por tipo de item (Não tem / Tem parte / Tem tudo)

Plano aprovado em 23/09/2026. Decisões: quantidade opcional no "Tem" do item sem quantidade; "Tem parte" pergunta tudo o que o cliente especificou.

Branch: `feat/conferencia-por-tipo-item`, criada a partir de `feat/pedido-orcamento-incompleto`
(depende da migration `20260924000001`, que ainda não está em `master`). Salvar este plano como
`plans/P12-conferencia-por-tipo-item.md` na primeira task.

## Contexto
A tela `pedidos/[id]/verificar` foi montada antes do P11 e responde por remendos: o item específico
tem "Não tem / Tem parte / Tem tudo" com exceções para o que chegou sem quantidade ou sem
recipiente, a altura pedida não é conferida, e o genérico só se resolve pela composição exata (não
tem "Não tem" nem "Tem parte"). O usuário listou os 14 casos de item (espécie ou genérico, com ou sem
recipiente, altura e quantidade). A análise corrigiu a lista e a reduziu a **uma regra só**, que vale
para os 16 casos (8 de espécie + 8 de genérico, incluindo os dois que faltavam: genérico só com
quantidade e só com altura).

## A regra (decidida com o usuário)
Seja **E** = atributos que o cliente especificou (recipiente, altura, quantidade).

| Botão | Aparece | Pergunta |
|---|---|---|
| **Não tem** | sempre | nada (só observação) |
| **Tem parte** | quando E não é vazio | cada atributo de E, **já preenchido com o pedido**; a pessoa troca o que difere. Recusa se nada difere ("use Tem tudo") |
| **Tem tudo** (rótulo "Tem" quando E é vazio) | sempre | o que falta para fechar: **recipiente, se não veio** (obrigatório); **quantidade, se não veio** (opcional) |

Altura que não veio nunca é perguntada. Genérico: as mesmas perguntas, só que por linha de espécie
(espécie + campos acima), com uma diferença: quando o pai tem quantidade, **Tem tudo** pede a
quantidade de cada espécie e a soma tem de fechar; **Tem parte** aceita soma menor ou igual (igual
só se algum filho difere em recipiente ou altura).

Correções à lista original que isto incorpora: altura entra no "Tem parte" sempre que foi pedida;
recipiente é perguntado no "Tem" quando o item não tem; genérico com quantidade pede quantas de cada
espécie mesmo no "Tem tudo"; genérico ganha "Não tem".

## Fase 1: banco (migration `20260925000001_conferencia_altura_e_quantidade_opcional.sql`)
- [x] `pedidos_itens.altura_disponivel_m NUMERIC(4,2)` + CHECK igual ao de `altura_m` (0 < h <= 20); só com muda (`quantidade_disponivel IS DISTINCT FROM 0`).
- [x] Trocar `pedidos_itens_disponibilidade_coerente`: ramo novo `quantidade IS NULL AND disponivel = true AND quantidade_disponivel IS NULL` ("tem, sem número"). O genérico "Não tem" (`false`, `qd = 0`) e "Tem parte" (`false`, `qd = soma`) já cabem nos ramos existentes; conferir com teste de banco.
- [x] Soltar, migrar, prender (padrão de `20260924000001`). CHANGELOG; C6, C8, figura do `modelo-dados-pt` + `mede-figuras.mjs` + `confere-modelo-pt.mjs`.

## Fase 2: regra num lugar só (`src/lib/pedidos-rotulos.ts`)
- [x] `perguntasDoItem({ quantidade, recipienteId, alturaM, generico })` → `{ botoes, camposParte, camposTudo }` (com obrigatório/opcional). Fonte única para a tela e para o servidor.
- [x] `estadoDaResposta(item)`: `pendente | nao_tem | parte | tudo`, derivado das colunas (parte = `qd < quantidade`, ou recipiente/altura conferidos preenchidos). Substitui `estadoDe` de `VerificacaoItem.tsx`.
- [x] `resolveDisponibilidade` reescrita sobre `perguntasDoItem`: aceita `alturaM`; quantidade opcional sem quantidade pedida; "Tem tudo" com recipiente especificado ignora recipiente conferido; "Tem parte" recusa quando nada difere; conferido igual ao pedido continua gravando nulo.
- [x] `validarComposicaoGenerico(pai, linhas, permitidas, modo: 'tudo' | 'parte')`: linha com `alturaM` opcional; quantidade de linha opcional no pai sem quantidade; soma exata em `tudo`, `<=` em `parte` (igual exige filho diferente).

## Fase 3: domínio e actions (`src/lib/pedidos.ts`, `verificar/actions.ts`)
- [x] `marcarDisponibilidade`: lê `altura_m`, grava `altura_disponivel_m`.
- [x] `marcarGenericoIndisponivel` (nova): apaga filhos, grava `false / 0`. Action `marcarGenericoIndisponivelAction`.
- [x] `definirComposicaoGenerico` recebe o modo; filho usa a altura da linha (senão herda a do pai); pai grava `true / NULL` em `tudo` e `false / soma` em `parte` quando soma < quantidade.
- [x] `listItens` (linha ~264) traz `alturaDisponivelM`; reset em `atualizarItem` (linhas ~454 e ~655) zera a coluna nova junto.
- [x] `confirmarPedido` (linhas ~708-736): `altura_m = COALESCE(altura_disponivel_m, altura_m)` junto do recipiente.

## Fase 4: tela (mobile-first)
- [x] `CartaoConferencia.tsx` (substitui `VerificacaoItem` e `ComposicaoGenerico`): cabeçalho com espécie (ou "Genérico: especificação"), linha "pedido" com chips recipiente · altura · quantidade ("a definir" no que faltou), faixa de cor pelo estado, 2 ou 3 botões grandes vindos de `perguntasDoItem`, painel só com os campos da regra, observação recolhida atrás de "Adicionar observação".
- [x] Específico: mantém a gravação automática (Tem tudo sem pergunta grava no toque; campos gravam ao sair).
- [x] Genérico: `LinhasComposicao.tsx` com espécie (combobox) + campos da regra por linha, contador "Faltam N / Passou N" fixo no rodapé do cartão, botão "Gravar" que só habilita quando a regra fecha. "Não tem" grava no toque.
- [x] `page.tsx`: um só mapa de itens na ordem do pedido; progresso no topo continua.
- [x] Mostrar a altura conferida onde o recipiente conferido já aparece: `pedidos/[id]/page.tsx` (~184) e `ItensDoPedido.tsx`.

## Fase 5: documentação
- [x] `docs/rotinas/3-comercial/pedidos-como-chegam.md` e `pedidos.md`: tabela da regra; RF-56 e caso de uso da conferência; `node scripts/verifica-rastreabilidade.mjs` e os `build-*` afetados.

## Testes
- `pedidos-rotulos.test.ts`: `perguntasDoItem` nos 16 casos (tabela), `resolveDisponibilidade` e `validarComposicaoGenerico` nos dois modos, `estadoDaResposta`.
- `pedidos.db.test.ts`: CHECKs novos (tem sem número, altura conferida, genérico não tem/parte), `confirmarPedido` aplicando altura.
- `CartaoConferencia.test.tsx` (substitui `VerificacaoItem.test.tsx`): botões e campos por caso, com amostragem de casos-limite; `verificar/__tests__/actions.test.ts` para a action nova.

## Verificação
`npm test`; migration aplicada no Postgres local; `npm run dev`, criar um pedido com um item de cada
tipo (colagem), abrir a conferência em viewport de celular (Chrome, 390px) e responder cada um;
aprovar e conferir que recipiente, altura e quantidade conferidos viraram os do item.

## Desvios do plano
- `CartaoConferencia` não foi criado: `VerificacaoItem` e `ComposicaoGenerico` foram reescritos e
  compartilham `CabecalhoItem`, `BotoesResposta` e `CampoObservacao`. Menos arquivos trocando de nome
  e o mesmo resultado na tela.
- `quantidadeConfirmada` passou a devolver nulo ("sem teto") para o "Tem" sem número, e a
  negociação (`negociarItens`, `PrecosForm`) deixou de travar a quantidade nesse caso.
- `atualizarItem` também zera a resposta quando a altura pedida muda.
