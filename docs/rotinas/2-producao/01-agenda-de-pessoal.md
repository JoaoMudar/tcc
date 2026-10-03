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

### A semana, abaixo do dia (planejamento)

**Não é uma tela própria, e não há botão de escala**: a agenda da entrada da Produção mostra o dia
em cima e, logo abaixo, a semana desse dia. Clicar num dia da semana troca o dia de cima. A grade é
de computador, por RNF-14; no celular a semana vira lista por dia.

```
Semana de 10/08 a 15/08  [Aberta]      [Copiar semana passada] [Fechar a semana]

              SEG        TER        QUA        QUI        SEX
              7  9  11 7  9  11 7  9  11 7  9  11 7  9  11
Rogério      Repicagem  Repicagem  Irrigação  Semeadura  Semeadura
Amélia       Repicagem  Repicagem  Semeadura  Semeadura  Semeadura
             Ipê-amar.  Ipê-amar.  Aroeira    Aroeira    Aroeira
             2026-0147  2026-0147  --         --         --
             M+T        M          M 7h-8h    M+T        M

Jaison       Separação  Entrega    Adubação   Adubação   Separação
             Ped. #124  Blumenau   --         --         Ped. #131
             M          M+T        M          M          M+T
```

Rogério e Amélia aparecem **na mesma célula** de segunda e terça: é uma tarefa com duas pessoas,
não duas tarefas. A irrigação de quarta mostra `M 7h-8h`: tem turno **e** hora. As demais mostram
só o turno, porque é só isso que têm.

Rogério e Amélia aparecem **na mesma célula** de segunda e terça: é uma tarefa com duas pessoas,
não duas tarefas.

**A grade mostra de segunda a sexta.** O sábado quase sempre fica vazio, e uma coluna vazia rouba
largura das cinco que se usam de verdade. Ele não deixou de existir: continua no formulário e na
lista do celular, e quando a semana tem tarefa nele a grade lista essas tarefas logo abaixo, cada
uma com o atalho para a ficha.

**Na tela de computador a semana é uma linha do tempo por pessoa.** Cada dia é um eixo de hora de
verdade, mas só da jornada: o almoço não ocupa largura e vira um divisor fino entre manhã e tarde
(a tarefa que o atravessa segue inteira por cima dele). Uma linha clara marca cada hora, e o
cabeçalho numera só as pares; os turnos e os horários deles estão na linha da jornada, acima da
grade. **O dia sob o mouse cresce** depois de uma pausa curta, e os outros encolhem: nele o
cabeçalho numera todas as horas e os títulos cabem inteiros. Durante o arrasto as larguras ficam
paradas, para a posição do mouse não mudar de hora no meio do gesto.

A tarefa é uma barra com o desenho de cartão: uma faixa fina à esquerda e um fundo bem claro, os
dois com a cor da categoria, que é a única coisa que a cor diz. O que cabe no cartão depende só da
largura dele: a partir de 110 pixels, o nome em até duas linhas e o horário (ou o turno, na tarefa
sem hora); de 48 a 110, o nome numa linha, com reticências; abaixo disso, só a faixa, e o nome vai
para o lado de fora, em cinza, quando há espaço livre à direita. O nome nunca é cortado no meio da
palavra, e passar o mouse mostra nome e horário. A conclusão aparece como ícone no canto, e só
quando foge do planejado (feita, parcial, presumida ou não feita). A tarefa sem hora marcada ocupa o
turno inteiro, porque o turno é a unidade da agenda (RN-12), com a mesma borda das outras. O dia de
hoje tem fundo próprio e uma linha vermelha na hora corrente, e a pessoa sem tarefa na semana é
marcada em âmbar. No pé de cada dia, uma linha fina mostra quanto da jornada a pessoa já tem
("7h15 / 9h" no mouse), e fica em alerta quando passa dela.

A semana se monta com a mão, e não só pelo formulário. Passar o mouse num vazio mostra um "+" na faixa
de quinze minutos sob ele, e clicar em qualquer vazio da linha de uma pessoa abre o lançamento **sem perguntar dia nem turno**, porque o clique já disse os dois, e com a
pessoa já marcada. No turno livre a tarefa nasce sem hora; no turno que já tem tarefa, nasce com a
hora do pedaço livre onde se clicou (com uma tarefa das 8h às 9h, o clique à direita propõe das 9h
ao fim da manhã), e a hora pode ser mudada no formulário.

Duas tarefas ao mesmo tempo para a mesma pessoa (RF-26) não dobram a altura da linha: **no trecho em
que se cruzam, a linha se divide em duas faixas**. A principal fica com a de cima (60% da altura) e
a outra com a de baixo (40%), só com o nome; fora do cruzamento cada uma volta à altura toda. A
principal é a de maior duração, e no empate a que começa primeiro: a manhã inteira com uma tarefa
das 8h às 9h aparece como manhã em cima e a tarefa das 8h às 9h embaixo, só nesse trecho. O botão
"Tornar principal", na faixa de baixo (ou Shift e seta para cima, com o foco nela), inverte as duas,
e a escolha fica gravada. Com três ou mais ao mesmo tempo, a terceira em diante não cabe na altura e
vira um "+N" que abre a lista delas. O corte é só do desenho: os horários não mudam. A tarefa da
faixa de baixo também tem a borda para puxar, nas pontas que são dela.

Arrastar a barra de uma tarefa planejada a remarca no dia e na
hora, de quinze em quinze minutos, e puxar a borda muda quando ela começa ou termina. Perto (menos de
dez minutos) do começo ou do fim de um turno, a barra se imanta nele. Durante o gesto o lugar de
origem fica apagado e um balão acima da barra mostra o horário que ela vai ganhar e, ao passar para
a linha de outra pessoa, o nome dela. A tarefa de
um grupo aparece na linha de cada pessoa, e as cópias andam juntas durante o arrasto. A tarefa que
só mudou de dia continua sem hora. Soltar a barra na linha de outra pessoa troca quem faz: quem
estava na linha de origem sai do grupo e quem está na de destino entra (RN-61). Cada mudança
aparece na hora, com um aviso discreto que oferece desfazer por cinco segundos (Ctrl+Z faz o mesmo),
e clicar na barra abre a ficha da tarefa. A tela não traz parágrafo de instruções: o cursor de
arrastar, a borda que aparece no mouse e o "+" do vazio se explicam sozinhos, e na primeira visita
um balão aponta para um cartão uma única vez. Com o foco numa barra, Shift e as setas a remarcam, e Alt e as setas mudam a duração; fora
dela, as setas trocam de semana e a tecla T volta para hoje.

Quatro limites valem a pena dizer, porque são decisão e não falta. **Só a tarefa planejada se
arrasta**: a que já foi confirmada aconteceu, e o que aconteceu não se remaneja. A semana fechada
não se move, nem por arrasto nem por clique. Soltar a barra na linha de quem já está na tarefa é
recusado, porque não haveria quem trocar. E tirar alguém do grupo sem pôr ninguém no lugar continua
no formulário, porque o arrasto sempre leva a tarefa para alguém.

No celular a agenda vira **lista de um dia**: um seletor dos dias da semana no alto, uma seção por
pessoa, e deslizar para os lados troca o dia. A grade completa não cabe e não deve ser espremida, e
é por isso que a redução troca de desenho em vez de encolher o mesmo. Ao lado de cada tarefa fica um
quadrado de 44 pixels que **marca feito num toque** quando a confirmação não tem nada a perguntar.
A tarefa quantitativa, ou a que exige lote e ainda não o tem, leva à ficha, onde está o formulário.
O toque passa pela mesma fila do aparelho da confirmação, e sem rede fica guardado. Montar a semana
inteira é gesto de mesa, e é por isso que o arrasto existe só no computador.

Cadastrar uma tarefa são **3 toques**: pessoas, tipo de tarefa e turno. Hora, espécie, recipiente
e lote só aparecem se a tarefa tiver hora ou se o tipo de tarefa os exigir.

### A agenda do dia (confirmação)

A agenda é a **primeira aba da tela inicial da Produção**; a segunda é o mapa de produção
([`04`](04-lotes-e-canteiros.md)). São as duas perguntas que se faz ao entrar no módulo: *quem está
fazendo o quê hoje* e *como está o viveiro*. No computador a aba abre na semana, com o dia de hoje
destacado; no celular abre no dia, que é onde se confirma.

**Confirmar é marcar que foi feita**, e informar a quantidade de cada participante quando o tipo de
tarefa for quantitativo por unidade. Tarefa não quantitativa confirma sem pedir número nenhum.

**Quem confirma é a gerência.** Os seis colaboradores de campo não operam o sistema: o trabalho
deles é planejado e confirmado por quem coordena, de um aparelho só.

## O ciclo da semana

```
aberta                        ->  fechada
   |                                 |
nasce no primeiro lançamento      não se altera mais
(ou no "Copiar semana passada");  o que ficou sem confirmação entra
monta-se e a equipe trabalha      como realizado, MARCADO de não confirmado
```

**Não há abrir nem publicar.** Abrir era redundante, porque o primeiro lançamento já cria a semana,
com as tarefas recorrentes da anterior. Publicar não tinha público, porque os seis colaboradores de
campo não acessam o sistema. Sobra o ato que separa o feito do suposto, que é fechar.

**Só se fecha a semana que já terminou**, a partir da segunda-feira seguinte. Fechar assume como
feito o que não se confirmou, e a semana corrente ainda tem dia por trabalhar: fechá-la antes
daria por realizada a tarefa que nem chegou o dia de fazer.

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
| `semanas` | a semana: `inicio_semana`, `situacao` (aberta, fechada) |
| `atribuicoes` | a célula da grade: data, turno, **hora de início e fim quando a tarefa a tem**, tipo de tarefa, espécie?, recipiente?, lote?, área?, canteiro?, quantidade planejada, situação |
| `atribuicoes_participantes` | o grupo escalado, e quanto cada um fez |

**Não há entidade de apontamento.** O planejado e o confirmado moram na mesma linha, e é a
situação que distingue os dois.

Funcionário é `cadastro.pessoas` com papel `funcionario`: **não** `usuarios`. Amélia e Jaison
existem na agenda mesmo sem nunca terem feito login.

## Regras invioláveis

1. **Semana fechada não muda.** Depois de fechada, correção só por lançamento na semana seguinte.
   E só fecha depois do seu domingo.
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
