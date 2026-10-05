# Planejar pedido: a viagem de entrega

> Rotina 2 do Comercial. Visão da área em [`00-visao-geral.md`](00-visao-geral.md); o pedido, da
> conferência à carga, em [`pedidos.md`](pedidos.md). Plano de origem: `plans/P14-planejar-pedido.md`.

## O que a rotina resolve

A carga pertence a um pedido, e o caminhão sai com vários. Quem carrega precisa pôr por último o
que se entrega primeiro, para que a primeira entrega fique perto da porta traseira. **A rotina
planeja a viagem do dia**: escolhe os pedidos, sugere a rota a partir do ponto de saída e gera a
separação na ordem inversa da rota (RF-63, RF-64).

A viagem organiza as cargas, e não as substitui. O que se separa e confere continua sendo a carga
de cada pedido, e o "Organizar cargas" pedido a pedido continua existindo para quem não usar a
rotina.

## Entrada

- No calendário de `/pedidos`, tocar num dia **com entrega** (amarelo ou vermelho) abre a rotina
  daquele dia.
- Os outros dias abrem o painel de sempre, que ganhou o botão "Planejar entrega neste dia".
- Viagem começada e não terminada ganha um ponto no dia e um cartão acima do calendário ("Entrega
  de 02/10 · Parou em Rota", botão "Continuar"). Tocar no dia ou no cartão reabre a viagem **na
  etapa em que parou**.

## Sair e voltar

**Toda ação grava na hora**: pôr e tirar pedido, a saída, a ordem ao soltar o arraste, a parada
extra e cada item separado. Não há botão "Salvar". "Sair" volta ao calendário em qualquer etapa sem
perder nada. A seta de voltar anda uma etapa para trás, e os passos do cabeçalho ("1 · Carga",
"2 · Rota", "3 · Carregamento") são botões, desde 05/10/2026: o anterior volta direto a ele, e o
seguinte faz o mesmo que o botão da etapa ("Confirmar carga", "Iniciar carregamento"), com as
mesmas conferências. **Do carregamento também se volta.** As cargas e os itens já marcados ficam, e
ao avançar de novo cada pedido segue com as cargas que já tem, sem ganhar outra. Só a viagem pronta
não volta.

## As três etapas

### 1. Carga

- No topo, fixos, os pedidos já na carga: cliente, cidade e logradouro, e um item por linha
  (`Ipê-amarelo · 300 · 1,20 m`), com um X vermelho em cada pedido para tirá-lo, a antítese do "+" verde que o põe.
- Abaixo, duas listas: **Marcados para este dia** e **Em aberto**, de qualquer data ou sem data.
- **Entra pedido de aprovado para cima** (RN-59): *aprovado*, *separando* ou *pronto para envio*. O
  cartão do que já está separando ou pronto diz a situação.
- **O pedido que já esteve numa viagem não volta à lista**, nem entra em outra. Como não há situação
  "entregue", o que já saiu num caminhão continua pronto para envio, e sem esta regra a lista
  acumularia tudo o que já foi entregue.
- Tocar num pedido o põe na carga e **marca a entrega dele para o dia da viagem**, com uma nota no
  histórico do pedido ("Entrega marcada para 02/10 no planejamento da viagem."). Tirar o pedido não
  desfaz a data, que já foi combinada.
- "Confirmar carga" leva à rota.

### 2. Rota

- **Saída**: Agrolândia (padrão), Itapema ou um endereço digitado. Os dois endereços-base ficam em
  Configurações, nos parâmetros `comercial.viagem_partida_agrolandia` e
  `comercial.viagem_partida_itapema`.
- **Endereço com sugestões**: na saída digitada e na parada extra, a partir de três letras aparece
  uma lista de lugares, como no Google Maps, com preferência pelos próximos de Agrolândia. Tocar
  num deles escreve o endereço completo e guarda a coordenada, e o lugar não é procurado de novo.
  Sem escolher, ou com o serviço fora do ar, o texto digitado vale como antes.
- **Sugestão da ordem**: o serviço de mapas (OpenRouteService) acha a coordenada de cada endereço de
  entrega e devolve a melhor ordem a partir da saída, com distância e tempo. A coordenada fica
  guardada no endereço do cliente, para não consultar de novo. A sugestão roda ao confirmar a
  carga, quando as entregas mudaram, ao trocar a saída e no botão "Sugerir ordem".
- **Reordenar** pressionando e arrastando a parada, ou pelas setas, para quem não acerta o arraste.
  A ordem arrumada à mão não é refeita ao voltar da etapa da carga.
- **Parada extra**: descrição obrigatória e endereço opcional. Não tem item, e não aparece no
  carregamento.
- Pedido **sem endereço de entrega**, ou que o serviço não achou, vai para o fim com aviso no
  cartão, e a pessoa o posiciona à mão. **O cartão traz "Adicionar endereço"** (ou "Corrigir
  endereço"), que abre o endereço de entrega do cliente ali mesmo: digitado, com as sugestões do
  mapa, ou pela **localização que o cliente mandou pelo WhatsApp**, colada no campo próprio. O
  campo lê o link do Google Maps, o do Apple Maps e os dois números, mostra o ponto lido com o link
  "ver no mapa" antes de salvar, e o link curto (`maps.app.goo.gl`) é aberto pelo servidor ao
  salvar, que só segue endereço do próprio Google Maps. Só com o ponto, a rua vem do mapa. O
  endereço fica no cadastro do cliente, vale para as próximas entregas, e a viagem pede a ordem de
  novo.
- **Serviço fora do ar ou sem chave** (`ORS_API_KEY`): a ordem fica como estava, com aviso. O
  planejamento nunca para por causa do mapa.
- **Google Maps** abre o trajeto na ordem da tela, sem chave e mesmo com o serviço de rotas fora
  do ar. O que não tem endereço fica de fora. O Maps aceita no máximo nove pontos intermediários, e
  acima de dez paradas aparece um segundo botão, "Continuar no Maps", que parte da décima.
- "Iniciar carregamento" cria a carga de cada pedido aprovado, numa transação só, e ele passa a
  *separando*. O pedido que já tem carga (separando ou pronto) segue com as dele, todas.

### 3. Carregamento

- A contagem do "Organizar cargas", agrupada por pedido na **ordem inversa da rota** (RN-60) e
  numerada 1, 2, 3 na ordem de carregar: o 1 são os itens da última entrega, que vão para o fundo, e
  o último número, os da primeira, que ficam perto da porta. Uma faixa no topo mostra como o
  caminhão fica, do fundo à porta.
- Cada item é marcado ao ser separado; o que já chegou separado vem marcado e travado. "Carga
  pronta" só se habilita com tudo marcado, e fecha as cargas de todos os pedidos: os pedidos ficam
  *prontos para envio*, e a viagem fica pronta, sem mensagem de confirmação.
- A carga fechada pela tela do pedido também conta: a viagem fica pronta quando a última carga dos
  pedidos dela fecha, venha de onde vier.

## Situação da viagem

| Situação | Etapa | O que falta |
|---|---|---|
| `montando` | Carga | Escolher os pedidos |
| `roteirizando` | Rota | Decidir a ordem e iniciar o carregamento |
| `carregando` | Carregamento | Separar os itens |
| `pronta` | fim | Nada: os pedidos estão prontos para envio |

Com a viagem do dia pronta, a rotina oferece "Planejar outra viagem neste dia".

## Modelo de dados

`viagens` e `viagens_paradas`, e a coordenada em `cadastro.pessoas_enderecos` (`lat`, `lng`,
`geocodificado_em`). Declaradas em `migrations/20260929000001_viagens.sql` e descritas no
[`C8`](../../engenharia/C-modelagem/C8-dicionario-de-dados.md). A ordem de carregar não é gravada:
é a inversa da ordem das paradas, e se deriva na leitura.

## Quem opera

A gerência, pelo recurso `cargas_pedido`, o mesmo do "Organizar cargas"
([`D4` §3.2](../../engenharia/D-arquitetura/D4-matriz-rbac.md)). A chefia também opera, quando é
ela quem carrega. Os seis colaboradores de campo não entram aqui.

## Rastreabilidade

RF-63, RF-64 · RN-59, RN-60 · [`UC-39`](../../engenharia/C-modelagem/C2-especificacao-casos-de-uso.md)
· TA-77, TA-78, TA-87, TA-88.
