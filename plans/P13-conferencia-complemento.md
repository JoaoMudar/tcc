# P13: ajustes da conferência e complemento em outro recipiente

Plano aprovado em 27/09/2026, sobre o P12 (commit 5b8d5cc). Branch: `feat/conferencia-por-tipo-item`.

## Contexto
O teste do P12 pediu cinco ajustes na tela `pedidos/[id]/verificar`: o cartão toma a cor da
resposta no toque, textos de apoio saem, "Nada difere do pedido." fica sem o conselho, e "Tem
parte" ganha um **"+"**: o saco pedido não tem a quantidade toda, e o viveiro oferece completar
com outro saco ("tem 300 em 17x22 + 200 em 20x26").

Decisão do usuário: **o complemento é item próprio** da mesma espécie, ligado ao original por
`complementa_item_id`, já respondido e sem preço. A chefia digita o preço dele na negociação,
porque saco diferente tem preço diferente.

## Tarefas
- [x] Cor no toque: o cartão pinta pela resposta selecionada, não só pela gravada (específico e genérico).
- [x] Textos: "Nada difere do pedido."; sem o hint da observação; sem "Grava ao sair do campo.", "Gravando…", "Gravado.", "Se não contou, deixe em branco.".
- [x] Migration `20260927000001_conferencia_complemento.sql`: `pedidos_itens.complementa_item_id` (FK, `ON DELETE CASCADE`) + CHECK (não genérico, não filho).
- [x] Regra `resolveComplemento` em `pedidos-rotulos.ts`: só em "Tem parte" de item com quantidade; quantidade e recipiente obrigatórios; soma não passa do pedido; difere da linha principal em recipiente ou altura.
- [x] Gravação: `marcarDisponibilidade` apaga o complemento anterior e cria o novo; `atualizarItem` apaga o complemento quando derruba a resposta; action lê os campos do complemento.
- [x] Leitura: `findPedido` devolve `complementaItemId`; a conferência esconde o complemento como cartão próprio e o mostra dentro do original; `concluirVerificacao` conta só o que foi pedido.
- [x] Tela: botão "+" em "Tem parte" duplica os campos; "Tirar complemento" desfaz; resumo mostra `+ N em recipiente`.
- [x] Testes (regra, tela, action, banco).
- [x] Docs: CHANGELOG, C6, C8, figura 17, B3, rotina de pedidos, scripts geradores e de rastreabilidade.
- [x] Resumo embaixo do título só em "Tem parte": "Não tem no viveiro" e "Tem tudo" repetiam o botão (específico e genérico).
- [x] Genérico sem botão "Gravar": a composição grava ao sair do campo, quando a regra fecha, como no item com espécie.
