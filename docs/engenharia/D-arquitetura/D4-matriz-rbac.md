# D4: Matriz de controle de acesso baseado em papéis

> **Artefato:** Matriz RBAC · **Bloco:** D, Arquitetura
> **Destino no TCC:** Capítulo 4, seção 4.7, Segurança e controle de acesso
> **Fundamentação:** Sommerville (2011) trata autenticação e controle de acesso como controles de
> **prevenção de vulnerabilidade**, e observa que a proteção tem como contrapartida a perda de
> produtividade do usuário, cabendo ao projetista encontrar o equilíbrio em cada cenário. Este
> documento registra onde esse equilíbrio foi fixado.

---

## 1. Os papéis

Dois perfis de negócio, correspondentes às funções reais da empresa, mais um papel técnico.

| Papel | Corresponde a | Pessoas | Natureza |
|---|---|---|---|
| **Chefia** | Direção: vendas, pedidos, parâmetros, decisões | 1 | Negócio |
| **Gerência** | Coordenação: operação, agenda, lotes, produção | 2 | Negócio |
| **Administrador** | Manutenção do sistema e gestão de usuários | 1, acumulado | **Técnico** |

**O administrador não é uma função da empresa.** Não participa de nenhuma rotina de negócio: seu
escopo limita-se a criar usuários, atribuir perfis e manter o sistema. É representado à parte para
que a matriz de negócio reflita a operação real do viveiro, e não a estrutura interna do sistema.

**Os seis colaboradores de campo não têm perfil de acesso.** Eles existem no sistema como
`cadastro.parties` com o papel `funcionario`, aparecem na agenda e recebem tarefa, e **nunca abrem
uma tela**: quem planeja e confirma o trabalho deles é a gerência. É decisão de escopo, registrada
em [`A1` §5](../A-fundacao/A1-documento-de-visao.md), e é o que reduz a três o número de perfis.

> **Não confundir os dois sentidos de "funcionário".** `users.role` não tem, e nunca terá enquanto
> esta decisão valer, o valor `colaborador`: ali estão as **permissões**. Já
> `cadastro.party_roles.role` tem o valor `funcionario`, e ali está o **vínculo de trabalho**. Uma
> pessoa pode ter o segundo sem o primeiro, e é o caso de seis das nove.

**Princípio adotado:** o menor privilégio que permita à pessoa fazer o seu trabalho. Onde houve
dúvida, a decisão pendeu para conceder: um perfil restrito demais produz pedido de exceção
constante, e a exceção concedida caso a caso é pior que a permissão declarada.

### 1.1 Nota sobre o administrador na implementação

A coluna *Administrador* da matriz é, em algumas linhas, mais restrita que a da chefia, coerente
com o parágrafo acima, já que o administrador não é função de negócio. **Na implementação, porém,
o perfil `admin` recebe acesso irrestrito**, por uma verificação explícita anterior à consulta da
matriz.

A razão é operacional e não conceitual: há **uma pessoa** com esse perfil, ela é quem mantém o
sistema, e precisa conseguir destravar qualquer situação em produção. A alternativa real não é um
administrador mais restrito: é um administrador que troca o próprio perfil para resolver
incidente, o que destrói o registro de auditoria justamente no momento em que ele mais importa.

A matriz permanece como está: ela descreve o **projeto** do controle de acesso, e é a fonte do
teste que compara documento e código. O override é uma decisão de implantação, declarada aqui e em
um único ponto do código.

---

## 2. Matriz por recurso e operação

Legenda: **C** criar · **L** ler · **A** atualizar · **E** excluir · **-** sem acesso

Os recursos estão agrupados pelas **três áreas de negócio** do sistema, com Acesso e Configurações
à frente por serem transversais: o mesmo agrupamento de
[`B2 §2`](../B-requisitos/B2-especificacao-requisitos.md), onde esta matriz vira código.

**A permissão é do recurso, não da área.** Nenhuma linha abaixo é concedida por a tela ficar sob
`/producao` ou `/comercial`: a guarda é por recurso, em toda operação (§4). O agrupamento serve
para ler a matriz, não para decidir acesso.

| Recurso | Chefia | Gerência | Administrador |
|---|:--:|:--:|:--:|
| **Acesso: transversal** | | | |
| **Usuários e perfis** | - | - | **C L A E** |
| **Sessões próprias** | L E | L E | L E |
| **Auditoria de acesso** | - | - | L |
| **Configurações: transversal** | | | |
| **Período de trabalho** | C L A | L | C L A |
| **Parâmetros do sistema** ¹ | L A | L | L A |
| **1 · Cadastro único** | | | |
| **Espécies** | C L A E | L | C L A E |
| **Recipientes** | C L A E | L | C L A E |
| **Insumos** | C L A E | L | C L A E |
| **Pessoas** ² | C L A E | L | C L A E |
| **Dados fiscais de pessoa** | C L A | - | C L A |
| **Tipos de tarefa** | C L | C L A E | L |
| **Áreas e canteiros** | C L | C L A E | L |
| **Protocolo de atividades** ³ | C L A | C L A | L |
| **2 · Produção** | | | |
| **Agenda da semana** | L | C L A E | L |
| **Fechamento da semana** | L | **A** | L |
| **Confirmação de tarefa** | L | C L A | L |
| **Lotes** | L | C L A | L |
| **Movimentos de lote** | L | C L | L |
| **Divisão de lote** ³ | L | **C** | L |
| **Perdas** | L | C L | L |
| **Análise de perdas** | L | L | L |
| **Mapa de lotes** | L | L | L |
| **Estoque disponível** | L | L | L |
| **3 · Comercial** | | | |
| **Pedidos** | C L A E | L | C L A E |
| **Confirmação de pedido** | **A** | - | A |

¹ **Ninguém cria e ninguém exclui parâmetro.** Ver §3.7.

² **Pessoas é um recurso só, e os papéis não se separam.** Cliente, fornecedor e funcionário são
papéis da mesma identidade (RN-47): dar acesso a um e negar a outro exigiria uma permissão por
papel sobre a mesma linha. Requisitos: **RF-15 a RF-18, RF-19, RF-20, RF-14**.

³ **Recursos do protocolo de atividades por lote**, ainda sem tabela e sem tela. Requisitos:
**RF-22 a RF-24 e RF-25** para o protocolo, **RF-42** para a divisão de lote. As regras de
acesso que não se leem direto da matriz estão em §3.8.

**Vinte e cinco recursos.** A matriz encolheu com o escopo, e o que ela perdeu foi sobretudo
coluna: a saída do perfil de campo eliminou a única regra que dependia do registro e não do
perfil, e com ela a distinção entre "a tarefa que é sua" e "a tarefa dos outros".

---

## 3. As regras de exceção

A matriz não se explica sozinha. Oito decisões merecem justificativa: em quase todas a permissão
restringe alguém que aparentemente deveria ter acesso.

### 3.1 A gerência não vê dado fiscal de pessoa

É a única restrição da matriz cuja motivação é de **privacidade**, e não de escopo funcional. CPF,
CNPJ e endereço de cobrança são dados pessoais sob a Lei nº 13.709/2018
([`E5`](../E-qualidade/E5-mapeamento-lgpd.md)), e a gerência não executa nenhuma tarefa que dependa
deles: ela não emite nota, não cobra e não entrega. Expô-los ampliaria a superfície de dado
sensível sem contrapartida operacional.

A gerência **lê a pessoa**: nome, telefone e papéis, que é o que ela precisa para escalar
funcionário na agenda. O que ela não lê é a ficha fiscal.

### 3.2 Confirmar pedido é privativo da chefia

Confirmar o pedido é o ato que trava itens, quantidades e preços (RF-61). É decisão comercial, e
quem responde por preço é a chefia (RN-52). A gerência **não lê pedido**, e é deliberado: o que a
produção precisa saber do comercial é quanto foi vendido de cada espécie, e isso ela lê pelo saldo
disponível, sem precisar da carteira de pedidos.

### 3.3 A chefia não monta a agenda

A agenda é da gerência, inteira, e a chefia só lê. Não é restrição de proteção: é divisão de
trabalho. Quem sabe quem está disponível, quem faz cada serviço e o que o viveiro precisa nesta
semana é quem coordena a operação todos os dias.

**Fechar a semana é atualização, e não exclusão.** A gerência fecha; ninguém apaga uma semana
(RN-13). A linha da matriz dá `A` e não `E` de propósito: semana fechada é registro, e registro
que se apaga não serve de histórico.

### 3.4 A gerência não cadastra espécie, recipiente nem insumo

Os três catálogos são da chefia, e a gerência só lê. É o catálogo que define o que a empresa
produz e vende, e essa é decisão de direção. A gerência é dona do que **organiza o trabalho**:
tipos de tarefa, áreas e canteiros, onde ela cria, altera e exclui.

A fronteira é nítida e vale a pena enunciá-la: **a chefia decide o que o viveiro faz; a gerência
decide como o viveiro faz**.

### 3.5 Ninguém administra os próprios usuários

Nenhum perfil de negócio cria usuário nem atribui perfil, **nem mesmo a chefia**. É o único recurso
fechado para os dois perfis de negócio.

A razão é de auditoria: quem pode conceder permissão pode conceder a si mesmo, e a partir daí o
registro de quem fez o quê perde valor probatório. Concentrar a operação no papel técnico mantém
separadas a decisão de negócio e a concessão de acesso, ainda que hoje as duas caibam nas mesmas
três pessoas.

### 3.6 A gerência cria lote e movimento, mas não exclui

`C L A` em lotes e `C L` em movimentos, e nenhum `E` nos dois. Movimento de lote é razão contábil
do saldo: apagar uma linha faria o saldo deixar de bater com a soma, que é justamente a
verificação que o modelo existe para permitir (RN-21). O erro se corrige com um movimento de
`ajuste_contagem`, que registra a correção em vez de esconder o erro.

Pelo mesmo motivo a perda é `C L`: perda registrada por engano vira ajuste, e não desaparece.

### 3.7 Configurações: ninguém cria e ninguém exclui

A linha de **Parâmetros do sistema** dá `L A` à chefia e ao administrador, e nada mais a ninguém.
Não há `C` nem `E` para perfil algum, e a ausência é a regra: a chave nasce com a estrutura do
banco, porque existe código que a lê pelo nome. Apagá-la não deixaria a tela vazia, deixaria a
leitura sem resposta, e o mapa de lotes passaria a considerar todo lote saudável, que é a falha
silenciosa mais cara possível naquela tela.

O que a operação faz é **alterar o valor**. É por isso que o limite de mortalidade e os limites de
atraso são parâmetro e não constante (RN-27): mudam com a estação, e mudá-los não pode exigir uma
implantação.

**O período de trabalho tem linha própria e permissão diferente**, ainda que a tela seja a mesma:
ali a chefia cria e altera turno, porque turno é uma **lista de coisas com atributos** e não um
valor solto. É a fronteira entre `settings` e entidade, descrita em
[`C6` §3.1](../C-modelagem/C6-modelo-entidade-relacionamento.md).

### 3.8 O protocolo é da gerência tanto quanto da chefia, e a divisão é só da gerência

**Protocolo de atividades** é a única linha da matriz em que chefia e gerência têm exatamente a
mesma permissão, `C L A`. É deliberado: o protocolo é conhecimento de manejo, e as duas o possuem.
A chefia sabe o que a espécie exige; a gerência sabe o que a equipe consegue executar. Dar a uma
delas e não à outra produziria protocolo que não se cumpre ou protocolo que ninguém revisa.

**Ninguém exclui protocolo**, nem o administrador. Etapa apagada deixaria lotes apontando para uma
receita que não existe mais, e as datas já cumpridas perderiam a referência. O protocolo se
inativa, e a alteração não retroage (RN-39).

**Dividir lote é só da gerência, e é `C` sem `L`.** A operação cria dois lotes e encerra o
original: ler o resultado é ler lote, que a linha de cima já concede. A chefia não divide porque
dividir é decisão de manejo, tomada com a leva na frente.

---

## 3.9 Nota sobre o alcance da matriz

**Os três perfis correspondem às três pessoas que operam o sistema.** Não há aqui, como houve em
versões anteriores deste documento, um perfil especificado para uso futuro: a matriz descreve o
acesso das pessoas que efetivamente abrem o sistema, e o trabalho de campo entra por quem coordena.

Isso simplifica a verificação de aceite: cada linha da matriz é testável com um usuário real de
cada perfil, e não há coluna cuja conferência dependa de uma implantação posterior.

---

## 4. Onde a verificação ocorre

O controle de acesso é verificado em **três níveis**, e a redundância é deliberada: cada nível
protege contra uma classe distinta de falha.

| Nível | O que faz | Contra o quê protege |
|---|---|---|
| **Interface** | Oculta o que o perfil não pode acionar | Erro do usuário, e ruído visual |
| **Rota** | Recusa a navegação para a tela sem permissão | Acesso por endereço digitado ou por link salvo |
| **Operação** | Verifica a permissão a cada leitura e a cada gravação, no servidor | Requisição forjada, e defeito de interface |

**Só o terceiro é controle de segurança** (RNF-12, RF-06). Os dois primeiros são usabilidade: uma
interface que oferece o que vai ser recusado é uma interface que mente. A guarda que decide é a do
servidor, e ela não confia em nada que venha do navegador.

### 4.1 Por que não há um quarto nível no banco

O PostgreSQL oferece segurança em nível de linha, que permitiria expressar a matriz como política
do próprio banco. Não foi adotada, e a razão é declarada: a aplicação acessa o banco com uma
conexão única de serviço, e a identidade do usuário vive na sessão da aplicação, não na do banco.
Reproduzir a identidade no banco exigiria uma conexão por usuário, o que o ambiente de publicação
sem servidor torna proibitivo.

A consequência é assumida: **quem tiver a credencial do banco contorna a matriz inteira**. É a
razão de RNF-23 proibir versionar credencial, e de a modelagem de ameaças
([`E4`](../E-qualidade/E4-modelagem-de-ameacas.md)) tratar o vazamento dela como ameaça de maior
severidade.

---

## 5. O compromisso entre proteção e produtividade

Sommerville (2011) observa que toda medida de proteção custa produtividade, e que o projetista
decide onde parar. Três decisões deste projeto são exatamente isso:

| Decisão | O que se ganha | O que se paga |
|---|---|---|
| Sessão de duração longa no dispositivo de quem registra em campo | O registro de perda não pede senha no meio do trabalho | Aparelho perdido dá acesso até a sessão expirar |
| Administrador com acesso irrestrito na implementação | Incidente em produção se resolve sem trocar de perfil | A auditoria não distingue o que o administrador fez por manutenção do que fez por negócio |
| Dado fiscal fechado para a gerência | Menos superfície de dado pessoal | A gerência não consegue conferir um cadastro incompleto sem chamar a chefia |

**Todo registro tem autor identificado** (RN-54), e é o contrapeso comum às três: onde a permissão
foi concedida com folga, o registro de quem fez o quê é o que permite responder depois.

---

## 6. Rastreabilidade

A matriz realiza **RF-06**, a verificação de permissão a cada operação, e **RF-05**, a atribuição
de perfil. As regras de negócio que a sustentam são **RN-53**, cada pessoa tem um perfil que
determina o que vê e faz, e **RN-54**, todo registro tem autor.

A correspondência entre recurso e requisito está em
[`B5`](../B-requisitos/B5-matriz-rastreabilidade.md).

**A matriz não é verificada célula a célula, e é bom dizer.** São 25 recursos por 3 perfis, e
[`E2`](../E-qualidade/E2-casos-de-teste-de-aceite.md) traz quatro casos de acesso: TA-03, a
operação restrita recusada quando acionada pelo endereço; TA-08, a leitura permitida onde a
escrita não é; TA-61, a regra que roda no servidor e não no navegador; e TA-63, o perfil atribuído
valendo no primeiro acesso. Eles verificam o **mecanismo**, e não as 75 células: testar cada uma
seria reescrever a matriz em forma de teste, e o que quebra na prática é o mecanismo, não a linha.
