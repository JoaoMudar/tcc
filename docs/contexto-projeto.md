# Contexto do Projeto: Viveiro Mudar

> Conteúdo de referência movido do `CLAUDE.md` para não pesar no contexto de toda sessão.
> Consultar quando precisar de visão geral de arquitetura, histórico ou princípios de UX de campo.

## Histórico / contexto crítico
- A empresa opera há anos **sem dados estruturados**: tudo feito de cabeça.
- O sistema de NF atual é do Sebrae: dados de notas em Excel com campos genéricos.
- Não existe controle de lotes, perdas nem estoque estruturado.
- O trabalho da semana é combinado verbalmente e não sobrevive ao próprio dia.

## As três áreas de negócio

O sistema tem **três áreas** (Cadastro único, Produção, Comercial), com Acesso e Configurações
atravessando as três. É a taxonomia única, espelhada nos artefatos de engenharia e no
[`mapa de rotinas`](rotinas/00-mapa-de-rotinas.md).

| Área | O que reúne |
|---|---|
| *(transversal)* **Acesso** | autenticação, três perfis, sessões, auditoria de login |
| *(transversal)* **Configurações** | período de trabalho, limites de atraso e de mortalidade |
| **1 · Cadastro único** | espécies, recipientes, insumos, pessoas (cliente/fornecedor/funcionário), tipos de tarefa, áreas e canteiros, protocolos |
| **2 · Produção** | agenda da semana, confirmação de tarefa, lotes e movimentos, protocolo do lote, mapa de lotes |
| **3 · Comercial** | cadastro de pedidos |

**O Cadastro único não consome nada e alimenta as outras duas.** É a única área sem entrada, e é a
razão de ela existir como área própria e não como um canto do `/admin`.

## A redução de escopo (28/08/2026)

O sistema foi especificado para a empresa e para o TCC ao mesmo tempo, e cresceu além do que um
protótipo entrega no prazo acadêmico. O corte foi aplicado a todos os artefatos.

**Saíram:** o módulo Financeiro por inteiro, custeio, precificação, cotação com fornecedores,
entregas e cargas, apontamento por relógio, estoque e gastos de insumo, indicadores financeiros,
catálogo digital, site, Instagram, comércio eletrônico e integração automática com WhatsApp.

**Saiu também o perfil colaborador.** Os seis trabalhadores de campo deixaram de operar o sistema:
o trabalho deles é planejado e confirmado pela gerência. Restaram três perfis, e três pessoas.

| Antes | Depois |
|---|---:|
| 138 requisitos funcionais | 62 |
| 105 regras de negócio | 60 |
| 59 casos de uso | 34 |
| 62 entidades | 27, mais 2 visões |
| 4 perfis de acesso | 3 |
| 15 planos de implementação | 1 |

O registro do corte está na oitava passada de
[`auditoria-divergencias.md`](auditoria-divergencias.md).

**Os requisitos caíram duas vezes, por motivos diferentes.** O corte de 28/08 levou de 138 a 70, e
tirou funcionalidade: módulos inteiros saíram. A passagem de 70 a 62, em 30/08, **não tirou nada**:
fundiu oito pares de requisitos que compartilhavam o mesmo caso de uso e o mesmo teste de aceite,
e portanto eram um requisito escrito em duas linhas. O critério está declarado em
[`B2` §1](engenharia/B-requisitos/B2-especificacao-requisitos.md).

## O que o sistema faz, em uma linha

**O que se cadastra na área 1 alimenta as outras duas; o que a Produção deixa pronto é o que o
Comercial consegue vender.**

O fluxo **não é um anel, é uma linha**. A versão anterior deste documento descrevia um ciclo em que
a compra nascia no Financeiro e voltava para a Produção, e o preço voltava para o Comercial. Sem
custeio, não há volta a fazer: o Cadastro único alimenta, a Produção registra, e o Comercial lê um
número, o saldo de muda pronta.

**Esse número é a única aresta entre as duas áreas de movimento**, e é de leitura: o pedido não
reserva, não baixa e não move lote. É o que o trabalho existe para demonstrar, e o caso de uso
UC-32 existe justamente para registrar que ele é derivado, e não digitado.

## Ordem de construção

A ordem está em [`plans/P1-sistema-reduzido.md`](../plans/P1-sistema-reduzido.md), em quatro fases:

```
Fase 1 (acesso e cadastro) ─┬─> Fase 2 (lotes) ─┬─> Fase 4 (mapa e pedido)
                            └─> Fase 3 (agenda e protocolo) ─┘
```

**A Fase 1 bloqueia tudo**, e não por convenção: a agenda escala pessoas, o lote referencia espécie
e canteiro, e o pedido referencia pessoa. **O mapa é o último a funcionar**, porque depende das duas
fontes de pendência, a atribuição lançada à mão e a ordem gerada pelo protocolo.

## Formulários de campo (princípios de UX)
- Máximo 5 campos por tela.
- Dropdowns com opções pré-definidas (nunca campo aberto para categorias).
- Botões grandes para dedos sujos de terra.
- Funcionar com conexão lenta ou offline (queue de sync).
- Feedback visual imediato (toast de confirmação).

**Continuam valendo, ainda que o campo não opere o sistema.** Quem registra passou a ser a gerência,
e ela registra em pé, no viveiro, com a leva na frente: o que mudou foi de quem é o dedo que toca a
tela, não o lugar em que ela é usada. As duas exceções declaradas são a agenda da semana e o mapa
de lotes, que não registram nada e existem para comparar (RNF-15).
