# Como os pedidos chegam

> Leitura de 3 minutos. Pedido começa como **desejo**, e só vira venda no **Fechar**.
> Detalhe da rotina em [`pedidos.md`](pedidos.md).

## A regra de ouro

- **Cadastrar:** só o cliente e a lista. Cada item precisa de **uma** coisa: a espécie
  **ou** uma descrição ("mudas nativas 17x22").
- **Fechar:** aí sim tudo completo: espécie, recipiente, quantidade e preço.
- Quem preenche o que falta no meio do caminho é o viveiro, não o cliente.

## O fluxo

| Etapa | Quem | O que acontece |
|---|---|---|
| 1. Cadastrar | chefia | Cola a lista do WhatsApp. Deixa em branco o que o cliente não disse. |
| 2. Verificar | gerência | Vai no pátio. Para cada item: tem? quantas? em que recipiente? |
| 3. Negociar | chefia | Manda ao cliente o que tem. Ajusta itens e põe preço. |
| 4. Fechar | chefia | Aprova. O sistema só deixa se tudo estiver preenchido. |
| 5. Entregar | gerência | Separa em cargas e confere. |

## Os 7 tipos de pedido

**1. Só a lista de espécies**
"Quero ipê, aroeira, pitanga, jerivá."
→ Cadastra só as espécies. Na verificação, a gerência diz quanto tem de cada uma e em qual
recipiente. Na negociação, vocês propõem as quantidades.

**2. Espécie + quantidade**
"200 ipês, 100 aroeiras."
→ Cadastra sem recipiente. A gerência diz em qual recipiente tem.

**3. Espécie + tamanho**
"Ipê em saco 17x22", "aroeira de 1,20 m".
→ Cadastra com recipiente ou altura, sem quantidade. A gerência diz quantas tem.

**4. Completo**
"200 ipês em saco 17x22."
→ Já é o que o sistema faz hoje. Só verificar e pôr preço.

**5. Genérico por tamanho**
"500 mudas nativas em saco 10x18."
→ Item genérico. Na verificação, a gerência escolhe quais espécies entram e quantas de cada.

**6. Genérico com filtro**
"300 mudas, só frutíferas" ou "300 mudas, dessas 20 espécies".
→ Item genérico + espécies permitidas. A gerência só escolhe dentro do filtro.

**7. Por projeto ou área**
"Preciso recompor 2 hectares de mata ciliar", ou manda o PDF do projeto.
→ Cadastra como genérico e escreve o projeto na descrição. A gerência monta a lista.

## Resumo em uma tabela

| Tipo | Espécie | Tamanho | Quantidade | Quem decide o que falta |
|---|---|---|---|---|
| 1. Só lista | ✅ | ❌ | ❌ | gerência (o que tem) + chefia (propõe) |
| 2. Espécie + quantidade | ✅ | ❌ | ✅ | gerência |
| 3. Espécie + tamanho | ✅ | ✅ | ❌ | gerência |
| 4. Completo | ✅ | ✅ | ✅ | ninguém |
| 5. Genérico | ❌ | ✅ | ✅ | gerência |
| 6. Genérico + filtro | filtro | ✅ | ✅ | gerência, dentro do filtro |
| 7. Projeto | ❌ | ❌ | ❌ | gerência monta tudo |

## Como o sistema trata

Desde 24/09/2026 (plano P11, migration `20260924000001`):

1. **Recipiente e quantidade são opcionais no cadastro.** Só a aprovação os exige. O item sem
   espécie exige a descrição do que o cliente pediu.
2. **A conferência abre sem quantidade.** No item que veio sem ela, a gerência responde "não tem"
   ou "tem N", e diz em qual recipiente.
3. **Sem recipiente, a resposta com muda diz em qual está.** No item completo, o "tem tudo" aceita
   um recipiente diferente do pedido.
4. **O genérico sem quantidade é uma lista montada.** A gerência escolhe espécies e quantidades sem
   soma a fechar, e cada espécie vira um item com preço próprio. Com quantidade (tipos 5 e 6), a
   soma continua tendo de fechar, e o preço é o do genérico.
5. **Negociar não volta à conferência.** Na ficha, a chefia põe preço, baixa a quantidade até o
   confirmado, zera o item ou escolhe entre o recipiente pedido e o conferido. Pedir mais do que
   existe é "Salvar e reenviar".
6. **A primeira etapa aparece como "Orçamento".**

**O que ainda não faz:** a colagem não transforma sozinha a linha sem espécie reconhecida em item
genérico (marca-se à mão, na revisão), e a lista não separa orçamentos de vendas.
