# Rotina: Pedidos

> A rotina do Comercial. O pedido é negociado por WhatsApp e registrado depois, e o sistema guarda
> o que foi vendido, por quanto, para quem, e o que o viveiro tinha para entregar.

## Fluxo

A negociação nasce no WhatsApp e é conversa entre pessoas. O sistema não participa dela: o pedido
é registrado depois, à mão, e quem registra é a chefia.

```
cadastrado ─► verificando ─► verificado ─► aprovado ─► separando ─► pronto_envio
    ▲                             │
    └── "Solicitar alteração" ◄───┘

qualquer situação ─► cancelado
```

São **oito situações, e cada uma tem dono** (RN-53). O pedido passa de mão em mão, e é isso que o
fluxo antigo de três situações não sabia dizer:

| Situação | Quem trabalha nela | O que acontece |
|---|---|---|
| `cadastrado` | Gerência | A chefia registrou; falta conferir no viveiro. A tela mostra **Orçamento** |
| `verificando` | Gerência | A conferência está aberta, item a item |
| `verificado` | Chefia | A gerência respondeu tudo e devolveu; é aqui que a chefia negocia preço e quantidade |
| `pendente_alteracao` | Chefia | Legado: a ficha não leva mais o pedido para cá, e o de antes volta ao orçamento |
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

**A ficha mostra só o próximo passo**, e só para quem o executa. No orçamento é "Começar
verificação" (chefia e gerência); no verificado, "Aprovar pedido" e "Solicitar alteração" (chefia),
com a lista do que ainda falta acima do botão de aprovar; no aprovado, "Organizar cargas" (chefia e
gerência). A conferência e a separação mudam a situação na tela delas, quando o trabalho termina.
"Solicitar alteração" devolve o pedido ao orçamento, onde os itens voltam a ser editados na mesma
grade do cadastro. O andamento aparece como linha do tempo, uma fase depois da outra, com o dia de
cada uma. O cancelamento fica no fim da ficha.

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

A gerência abre a conferência e responde, item a item, a pergunta "tem essa muda?". **Uma regra
só vale para todo item, com espécie ou genérico, e ela depende do que o cliente especificou**
(recipiente, altura, quantidade), desde 24/09/2026 (plano P12, migration `20260925000001`):

| Botão | Aparece | Pergunta |
|---|---|---|
| Não tem | sempre | nada |
| Tem parte | quando o cliente especificou alguma coisa | tudo o que foi especificado, já preenchido com o pedido, e a pessoa troca o que difere |
| Tem tudo ("Tem", quando nada foi especificado) | sempre | o recipiente, se o pedido não tem (obrigatório), e a quantidade, se o pedido não tem (opcional) |

A altura que o cliente não pediu nunca é perguntada. "Tem parte" com nada diferente do pedido é
recusado, porque é "Tem tudo" escrito de outro jeito. No item genérico, a resposta com muda é a
lista de espécies que o atende, uma linha por espécie, com os mesmos campos. Quando o genérico tem
quantidade, cada linha diz quantas: em "Tem tudo" a soma fecha exatamente, em "Tem parte" pode
ficar abaixo, ou fechar com alguma espécie em outro recipiente ou outra altura.

As respostas viram colunas de `pedidos_itens`:

| Resposta | `disponivel` | `quantidade_disponivel` | recipiente e altura conferidos |
|---|---|---|---|
| ainda não olhou | nulo | nulo | nulos |
| não tem | falso | 0 | nulos |
| tem tudo | verdadeiro | nulo, ou o número contado no item sem quantidade | o recipiente, se o pedido não tinha |
| tem parte, com menos mudas | falso | de 1 a total menos 1 | quando diferem do pedido |
| tem parte, com todas | verdadeiro | nulo | quando diferem do pedido |

**"Tem parte" pode completar em outro recipiente**, desde 27/09/2026 (plano P13, migration
`20260927000001`). O saco pedido nem sempre tem a quantidade toda, e o viveiro oferece completar com
outro: "tem 300 em 17x22 + 200 em 20x26". O "+" do painel abre uma segunda linha com os mesmos
campos, já com o que falta para fechar o pedido. As duas linhas somam no máximo a quantidade
pedida, e a segunda tem de diferir da primeira em recipiente ou altura. Ela vira **um item próprio**
da mesma espécie (`complementa_item_id`), já respondido e sem preço: saco diferente tem preço
diferente, e a chefia o digita na negociação, como em qualquer item. Responder o item de novo apaga
o complemento anterior, e a conferência não o conta como item a responder.

O cartão toma a cor da resposta no toque, antes de gravar: vermelho em "Não tem", amarelo em "Tem
parte" e verde em "Tem tudo". Branco é o que ninguém olhou.

**Parcial e indisponível compartilham `disponivel = false`**, e quem os distingue é a quantidade.
O recipiente e a altura conferidos só são gravados quando diferem do pedido, e a aprovação os copia
sobre o item.

**Não se envia à chefia pela metade**: item sem resposta segura a conclusão, porque deixar passar
faria a chefia aprovar sobre uma apuração incompleta, que é o que a etapa existe para evitar.

Cada toque grava na hora, e não há "Salvar" por item, nem no genérico: a composição grava ao sair
de cada campo, assim que a soma fecha pela regra. Quem confere está andando com o celular numa
mão, e um botão a mais por item é um item que fica sem resposta.

### Contagem para carregar (gerência, no galpão)

Depois de aprovado, a gerência diz em quantas viagens o pedido sai. **Uma carga é uma viagem do
caminhão**, e a soma de cada item nas cargas tem de reproduzir a quantidade do item: muda que não
entrou em carga nenhuma é muda que ninguém vai separar.

Depois conta item por item, carga por carga, e marca. **O que se grava é a confirmação, e não o
número contado**: quantas contar já está escrito na linha. A carga só fecha com tudo marcado, e o
pedido só fica pronto para envio quando todas as cargas estiverem prontas.

**Vários pedidos no mesmo caminhão**: a rotina [`planejar-pedido.md`](planejar-pedido.md) junta os
pedidos aprovados de um dia numa viagem, sugere a ordem das paradas e gera a separação na ordem
inversa da rota. Ela cria uma carga por pedido pela mesma porta desta seção, e quem não a usa
continua organizando as cargas pedido a pedido.

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
quantas mudas existem e em que recipiente. **A negociação acontece na própria grade de itens**, com
uma coluna de preço no fim de cada item e a quantidade (preenchida com a confirmada) editável, e
grava enquanto se digita, sem botão de salvar. Quando a gerência achou a muda em outro recipiente, a
célula do recipiente vira a escolha entre os dois. A chefia baixa a quantidade ou zera o item sem
devolver o pedido à conferência; pedir mais do que existe, ou outro recipiente, é "Solicitar
alteração".

**A aprovação exige o item completo**: todo item vendido com recipiente, quantidade e preço, e todo
item sem espécie já composto. A recusa conta o que falta por motivo, e a grade marca cada célula
que falta com "Definir", em amarelo, e em vermelho no verificado, quando a falta segura a
aprovação.

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

Cada item mostra quanta muda a produção tem daquela espécie e daquele recipiente (RF-56). Não há
muda "pronta": toda muda de lote aberto está à venda, em qualquer fase (RN-06). Quando o item pede
altura, contam os lotes medidos com altura igual ou maior; se não bastam, a linha diz quanto falta,
quanto há com até 20 cm a menos para completar e quanto está em lote ainda sem altura medida
(RN-62). A muda menor fica à parte, e não no saldo, porque não é a pedida: é a chefia que a oferece
ao cliente. O número é somado dos lotes a cada consulta, e não fica gravado no item: gravá-lo congelaria uma
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

**Não há motorista nem acompanhamento na estrada.** A carga termina quando o pedido fica pronto
para envio, e a viagem planejada ([`planejar-pedido.md`](planejar-pedido.md)) termina junto; o que
acontece na estrada continua fora do sistema
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
- **Lotes**: o estoque disponível por espécie, recipiente e altura é o que o item exibe.
