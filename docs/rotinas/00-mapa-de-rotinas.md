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
nesta página: **cinza sólido** = toda etapa tem tela · **tracejado largo** = parte tem ·
**tracejado fino, sem preenchimento** = nenhuma tem. A fração aparece no próprio nó.

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

As três classes de status chamam-se `ok`, `meio` e `falta` nos seis diagramas: quem acrescentar um
mapa deve usar os mesmos nomes, senão o script não encontra o que trocar. A largura também mora no
script, uma só para todos: antes disso cada mapa tinha sido gerado com um `-w` diferente, e regerar
com o valor errado reescalava a figura sem ninguém perceber.

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
| Cadastrar/editar cliente ([`1-cadastros/clientes.md`](1-cadastros/clientes.md)) | Chefia |
| Cadastrar/editar fornecedor | Chefia |
| Cadastrar/editar funcionário | Chefia |
| Cadastrar/editar tipo de tarefa | Gerência |
| Cadastrar/editar área e canteiro ([`2-producao/04-lotes-e-canteiros.md`](2-producao/04-lotes-e-canteiros.md)) | Gerência |
| Montar o protocolo de atividades ([`2-producao/06-protocolo-de-atividades.md`](2-producao/06-protocolo-de-atividades.md)) | Gerência / Chefia |

**Pessoas são uma identidade só.** Cliente, fornecedor e funcionário são papéis de
`cadastro.parties`: quem vende muda e às vezes compra é um cadastro só
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
│   ├── 01-cadastro-unico.md        o schema `cadastro`: pessoa, papel, endereço
│   └── clientes.md  +  clientes/   cadastro fiscal e o portão da nota
├── 2-producao/
│   ├── 00-visao-geral.md           as subrotinas e o fluxo
│   ├── 01-agenda-de-pessoal.md     o planejamento da semana e a confirmação
│   ├── 04-lotes-e-canteiros.md     onde a muda está e de que leva veio
│   └── 06-protocolo-de-atividades.md  o que o lote tem de receber
└── 3-comercial/
    ├── 00-visao-geral.md           o cadastro de pedidos
    └── pedidos.md  +  pedidos/     as etapas, uma por documento
```

**Acesso e Configurações não têm pasta.** São transversais e não têm rotina de negócio própria:
estão descritos na seção 0 desta página e especificados em
[`D4`](../engenharia/D-arquitetura/D4-matriz-rbac.md).
