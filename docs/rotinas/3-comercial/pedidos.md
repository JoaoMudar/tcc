# Rotina: Pedidos

> A única rotina do Comercial. O pedido é negociado por WhatsApp e registrado depois, e o sistema
> guarda o que foi vendido, por quanto e para quem.

## Fluxo

A negociação nasce no WhatsApp e é conversa entre pessoas. O sistema não participa dela: o pedido
é registrado depois, à mão, e quem registra é a chefia, do começo ao fim.

```
rascunho  →  confirmado
    ↓
cancelado
```

**Confirmar é o ato que trava o pedido** (RF-57, RN-50). Enquanto ele está em rascunho, item,
quantidade e preço se alteram; depois de confirmado, não. São três situações, e não há histórico de
mudança de estado, porque quem mudou o que e quando é pergunta que um viveiro de nove pessoas
resolve perguntando.

## Conceitos

### Preço digitado

O preço vem no item do pedido, digitado por quem registra (RF-55, RN-52). O sistema guarda por
quanto se vendeu, e não calcula custo, margem nem piso.

### Saldo ao lado do item

Cada item mostra quanta muda pronta a produção tem daquela espécie e daquele recipiente (RF-56). O
número é somado dos lotes a cada consulta, e não fica gravado no item: gravá-lo congelaria uma
leitura que muda a cada perda registrada. **A consulta é de leitura**, e o pedido não reserva, não
baixa e não move lote.

### Canal de venda

Atacado (o padrão), compensação ambiental, paisagismo, prefeitura e varejo. É lista fechada de
cinco valores, e não entidade própria (RN-44), porque não carrega margem nem preço.

### Item sempre nomeia a espécie

`pedidos_itens.especie_id` é obrigatório. O pedido em que o cliente diz só a quantidade e o
tamanho, deixando a escolha de espécie para quem separa, é combinado na conversa e registrado já
resolvido, com as espécies que foram efetivamente vendidas.

## Modelo de dados

`pedidos` e `pedidos_itens`, com o cliente em `cadastro.pessoas` pelo papel `cliente` (RN-47).
Declaradas em `migrations/20260901000006_comercial_pedidos.sql`, descritas em
[`C8`](../../engenharia/C-modelagem/C8-dicionario-de-dados.md). **Não há tabela de carga,
separação, entrega nem cotação**: essas etapas acontecem na operação e continuam fora do sistema
([`A1` §7](../../engenharia/A-fundacao/A1-documento-de-visao.md)).

## Quem opera

Pedido é recurso da chefia, e a gerência não o lê
([`D4` §3.2](../../engenharia/D-arquitetura/D4-matriz-rbac.md)). O que a produção precisa saber do
comercial é quanto foi vendido de cada espécie, e isso ela lê pelo saldo disponível, sem a carteira
de pedidos.

## Dependências com outras rotinas

- **Cadastros**: cliente, espécie e recipiente vêm de lá.
- **Lotes**: o saldo de muda pronta por espécie e recipiente é o que o item exibe.
