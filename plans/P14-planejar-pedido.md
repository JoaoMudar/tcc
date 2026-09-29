# P14: rotina "Planejar pedido" (a viagem de entrega)

Plano aprovado em 28/09/2026. Branch sugerida: `feat/planejar-pedido`, a partir de `master` depois
do merge do P13. Revisado em 29/09/2026: textos enxutos, sair e voltar, rota no Google Maps.

## Contexto
O calendário (`src/app/(sistema)/pedidos/CalendarioCargas.tsx`) só lista os pedidos do dia, e a
carga pertence a **um** pedido (`pedidos_cargas.pedido_id`, migration `20260921000002`). Na prática
o caminhão sai com vários pedidos numa viagem, e quem carrega precisa pôr por último o que se
entrega primeiro. A rotina nova planeja a viagem do dia: escolhe os pedidos, sugere a rota a partir
do viveiro e gera a separação na **ordem inversa da rota**, para que a primeira entrega fique perto
da porta traseira.

Decisões do usuário:
- **Rota por API externa**: OpenRouteService (geocodificação + otimização). A lat/long fica guardada
  no endereço, para não consultar de novo.
- **Só pedido aprovado** entra na viagem: é o único com item travado para separar.
- **Entidade nova, `viagens`.** O "Organizar cargas" por pedido continua existindo para quem não
  usar a rotina.
- Protótipo clicável publicado como Artifact antes da implementação.

## A rotina

### Entrada
- No calendário, tocar num dia **com entrega** (amarelo ou vermelho) abre `/pedidos/planejar/[data]`.
- Os outros dias mantêm o painel atual, com o botão "Planejar entrega neste dia".
- Dia com viagem em andamento ganha um ponto no calendário e, acima dele, um cartão curto
  ("Entrega de 02/10 · Parou em Rota", botão "Continuar"). Tocar no dia ou no cartão abre a viagem
  **na etapa em que parou** (`viagens.situacao`).

### Sair e voltar
- O cabeçalho da rotina tem "Sair" em todas as telas: volta ao calendário sem perder nada.
- Toda ação grava na hora (pôr e tirar pedido, partida, ordem ao soltar o arraste, parada, item
  separado). Não existe botão "Salvar".
- A seta de voltar anda uma etapa para trás (Rota → Carga). Na Tela 3 ela some: as cargas já foram
  criadas, e dali só se sai.

### Texto na tela
Mínimo. Sem frases de instrução ("pressione e arraste…") nem exemplos entre parênteses; o que o
cartão já mostra não se repete em legenda.

### Tela 1: Montar a carga
- **Topo fixo**: os pedidos já na carga, cada um com cliente, cidade (e logradouro, se houver) e os
  itens em uma linha cada, concatenados: `Ipê-amarelo · 300 · 1,20 m`. Botão "Tirar" por pedido.
- Abaixo, duas listas: **"Marcados para este dia"** e **"Em aberto"** (aprovados sem viagem e sem
  carga, de qualquer data ou sem data).
- Tocar num pedido o adiciona à carga e **grava `data_entrega` = dia da viagem**, com linha no
  histórico do pedido ("Entrega marcada para 02/10 no planejamento da viagem").
- Botão **"Confirmar carga"** leva à Tela 2 (`situacao` = `roteirizando`); desabilitado com a carga
  vazia.

### Tela 2: Rota
- **Partida**: Agrolândia (padrão) ou Itapema, ou qualquer endereço digitado. Os dois endereços-base
  ficam em Configurações (`parametros`).
- **Sugestão automática** da melhor ordem: geocodifica os endereços de entrega (`/geocode/search`,
  com cache em `pessoas_enderecos`) e pede a ordem ao `/optimization` (VROOM) do ORS.
- **Reordenar** pressionando e arrastando o item (`@dnd-kit/sortable`, com suporte a toque), e
  botões ↑/↓ como alternativa para quem não acerta o arraste.
- **"Parada extra"**: descrição obrigatória e endereço opcional. Parada avulsa não tem item e não
  aparece no carregamento.
- Pedido **sem endereço de entrega** ou que a API não achou: aviso no cartão, vai para o fim, e a
  pessoa o posiciona à mão.
- **API fora do ar ou sem chave**: mantém a ordem atual com aviso. O planejamento nunca trava por
  causa do mapa.
- Mostra distância e tempo estimados quando a API responde.
- Botões **"Sugerir ordem"** e **"Google Maps"**. O segundo abre o trajeto na ordem atual
  (`https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=…&travelmode=driving`),
  cada ponto por `lat,lng` ou, sem coordenada, pelo endereço em texto; o que não tem endereço fica de
  fora. Não usa chave e funciona com o ORS fora do ar. O Maps aceita no máximo 9 pontos
  intermediários: com mais de 10 paradas, o link cobre as 10 primeiras e um segundo botão,
  "Continuar no Maps", parte da 10ª.
- Rodapé: **"Iniciar carregamento"**.

### Tela 3: Carregamento
- Ao iniciar, numa transação: para cada pedido da viagem, `criarCargaUnica` (reuso de
  `src/lib/cargas.ts`), que leva o pedido a `separando`; a viagem vai a `carregando`.
- A tela é a contagem de `ContarCarga.tsx`, sem a parte de dividir viagens, agrupada por pedido na
  **ordem inversa da rota**: primeiro os itens da última entrega, por último os da primeira. Cada
  grupo mostra "Entrega 3 de 3 · Cliente · Cidade" e a legenda "vai para o fundo do caminhão" /
  "fica perto da porta".
- Marcar e concluir reutilizam `marcarItemSeparado` e `concluirCarga`. A viagem fica `pronta` quando
  todas as cargas dela estiverem prontas.

## Modelo de dados
Migration nova `2026MMDD000001_viagens.sql`:
- `viagens`: `id`, `data` (DATE), `partida_descricao`, `partida_lat`, `partida_lng`, `situacao`
  (`montando` | `roteirizando` | `carregando` | `pronta`: é também a etapa onde a pessoa parou), `distancia_m`, `duracao_s`, `criado_por`, timestamps.
- `viagens_paradas`: `id`, `viagem_id` (FK, cascade), `ordem`, `pedido_id` (nulo em parada avulsa),
  `descricao`, `endereco`, `lat`, `lng`.
  - `UNIQUE (viagem_id, ordem)` deferível (reordenar troca posições) e `UNIQUE (viagem_id, pedido_id)`.
  - CHECK: `pedido_id IS NOT NULL OR descricao IS NOT NULL`.
  - Um pedido só pode estar em uma viagem não pronta: conferido no código, com o pedido travado
    por `travarPedido`.
- `cadastro.pessoas_enderecos`: `+ lat`, `lng`, `geocodificado_em`. O endereço editado zera as três
  (o cache não pode sobreviver à mudança do texto).
- Parâmetros: `viagem_partida_agrolandia`, `viagem_partida_itapema`.
- Env `ORS_API_KEY` (Vercel e `.env.local`), usada só no servidor.

## Tarefas
- [x] Branch `feat/planejar-pedido` a partir de `master`.
- [x] Migration `viagens` + colunas de geocodificação + parâmetros de partida.
- [x] `src/lib/viagens.ts`: `viagemDoDia`, `adicionarPedido` (grava `data_entrega` e histórico), `tirarPedido`, `salvarOrdem`, `adicionarParada`, `removerParada`, `mudarEtapa` (`montando` ↔ `roteirizando`), `iniciarCarregamento`, `atualizarSituacaoViagem`.
- [x] `src/lib/rotas.ts`: cliente ORS (`geocodificar` com cache, `otimizarOrdem`), com timeout e erro tratado; função pura `ordemDeCarregamento(paradas)`; função pura `resumoDoItem(item)` para o texto concatenado; função pura `linkGoogleMaps(partida, paradas)`, que devolve uma ou mais URLs.
- [x] `concluirCarga`: ao fechar a última carga de uma viagem, levar a viagem a `pronta`.
- [x] Páginas em `src/app/(sistema)/pedidos/planejar/[data]/`: `page.tsx`, `MontarCarga.tsx`, `RotaDaViagem.tsx`, `CarregarViagem.tsx`, `actions.ts`; guarda `requirePageAccess('cargas_pedido')`.
- [x] Dependência `@dnd-kit/core` + `@dnd-kit/sortable`.
- [x] `CalendarioCargas.tsx`: dia com entrega navega para a rotina; painel dos outros dias ganha o botão; viagem em andamento mostra o ponto e o cartão "Continuar".
- [x] Configurações: os dois endereços de partida.
- [x] Testes: unit de `ordemDeCarregamento`, `resumoDoItem`, `linkGoogleMaps` (ordem, ponto sem endereço fora, divisão acima de 10) e validações; retomada na etapa certa; actions com `vi.mock` do pool e do ORS (sucesso, sem endereço, API fora); `viagens.db.test.ts` no padrão de `cargas.db.test.ts`; `CalendarioCargas` navegando.
- [x] Docs: `docs/rotinas/3-comercial/planejar-pedido.md`, links em `pedidos.md` e `00-mapa-de-rotinas.md`; C6, C8 e `modelo-dados-pt` (`.mmd`, `.png`, `mede-figuras.mjs`, `confere-modelo-pt.mjs`); CHANGELOG; RF/RN/caso de uso novos e `verifica-rastreabilidade.mjs` + scripts `build-*` afetados.

Notas da execução (29/09/2026):
- A nota de data no histórico exigiu afrouxar `pedidos_historico_muda_de_situacao`: linha sem troca
  de situação agora entra, desde que tenha observação. A ficha a mostra como nota, sem seta.
- `viagens.sugerir_ordem` (coluna a mais que o plano): liga quando os pedidos da carga mudam e
  desliga quando a ordem é arrumada à mão, para voltar da Tela 1 não desfazer o arraste.
- `atualizarSituacaoViagem` mora em `cargas.ts` (reexportada por `viagens.ts`): `concluirCarga` a
  chama, e o import ao contrário faria um ciclo.
- `geocodificado_em` preenchido com a coordenada nula guarda o "não achado", e o cartão avisa.
- A Tela 3 fecha todas as cargas da viagem num botão só (`concluirViagem`), como no protótipo.

## Verificação
- `npm test` e `node scripts/verifica-rastreabilidade.mjs`.
- No app com o Postgres local: dia com entrega → adicionar um pedido em aberto (conferir a data
  gravada) → confirmar carga → ver a rota sugerida, arrastar, adicionar parada → iniciar carregamento
  → conferir que o primeiro grupo é o da última entrega → marcar tudo e ver pedidos e viagem prontos.
- Sair na Tela 2 depois de arrastar: o calendário mostra "Continuar", que volta à Rota com a mesma
  ordem. Sair na Tela 3 com itens marcados e voltar: continuam marcados.
- "Google Maps" abre o trajeto na ordem da tela, também depois de reordenar.
- Sem `ORS_API_KEY`: a Tela 2 avisa e deixa ordenar à mão.
