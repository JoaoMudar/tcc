# Subrotina: Agenda de Pessoal

> Onde se anota **o que cada funcionário vai fazer** e **o que ele fez de fato**. É a porta de
> entrada da rotina de produção: ver [`00-visao-geral.md`](00-visao-geral.md).
>
> **Reescrita em 31/08/2026.** A versão anterior descrevia apontamento por relógio, horas reais e
> custo de mão de obra, tudo cortado na redução de escopo, e afirmava que o viveiro nunca planeja
> por hora marcada, o que é falso. Ver a décima passada da
> [auditoria](../../auditoria-divergencias.md).

## A ideia em 1 frase

**Uma grade de uma semana: linhas são pessoas, colunas são dias.** Preenche-se na segunda de
manhã em poucos minutos, e ela vira a agenda do dia que a gerência opera para a equipe inteira.

## O problema

Débora distribui tarefas verbalmente. Duas consequências:

1. **Nada fica registrado**: no fim do mês ninguém sabe o que foi feito, por quem, em qual lote.
2. **Esquecimento é invisível**: se a irrigação do canteiro 4 não foi feita, só se descobre
   pela muda morta.

## As 4 decisões de desenho

### 1. O turno é a unidade, e a hora existe onde ela existe de verdade

A unidade da agenda é **dia × turno** (manhã / tarde). Ninguém no viveiro planeja a semana inteira
de hora em hora, e exigir horário exato de toda tarefa garantiria que a agenda não é preenchida.

**Mas parte do trabalho tem hora marcada, e negar isso seria mentir sobre o viveiro.** A irrigação
das sete às oito tem horário na vida real. A carga de terra chega meio-dia. Essas tarefas
**declaram a sua hora**, e as demais não declaram nada: a hora é opcional (RN-12).

> **Por que o turno continua obrigatório mesmo havendo hora.** Os turnos **não cobrem o dia
> inteiro**: entre as 11h e as 13h não há turno nenhum, e a carga de terra que chega meio-dia
> cairia num vazio se a hora tivesse de determinar o turno. Quem sabe se aquilo conta como manhã ou
> como tarde é quem monta a agenda, e não o relógio.

**O turno não vale quatro horas por decreto.** A hora de início e de fim de cada turno é
**cadastro**, na tela de configurações. Muda com a estação e com a combinação da equipe, e
convenção que muda é dado, não constante escondida no código (RN-26).

**A hora da tarefa não é a hora da pessoa.** Registrar que a irrigação é das sete às oito diz
quando a tarefa acontece. Medir quando cada funcionário chegou e saiu é **controle de ponto**, que
é relação de trabalho e não gestão de produção: está fora do escopo
([`A1` §7](../../engenharia/A-fundacao/A1-documento-de-visao.md)) e continua fora.

### 2. Escolher, não digitar

Tudo é lista fechada: funcionário (do cadastro), tipo de tarefa (do catálogo), espécie,
recipiente e lote (quando o tipo de tarefa exigir). Campo livre só em "observação", opcional.

> **Sem campo aberto = sem typo = dado que serve para somar.**

**O catálogo de tarefas comanda o formulário.** Cada tipo de tarefa tem um nome e quatro
declarações: se é **quantitativa por unidade**, se tem **lote específico**, e se exige espécie ou
recipiente. A tela não sabe nada por conta própria, e por isso "Irrigação" não pergunta lote e
"Repicar" pergunta. Cadastrar uma tarefa e deixá-la ativa é o que a faz aparecer na lista da
agenda.

### 3. Repetir é o caminho normal

A semana do viveiro se parece muito com a anterior. O botão principal da tela é
**"Copiar semana passada"**: traz tudo preenchido, e ajusta-se o que mudou. Preencher do
zero é a exceção.

**Tarefa recorrente é uma marca, e não uma entidade de calendário.** Marcar a irrigação como
recorrente faz com que ela **nasça preenchida** na cópia da semana, com o turno e a hora que ela
tinha. É o suficiente para o gesto que o viveiro faz.

> **Por que não uma regra de recorrência com dias, hora e vigência.** Uma entidade dessas existiria
> para **gerar dias sozinha**, e o que gera dia sozinho neste modelo é o **protocolo**, cujo sujeito
> é o lote, e não a equipe. Duas máquinas de gerar dia, uma olhando a semana e outra olhando o lote,
> produziriam a mesma ordem duas vezes.

E uma tarefa pode ser lançada **para um intervalo de dias** de uma vez, em vez de cinco vezes.

### 4. A tarefa é do grupo, não da pessoa

Metade da equipe enchendo saquinho enquanto a outra metade repica é a **norma**, não a exceção.
Por isso uma atribuição tem **um grupo de funcionários**, e o mesmo turno comporta duas tarefas
com grupos diferentes (RN-25).

> **Por que não uma linha por pessoa.** Escalar quatro pessoas na mesma tarefa criaria quatro
> atribuições idênticas, e a tarefa deixaria de ser uma coisa só para virar quatro coisas
> parecidas.

**A quantidade, porém, é de cada um.** Quatro pessoas enchendo saquinho produzem quatro números, e
é assim que o viveiro fala (RN-23). Nunca um total dividido pelo tamanho do grupo, que inventaria
um rendimento que ninguém teve.

## As telas

### A agenda na escala de semana (planejamento)

**Não é uma tela própria**: é a mesma agenda da entrada da Produção, com o botão de escala em
*Semana*. É tela de computador, por RNF-14.

```
Semana de 10/08 a 15/08   [ Dia | Semana ]   [Copiar semana passada] [Publicar]

              SEG        TER        QUA        QUI        SEX        SÁB
Rogério      Repicagem  Repicagem  Irrigação  Semeadura  Semeadura  Limpeza
Amélia       Repicagem  Repicagem  Semeadura  Semeadura  Semeadura  --
             Ipê-amar.  Ipê-amar.  Aroeira    Aroeira    Aroeira
             2026-0147  2026-0147  --         --         --
             M+T        M          M 7h-8h    M+T        M          M

Jaison       Separação  Entrega    Adubação   Adubação   Separação  --
             Ped. #124  Blumenau   --         --         Ped. #131
             M          M+T        M          M          M+T
```

Rogério e Amélia aparecem **na mesma célula** de segunda e terça: é uma tarefa com duas pessoas,
não duas tarefas. A irrigação de quarta mostra `M 7h-8h`: tem turno **e** hora. As demais mostram
só o turno, porque é só isso que têm.

Rogério e Amélia aparecem **na mesma célula** de segunda e terça: é uma tarefa com duas pessoas,
não duas tarefas.

**Na tela de computador a semana se monta com a mão, e não só pelo formulário.** O dia é uma linha
do tempo de verdade, das sete às cinco, com os turnos marcados ao fundo. Arrastar a barra de uma
tarefa planejada a remarca, e ela leva junto o dia, o turno e a hora; puxar a borda muda quando
começa ou quando termina. Clicar num ponto vazio abre o lançamento já apontando para aquele dia e
aquela hora, sem sair da semana. Quem prefere o teclado faz o mesmo com Shift e as setas para
remarcar, e Alt e as setas para mudar a duração.

Três limites valem a pena dizer, porque são decisão e não falta. **Só a tarefa planejada se
arrasta**: a que já foi confirmada aconteceu, e o que aconteceu não se remaneja. **A semana fechada
não se move**, nem por arrasto nem por clique. E **arrastar não troca a pessoa**: a tarefa é de um
grupo, e soltar a barra na faixa de alguém não diria se é para substituir o grupo ou para entrar
nele, então trocar quem faz continua no formulário.

No celular a agenda vira **lista**: um dia por tela, uma linha por pessoa, deslizando entre os
dias. A grade completa não cabe e **não deve ser espremida**, e é por isso que a redução troca de
desenho em vez de encolher o mesmo. Montar a semana inteira, esse é gesto de mesa, e é por isso que
o arrasto existe só lá.

Cadastrar uma tarefa são **3 toques**: pessoas, tipo de tarefa e turno. Hora, espécie, recipiente
e lote só aparecem se a tarefa tiver hora ou se o tipo de tarefa os exigir.

### A agenda do dia (confirmação)

É a **primeira aba da tela inicial da Produção**; a segunda é o mapa de produção
([`04`](04-lotes-e-canteiros.md)). São as duas perguntas que se faz ao entrar no módulo: *quem está
fazendo o quê hoje* e *como está o viveiro*.

**Confirmar é marcar que foi feita**, e informar a quantidade de cada participante quando o tipo de
tarefa for quantitativo por unidade. Tarefa não quantitativa confirma sem pedir número nenhum.

**Quem confirma é a gerência.** Os seis colaboradores de campo não operam o sistema: o trabalho
deles é planejado e confirmado por quem coordena, de um aparelho só.

## O ciclo da semana

```
rascunho  ->  publicada  ->  fechada
   |             |              |
monta-se      a equipe       não se altera mais
              trabalha       o que ficou sem confirmação entra
                             como realizado, MARCADO de não confirmado
```

**A marca existe para que a suposição não se disfarce de medição** (RN-14). A alternativa, uma
agenda com buracos, não distingue o trabalho que não foi feito do que ninguém teve tempo de
confirmar.

**A ordem que o protocolo gerou e ninguém pegou é a exceção**: sem ninguém escalado, o fechamento
**não** a assume como realizada. Dar por feita uma tarefa que ninguém pegou apagaria exatamente o
esquecimento que o protocolo existe para denunciar.

## Modelo de dados (esboço)

| Entidade | Papel |
|---|---|
| `tipos_tarefa` | catálogo de tipos de tarefa: nome, categoria, quantitativa por unidade?, lote específico?, exige espécie?, exige recipiente?. Vive nos [Cadastros](../1-cadastros/00-visao-geral.md) |
| `turnos_trabalho` | o período de trabalho: hora de início e fim de cada turno |
| `semanas` | a semana: `inicio_semana`, `situacao` (rascunho, publicada, fechada) |
| `atribuicoes` | a célula da grade: data, turno, **hora de início e fim quando a tarefa a tem**, tipo de tarefa, espécie?, recipiente?, lote?, área?, canteiro?, quantidade planejada, situação |
| `atribuicoes_participantes` | o grupo escalado, e quanto cada um fez |

**Não há entidade de apontamento.** O planejado e o confirmado moram na mesma linha, e é a
situação que distingue os dois.

Funcionário é `cadastro.pessoas` com papel `funcionario`: **não** `usuarios`. Amélia e Jaison
existem na agenda mesmo sem nunca terem feito login.

## Regras invioláveis

1. **Semana fechada não muda.** Depois de fechada, correção só por lançamento na semana seguinte.
2. **Toda tarefa tem ao menos um responsável**, salvo a ordem recém-gerada pelo protocolo, que
   nasce sem ninguém e fica pendente até alguém pegá-la.
3. **Tipo de tarefa vem do catálogo.** Nunca texto livre.
4. **Toda atribuição tem turno; hora, só a que tiver.** O turno nunca é derivado da hora: os turnos
   não cobrem o dia inteiro.
5. **A quantidade é de cada pessoa**, nunca um total rateado pelo tamanho do grupo.
6. **Funcionário inativo some da grade, mas não do histórico.**

## O que isso destrava

| Destrava | Como |
|---|---|
| **Mapa de lotes** | a situação do lote sai da tarefa planejada cuja data já passou |
| **Perdas** | perda registrada no mesmo gesto da tarefa, já ligada ao lote |
| **Protocolo** | a ordem que o protocolo gera é uma atribuição comum, e cai na mesma grade |

## Engenharia

| Artefato | O que esta rotina acrescentou |
|---|---|
| [`A2`](../../engenharia/A-fundacao/A2-glossario-dominio.md) | §5: Turno, Período de trabalho, Tipo de tarefa, Atribuição, Situação da atribuição, Semana |
| [`B3`](../../engenharia/B-requisitos/B3-regras-de-negocio.md) | RN-23 a RN-26, RN-29; RN-12 e RN-14 emendadas; ressalvas em §2.4 |
| [`B2`](../../engenharia/B-requisitos/B2-especificacao-requisitos.md) | RF-21 e RF-08; RF-26 a RF-31, a agenda e a confirmação; RF-26 na entrada da área, com **RNF-14** e a emenda de RNF-06 |
| [`C1`](../../engenharia/C-modelagem/C1-diagrama-casos-de-uso.md) / [`C2`](../../engenharia/C-modelagem/C2-especificacao-casos-de-uso.md) | UC-15, UC-19, UC-20, UC-21 e UC-05; UC-20 detalhado |
| [`C6`](../../engenharia/C-modelagem/C6-modelo-entidade-relacionamento.md) / [`C8`](../../engenharia/C-modelagem/C8-dicionario-de-dados.md) | `semanas`, `atribuicoes`, `atribuicoes_participantes`, `turnos_trabalho` e `tipos_tarefa`; `atribuicoes` guarda o planejado e o confirmado na mesma linha, e por isso não há entidade de apontamento |
| [`D4`](../../engenharia/D-arquitetura/D4-matriz-rbac.md) | recursos **Agenda da semana**, **Confirmação de tarefa**, **Fechamento da semana** e **Período de trabalho**; §3.3 |
| [`E2`](../../engenharia/E-qualidade/E2-casos-de-teste-de-aceite.md) | TA-10 a TA-12, TA-26 a TA-33, TA-58, TA-27 e TA-28 |
