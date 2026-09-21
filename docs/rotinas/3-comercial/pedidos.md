# Rotina: Pedidos

> A rotina do Comercial. O pedido é negociado por WhatsApp e registrado depois, e o sistema guarda
> o que foi vendido, por quanto, para quem, e o que o viveiro tinha para entregar.

## Fluxo

A negociação nasce no WhatsApp e é conversa entre pessoas. O sistema não participa dela: o pedido
é registrado depois, à mão, e quem registra é a chefia.

```
cadastrado ─► verificando ─► verificado ─► aprovado ─► separando ─► pronto_envio
                                  │
                                  └─► pendente_alteracao ─┐
                                                          │
      (a chefia edita e reenvia) ◄────────────────────────┘

qualquer situação ─► cancelado
```

São **oito situações, e cada uma tem dono** (RN-53). O pedido passa de mão em mão, e é isso que o
fluxo antigo de três situações não sabia dizer:

| Situação | Quem trabalha nela | O que acontece |
|---|---|---|
| `cadastrado` | Gerência | A chefia registrou; falta conferir no viveiro |
| `verificando` | Gerência | A conferência está aberta, item a item |
| `verificado` | Chefia | A gerência respondeu tudo e devolveu |
| `pendente_alteracao` | Chefia | A chefia pediu mudança antes de aprovar |
| `aprovado` | Gerência | Vendido, e o item não muda mais. Falta organizar as viagens |
| `separando` | Gerência | As cargas existem, e estão sendo contadas |
| `pronto_envio` | ninguém | Todas as cargas prontas; o caminhão sai |
| `cancelado` | ninguém | Fim de linha, e os itens ficam para consulta |

**Toda mudança de situação passa por uma porta só**, `mudarSituacao`, que trava a linha do pedido,
confere a transição contra a tabela de transições e grava `pedidos_historico` na mesma transação.
Não é trigger de propósito: trigger não conhece o usuário, e toda linha do histórico precisa de
autor (RN-52).

**Aprovar é o ato que trava o item** (RF-57). Antes disso item, quantidade e preço se alteram;
depois, não. A chefia ainda pode editar, e editar **devolve o pedido ao começo da conferência**: o
que a gerência apurou valia para os itens de antes.

**O pronto para envio também cancela, e a decisão é de 21/09/2026.** Sem essa seta, a venda que cai
depois de pronta não teria como ser registrada, e o pedido ficaria para sempre afirmando uma
entrega que não houve.

**Cancelar pede dois toques** e aceita um motivo, que vai para a observação do histórico. É a única
saída que não volta atrás, e daqui a um mês "por que este pedido foi cancelado?" não tem outra
resposta no sistema.

## As duas etapas de campo

### Conferência de disponibilidade (gerência, no pátio)

A gerência abre a conferência e responde, item a item, a pergunta "tem essa muda?". Três respostas,
e elas viram quatro colunas de `pedidos_itens`:

| Resposta | `disponivel` | `quantidade_disponivel` | `recipiente_disponivel_id` |
|---|---|---|---|
| ainda não olhou | nulo | nulo | nulo |
| tem tudo | verdadeiro | nulo | nulo |
| tem parte | falso | de 1 a total menos 1 | obrigatório |
| não tem | falso | 0 | nulo |

**Parcial e indisponível compartilham `disponivel = false`**, e quem os distingue é a quantidade.
O recipiente da parcial **pode ser outro** que o pedido: achou as 300 em saco 17x22 quando o pedido
dizia 10x18. Não é bloqueio, é informação para a chefia ver na aprovação.

**Não se envia à chefia pela metade**: item sem resposta segura a conclusão, porque deixar passar
faria a chefia aprovar sobre uma apuração incompleta, que é o que a etapa existe para evitar.

Cada toque grava na hora, e não há "Salvar" por item: quem confere está andando com o celular numa
mão, e um botão a mais por item é um item que fica sem resposta.

### Contagem para carregar (gerência, no galpão)

Depois de aprovado, a gerência diz em quantas viagens o pedido sai. **Uma carga é uma viagem do
caminhão**, e a soma de cada item nas cargas tem de reproduzir a quantidade do item: muda que não
entrou em carga nenhuma é muda que ninguém vai separar.

Depois conta item por item, carga por carga, e marca. **O que se grava é a confirmação, e não o
número contado**: quantas contar já está escrito na linha. A carga só fecha com tudo marcado, e o
pedido só fica pronto para envio quando todas as cargas estiverem prontas.

**Dia de carregar é o dia útil anterior à entrega** (segunda a sexta). Entrega na segunda se carrega
na sexta. Feriado fica de fora de propósito: os municipais variam, e um calendário errado atrasaria
o carregamento sem ninguém entender por quê.

## Conceitos

### Preço digitado

O preço vem no item do pedido, digitado por quem registra (RF-55, RN-50). O sistema guarda por
quanto se vendeu, e não calcula custo, margem nem piso.

### Saldo ao lado do item

Cada item mostra quanta muda pronta a produção tem daquela espécie e daquele recipiente (RF-56). O
número é somado dos lotes a cada consulta, e não fica gravado no item: gravá-lo congelaria uma
leitura que muda a cada perda registrada. **A consulta é de leitura**, e o pedido não reserva, não
baixa e não move lote.

**As colunas de disponibilidade não são esse saldo.** O saldo diz o que o viveiro tem; elas dizem o
que uma pessoa foi ao pátio conferir e respondeu, com autor e hora. São resposta de alguém, não
leitura de estoque, e é por isso que são gravadas.

### Canal de venda

Atacado (o padrão), compensação ambiental, paisagismo, prefeitura e varejo. É lista fechada de
cinco valores, e não entidade própria (RN-42), porque não carrega margem nem preço.

### Item genérico

O cliente que pede "500 mudas nativas, no mínimo saco 10x18" sem escolher espécie é registrado
assim mesmo: item com `generico`, sem espécie, com a especificação em texto. **Quem escolhe as
espécies é a gerência, na conferência**, criando um item filho por espécie.

Quando o cliente restringe ("só estas cinco do bioma"), as espécies aceitas ficam em
`pedidos_itens_especies_permitidas`, e o escopo é **bloqueio rígido**: o servidor recusa espécie de
fora, e não apenas deixa de oferecê-la na busca. **Sem nenhuma linha, qualquer espécie serve**, que
é o caso comum.

O filho herda o preço do pai, e **o total do pedido soma só os itens de topo**: o filho diz qual
espécie compõe as 500 mudas, não quanto elas custam. Somar os dois dobraria a venda.

### A aprovação consome a conferência

Ao aprovar, o pedido perde os itens indisponíveis e os parciais passam a valer pela quantidade e
pelo recipiente que existem de verdade. É o que faz a etapa seguinte ser simples: quem separa a
carga nunca vê "tem 300 das 500", vê 300, que é o que vai no caminhão.

## Modelo de dados

`pedidos`, `pedidos_itens`, `pedidos_historico`, `pedidos_itens_especies_permitidas`,
`pedidos_cargas` e `pedidos_cargas_itens`, com o cliente em `cadastro.pessoas` pelo papel `cliente`
(RN-45). Declaradas em `migrations/20260901000006_comercial_pedidos.sql`,
`20260921000001_pedidos_fluxo_situacao.sql` e `20260921000002_pedidos_verificacao_e_cargas.sql`, e
descritas em [`C8`](../../engenharia/C-modelagem/C8-dicionario-de-dados.md).

**Não há entrega, roteiro nem motorista.** A carga termina quando o pedido fica pronto para envio,
e o que acontece na estrada continua fora do sistema
([`A1` §7](../../engenharia/A-fundacao/A1-documento-de-visao.md)).

## Quem opera

Cadastrar e alterar pedido é da chefia, e a gerência não faz nem um nem outro
([`D4` §3.2](../../engenharia/D-arquitetura/D4-matriz-rbac.md)). A gerência **lê a carteira
inteira**, com preço e total, e executa duas fases: conferir o pedido no viveiro e separar a carga
depois de aprovado. Aprovar, devolver para alteração e cancelar são da chefia, que também executa
as duas fases da gerência quando é ela quem faz o trabalho.

O trabalho de cada fase tem recurso próprio, `verificacao_pedido` e `cargas_pedido`, separados de
`confirmacao_pedido`: um diz quem move o pedido adiante, o outro diz quem escreve o que foi
conferido no pátio e contado no galpão.

**Os seis colaboradores de campo não entram aqui.** A contagem no galpão é da gerência, com o
celular na mão, pela mesma decisão de escopo que os deixa sem acesso ao sistema.

## Dependências com outras rotinas

- **Cadastros**: cliente, espécie e recipiente vêm de lá.
- **Lotes**: o saldo de muda pronta por espécie e recipiente é o que o item exibe.
