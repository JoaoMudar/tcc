# Rotina: Cadastros (cadastro único)

> Rotina **agrupadora**. Não tem processo próprio, reúne, num lugar só, tudo que é
> *cadastro* (o que é estável e se repete) e separa do que é *movimento* (o que acontece
> uma vez e vira histórico).
>
> Modelo em [`C6`](../../engenharia/C-modelagem/C6-modelo-entidade-relacionamento.md) e
> [`C8`](../../engenharia/C-modelagem/C8-dicionario-de-dados.md); origem no banco em
> `migrations/20260901000002_cadastro_catalogo.sql` e
> `migrations/20260901000003_cadastro_pessoas_e_tarefas.sql`.

## O problema

Os cadastros nasceram espalhados, cada um junto da rotina que precisou dele primeiro:

| Cadastro | Onde estava |
|---|---|
| Espécies, recipientes e insumos | `/admin/especies`, `/admin/recipientes`, `/admin/insumos` |
| Clientes | `/clientes` |
| Fornecedores | `/fornecedores` |
| Funcionários | não existia |
| Tipos de tarefa | não existia |

Três consequências:

1. **Ninguém sabe onde cadastrar.** Espécie fica em `/admin`, cliente não. A divisão é
   histórica, não lógica.
2. **`/admin` virou depósito.** Mistura cadastro de domínio (espécie) com administração de
   sistema (usuários, permissões e sessões), coisas de natureza e de risco diferentes.
3. **Funcionário não tem cadastro.** É o buraco que impede a agenda de pessoal.

## A solução

Uma área `/cadastros` que agrupa as telas. **É agrupador de navegação, não migração de
banco**, as tabelas continuam onde estão, e nenhuma tela ou consulta atual quebra.

```
/cadastros
├── pessoas           ← UMA lista, filtrada por papel
│   ├── [id]          ← a ficha: identidade + histórico dos dois lados
│   ├── cliente       → /clientes       (a tela do papel, URL antiga)
│   ├── fornecedor    → /fornecedores   (a tela do papel, URL antiga)
│   └── funcionário   → a tela do papel
├── espécies          (veio de /admin/especies)
├── recipientes       (veio de /admin/recipientes)
├── insumos           (veio de /admin/insumos)
├── tipos de tarefa
├── áreas e canteiros
└── protocolo de atividades
```

**Área, canteiro e protocolo são cadastro, e a descrição deles mora na Produção.** São o lugar
onde a muda fica e a receita de manejo que ela segue, então quem os lê todos os dias é a gerência,
e documentá-los longe do lote separaria a definição do uso. Ver
[`2-producao/04-lotes-e-canteiros.md`](../2-producao/04-lotes-e-canteiros.md) e
[`2-producao/06-protocolo-de-atividades.md`](../2-producao/06-protocolo-de-atividades.md).

**Pessoas é uma entrada só, não duas.** Com abas irmãs de Clientes e Fornecedores, quem vende
semente ao viveiro e às vezes compra muda dele aparecia duas vezes, que é exatamente o problema
que `cadastro.pessoas` foi criada para resolver. A lista mostra a pessoa uma vez, com um selo
por papel, e **o selo é o link** para a tela daquele papel.

**A ficha é a identidade; a tela do papel é o papel.** Na lista, o **nome** abre
`/cadastros/pessoas/[id]`, que mostra quem é a pessoa e o histórico dos dois lados. O **selo** abre
a tela do papel, onde se editam os campos que são dele. A ficha não edita nada.

**A ficha responde em volume e em dinheiro, cada um pelo que existe.** Do lado da venda,
`pedidos_itens.preco_unitario` guarda por quanto se vendeu cada item, então a ficha soma pedidos,
mudas e valor. Do lado da compra não há registro nenhum, porque o sistema não cota, não lança e não
importa extrato, e a ficha diz isso na tela, porque número ausente é melhor que número inventado.

> **Fundir duas identidades ainda não é seguro.** `mergeParties` termina apagando a pessoa
> redundante, e as três chaves estrangeiras que apontam para ela precisam ser repontadas antes.
> Detalhes em [`divida-tecnica.md`](../../divida-tecnica.md) §8.

**A ficha fiscal é fechada para a gerência**, e é a única restrição de privacidade da matriz de
acesso ([`D4` §3.1](../../engenharia/D-arquitetura/D4-matriz-rbac.md)). A gerência lê nome,
telefone e papéis, que é o que ela precisa para escalar funcionário na agenda, e não lê CPF, CNPJ
nem endereço. O papel, ao contrário, não se esconde: Pessoas é um recurso só na matriz, e separar a
leitura de cliente da de fornecedor exigiria uma permissão por papel sobre a mesma linha
([`D4` §2](../../engenharia/D-arquitetura/D4-matriz-rbac.md), nota 2).

`/admin` fica só com o que é administração de sistema: **usuários, permissões e sessões**.

**Coleta de sementes não entra em Cadastros.** É atividade de campo, então virou tipo de tarefa da
agenda, e a tela avulsa `/producao/coleta-sementes` saiu em 26/08/2026.

**Fornecedor é cadastro, e é só cadastro.** O papel existe para dizer de quem se compra semente, e
guarda nome, telefone e endereço como qualquer outra pessoa. Cotar com fornecedor, comparar preço e
registrar compra estão fora do escopo
([`A1` §7](../../engenharia/A-fundacao/A1-documento-de-visao.md)).

### A regra que decide o que entra

> **É cadastro se, ao apagá-lo, um movimento passado ficar sem sentido.**

Espécie, cliente, funcionário e tipo de tarefa passam no teste. Pedido, tarefa atribuída e
registro de perda **não**, são movimento, e vivem nas suas rotinas.

Por isso **"tarefas" no cadastro é o catálogo de tipos** (semeadura, repicagem, irrigação,
limpeza de canteiro), não as tarefas atribuídas a alguém. As atribuídas são movimento e
ficam na [agenda de pessoal](../2-producao/01-agenda-de-pessoal.md).

## Identidade única de pessoas

Clientes, fornecedores e funcionários são **a mesma coisa vista de ângulos diferentes**,
uma pessoa. O esquema `cadastro` resolve isso com uma identidade e N papéis, e o detalhamento
das três tabelas está em [`01-cadastro-unico.md`](01-cadastro-unico.md).

```
cadastro.pessoas             quem é (PF/PJ, documento, contato)
cadastro.pessoas_papeis      cliente · fornecedor · funcionario
cadastro.pessoas_enderecos   endereços
```

Duas consequências práticas:

- **Quem vende e compra é um cadastro só**, com dois papéis na mesma linha de identidade.
- **Funcionário existe sem login.** `usuarios` é só credencial, com chave estrangeira opcional
  para a pessoa (`usuarios.pessoa_id`). Seis dos nove colaboradores aparecem na agenda sem nunca
  abrir o aplicativo.

A tela que materializa isso é `/cadastros/pessoas`. As telas de papel continuam sendo onde se
editam os campos **do papel**, como os dados fiscais no cliente.

> **Espécies, recipientes, insumos e tipos de tarefa não são pessoas** e não entram em
> `pessoas`. Continuam nas suas tabelas. O que os une a clientes e fornecedores é a
> navegação, não o schema.

## Cadastro de funcionário

Campos mínimos, porque o formulário tem que caber numa tela de celular. São as colunas de
`cadastro.pessoas` mais o vínculo, que vive no papel:

| Campo | Obrigatório | Nota |
|---|---|---|
| Nome | sim | `pessoas.nome` |
| Tipo | sim | `pf` ou `pj`, pelo enum `cadastro.tipo_pessoa` |
| Telefone / WhatsApp | não | |
| Vínculo | sim | `fixo` ou `diarista`, em `pessoas_papeis.tipo_vinculo`, aceito só no papel `funcionario` |
| Ativa | sim | soft-delete; inativa some da agenda mas o histórico fica |
| Documento, endereço | não | preenchidos quando a nota precisar (RN-46) |

**Não há valor por hora, nem individual nem médio.** O sistema não apura custo de mão de obra, e
por isso o cadastro de funcionário não guarda remuneração alguma
([`A1` §7](../../engenharia/A-fundacao/A1-documento-de-visao.md)).

## Cadastro de tipos de tarefa

O que faz a agenda ser rápida de preencher, porque não há digitação livre, só escolha da lista.

| Campo | Nota |
|---|---|
| Nome da atividade | "Colher semente", "Encher saquinho", "Repicar", "Irrigar", "Capinar" |
| Categoria | `semente` · `terra` · `plantio` · `manutencao` · `pos_morte` · `expedicao`. **Classifica, não comanda formulário** (RN-23) |
| `e_quantitativa` | quando verdadeiro, a confirmação pede **quanto cada participante fez**; quando falso, não pede número algum (RF-29, RN-24) |
| `exige_lote` | quando verdadeiro, a confirmação exige o lote, que traz consigo canteiro, espécie e recipiente (RN-25) |
| `exige_especie` | para a tarefa que pede espécie sem haver lote, como colher semente |
| `exige_recipiente` | para a tarefa que pede recipiente sem haver lote, como encher saquinho |
| `ativo` | soft-delete; inativar é o que retira a tarefa da lista da agenda |

**É o tipo de tarefa que comanda o formulário** (RF-21, RN-15). Sem ele, ou a tela pede tudo
sempre, e ninguém preenche, ou pede o mínimo sempre, e o dado não serve.

## Telas por perfil

O recorte é o da matriz de acesso
([`D4` §2](../../engenharia/D-arquitetura/D4-matriz-rbac.md)):

| Etapa | Perfil |
|---|---|
| Cadastrar/editar espécie, recipiente e insumo | Chefia |
| Cadastrar/editar pessoa em qualquer papel | Chefia |
| Ler pessoa (nome, telefone e papéis) | Chefia / Gerência |
| Ler e editar a ficha fiscal da pessoa | Chefia |
| Cadastrar/editar tipo de tarefa | Gerência |
| Cadastrar/editar área e canteiro | Gerência |
| Montar o protocolo de atividades | Chefia / Gerência |

**A chefia decide o que o viveiro faz; a gerência decide como o viveiro faz**, e é essa fronteira
que separa o catálogo de espécie, recipiente e insumo do catálogo de tipo de tarefa, área e
canteiro ([`D4` §3.4](../../engenharia/D-arquitetura/D4-matriz-rbac.md)).

## Relação com as outras áreas

Cadastros não consome nada, é a base das outras duas.

| Consome | Para quê |
|---|---|
| Produção | espécie, recipiente, funcionário, tipo de tarefa, área, canteiro e protocolo |
| Comercial | cliente, espécie e recipiente no item do pedido |

## Rastreabilidade

| Documento | O que |
|---|---|
| [`B2`](../../engenharia/B-requisitos/B2-especificacao-requisitos.md) | RF-10 a RF-13 no catálogo; RF-14 a RF-20 nas pessoas; RF-21 nos tipos de tarefa; RF-22 a RF-25 no protocolo |
| [`B3`](../../engenharia/B-requisitos/B3-regras-de-negocio.md) | RN-15, RN-23, RN-24, RN-25, RN-46, RN-47 |
| [`C6`](../../engenharia/C-modelagem/C6-modelo-entidade-relacionamento.md) / [`C8`](../../engenharia/C-modelagem/C8-dicionario-de-dados.md) | `especies`, `recipientes`, `insumos`, `areas`, `canteiros`, `tipos_tarefa` e o esquema `cadastro` |
| [`D4`](../../engenharia/D-arquitetura/D4-matriz-rbac.md) | recursos **Espécies**, **Recipientes**, **Insumos**, **Pessoas**, **Dados fiscais de pessoa**, **Tipos de tarefa**, **Áreas e canteiros** e **Protocolo de atividades** |
