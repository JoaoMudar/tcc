# Rotina: Produção, visão geral

> **Tarefa diária não é uma rotina separada**: é como a produção é executada, e é a agenda da
> semana que a organiza. Os documentos de engenharia sempre trataram assim, e esta pasta alinha o
> domínio ao que a engenharia já dizia.

## Situação atual

Débora distribui tarefas verbalmente de manhã. Produção é decidida conforme demanda. Não há
registro de quem fez o quê, de quando cada lote foi semeado nem de quanto tempo leva para
ficar pronto.

## As três subrotinas

| # | Subrotina | Pergunta que responde | Documento |
|---|---|---|---|
| 1 | **Agenda de pessoal** | O que cada um vai fazer nesta semana, e o que foi feito? | [`01-agenda-de-pessoal.md`](01-agenda-de-pessoal.md) |
| 2 | **Lotes e canteiros** | Onde está cada lote, de onde veio e quando fica pronto? | [`04-lotes-e-canteiros.md`](04-lotes-e-canteiros.md) |
| 3 | **Protocolo de atividades** | O que cada lote tem de receber, e quando? | [`06-protocolo-de-atividades.md`](06-protocolo-de-atividades.md) |

> **Eram quatro, e o apontamento de tarefas era a segunda.** Ele saiu com a redução de escopo: o
> planejado e o confirmado moram na mesma linha da agenda, e não há entidade de execução separada
> nem medição de hora de ninguém. A confirmação passou a ser parte da agenda de pessoal.

> **A numeração dos arquivos não acompanha a das subrotinas**, e é deliberado: `02-estoque.md` e
> `03-perdas.md` já ocupavam os números quando estas foram escritas, e renumerá-los quebraria
> ligações em `B3`, `C6`, `C8`, no mapa de rotinas e no `P13`.

O encadeamento é um ciclo simples:

```
agenda (planejado)  →  confirmação (realizado)  →  lote avança  →  estoque muda
        ↑                          │
        └──────────────────────────┘
             replaneja a próxima semana com o que sobrou
```

**A agenda é a porta de entrada.** Sem ela, o registro de atividade é um formulário solto
que ninguém lembra de preencher. Com ela, a gerência abre a agenda e já vê o que estava planejado:
registrar vira confirmar, não digitar.

**O lote é o que amarra as três.** A tarefa de campo pede um canteiro para ser executada, a perda
precisa de um lugar para virar mortalidade por leva, e o estoque da espécie é a soma dos lotes
abertos dela. Sem lote, as três subrotinas funcionam por espécie agregada, e nenhuma responde
*onde*. Ele entrou no escopo em 24/08/2026, com a justificativa registrada no
[`A1` §7](../../engenharia/A-fundacao/A1-documento-de-visao.md).

## Telas por perfil

### Chefia
- **Visão de produção**: o que está sendo produzido, previsão de disponibilidade, gargalos
- **Decisão de produção**: quais espécies produzir em maior volume (com base em vendas e estoque)
- **Custo de mão de obra do período**: horas planejadas × realizadas, valor total

### Gerência
- **Agenda**: uma tela só, em três escalas. **Dia** para apontar quem trocou de serviço, com uma
  faixa por funcionário (subrotina 2); **semana** para preencher o que cada um faz (subrotina 1);
  **mês** para conferir o que deixou de se repetir
- **Ocupação do viveiro**: o mapa, com o que há em cada canteiro e quais estão livres (subrotina 3)
- **Ficha do lote**: semeado → germinando → repicado → pronto, com o histórico que explica o saldo

> **A agenda e o mapa são as duas telas de mesa do sistema** (RNF-14): abrem juntas na entrada da
> Produção, alternadas por aba, e são concebidas para computador. No celular viram lista. Todo o
> resto do sistema é de campo, e continua sendo do celular.

### Colaborador
- **Minhas tarefas de hoje**: lista curta, vinda da agenda; marcar como feito
- **Registro de atividade**: lote e quantidade, pré-preenchidos pela tarefa

## Relação com as outras rotinas

| Rotina | Relação |
|---|---|
| **Cadastros** | consome espécie, recipiente, funcionário, tipo de tarefa, área, canteiro e período de trabalho |
| **Estoque** | produção registrada é a entrada do saldo (estoque = produção − perdas − vendas) |
| **Perdas** | perda é registrada no mesmo gesto da atividade, quando ocorre |
| **Protocolo** | a etapa vencida do lote vira ordem na agenda, e é confirmada como qualquer outra tarefa |
| **Pedidos** | separação de pedido também é tarefa e entra na agenda |
