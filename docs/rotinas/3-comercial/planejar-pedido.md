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
perder nada. A seta de voltar anda uma etapa para trás; no carregamento ela some, porque as cargas
já foram criadas, e dali só se sai.

## As três etapas

### 1. Carga

- No topo, fixos, os pedidos já na carga: cliente, cidade e logradouro, e um item por linha
  (`Ipê-amarelo · 300 · 1,20 m`), com "Tirar" em cada pedido.
- Abaixo, duas listas: **Marcados para este dia** e **Em aberto**, que são os aprovados sem carga e
  fora de outra viagem, de qualquer data ou sem data.
- **Só pedido aprovado entra** (RN-59): é o único com item travado para separar.
- Tocar num pedido o põe na carga e **marca a entrega dele para o dia da viagem**, com uma nota no
  histórico do pedido ("Entrega marcada para 02/10 no planejamento da viagem."). Tirar o pedido não
  desfaz a data, que já foi combinada.
- "Confirmar carga" leva à rota.

### 2. Rota

- **Saída**: Agrolândia (padrão), Itapema ou um endereço digitado. Os dois endereços-base ficam em
  Configurações, nos parâmetros `comercial.viagem_partida_agrolandia` e
  `comercial.viagem_partida_itapema`.
- **Sugestão da ordem**: o serviço de mapas (OpenRouteService) acha a coordenada de cada endereço de
  entrega e devolve a melhor ordem a partir da saída, com distância e tempo. A coordenada fica
  guardada no endereço do cliente, para não consultar de novo. A sugestão roda ao confirmar a
  carga, quando as entregas mudaram, ao trocar a saída e no botão "Sugerir ordem".
- **Reordenar** pressionando e arrastando a parada, ou pelas setas, para quem não acerta o arraste.
  A ordem arrumada à mão não é refeita ao voltar da etapa da carga.
- **Parada extra**: descrição obrigatória e endereço opcional. Não tem item, e não aparece no
  carregamento.
- Pedido **sem endereço de entrega**, ou que o serviço não achou, vai para o fim com aviso no
  cartão, e a pessoa o posiciona à mão.
- **Serviço fora do ar ou sem chave** (`ORS_API_KEY`): a ordem fica como estava, com aviso. O
  planejamento nunca para por causa do mapa.
- **Google Maps** abre o trajeto na ordem da tela, sem chave e mesmo com o serviço de rotas fora
  do ar. O que não tem endereço fica de fora. O Maps aceita no máximo nove pontos intermediários, e
  acima de dez paradas aparece um segundo botão, "Continuar no Maps", que parte da décima.
- "Iniciar carregamento" cria a carga de cada pedido, numa transação só, e cada pedido passa a
  *separando*.

### 3. Carregamento

- A contagem do "Organizar cargas", agrupada por pedido na **ordem inversa da rota** (RN-60):
  primeiro os itens da última entrega, que vão para o fundo, e por último os da primeira, que ficam
  perto da porta. Uma faixa no topo mostra como o caminhão fica, do fundo à porta.
- Cada item é marcado ao ser separado. "Carga pronta" só se habilita com tudo marcado, e fecha as
  cargas de todos os pedidos: os pedidos ficam *prontos para envio*, e a viagem fica pronta.
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
· TA-77, TA-78.
