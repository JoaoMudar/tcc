# Mapa de Rotinas

> **O sistema tem três áreas de negócio**: Cadastro único, Produção e Comercial.
> Acesso (login, senha, aparelhos, usuários) e Configurações (período de trabalho,
> parâmetros) são **transversais**: atravessam as três e não são áreas de negócio.
>
> Esta é a taxonomia única. Ela está espelhada nos diagramas desta página, nas pastas desta
> própria pasta (`1-cadastros/` … `3-comercial/`), na navegação do app e nos comentários de
> seção da matriz de permissões.
>
> Nos artefatos de engenharia, o mesmo agrupamento organiza os requisitos
> ([`B2 §2`](../engenharia/B-requisitos/B2-especificacao-requisitos.md)), a rastreabilidade
> ([`B5 §2`](../engenharia/B-requisitos/B5-matriz-rastreabilidade.md)), os casos de uso
> ([`C1 §2`](../engenharia/C-modelagem/C1-diagrama-casos-de-uso.md)), o modelo de dados
> ([`C6 §3`](../engenharia/C-modelagem/C6-modelo-entidade-relacionamento.md)), os componentes
> ([`D1 §4`](../engenharia/D-arquitetura/D1-arquitetura-c4.md)) e a matriz de acesso
> ([`D4 §2`](../engenharia/D-arquitetura/D4-matriz-rbac.md)).

## Perfis

| Perfil | Quem | Foco |
|--------|------|------|
| **Chefia** | Gilberto | Vendas, pedidos, parâmetros, decisões |
| **Gerência** | Débora, João | Operação, agenda, lotes, produção |
| **Administrador** | acumulado pela gerência | Usuários, perfis e sessões |

**Os seis colaboradores de campo não operam o sistema.** Rogério, Amélia, Jaison, Mathias,
Santilha e Carolayne aparecem no cadastro como **funcionário**, recebem tarefa na agenda e têm a
quantidade produzida registrada, e nunca abrem uma tela: quem planeja e confirma o trabalho deles é
a gerência. É decisão de escopo, registrada em
[`A1` §5](../engenharia/A-fundacao/A1-documento-de-visao.md).

---

## Como as três áreas se relacionam

![Mapa do sistema: três áreas](img/mapa-sistema-v2.png)

**Como ler o status.** O critério é contado sobre a tabela de etapas de cada área, mais abaixo
nesta página: **borda sólida, preenchimento cinza** = toda etapa tem tela · **tracejado largo,
cinza claro** = parte tem · **pontilhado fino, sem preenchimento** = nenhuma tem. **A fração não
aparece dentro da figura**: quantas telas já existem é andamento de obra, não conteúdo de figura
de TCC, e o número escrito no nó envelhecia sozinho toda vez que a tabela de etapas crescia. Quem
quiser a contagem lê a tabela da área.

Este parágrafo **é** a legenda da figura, e é por isso que ela não tem uma dentro. A versão
anterior desenhava a legenda como um `subgraph`, que comia a metade esquerda da largura e ainda
saía azulado, porque usava uma classe que a tabela de conversão do `render-mapas` não conhecia.
Ao colar a figura no Word, cole este parágrafo com ela.

**Três leituras que o diagrama torna imediatas:**

- **O Cadastro único não consome nada e alimenta as duas outras.** É a única área sem entrada.
  Por isso é rotina própria, e não um canto do `/admin`.
- **O fluxo não é um ciclo, é uma linha.** Cadastro alimenta Produção e Comercial; a Produção
  entrega ao Comercial um número, o saldo de muda pronta; e nada volta. É a diferença mais visível
  em relação ao desenho anterior, que tinha o Financeiro fechando um anel: sem custeio, não há
  volta a fazer.
- **Estoque não é tabela.** É a soma dos lotes prontos; por isso mora na Produção, como resultado,
  e não em Cadastros.

### A visão do dono

![As três áreas do sistema](img/mapa-4-areas.png)

<details>
<summary>Fonte dos diagramas (Mermaid)</summary>

Os arquivos `.mmd` ficam em [`img/`](img/). Para regenerar:

```bash
node scripts/render-mapas.mjs                    # todos
node scripts/render-mapas.mjs mapa-2-producao    # só um
```

**A cor mora no `.mmd`; o cinza mora no `.png`.** Os arquivos-fonte usam verde, amarelo e
vermelho: é o que faz sentido num preview de Mermaid, na tela. O
[`scripts/render-mapas.mjs`](../../scripts/render-mapas.mjs) troca essa paleta por uma escala
de cinza numa cópia temporária, renderiza e joga a cópia fora. O que vai para o repositório e
para o TCC é o cinza, que sobrevive à impressão em preto e branco; o que se edita continua
colorido.

**O cinza não distingue só por tom, distingue por traço**, e é o traço que carrega a leitura.
A versão anterior separava os três status por três cinzas quase brancos, `#e8e8e8`, `#f2f2f2` e
`#fbfbfb`: os dois últimos diferiam do papel em 9 e em 4 níveis de 255, e impresso não se
distinguia nada. Agora cada status tem tom e padrão de borda próprios, que é exatamente a chave
que a seção "Como ler o status" sempre descreveu.

As três classes de status chamam-se `ok`, `meio` e `falta` nos seis diagramas: quem acrescentar um
mapa deve usar os mesmos nomes, senão o script não encontra o que trocar. A largura também mora no
script, uma só para todos: antes disso cada mapa tinha sido gerado com um `-w` diferente, e regerar
com o valor errado reescalava a figura sem ninguém perceber.

**A renderização é a `-s 3`**, como a de [`modelo-dados-pt/`](../engenharia/modelo-dados-pt/README.md):
no Word a imagem entra reduzida e continua nítida na impressão. Sem isso, os dois mapas pequenos
precisavam ser **ampliados** para preencher a coluna e chegavam ao papel a 88 e a 117 dpi.

**Os mapas são desenhados em faixa horizontal, e o que fixa a forma é o comprimento da cadeia.**
Em `LR` cada seta empurra a caixa seguinte para o lado, então uma cadeia de seis níveis vira uma
tira de 9,4 para 1 e derruba o rótulo a 5,2 pt, abaixo do piso de 6 pt que
[`mede-figuras.mjs`](../../scripts/mede-figuras.mjs) usa. A saída não foi girar a figura para `TD`,
que devolvia uma coluna alta e cheia de setas longas passando por fora, e sim **encurtar a cadeia**:
a Produção fundiu a confirmação da tarefa dentro do nó da agenda, que é onde ela acontece, e o mapa
consolidado passou a receber uma única seta do Acesso em vez de uma para cada área. Onde não há
cadeia, como no Cadastro único, três ligações `~~~` invisíveis quebram a coluna em uma grade de três
colunas. Nenhum mapa tem hoje seta cruzando seta, e o menor rótulo do conjunto está em 7,0 pt.

Depois de regerar, rode a conferência:

```bash
node scripts/confere-mapas.mjs
```

Ele mede a fonte útil de cada PNG na mancha do TCC e verifica que nenhum nó voltou a contar telas.
As duas verificações existem porque as duas falhas já aconteceram: a figura mais importante do
conjunto chegou ao Word a 5,2 pt, e o mapa consolidado ficou meses anunciando "8 etapas" para uma
Produção de 10, que é o motivo de a contagem ter saído do desenho.

O PNG é a fonte para leitura e para o TCC; o `.mmd` é a fonte para edição.

</details>

---

## 0 · Acesso e Configurações: transversais

![Acesso e configurações](img/mapa-0-acesso.png)

Login, definição e troca de senha, aparelhos conectados, usuários e permissões. Ao lado, os dois
ajustes que o sistema lê e a operação altera: o **período de trabalho** do viveiro e os
**parâmetros** que pintam o lote no mapa.

| Etapa | Perfil |
|-------|--------|
| Entrar, trocar a senha, encerrar a própria sessão | Todos |
| Ver e encerrar aparelhos conectados | Todos |
| Criar usuário e atribuir perfil | Administrador |
| Definir o período de trabalho (turnos) | Chefia |
| Alterar limites de atraso e de mortalidade | Chefia |

Telas em `/login`, `/trocar-senha`, `/conta/sessoes`, `/admin/usuarios` e `/configuracoes`.
`/admin` ficou **só** com administração de sistema, usuários e sessões.

**Ninguém cria e ninguém exclui parâmetro.** A chave nasce com a estrutura do banco, porque existe
consulta que a lê pelo nome: o que a operação faz é alterar o valor.

---

## 1 · Cadastro único ([`1-cadastros/`](1-cadastros/00-visao-geral.md))

![Cadastro único](img/mapa-1-cadastros.png)

Rotina **agrupadora**, sem processo próprio. Reúne o que é estável e se repete.

> **Regra de corte: é cadastro se, ao apagá-lo, um movimento passado ficar sem sentido.**

| Etapa | Perfil |
|-------|--------|
| Cadastrar/editar espécie, com nomes populares e foto | Chefia |
| Cadastrar/editar recipiente e insumo | Chefia |
| Consultar pessoas por papel (`/cadastros/pessoas`) | Chefia |
| Cadastrar/editar cliente ([`1-cadastros/01-cadastro-unico.md`](1-cadastros/01-cadastro-unico.md)) | Chefia |
| Cadastrar/editar fornecedor | Chefia |
| Cadastrar/editar funcionário | Chefia |
| Cadastrar/editar tipo de tarefa | Gerência |
| Cadastrar/editar área e canteiro ([`2-producao/04-lotes-e-canteiros.md`](2-producao/04-lotes-e-canteiros.md)) | Gerência |
| Montar o protocolo de atividades ([`2-producao/06-protocolo-de-atividades.md`](2-producao/06-protocolo-de-atividades.md)) | Gerência / Chefia |

**Pessoas são uma identidade só.** Cliente, fornecedor e funcionário são papéis de
`cadastro.pessoas`: quem vende muda e às vezes compra é um cadastro só
([`1-cadastros/01-cadastro-unico.md`](1-cadastros/01-cadastro-unico.md)). Por isso
`/cadastros/pessoas` é **uma lista com filtro por papel**, e não uma aba por papel: a pessoa
aparece uma vez, com um selo por papel que leva à tela daquele papel. O nome abre a **ficha**
(`/cadastros/pessoas/[id]`), com o histórico dos dois lados.

**A ficha fiscal é fechada para a gerência**, e é a única restrição de privacidade da matriz
([`D4` §3.1](../engenharia/D-arquitetura/D4-matriz-rbac.md)): a gerência lê nome, telefone e papéis,
que é o que ela precisa para escalar funcionário na agenda, e não lê CPF, CNPJ nem endereço.

Área `/cadastros`. As telas de papel mantiveram as URLs antigas (`/clientes`, `/fornecedores`)
porque a rotina de pedidos aponta para elas; o agrupamento é de navegação, não de rota.

## 2 · Produção ([`2-producao/`](2-producao/00-visao-geral.md))

![Produção](img/mapa-2-producao.png)

O trabalho da semana e a muda no canteiro. **A área abre em duas visões**, e não numa lista: a
pergunta que a gerência faz ao entrar é sempre uma das duas, *quem está fazendo o quê esta semana*
e *como está o viveiro*.

| Etapa | Perfil |
|-------|--------|
| Montar a agenda da semana ([`2-producao/01-agenda-de-pessoal.md`](2-producao/01-agenda-de-pessoal.md)) | Gerência |
| Confirmar tarefa realizada, com a quantidade de cada participante | Gerência |
| Fechar a semana | Gerência |
| Criar lote e consultar a ocupação ([`2-producao/04-lotes-e-canteiros.md`](2-producao/04-lotes-e-canteiros.md)) | Gerência |
| Repicar lote, gerando o lote de destino | Gerência |
| Dividir lote | Gerência |
| Registrar perda e contagem física sobre o lote | Gerência |
| Acompanhar o protocolo do lote ([`2-producao/06-protocolo-de-atividades.md`](2-producao/06-protocolo-de-atividades.md)) | Gerência |
| Consultar o mapa de lotes: atraso, mortalidade e ocupação | Gerência / Chefia |
| Analisar perdas por espécie e causa | Gerência / Chefia |

Área `/producao`.

**O relógio ficou de fora.** A agenda registra que a tarefa planejada foi feita, e quanto rendeu.
Não há hora de início nem de fim: medir a entrada e a saída de cada pessoa seria controle de ponto,
e está fora do escopo.

## 3 · Comercial ([`3-comercial/`](3-comercial/00-visao-geral.md))

![Comercial](img/mapa-3-comercial.png)

O pedido é negociado por WhatsApp e registrado depois. O sistema guarda o que foi vendido, por
quanto e para quem, e mostra ao lado o que a produção tem pronto.

| Etapa | Perfil |
|-------|--------|
| Cadastro de pedido, com cliente, canal e itens | Chefia |
| Informar o preço unitário de cada item | Chefia |
| Consultar o saldo de muda pronta ao lado do item | Chefia |
| Confirmar o pedido, travando os itens | Chefia |
| Acompanhar pedidos, com filtro por cliente, canal e período | Chefia |

Área `/comercial`; as telas continuam em `/pedidos`.

**A consulta de saldo é a única ligação entre as duas áreas de movimento**, e ela é de leitura: o
pedido não reserva, não baixa e não move lote. É o que o trabalho existe para demonstrar, e custa
uma seta no diagrama.

---

## Onde cada rotina mora

As pastas seguem as áreas: uma por área, na ordem em que o fluxo as percorre.

```
docs/rotinas/
├── 00-mapa-de-rotinas.md          ← você está aqui
├── img/                            ← os diagramas (.mmd é a fonte, .png é a leitura)
├── 1-cadastros/
│   ├── 00-visao-geral.md           a rotina agrupadora e a regra de corte
│   └── 01-cadastro-unico.md        o esquema `cadastro`: pessoa, papel, endereço
├── 2-producao/
│   ├── 00-visao-geral.md           as subrotinas e o fluxo
│   ├── 01-agenda-de-pessoal.md     o planejamento da semana e a confirmação
│   ├── 04-lotes-e-canteiros.md     onde a muda está e de que leva veio
│   └── 06-protocolo-de-atividades.md  o que o lote tem de receber
└── 3-comercial/
    ├── 00-visao-geral.md           a área e o que ela consome
    └── pedidos.md                  o cadastro de pedidos, a única rotina
```

**Acesso e Configurações não têm pasta.** São transversais e não têm rotina de negócio própria:
estão descritos na seção 0 desta página e especificados em
[`D4`](../engenharia/D-arquitetura/D4-matriz-rbac.md).
