# E5: Mapeamento de tratamento de dados pessoais (LGPD)

> **Artefato:** Mapeamento LGPD · **Bloco:** E, Qualidade, riscos e segurança
> **Destino no TCC:** Capítulo 4, seção 4.7, Segurança e controle de acesso
> **Fundamentação:** Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais).
> ⚠️ **Exige acréscimo ao Capítulo 2.5 do TCC**: o referencial atual não menciona a legislação de
> proteção de dados. O texto proposto está em [`../word/`](../word/).

---

## 1. Por que este artefato existe

O sistema trata dados pessoais de quatro grupos, clientes, fornecedores, usuários e funcionários,
e um deles é composto por **pessoas que não operam o sistema**: os seis colaboradores de campo, que
aparecem na agenda, recebem tarefa e têm a quantidade produzida registrada individualmente, sem
nunca abrir uma tela.

Esse grupo é o que torna o mapeamento necessário e não meramente formal. Nos outros três, o titular
está diante de quem digita: o cliente negocia, o fornecedor é contatado, o usuário vê a própria
tela. O funcionário sem login é o único sobre quem o sistema registra sem que ele veja o registro,
e a análise de o que se guarda, para quê e por quanto tempo precisa ser feita antes de o sistema
entrar em operação, não depois.

---

## 2. Inventário do tratamento

### 2.1 Dados de clientes

| Dado | Finalidade | Base legal | Retenção |
|---|---|---|---|
| Nome | Identificação comercial e emissão de nota fiscal | Execução de contrato (art. 7º, V) | Enquanto houver relação comercial; dado fiscal, 5 anos |
| Telefone | Contato sobre pedidos e entregas | Execução de contrato (art. 7º, V) | Idem |
| CPF ou CNPJ | Emissão de nota fiscal | **Obrigação legal** (art. 7º, II) | 5 anos, por exigência fiscal |
| Endereço completo | Emissão de nota fiscal e entrega | Execução de contrato e obrigação legal | 5 anos |
| Correio eletrônico | Envio de documentos da venda | Execução de contrato (art. 7º, V) | Enquanto houver relação comercial |

**Titulares:** clientes pessoa física. Clientes pessoa jurídica não são titulares, mas o nome do
contato e o documento do responsável, quando informados, são dado pessoal.

**Minimização aplicada:** os campos fiscais são **todos opcionais** no cadastro. O cliente de
atacado que não pede nota permanece cadastrado apenas com nome e telefone (RF-15), e a ficha
completa só é preenchida quando há nota a emitir no sistema externo (RF-16): coleta-se o mínimo
necessário à finalidade, e apenas quando a finalidade existe.

### 2.2 Dados de fornecedores

| Dado | Finalidade | Base legal | Retenção |
|---|---|---|---|
| Nome, contato, telefone | Relação comercial de compra | **Legítimo interesse** (art. 7º, IX) | Enquanto houver relação, ou até oposição do titular |
| Correio eletrônico | Idem | Legítimo interesse (art. 7º, IX) | Idem |
| Cidade e estado | Identificação da origem da muda ou do insumo | Legítimo interesse (art. 7º, IX) | Idem |

**Ponto de atenção: legítimo interesse exige contrapartida.** O cadastro de fornecedor apoia-se em
legítimo interesse, e não em consentimento. A lei condiciona essa base à garantia do **direito de
oposição** do titular, e o sistema o atende de forma estrutural: o cadastro se **inativa**, e o
fornecedor inativo deixa de ser oferecido em qualquer seleção.

> **O sistema não envia mensagem a fornecedor.** Não há disparo automático, nem integração com
> mensageria: a comunicação continua sendo conversa entre pessoas, fora do sistema. É o que reduz
> este tratamento a um cadastro de contato, e é a razão de ele não exigir mais controles do que os
> descritos acima.

### 2.3 Dados de usuários do sistema

| Dado | Finalidade | Base legal | Retenção |
|---|---|---|---|
| Nome de exibição e identificador de acesso | Identificação no sistema | Execução de contrato de trabalho (art. 7º, V) | Enquanto durar o vínculo |
| Resumo criptográfico da senha | Autenticação | Execução de contrato (art. 7º, V) | Idem |
| Endereço de origem e descrição do dispositivo | **Segurança da informação**: auditoria de acesso e identificação de aparelho | Legítimo interesse (art. 7º, IX) | 12 meses |
| Registro de tentativas de autenticação | Detecção de acesso indevido | Legítimo interesse (art. 7º, IX) | 12 meses |

**Transparência devida.** O registro de endereço de acesso e de dispositivo é monitoramento de
pessoa identificada, ainda que com finalidade de segurança. Os usuários devem ser informados de que
esse registro existe, do que ele contém e de por quanto tempo é mantido. A tela de sessões ativas
cumpre parte dessa transparência ao exibir ao próprio usuário os dados registrados sobre ele.

### 2.4 Dados de funcionários que não usam o sistema: **o caso mais sensível**

| Dado | Finalidade | Base legal | Retenção |
|---|---|---|---|
| Nome e contato do funcionário | Escala de trabalho e identificação na agenda | Execução de contrato de trabalho (art. 7º, V) | Enquanto durar o vínculo, e 5 anos depois, por prazo prescricional trabalhista |
| Vínculo (fixo ou diarista) | Distinguir quem está na escala permanente de quem aparece por temporada | Execução de contrato (art. 7º, V) | Idem |
| Tarefa atribuída, dia, turno e a hora da tarefa quando ela a tem | Planejamento e registro do trabalho. A hora é **da tarefa**, e não da pessoa: não há apontamento de entrada e saída, e daqui não se extrai jornada de ninguém (RN-12) | Execução de contrato (art. 7º, V) | Idem |
| Quantidade realizada por pessoa | Registro do que foi produzido | **Legítimo interesse** (art. 7º, IX) | Idem |

**Três características tornam este o tratamento mais delicado do sistema.**

1. **O titular não é usuário.** Seis das nove pessoas cadastradas como funcionário **não têm login**
   e nunca abrem uma tela. Elas não veem o que o sistema registra sobre elas, não são notificadas
   quando um registro é feito, e não têm, pela própria interface, como exercer o direito de acesso.
   É o oposto da situação do cliente, que ao menos negocia diretamente com quem digita.
2. **O dado é sobre desempenho individual, e não sobre a equipe.** A quantidade realizada é gravada
   **por pessoa**, e não por tarefa (RN-23): é a granularidade que o negócio pediu, e é também a
   que permite comparar pessoas entre si. O sistema não faz essa comparação em tela nenhuma, mas o
   dado a permite, e é isso que precisa estar declarado.
3. **A finalidade declarada é planejamento, não avaliação.** O registro existe para responder o que
   foi feito no viveiro, e não para medir quem produz mais. Usá-lo para avaliação de desempenho
   seria **desvio de finalidade**, vedado pelo art. 6º, I, e exigiria nova base legal e nova
   informação ao titular.

**Controles aplicados:**

- **O relógio ficou de fora.** O sistema não registra hora de entrada, de saída nem duração de
  tarefa por pessoa ([`A1` §7](../A-fundacao/A1-documento-de-visao.md)). É a decisão de escopo que
  mais reduz a superfície de dado pessoal: sem ela, o cadastro de funcionário viraria controle de
  ponto, com tudo o que isso exige de base legal e de transparência.
- **Nenhum dado de remuneração é tratado.** Não há salário, folha, valor-hora nem custo de mão de
  obra no sistema.
- **Acesso restrito a três pessoas**, chefia, gerência e administrador, todas com vínculo direto de
  supervisão sobre os titulares ([`D4`](../D-arquitetura/D4-matriz-rbac.md)).

> **Transparência devida, e ainda não atendida.** Os seis funcionários sem login precisam ser
> **informados** de que o sistema registra a tarefa atribuída a eles e a quantidade que produziram,
> com que finalidade e por quanto tempo. Como não há tela pela qual informá-los, a comunicação tem
> de ser feita fora do sistema, por aviso escrito entregue à equipe. Fica aqui registrada como
> pendência de implantação, e não como controle já existente.

## 3. Direitos dos titulares e como o sistema os atende

| Direito (art. 18) | Situação no sistema |
|---|---|
| **Confirmação e acesso** | Consulta ao cadastro atende. Não há tela de autoatendimento: a solicitação é processada manualmente pela chefia |
| **Correção** | Cadastros de cliente e fornecedor são editáveis |
| **Anonimização ou eliminação** | Parcialmente atendido. O arquivamento lógico preserva o dado; a eliminação efetiva depende de operação manual no banco |
| **Portabilidade** | Não implementado. Registrado como pendência |
| **Informação sobre compartilhamento** | Este documento identifica o único compartilhamento: os dados cadastrais do cliente, transcritos no emissor fiscal externo pela própria chefia |
| **Revogação de consentimento** | Não aplicável: nenhum tratamento se apoia em consentimento |
| **Oposição** | Atendido para fornecedores, pela inativação do cadastro |

### Pendências reconhecidas

Registrá-las é preferível a declarar conformidade que não existe:

1. **Não há rotina de eliminação por prazo de retenção.** Os prazos estão declarados neste documento;
   sua aplicação é manual.
2. **Não há aviso de privacidade apresentado aos titulares.** Clientes e fornecedores não são
   informados formalmente sobre o tratamento, e os **funcionários sem login** são o caso mais
   grave, porque não há tela pela qual informá-los (§2.4).
3. **Portabilidade não implementada.**
4. **A transparência aos usuários sobre o registro de acesso é parcial**, limitada à tela de sessões
   ativas.

Nenhuma das quatro impede a operação, e todas são de baixo custo de implementação. Ficam registradas
como escopo de continuidade.

---

## 4. Síntese das bases legais

| Base legal | Onde se aplica |
|---|---|
| **Obrigação legal** (art. 7º, II) | Documento fiscal do cliente, dados de nota fiscal, guarda de registro contábil |
| **Execução de contrato** (art. 7º, V) | Nome, contato e endereço de cliente; dados de usuário do sistema; cadastro e escala de funcionário |
| **Legítimo interesse** (art. 7º, IX) | Contato de fornecedor, registro de acesso, quantidade produzida por funcionário |
| **Consentimento** | **Não utilizado em nenhum tratamento** |

A ausência de consentimento como base é deliberada e vale explicitar: consentimento exige coleta,
registro e possibilidade de revogação, e é a base mais frágil quando o tratamento é necessário à
operação. Onde o tratamento é indispensável ao contrato ou à obrigação fiscal, a base adequada é
outra: e apoiá-lo em consentimento criaria a situação absurda de o cliente poder revogar o dado
exigido pela nota fiscal que ele mesmo pediu.
