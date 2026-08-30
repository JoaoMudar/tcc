# D1: Documento de arquitetura

> **Artefato:** Documento de arquitetura (modelo C4) · **Bloco:** D, Arquitetura
> **Destino no TCC:** Capítulo 4, seção 4.6, Arquitetura da solução
> **Fundamentação:** Sommerville (2011) descreve a arquitetura cliente-servidor como conjunto de
> serviços e servidores acessados por clientes, e apresenta o sistema de informação genérico
> estruturado em **três camadas**: comunicação com o usuário, lógica da aplicação, e gerenciamento do
> banco de dados. Este documento organiza a arquitetura em níveis progressivos de detalhe e mapeia
> cada nível a essas três camadas.

---

## 1. As três camadas antes dos diagramas

A arquitetura adotada é **cliente-servidor em três camadas**, conforme o sistema de informação
genérico de Sommerville (2011). Antes de detalhar, convém fixar o que cada camada é neste sistema:

| Camada de Sommerville | Neste sistema | Onde executa |
|---|---|---|
| **Comunicação com o usuário** | Interface acessada pelo navegador do celular, concebida para uso móvel e instalável como aplicativo web progressivo | Dispositivo do usuário |
| **Lógica da aplicação** | Regras de negócio, validações e controle de acesso, executados exclusivamente no servidor | Servidor de aplicação |
| **Gerenciamento do banco de dados** | Sistema gerenciador relacional, responsável pela persistência e pela integridade | Servidor de banco |

**A decisão arquitetural mais determinante é a fronteira entre a primeira e a segunda camada.** As
regras de acesso a dados são executadas no servidor e nunca no navegador (RNF-12). O navegador
recebe apenas o resultado já filtrado pelo perfil do usuário, nunca a credencial de banco, nunca a
regra que decide o que ele pode ver. Um usuário que inspecione o código entregue ao seu dispositivo
não encontra ali nada que lhe permita contornar a autorização.

---

## 2. Nível 1: Contexto

Quem usa o sistema e com que sistemas externos ele troca informação.

```mermaid
graph TB
  subgraph usuarios["Usuários do viveiro"]
    CH["Chefia<br/>vendas, pedidos, decisões"]
    GE["Gerência<br/>operação e coordenação"]
  end

  SIS["<b>Sistema de gestão do viveiro</b><br/>Cadastro único, agenda da semana,<br/>lotes e pedidos"]

  NF["Emissor de nota fiscal<br/><i>sistema externo</i>"]
  WA["Serviço de mensageria<br/><i>WhatsApp</i>"]

  CH --> SIS
  GE --> SIS

  SIS -.->|"dados cadastrais do cliente"| NF
  WA -.->|"pedido negociado,<br/>registrado à mão depois"| SIS
```

**Nenhuma das duas integrações é automática, e as setas pontilhadas dizem isso.** A nota fiscal é
emitida no sistema externo, que apenas consome o cadastro que este mantém; a negociação por
WhatsApp é conduzida por pessoa, e o pedido chega ao sistema digitado por quem vendeu. É decisão de
projeto compatível com a restrição de orçamento e com a inexistência de interface programática nos
sistemas envolvidos, e, no caso da mensageria, também de conformidade (ver
[`E5`](../E-qualidade/E5-mapeamento-lgpd.md)).

**Os colaboradores de campo não aparecem porque não são usuários do sistema.** O trabalho deles é
planejado e confirmado pela gerência ([`A1` §5](../A-fundacao/A1-documento-de-visao.md)), e um
diagrama de contexto que os desenhasse estaria descrevendo a empresa, e não o software.

---

## 3. Nível 2: Contêineres

As unidades executáveis e de armazenamento, e a correspondência com as três camadas.

```mermaid
graph TB
  subgraph disp["Dispositivo do usuário: camada de apresentação"]
    PWA["<b>Aplicação web progressiva</b><br/>Interface móvel<br/>Instalável, funciona sem conexão"]
    FILA["<b>Fila local de sincronização</b><br/>Armazenamento no navegador<br/>Guarda registros feitos sem rede"]
  end

  subgraph srv["Servidor: camada de lógica"]
    REND["<b>Renderização no servidor</b><br/>Monta as telas já com os dados"]
    ACOES["<b>Ações de servidor</b><br/>Regras de negócio, validações<br/>e verificação de permissão"]
    AUTH["<b>Controle de acesso</b><br/>Sessão, perfil e autorização<br/>por operação"]
  end

  subgraph dados["Camada de dados"]
    BD[("<b>Banco relacional</b><br/>27 entidades em 2 esquemas")]
    ARQ["<b>Armazenamento de imagens</b><br/>Fotografias das espécies"]
  end

  PWA -->|"solicita tela"| REND
  PWA -->|"submete formulário"| ACOES
  PWA <-->|"grava e reenvia"| FILA
  FILA -->|"envia ao reconectar"| ACOES

  REND --> AUTH
  ACOES --> AUTH
  AUTH -->|"consulta e grava"| BD
  REND -->|"consulta"| BD
  ACOES -->|"consulta e grava"| BD
  REND --> ARQ
```

### Justificativa dos contêineres

| Contêiner | Por que existe |
|---|---|
| **Aplicação web progressiva** | Atende ao uso móvel (RE-2) sem exigir instalação por loja de aplicativos (RNF-27), o que elimina custo e fricção de distribuição para nove usuários |
| **Fila local de sincronização** | A conexão no viveiro é instável (RE-3). Sem ela, o registro em campo falharia justamente onde mais ocorre, e seria substituído por papel |
| **Renderização no servidor** | Permite que a tela chegue ao celular já com os dados, reduzindo o número de idas e voltas sob rede lenta (RNF-07) |
| **Ações de servidor** | Concentram regra de negócio e verificação de permissão do lado do servidor, atendendo ao RNF-12 |
| **Controle de acesso** | Verificação por operação, e não apenas ocultação de elementos na interface (RF-06) |
| **Banco relacional** | Integridade referencial e restrições declarativas, indispensáveis a um modelo com 27 entidades interligadas |

---

## 4. Nível 3: Componentes da camada de lógica

Decomposição interna do servidor, organizada pelas **três áreas de negócio** do sistema
(`docs/rotinas/00-mapa-de-rotinas.md`), com Acesso e Configurações transversais.

```mermaid
graph TB
  subgraph acesso["Acesso e configurações: transversais"]
    A1["Autenticação de sessão"]
    A2["Autorização por perfil"]
    A3["Auditoria de acesso"]
    A4["Parâmetros do sistema"]
  end

  subgraph cadastros["1 · Cadastro único"]
    N1["Catálogo de espécies"]
    N2["Cadastro de recipientes e insumos"]
    N3["Identidade única de pessoas"]
    N4["Áreas, canteiros e tipos de tarefa"]
    N5["Protocolo de atividades"]
  end

  subgraph producao["2 · Produção"]
    O1["Agenda da semana"]
    O2["Lotes e movimentos"]
    O3["Motor do protocolo"]
    O4["Mapa e estatísticas do lote"]
  end

  subgraph comercial["3 · Comercial"]
    C2["Cadastro de pedidos"]
  end

  O1 --> N4
  O2 --> N1
  O2 --> N2
  O3 --> N5
  O3 --> O2
  O3 -.->|"gera ordem na agenda"| O1
  O4 --> O2
  O4 --> O1
  O4 --> A4
  O1 --> N3
  C2 --> N3
  C2 --> N1
  C2 -.->|"saldo de muda pronta"| O2

  A2 -.->|"protege"| cadastros
  A2 -.->|"protege"| producao
  A2 -.->|"protege"| comercial
```

### O que o grafo de dependências revela

**O Cadastro único é a raiz, e nada nele depende de nada.** Todas as setas apontam para ele, e
nenhuma sai. É a tradução arquitetural do que o sistema afirma: o catálogo é o que as outras duas
áreas consomem, e é por isso que ele é a primeira coisa a existir.

**O motor do protocolo é o único componente que escreve numa área que não é a sua.** Ele lê a
etapa em Cadastro único, lê o lote em Produção e **gera ordem na agenda**, que também é Produção.
A seta pontilhada marca que a escrita é automática: nenhum usuário a aciona, e é justamente essa
a razão de o componente existir (RF-59).

**O Comercial depende da Produção por uma única aresta, e ela é de leitura.** O cadastro de
pedidos consulta o saldo de muda pronta e não escreve nada lá: o pedido não reserva, não baixa e
não move lote. É a interconexão que o trabalho existe para demonstrar, e o diagrama mostra que ela
custa uma seta.

**O mapa depende de três coisas, e uma delas é parâmetro.** Ele lê lote, lê agenda e lê os limites
de atraso e de mortalidade. É o que torna a cor da tela ajustável sem implantação (RN-32), e é a
razão de Configurações ser transversal e não um canto do Cadastro único.

---

## 5. Decisões arquiteturais e suas consequências

| Decisão | Consequência aceita |
|---|---|
| Lógica e autorização exclusivamente no servidor | Toda operação exige ida ao servidor; mitigado pela fila local nas operações de campo |
| Aplicação web progressiva em vez de aplicativo nativo | Sem acesso a recursos nativos avançados; em troca, distribuição imediata e sem loja |
| Banco relacional com integridade declarativa | Alterações de esquema exigem migração versionada (RNF-20); em troca, o dado inconsistente é impedido pelo banco e não apenas pela aplicação |
| Esquema separado para o cadastro de pessoas | Consultas precisam qualificar o esquema; em troca, a identidade única fica visivelmente fora das três áreas de negócio, que é o que ela é |
| Sincronização por fila local, e não banco replicado no dispositivo | Consultas agregadas exigem conexão; em troca, não há conflito de escrita a resolver |

> O registro formal de cada decisão, com alternativas descartadas, corresponderia ao item **D2** do
> catálogo de artefatos, não selecionado para produção.

---

## 6. Atendimento aos requisitos não funcionais

| Requisito | Como a arquitetura o atende |
|---|---|
| RNF-05: registro sem conexão | Fila local no dispositivo, com reenvio automático |
| RNF-06: concepção móvel | Camada de apresentação projetada para o celular, não adaptada de tela maior, nas rotinas de campo |
| RNF-15: tela larga na coordenação | Agenda do dia e mapa de produção projetados para o computador, com redução em lista no celular |
| RNF-07: conexão lenta | Renderização no servidor reduz idas e voltas |
| RNF-09, RNF-10: senha e sessão | Armazenadas apenas como resumo criptográfico |
| RNF-11: cookies de sessão | Marcações que restringem uso a canal cifrado e impedem leitura por código de página |
| RNF-12: regras no servidor | Componente de autorização na camada de lógica, verificando a cada operação |
| RNF-13: cifra em trânsito | Comunicação cifrada obrigatória entre as três camadas |
| RNF-20: esquema versionado | Migrações aplicadas de forma controlada na publicação (ver [`D3`](D3-diagrama-implantacao.md)) |
