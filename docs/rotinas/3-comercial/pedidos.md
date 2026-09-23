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
| `cadastrado` | Gerência | A chefia registrou; falta conferir no viveiro. A tela mostra **Orçamento** |
| `verificando` | Gerência | A conferência está aberta, item a item |
| `verificado` | Chefia | A gerência respondeu tudo e devolveu; é aqui que a chefia negocia preço e quantidade |
| `pendente_alteracao` | Chefia | A chefia pediu mudança antes de aprovar |
| `aprovado` | Gerência | Vendido, e o item não muda mais. Falta organizar as viagens |
| `separando` | Gerência | As cargas existem, e estão sendo contadas |
| `pronto_envio` | ninguém | Todas as cargas prontas; o caminhão sai |
| `cancelado` | ninguém | Fim de linha, e os itens ficam para consulta |

**Toda mudança de situação passa por uma porta só**, `mudarSituacao`, que trava a linha do pedido,
confere a transição contra a tabela de transições e grava `pedidos_historico` na mesma transação.
Não é trigger de propósito: trigger não conhece o usuário, e toda linha do histórico precisa de
autor (RN-52).

**A conferência abre na primeira resposta.** Quem está no pátio toca "Tem tudo" no primeiro item, e
o pedido passa de `cadastrado` a `verificando` na mesma transação da resposta. Abrir continua sendo
gesto de pessoa, e não efeito de abrir a tela: o gesto é a resposta, e o histórico registra quem
abriu. Um botão separado antes disso só rendia um item sem resposta e um erro que não era de
ninguém.

**Aprovar é o ato que trava o item** (RF-57). Antes disso item e quantidade se alteram; depois,
não. A chefia ainda pode editar, e editar **devolve o pedido ao começo da conferência**: o
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
| tem parte | falso | de 1 a total menos 1 | quando é outro que o pedido |
| não tem | falso | 0 | nulo |
| tem N (item sem quantidade) | verdadeiro | N | quando é outro que o pedido |

**O item que chegou incompleto muda a pergunta.** Sem quantidade ("tem ipê?"), a resposta é "não
tem" ou "tem N", e `disponivel` é só "tem alguma". Sem recipiente, toda resposta com muda diz em
qual recipiente ela está, porque é a única informação de tamanho que o pedido vai ter. No "tem
tudo" do item completo o recipiente conferido é opcional: "tem, mas em 17x22".

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

### Preço digitado, e digitado depois da conferência

O preço vem no item do pedido, digitado por quem registra (RF-55, RN-50). O sistema guarda por
quanto se vendeu, e não calcula custo, margem nem piso.

**O cadastro não pede preço, e nem recipiente ou quantidade.** Quem registra o pedido está no meio
de uma conversa de WhatsApp e anota o que o cliente disse: a espécie, ou a descrição do item sem
espécie, e o resto quando ele disser. Os sete jeitos de o pedido chegar estão em
[`pedidos-como-chegam.md`](pedidos-como-chegam.md).

**O valor se fecha na negociação**, com o pedido em `verificado`, quando a conferência já disse
quantas mudas existem e em que recipiente. A ficha mostra então um formulário por item vendido,
com preço, quantidade (preenchida com a confirmada) e, quando a gerência achou a muda em outro
recipiente, a escolha entre os dois. A chefia baixa a quantidade ou zera o item sem devolver o
pedido à conferência; pedir mais do que existe, ou outro recipiente, é "Salvar e reenviar".

**A aprovação exige o item completo**: todo item vendido com recipiente, quantidade e preço, e todo
item sem espécie já composto. A recusa conta o que falta por motivo. Enquanto faltar preço ou
quantidade, a tela diz "a definir" no lugar do total, em vez de anunciar uma soma parcial.

### Colar a lista do cliente

A lista chega pelo WhatsApp como texto solto: "- Ipê amarelo 500", "200 araucária", "2x pitanga".
No cadastro do pedido, **Colar lista** lê esse texto e propõe o casamento com o catálogo. A linha
reconhecida com certeza sai marcada como exata, a parecida como provável, já com a espécie
escolhida, e a desconhecida fica em vermelho segurando a importação.

**A leitura aceita a lista do jeito que o cliente a escreve.** Os itens vêm um por linha ou em
lista corrida separada por "|" ou ";", e cada item pode trazer, em qualquer ordem, tamanho ("80
cm", "1,20 m"), faixa de tamanho ("80–100 cm"), preço ("R$ 12,00"), recipiente ("tubete", "17x22")
e quantidade. A lista agrupada também é lida, porque o cabeçalho "60 cm:" ou "R$ 10,00:" vale para
o item da mesma linha e, sozinho na linha, para os de baixo até o próximo. A lista só de tamanhos
ou só de preços vira linhas sem espécie, que se escolhe na revisão. A vírgula não separa item,
porque é o decimal de "12,00" e de "1,20 m".

**O preço lido não entra no pedido** (RN-50). Ele é reconhecido para não virar nome nem
quantidade, e a revisão mostra que foi visto e deixado de lado. Da faixa de tamanho fica o menor
valor, e o valor original continua à vista no texto lido de cada linha.

**O número solto depois do tamanho é a única leitura ambígua.** Em "Ipê 80cm 12" o 12 é preço, e
em "Ipê 80cm 300" o 300 é quantidade. Abaixo de 100 o número é tomado como preço e a quantidade
fica em branco, que é pergunta visível na revisão. Com "un", "mudas" ou "x" junto, ele é sempre
quantidade.

A revisão tem as mesmas colunas da planilha de itens (espécie, recipiente, altura e quantidade). O
recipiente escrito na lista vai para a linha, e o recipiente padrão do cabeçalho preenche só as
linhas que vieram sem ele. Trocar o padrão muda essas linhas e deixa como estão as que trouxeram o
recipiente escrito ou foram escolhidas à mão.

### Altura do item

A altura é opcional e gravada em metros (RF-54), e o campo aceita os dois jeitos de medir a muda.
"1,20" e "1,20 m" são metros, "80 cm" é centímetro, e **o número inteiro sem unidade a partir de 10
é lido em centímetros**, de modo que "120" vira 1,20 m. Abaixo de 10 o inteiro continua metro. Ao
sair do campo, o valor aparece como o sistema o entendeu ("1,20 m").

**Nada entra sem revisão** (RF-54). A linha que ninguém reconheceu se resolve de três maneiras:
escolhendo uma espécie da lista, cadastrando a espécie ali mesmo (nome popular e científico) ou
tornando o item genérico, que deixa a escolha para a conferência.

**O sistema aprende os apelidos.** Corrigida a espécie à mão, aparece um botão que salva o texto
colado como outro nome popular dela (RN-01: um nome pertence a uma espécie só). Da próxima vez,
aquele mesmo apelido é reconhecido sozinho.

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

O filho herda o preço do pai, e **o total do pedido soma o pai**: o filho diz qual espécie compõe
as 500 mudas, não quanto elas custam. Somar os dois dobraria a venda.

**Sem quantidade, o item genérico é uma lista montada** ("recompor 2 ha de mata ciliar", "o que
tiver de nativas"). A gerência escolhe espécies e quantidades sem soma a fechar, e cada filho é uma
venda: nasce sem preço, e a chefia o precifica como qualquer item. O que entra no total é o **item
vendável**, a mesma condição no código (`itemVendavel`) e no SQL (`itemVendavelSql`): o item de
topo com espécie, o genérico com quantidade e o filho do genérico sem quantidade.

### A aprovação consome a conferência

Ao aprovar, o pedido perde os itens indisponíveis, os parciais passam a valer pela quantidade que
existe de verdade, e o recipiente conferido substitui o pedido em toda resposta com muda. É o que faz a etapa seguinte ser simples: quem separa a
carga nunca vê "tem 300 das 500", vê 300, que é o que vai no caminhão.

## Modelo de dados

`pedidos`, `pedidos_itens`, `pedidos_historico`, `pedidos_itens_especies_permitidas`,
`pedidos_cargas` e `pedidos_cargas_itens`, com o cliente em `cadastro.pessoas` pelo papel `cliente`
(RN-45). Declaradas em `migrations/20260901000006_comercial_pedidos.sql`,
`20260921000001_pedidos_fluxo_situacao.sql`, `20260921000002_pedidos_verificacao_e_cargas.sql` e
`20260924000001_pedido_orcamento_incompleto.sql`, e
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
