# Comercial: visão geral

> Área 3 de 3. O que acontece entre o cliente pedir e o pedido ficar registrado.
> Mapa das três áreas em [`../00-mapa-de-rotinas.md`](../00-mapa-de-rotinas.md).

## O que esta área é

Tudo aqui é **movimento**: acontece uma vez e vira histórico. O que é estável, cliente,
espécie, recipiente, é Cadastros, e o Comercial só consome.

A negociação continua sendo por WhatsApp, conduzida por pessoa. O sistema não substitui a
conversa; ele registra o que ficou combinado, com o preço digitado por quem registra, e mostra ao
lado o que a produção tem pronto.

## A rotina da área

| # | Rotina | Pergunta que responde | Documento |
|---|---|---|---|
| 1 | **Pedidos** | O que o cliente quer, tem, e por quanto? | [`pedidos.md`](pedidos.md) |

O ciclo é da chefia, que é quem responde por preço, com duas fases executadas pela gerência, a
conferência no viveiro e a contagem da carga
([`D4` §3.2](../../engenharia/D-arquitetura/D4-matriz-rbac.md)):

```
registrar  →  conferir no viveiro  →  aprovar  →  organizar as cargas  →  contar  →  acompanhar
     │              (gerência)        (chefia)        (gerência)        (gerência)
consultar o saldo
```

**Aprovar é o ato que trava os itens** (RF-57), e não o fim do ciclo. Depois dele o pedido ainda
percorre duas etapas dentro do sistema, a organização das viagens e a contagem do que vai em cada
uma, até ficar pronto para envio. São oito situações ao todo, e cada uma espera por um perfil
determinado (RN-53).

A **entrega** continua fora do escopo, e com ela o roteiro de viagem e o motorista
([`A1` §7](../../engenharia/A-fundacao/A1-documento-de-visao.md)). O sistema acompanha o pedido até
a muda estar contada e no lugar de carregamento, e o que acontece na estrada é combinado entre
pessoas, como a negociação foi.

## Relação com as outras áreas

| Área | Relação |
|---|---|
| **1 · Cadastros** | cliente, espécie e recipiente no item do pedido |
| **2 · Produção** | o saldo de muda pronta aparece ao lado de cada item (RF-56) |

**A consulta de saldo é a única ligação entre as duas áreas de movimento**, e ela é de leitura. O
pedido não reserva, não baixa e não move lote.

## Onde estão as telas

Área `/comercial`. As telas seguem nas URLs de origem (`/pedidos/*`) porque a rotina de pedidos
aponta para elas e o caminho já está gravado no banco. O agrupamento é de navegação, não de rota.
