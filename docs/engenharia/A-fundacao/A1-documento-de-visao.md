# A1: Documento de Visão

> **Artefato:** Documento de Visão · **Bloco:** A, Fundação e escopo
> **Destino no TCC:** Capítulo 4, seção 4.1, Visão geral da solução
> **Fundamentação:** Sommerville (2011) situa a definição de escopo e de restrições como parte da
> engenharia de requisitos, anterior à especificação. Pressman e Maxim (2016) acrescentam que a
> delimitação explícita do que o software **não** fará é tão determinante quanto a do que ele fará.

---

## 1. Identificação

| Campo | Conteúdo |
|---|---|
| **Produto** | Sistema de gestão para viveiro florestal |
| **Organização** | Viveiro Mudar: Agrolândia, Santa Catarina |
| **Natureza** | Protótipo funcional, desenvolvido como Trabalho de Conclusão de Curso |
| **Domínio** | Produção e comercialização de mudas de árvores nativas |
| **Usuários previstos** | 3 pessoas, distribuídas em 3 perfis de acesso |

---

## 2. O problema

O Viveiro Mudar produz e comercializa mudas de espécies nativas desde 1990. Ao longo de mais de três
décadas, a operação consolidou-se sem qualquer estrutura de dados: **não há registro do que foi
plantado, de onde está, do que se perdeu nem do que foi vendido.**

O conhecimento operacional está distribuído na memória de duas pessoas. O trabalho da semana é
combinado verbalmente e não sobrevive ao próprio dia. O único sistema em uso restringe-se à emissão
de notas fiscais, e os dados dele exportados vêm em planilhas de campos genéricos, insuficientes
para subsidiar decisão. A comercialização ocorre majoritariamente por WhatsApp, sem registro
estruturado do pedido.

Duas consequências decorrem diretamente desse quadro:

1. **Ninguém sabe dizer o que o viveiro tem.** Sem registro do lote, a leva plantada em cada
   canteiro, não se responde quantas mudas de uma espécie existem, em que recipiente estão nem
   quanto daquela leva morreu. A resposta é uma caminhada pelo viveiro, refeita a cada pergunta.
2. **O que foi combinado não se verifica.** Sem registro da tarefa planejada, não há como saber se
   a irrigação daquele canteiro aconteceu, nem como o pedido consultar se existe muda pronta
   para atendê-lo.

O problema não é de escala nem de tecnologia disponível, é de **ausência de registro**. Todo dado
necessário à gestão é gerado diariamente pela operação e descartado no mesmo dia.

---

## 3. A oportunidade

O Alto Vale do Itajaí concentra a maior densidade de viveiros florestais de Santa Catarina, e o
diagnóstico do setor aponta a ausência de protocolos e as falhas de gestão como causas de
ineficiência produtiva. Trata-se, em sua maioria, de microempresas cuja continuidade depende da
geração de valor: para as quais a adoção de tecnologia da informação é fator de competitividade e,
frequentemente, de sobrevivência.

A oportunidade consiste em capturar, no ponto em que ela ocorre, a informação que a operação já
produz: e convertê-la em trabalho organizado, viveiro visível e pedido rastreável.

---

## 4. Objetivos do produto

Derivados dos objetivos específicos do trabalho:

| # | Objetivo | Verificação |
|---|---|---|
| **OP-1** | Estruturar um cadastro único de espécies, recipientes, insumos, pessoas e endereços do viveiro, hoje inexistente | Cadastro persistido e consultável, reaproveitado pela produção e pelo comercial |
| **OP-2** | Organizar o trabalho da semana, atribuindo tarefas por pessoa, por dia e por turno | Semana montada, publicada e fechada, com o realizado distinguível do planejado |
| **OP-3** | Registrar a leva de mudas como lote endereçado a um canteiro, com todo movimento que altera seu saldo | Saldo do lote reconstituível a partir dos seus movimentos |
| **OP-4** | Tornar o estado do viveiro visível numa tela só, com atraso de tarefa, mortalidade e ocupação | Mapa de lotes exibindo as três leituras sobre dado real |
| **OP-5** | Registrar o pedido no sistema, ligado ao que a produção efetivamente tem pronto | Pedido registrado exibindo, por item, o saldo disponível da espécie e do recipiente |

---

## 5. Stakeholders e usuários

| Perfil | Quantidade | Responsabilidades no sistema | Nível técnico | Dispositivo |
|---|---|---|---|---|
| **Chefia** | 1 | Vendas, pedidos, parâmetros do sistema, decisões | Baixo | Celular e computador |
| **Gerência** | 2 | Operação, coordenação, agenda da semana, lotes, planejamento de produção | Baixo a médio | Celular e computador |
| **Administrador** | 1, acumulado pela gerência | Usuários, perfis e sessões | Médio | Computador |

**A gerência ganhou o computador em 26/08/2026.** Ela registrava em campo, como todo mundo, e por
isso constava só com celular. Ao desenhar a agenda da semana e o mapa de lotes ficou claro que ela
também faz uma coisa que ninguém mais faz: **olhar a equipe inteira e o viveiro inteiro de uma vez**,
que é leitura de mesa. O registro em campo continua no celular, e é ele que RE-2 protege.

**Alcance da implantação.** Os usuários do sistema são a **chefia e a gerência**: três pessoas, uma
delas acumulando o papel técnico de administrador. Os seis colaboradores de campo **não operam o
sistema**: o trabalho deles é planejado e registrado pela gerência, que é quem monta a agenda e
aponta o que foi feito. A condição exigida pela metodologia (usuários sem formação técnica)
permanece atendida: nenhum dos três a possui.

**Stakeholders sem acesso ao sistema, mas com influência sobre os requisitos:** os colaboradores de
campo, cujo trabalho a agenda organiza; os clientes de compensação ambiental (exigência de nome
científico) e os órgãos ambientais (rastreabilidade de espécies nativas).

**Condição do autor:** o autor do trabalho integra a gerência da empresa. A imersão no domínio é uma
vantagem de elicitação e, simultaneamente, um risco metodológico de viés, tratado explicitamente em
[`E3: Análise de riscos`](../E-qualidade/E3-analise-de-riscos.md).

---

## 6. Escopo: o que o sistema fará

Organizado pelas **cinco áreas** do sistema, com Acesso e Configurações à frente por atravessarem as
demais ([`00-mapa-de-rotinas`](../../rotinas/00-mapa-de-rotinas.md)).

| Área | Entrega |
|---|---|
| *(transversal)* **Acesso** | Autenticação, três perfis de acesso, sessões ativas e controle de permissão por operação |
| *(transversal)* **Configurações do sistema** | Período de trabalho padrão do viveiro e os parâmetros que o mapa de lotes lê: limites de atraso e limite de mortalidade |
| **1 · Cadastro único** | Espécies, com nomes populares e foto; recipientes; insumos; pessoas (cliente, fornecedor e funcionário como papéis de uma identidade só), com cadastro rápido durante o pedido; tipos de tarefa; áreas e canteiros; protocolos de atividade por espécie e recipiente |
| **2 · Produção** | Agenda semanal de pessoal, com rascunho, publicação e fechamento; lotes endereçados a canteiro, com semeadura, repicagem, transferência, perda, ajuste e venda; etapas do protocolo que o lote deve cumprir; mapa de lotes com atraso de tarefa, mortalidade e ocupação |
| **3 · Comercial** | Cadastro de pedidos, com cliente, canal de venda e itens de espécie, recipiente, quantidade e preço, exibindo o saldo que a produção tem pronto |

**A interconexão é o argumento do sistema.** O que se cadastra na área 1 é o que a Produção usa para
montar tarefa e criar lote, e é o que o Comercial usa para montar pedido. O que a Produção registra
como pronto é o que o Comercial consegue vender. Nenhuma das três áreas se sustenta sozinha, e é
essa dependência que o modelo de dados materializa.

---

## 7. Escopo: o que o sistema **não** fará

Delimitação deliberada. Cada exclusão tem motivo declarado.

| Fora do escopo | Motivo |
|---|---|
| **Emissão de nota fiscal** | Permanece no sistema fiscal externo já em uso. Emissão fiscal exige certificação e homologação fora do alcance de um protótipo. |
| **Folha de pagamento e gestão de pessoal** | Fora do problema de pesquisa. A pessoa entra no sistema como quem executa tarefa, não como vínculo empregatício a administrar. |
| **Rastreamento individual da muda** | Cada muda com identidade própria exigiria etiqueta e leitura unitária, incompatível com a operação. O rastreamento vai até o **lote**, a leva plantada junta num canteiro, e para aí. |
| **Venda direta ao consumidor final (comércio eletrônico)** | Depende de catálogo, meio de pagamento e logística de varejo. Previsto como evolução, não como entrega do protótipo. |
| **Integração automática com o WhatsApp para fechar pedidos sem intervenção humana** | A negociação por WhatsApp é conduzida por pessoa e assim permanece. O sistema recebe o pedido já negociado. |
| **Aplicativo nativo para Android ou iOS** | O uso móvel é atendido por aplicação web progressiva. Publicação em loja de aplicativos não agrega ao problema de pesquisa e adiciona custo de distribuição. |
| **Funcionamento offline pleno** | O registro em campo funciona sem conexão, com envio posterior. Consultas que dependem de dado agregado exigem conexão. |

> **Revisão de escopo, 24/08/2026: o controle de lotes entrou.** Até esta data a tabela acima
> excluía "controle de lotes de produção rastreáveis individualmente", pelo motivo de que exigiria
> disciplina de registro incompatível com a operação, e o sistema registraria produção agregada
> por espécie e recipiente. O levantamento da rotina de produção derrubou os dois termos dessa
> justificativa.
>
> **Primeiro, a disciplina de registro já existe fora do sistema.** O viveiro plantou sempre por
> leva e sempre soube dizer, apontando, que o canteiro 4 da área B é ipê semeado em março. O que
> não existe é o registro escrito disso. Pedir lote não impõe uma disciplina nova: ele é escolhido
> de uma lista de canteiros ocupados, e não digitado.
>
> **Segundo, o agregado por espécie e recipiente não responde às perguntas que o sistema existe
> para responder.** Sem lote não se diz **onde** a muda está, e a tarefa de campo pede canteiro
> para ser executada. Sem lote a mortalidade só se mede sobre a espécie inteira, e a regra dos
> 20 % (RN-17) perde o poder de apontar **qual leva** morreu. Sem lote a repicagem é uma soma que
> entra e outra que sai, sem ligação entre elas, e não se sabe quanto de uma leva chegou à venda.
>
> O limite continua declarado, só mudou de altura: o rastreamento vai até o lote, nunca até a
> muda. A exclusão reescrita acima é essa linha nova.

---

## 8. Premissas

Condições assumidas como verdadeiras. Se alguma se mostrar falsa, o escopo precisa ser revisto.

| # | Premissa |
|---|---|
| **PR-1** | A equipe fornecerá os dados primários necessários, catálogo de espécies, mapa de recipientes, áreas e canteiros do viveiro e protocolos por espécie. Sem eles, o sistema funciona vazio. |
| **PR-2** | Os usuários dispõem de celular com navegador atualizado e acesso à internet, ainda que instável. |
| **PR-3** | A negociação comercial continuará ocorrendo por WhatsApp, com registro posterior no sistema. |
| **PR-4** | A gerência montará a agenda da semana no sistema antes de a semana começar, e a fechará ao final. É dela que sai todo o registro de trabalho. |

---

## 9. Restrições

Limites impostos ao projeto, não escolhidos por ele.

| # | Restrição | Origem | Consequência de projeto |
|---|---|---|---|
| **RE-1** | Usuários sem formação técnica | Perfil da equipe | Interface de uso direto: no máximo cinco campos por tela, listas fechadas em vez de campo aberto, vocabulário do viveiro e não do sistema |
| **RE-2** | Celular como dispositivo principal | Contexto de campo | Concepção orientada ao uso móvel, não adaptação de tela de computador. Vale para o **registro em campo**; as duas telas de coordenação da produção são exceção declarada, sob RNF-27 |
| **RE-3** | Conexão instável no viveiro | Ambiente físico | Registro em campo precisa funcionar sem rede, com envio posterior |
| **RE-4** | Uso com as mãos sujas, sob sol e chuva | Ambiente físico | Alvos de toque grandes, contraste alto, resposta visual imediata a cada ação |
| **RE-5** | Orçamento de microempresa | Porte da organização | Adoção de serviços de custo baixo ou nulo; sem licenças proprietárias |
| **RE-6** | Prazo até novembro de 2026 | Calendário acadêmico | Escopo entregue de forma incremental, com projetos priorizados por dependência |
| **RE-7** | Dados pessoais de clientes e de funcionários sujeitos à legislação de proteção de dados | Legal | Tratamento mapeado, acesso controlado e retenção definida |

---

## 10. Critérios de sucesso

Verificáveis. O detalhamento de cada verificação está em
[`E2: Casos de teste de aceite`](../E-qualidade/E2-casos-de-teste-de-aceite.md).

| # | Critério | Como se verifica |
|---|---|---|
| **CS-1** | O cadastro único alimenta as três áreas sem redigitação | Uma espécie cadastrada uma vez aparece na tarefa, no lote e no item de pedido |
| **CS-2** | A semana de trabalho percorre o ciclo completo dentro do sistema | Semana montada, publicada, apontada e fechada, com o realizado distinguível do planejado |
| **CS-3** | Registro de perda do lote executável sem treinamento formal | A gerência conclui o registro de uma perda sem auxílio, em observação assistida |
| **CS-4** | Dados persistem e sobrevivem a falha de conexão | Registro feito sem rede aparece no sistema após reconexão |
| **CS-5** | O saldo do lote é reconstituível | A soma dos movimentos do lote reproduz o saldo exibido, sem divergência |
| **CS-6** | O mapa de lotes responde às três perguntas sobre dado real | Tela exibe atraso de tarefa, mortalidade acima do limite e ocupação dos canteiros |
| **CS-7** | Usabilidade avaliada segundo os cinco atributos de Nielsen | Aplicação do instrumento definido em [`F3`](../F-ux/F3-plano-avaliacao-usabilidade.md) |

---

## 11. Visão do produto em uma frase

> Para a **chefia e a gerência do Viveiro Mudar**, que hoje operam sem qualquer registro estruturado
> do trabalho, do que está plantado e do que foi vendido, o **sistema de gestão do viveiro** é uma
> aplicação web de uso móvel que **captura a informação no ponto em que ela é gerada** e a converte
> em trabalho organizado, viveiro visível e pedido rastreável.
> Diferentemente da **planilha de notas fiscais hoje utilizada**, que registra o passado em campos
> genéricos e depende de digitação, o sistema **é alimentado pela própria rotina de trabalho** e
> devolve à operação a informação de que ela precisa para decidir.
