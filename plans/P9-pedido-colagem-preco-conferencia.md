# P9: conferência destravada, itens em grid, preço depois da conferência e colagem de lista

Plano completo (contexto, decisões e verificação) aprovado em 22/09/2026.

## Fase 1: conferência destravada
- [x] `src/lib/pedidos.ts`: `exigirEmVerificacao` vira `abrirOuExigirVerificacao`, que abre a conferência na mesma transação quando o pedido está em `cadastrado`
- [x] `verificar/actions.ts`: as três actions repassam o autor; guard de marcar sobe para `C`
- [x] `AcoesVerificacao.tsx`: some o botão "Começar a conferência"; rodapé único
- [x] Testes

## Fase 2: preço depois da conferência
- [x] Migration `20260922000001_pedido_preco_apos_conferencia.sql`
- [x] `pedidos-rotulos.ts`: `totalItem`/`totalPedido` com preço nulo
- [x] `pedidos.ts`: `definirPrecos`; aprovação exige preço; `atualizarItem` sem preço
- [x] `PrecosForm.tsx` + `definirPrecosAction`
- [x] Cadastro e edição de item sem preço
- [x] Testes

## Fase 3: itens em grid e toast
- [x] `src/components/pedidos/ItensDoPedido.tsx`
- [x] `src/components/ui/Toast.tsx`
- [x] `criarPedidoAction` volta para a lista; lista mostra o toast
- [x] Testes

## Fase 4: colar lista
- [x] `src/lib/especies-nomes.ts` e `src/lib/pedidos-colagem.ts`
- [x] `criarEspecieRapida` e `adicionarNomePopular`
- [x] `EspecieRapida.tsx` e `ColarLista.tsx`
- [x] Item genérico no cadastro do pedido
- [x] Testes

## Fase 5: documentação
- [x] C6, C8, modelo-dados-pt
- [x] B2, B3 e scripts derivados
- [x] rotina do comercial e CHANGELOG
