# P18: Recipientes que salvam sozinhos, o X do planejar e o suplente da conferência

Retorno de uso em quatro telas. A decisão de fundo é a regra do item **sem quantidade** na
conferência: o "+" não divide mais em linhas, grava **suplentes** (só o recipiente), que ficam na
ficha como "Se faltar: também tem em 17x22" com o botão "Usar". Item **com** quantidade continua
dividindo e completando em linhas reais, como no P17.

- [x] T1. Recipientes: salvar ao digitar (sem botão), máscara de 3 casas no volume e no peso, Volume · Peso · Em uso numa linha
- [x] T2. Planejar: o "Tirar" da carga vira um X vermelho, a antítese do "+"
- [x] T3. Verificar: variante `danger` no `Button`, nos botões de tirar
- [x] T4. Migration `20261006000001_pedido_item_suplente.sql`: `pedidos_itens.suplente`
- [x] T5. Regra: `resolveResposta` devolve suplentes no item sem quantidade; `marcarDisponibilidade` os grava
- [x] T6. Tela de verificar: "+ Também tem em outro recipiente", sem pedir quantidade
- [x] T7. Ficha: suplente fora das linhas, com aviso, saldo e "Usar"; `usarSuplente`; a aprovação apaga o que sobrou
- [x] T8. Docs: CHANGELOG, C6, C8, modelo-dados-pt, rotina de pedidos; scripts de verificação
- [x] T9. `npm test`
