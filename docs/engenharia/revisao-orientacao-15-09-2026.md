# Revisão de orientação de 15/09/2026: o que foi apontado e o que foi feito

> **Registro de uma rodada de correções.** A orientação devolveu quatorze apontamentos sobre o
> texto do trabalho. Este documento guarda cada um deles, a decisão tomada e onde a alteração caiu,
> para que a resposta ao orientador não precise ser remontada de memória.
>
> Aplicado no commit `664bd18`, na branch `docs/correcoes-orientador`.

---

## 1. Resumo

| | Quantidade |
|---|---:|
| Apontamentos recebidos | 14 |
| Resolvidos nesta rodada | 12 |
| Fora do escopo por decisão | 1 |
| Dependentes do documento no editor de texto | 1 |

O catálogo de regras de negócio passou de **54 para 52**, e foi renumerado em sequência contínua
por `scripts/renumerar.mjs`. Os identificadores citados abaixo são os **novos**, e a coluna de
origem registra o número que a regra tinha quando o orientador a leu.

---

## 2. Regras de negócio

### 2.1 RN-08: estoque por espécie contradizia a definição de produto

**Apontado:** "RN-08 você diz que o estoque é formado por espécie, mas na RN-04 fala que o produto é
a espécie com o recipiente?"

**Decisão:** trocar o sujeito do enunciado.

O apontamento está correto, e a contradição era real. RN-04 define produto como a combinação de
espécie e recipiente, e RN-08 somava lotes por espécie, o que apagava o recipiente exatamente onde
ele importa, que é no saldo oferecido ao cliente.

| | Texto |
|---|---|
| Antes | A quantidade disponível **de uma espécie** é a soma dos lotes abertos, descontadas perdas e vendas |
| Depois | A quantidade disponível **do produto, espécie e recipiente**, é a soma dos lotes abertos, descontadas perdas e vendas |

RN-04 ficou como estava. RF-43, que realiza a regra, já dizia "por espécie e recipiente", o que
confirma que a divergência era só de redação da regra.

**Onde:** `B-requisitos/B3-regras-de-negocio.md` §3.2.

### 2.2 RN-11: o limite de mortalidade parecia constante

**Apontado:** "Sugiro transformar os 20% em parâmetro, para que o usuário possa cadastrar sem
alteração do software."

**Decisão:** corrigir a redação, porque o parâmetro já existe.

Vale separar as duas coisas, porque a resposta ao orientador é mais forte do que o pedido. **O
limite já era parâmetro desde a migration `20260901000001`**, que semeia
`producao.mortalidade_limite_pct` com valor 20. O número não aparece em lugar nenhum da lógica:
`src/lib/perdas.ts` sempre lê da tabela `parametros`, e o caso de teste TA-25 altera o limite para
30% em Configurações e verifica que o alerta desaparece sem que nada no lote mude. O que estava
errado era o enunciado da regra, que cravava o número como se ele fosse a regra.

| | Texto |
|---|---|
| Antes | Acima do limite, **inicialmente 20%**, o lote é destacado |
| Depois | Acima do **limite definido em Configurações**, o lote é destacado |

A mesma correção foi aplicada aos seis pontos em prosa que repetiam o número: o verbete do
glossário em `A2`, a justificativa do lote em `A1`, a nota de RF-42 em `B2`, o fluxo alternativo de
UC-25 em `C2`, a ficha do indicador em `G2` e o exemplo do guia de elicitação. O caso de teste
TA-25 **não mudou**, de propósito, porque é ele que demonstra o que o orientador pediu.

**Onde:** `B3` §3.2, `A-fundacao/A1`, `A-fundacao/A2`, `B2`, `C-modelagem/C2`, `G-gestao/G2`,
`guia-cap-elicitacao-e-regras-de-negocio.md`.

### 2.3 RN-23 (antiga): a lista exemplificativa não nomeava as seis categorias

**Apontado:** "como plantio, manutenção e expedição não informa necessariamente todas as seis
categorias."

**Decisão:** retirar a regra inteira do catálogo.

Ao rever o enunciado, o problema mostrou-se maior do que a lista incompleta. Dizer que toda tarefa
pertence a uma de seis categorias não descreve nada que o negócio imponha, porque a categoria não
comanda formulário, não restringe operação e não altera cálculo. Ela agrupa a lista e os
relatórios, e isso é organização do requisito, não regra de negócio. Aplicado o critério da §2.1 do
próprio `B3` (apague o sistema e veja se o enunciado sobrevive), a regra não sobrevive.

A lista fechada das seis categorias **continua existindo**, no `CHECK` de
`20260901000003_cadastro_pessoas_e_tarefas.sql` e em `src/lib/tipos-tarefa.ts`. As sete citações
que apontavam para a regra passaram a apontar para **RF-21**, que é quem a realiza.

**Onde:** `B3` §3.2 (removida), `B2` §2.3, `C8`, as duas rotinas que a citavam, a migration e
`src/lib/tipos-tarefa.ts`.

### 2.4 RN-30 (antiga): o enunciado não se entendia

**Apontado:** "RN-30: não entendi."

**Decisão:** retirar do catálogo, e o conteúdo vira requisito.

A regra dizia "a situação do lote é calculada, nunca digitada". O apontamento é justo, e o motivo
está escrito no próprio documento: a §2.4 do `B3` já classificava essa regra entre as que são
convenção do projeto e não fato observado, admitindo que "derivada e nunca digitada" é decisão de
projeto. Uma regra de negócio que precisa de ressalva dizendo que não é regra de negócio está no
lugar errado.

O comportamento não mudou. Ele está em **RF-45**, que exige classificar o lote em saudável, atenção
e crítico a partir das etapas vencidas, sem que a situação seja digitada, e continua implementado
na view `situacao_lote`. As vinte citações da regra foram repontadas para RF-45.

Duas passagens em prosa foram reescritas por dependerem dela. A §2.3.1, que argumentava por que
três regras parecidas continuavam separadas, agora fala de duas e explica que a terceira saiu. A
§2.4, que listava cinco regras de convenção, lista quatro.

**Onde:** `B3` §2.3.1, §2.4 e §3.2 (removida), `B2` §2.4.3, `C6`, `C8`, `G2`, duas rotinas e três
migrations.

### 2.5 RN-41 (antiga RN-43): redação ruim, e a regra mudou junto

**Apontado:** "RN-43: precisa melhorar a redação."

**Decisão:** reescrever a regra com comportamento novo. O protocolo deixa de marcar tarefa na
agenda e passa a apresentar sugestão, e a tarefa aceita exige todas as informações.

Esta é a única alteração da rodada que muda o que o sistema faz, e não apenas como o texto o
descreve.

| | Texto |
|---|---|
| Antes | A ordem gerada pelo protocolo nasce sem responsável e fica na semana do vencimento, ou na semana aberta atual se aquela já fechou. Alterar a ordem de um dia não altera a etapa |
| Depois | O protocolo não lança tarefa na agenda: apresenta a etapa vencida como sugestão. Aceita a sugestão, a tarefa é lançada como qualquer outra, com todos os dados que o tipo exigir |

O tipo da regra passou de Restrição para Fato. A justificativa que entrou no texto é que tarefa
aparecendo sozinha na semana de alguém é tarefa sem dono, e quem monta a agenda decide em reunião.
O sistema lembra, e continua lembrando enquanto a etapa estiver vencida, mas não decide.

**O custo em código é zero**, e vale registrar por quê: o módulo de protocolo por lote ainda não
foi construído. O `C8` registra que a tabela `lotes_etapas` não existe, e a coluna
`atribuicoes.lote_etapa_id` existe sem chave estrangeira justamente à espera dela. A especificação
mudou antes da implementação, que é o momento barato de mudar.

Acompanharam a regra: **RF-47**, reescrito por inteiro; **RF-53**, que falava em cancelar ordens
geradas; os dois parágrafos de `B2` que explicavam a semana da ordem; o fluxo alternativo FA-5 e a
nota de alteração de protocolo em `C2`; a descrição de `lote_etapa_id` em `C6` e as cinco notas de
`C8`; o componente "motor do protocolo" em `D1`, cuja seta deixou de escrever na agenda e passou a
sugerir; os casos de teste TA-39 e TA-45; a rotina do protocolo; e os comentários de
`20260901000005_producao_agenda.sql`.

O rótulo da aresta entre etapa do lote e atribuição mudou de "gera ordem de" para "sugere" no `C6`
e nas três figuras de `modelo-dados-pt` que a desenham, que foram regeradas.

### 2.6 RN-05 e RN-30 (antiga RN-32): pareciam a mesma regra

**Apontado:** "RN-05 e RN-32 pareceram para mim a mesma regra, mas com descrições diferentes."

**Decisão:** as duas são distintas, e a redação de RN-05 é que as confundia. Reescrever RN-05.

As duas respondem perguntas diferentes, e a resposta ao orientador é esta:

**RN-30 responde de quem é o protocolo**, e a resposta é do recipiente. É o vasilhame que determina
o manejo, e não a espécie: o mesmo ipê em tubete e em saco 20x26 segue protocolos diferentes. É por
isso que o lote herda, ao nascer, o protocolo do recipiente dele (RF-46), e é por isso que
`protocolos.recipiente_id` existe e `especie_id` não.

**RN-05 responde onde as etapas de produção estão escritas**, e a resposta é no protocolo, e não no
cadastro da espécie nem na memória de quem trabalha. É a afirmação de que existe uma sequência
declarada, com prazo, entre o plantio e a muda pronta.

O que confundia é que RN-05 dizia "de cada espécie **e** recipiente", o que contradiz RN-30, que
atribui o protocolo só ao recipiente. Essa menção à espécie era resíduo de **RN-36**, que é outra
regra: a espécie pode sobrescrever o tempo de uma etapa específica.

| | Texto de RN-05 |
|---|---|
| Antes | As etapas de produção **de cada espécie e recipiente** ficam no protocolo de atividades |
| Depois | A produção da muda segue uma **sequência declarada de etapas com prazo**, do plantio à muda pronta |

Com isso as três ficam sem sobreposição. RN-05 afirma que a sequência existe, RN-30 diz de quem ela
é, e RN-36 é a exceção que permite à espécie mudar um prazo.

**Onde:** `B3` §3.1.

---

## 3. Requisitos funcionais

### 3.1 RF-07 e RF-25: "deveria" no lugar de "deve"

**Apontado:** "RF-07 e RF-25 trocar deveria por deve."

**Decisão:** trocar.

O apontamento é procedente, e a inconsistência era mais estranha do que parecia. Eram os **únicos
dois enunciados em 58** redigidos com "deveria". Todos os demais requisitos de prioridade *deveria
ter*, RF-04 entre eles, já usavam "deve" no enunciado e deixavam a prioridade para a coluna MoSCoW,
que é onde ela pertence. A troca restaura o padrão do documento, e a prioridade dos dois continua
marcada como `DV`.

**Onde:** `B2` §2.1 e §2.3.

### 3.2 RF-01: rastreabilidade incorreta

**Apontado:** "RF-01 fala sobre autenticação, mas está relacionado RN-53 e RN-54, na minha opinião
está incorreto."

**Decisão:** o apontamento está certo. Desfazer os dois vínculos.

Os três enunciados tratam de coisas diferentes, e a confusão vinha de todos morarem na mesma tela.

| Identificador | Do que trata | Quem o realiza |
|---|---|---|
| RF-01 | **Autenticação**: provar quem é antes de conceder acesso | ninguém, é o próprio requisito |
| RN-51 (antiga RN-53) | **Autorização**: o perfil define o que se pode ver e fazer | RF-05 e RF-06 |
| RN-52 (antiga RN-54) | **Autoria**: todo registro guarda quem o fez | RF-04 |

As duas regras **pressupõem** a autenticação, porque não se registra autor sem saber quem está
logado, mas pressupor não é originar. RF-01 é política de segurança do projeto, e o viveiro não
tinha acesso a controlar antes do sistema. Ele passou para a lista de requisitos funcionais sem
regra de negócio, na §6.1 do `B3`, que foi de três para quatro entradas, com a justificativa
escrita por extenso.

**Onde:** `B3` §3.5 e §6.1.

---

## 4. O documento no editor de texto

### 4.1 Numeração que saltava de 4.3 para 3.5

**Apontado:** "No capítulo 4, você enumera 4.1, 4.2, 4.3 e depois 3.5 e 3.6."

**Decisão:** corrigir no gerador, e não à mão.

A causa é mecânica, e valia descobri-la antes de renumerar nada. O `scripts/build-word.mjs`
substituía apenas o título de nível 1 de cada artefato, e copiava os subtítulos literalmente. Como
cada artefato numera as próprias seções a partir de 1, o "3.5 Área E" que aparecia depois de "4.3
Regras de negócio" era a seção 3.5 **do artefato de regras**, e não do Capítulo 3. O mesmo defeito
existia em todas as dez seções, e não só naquela.

O gerador agora subordina a numeração interna à da seção: "3.5 Área E" sai como "4.3.3.5 Área E".
As remissões em prosa acompanham, e as que apontam para outro artefato não, porque vêm precedidas
de crase ou do parêntese que fecha o link, e é esse o critério que as separa.

Um segundo defeito apareceu no caminho. As seções montadas de vários artefatos, que são 4.4, 4.6 e
4.7, exibiam a numeração reiniciada a cada fonte: a 4.7 tinha quatro seções "4.7.1" seguidas. O
gerador passou a deslocar a contagem, e a segunda fonte continua de onde a primeira parou.

**Onde:** `scripts/build-word.mjs`, e a pasta gerada inteira.

### 4.2 Elementos pré-textuais

**Apontado:** "Quando iniciamos a orientação solicitei para deixar a parte inicial (agradecimento,
epígrafe, etc) prontos."

**Decisão:** escrever, como artefato versionado.

O repositório não tinha nenhum elemento pré-textual, porque o documento final vive fora dele.
Criado `tcc-pre-textuais.md`, com dedicatória, agradecimentos e epígrafe escritos, mais duas opções
de epígrafe com a justificativa de qual conversa com qual capítulo. **Os nomes próprios ficaram
entre colchetes**, e precisam ser preenchidos: o repositório não registra o nome do orientador, dos
membros da banca nem do curso, e inventá-los seria pior do que deixar a lacuna visível.

O artefato entra no gerador como os outros, e sai em `word/00-pre-textuais.md`.

### 4.3 Quebras de página e a página 16 em branco

**Apontado:** "Use também, sempre que possível, a opção de quebrar página" e "Pg 16 está em
branco".

**Decisão:** escrever o procedimento no guia de montagem, porque o documento não está versionado.

O guia ganhou uma seção cobrindo três coisas. A primeira é que toda separação entre elementos é
quebra de página, e nunca linha em branco, com a lista dos onze elementos que abrem página própria.
A segunda é que, onde a numeração vira de romana para arábica, a quebra é de seção e não de página,
e o vínculo com o cabeçalho anterior precisa ser desligado antes de reiniciar a contagem.

A terceira é a página em branco, com as três causas e como distinguir uma da outra ligando as
marcas de formatação. A mais provável no caso apontado é a quebra dupla, que é quebra de página
inserida onde já havia quebra de seção, porque é o que acontece ao colar conteúdo vindo da pasta
gerada: o Markdown traz o próprio espaço entre seções e o editor soma o dele.

**Onde:** a seção "Montagem no Word" de `word/00-como-montar.md`, gerada por `build-word.mjs`.

---

## 5. O que não foi feito, e por quê

### 5.1 Referências mais recentes

**Apontado:** "(Elmasri; Navathe, 2011), (Sommerville, 2011), (Humble; Farley, 2010), (Nielsen,
1993). tem que referências mais recentes, sugiro troca."

**Decisão do aluno: não fazer nada nesta rodada.**

Fica registrado o levantamento, para quando a decisão for revista. As citações no corpo dos
artefatos somam cerca de trinta, e trocar a edição muda o ano em todas elas. Duas observações
valem para a próxima rodada.

A primeira é que os cinco atributos de usabilidade que o `F3` usa vêm de *Usability Engineering*,
de 1993. Trocar a fonte por uma obra recente do mesmo autor descaracteriza o instrumento, porque a
obra recente não traz os cinco atributos na forma em que o plano os aplica. O caminho defensável
seria manter a obra de 1993 como origem dos atributos e acrescentar um autor recente ao lado.

A segunda é que **Humble e Farley não aparecem em nenhum artefato do repositório**. A varredura
cobriu documentação, scripts e código, e não retornou nenhuma ocorrência. Se o Capítulo 2 os cita,
essa citação não tem lastro em nada do Capítulo 4, e a tabela de fundamentação por artefato do
`00-indice.md` não a registra. Isso é uma lacuna independente da troca de edição, e continua
aberta.

### 5.2 O parágrafo final que cita 20%

**Apontado:** "teu último parágrafo escrito também cita 20%."

Os pontos em prosa dentro do repositório foram corrigidos, e estão listados na seção 2.2 acima. O
parágrafo a que o apontamento se refere está no documento final, que não é versionado aqui, e
precisa ser ajustado à mão com a mesma redação: o limite mora em Configurações, e vale 20% na
instalação.

---

## 6. Pendências abertas que esta rodada revelou

- **Os comentários de coluna gravados no banco divergem dos arquivos.** As migrations tiveram os
  identificadores de regra corrigidos no texto, mas `COMMENT ON` já aplicado só muda com migration
  nova. Atinge a view `situacao_lote`, a tabela de recipientes e três parâmetros. Nada funcional
  depende disso, e a correção cabe junto da próxima migration que tocar essas tabelas. Registrado
  em [`divida-tecnica.md`](../divida-tecnica.md).
- **`scripts/renumerar.mjs` não varre `src/`.** Os seis identificadores citados em comentários de
  código foram corrigidos à mão nesta rodada, e a próxima renumeração vai precisar da mesma
  correção manual.
- **`scripts/renumerar.mjs` corrompe `scripts/scan-secrets.mjs`.** Ao reescrever o arquivo, o
  sentinela que ele usa apaga o byte nulo da comparação que detecta arquivo binário, e a varredura
  de segredos passa a tratar todo arquivo como binário, deixando de encontrar qualquer coisa. O
  arquivo foi restaurado nesta rodada, e o defeito do script continua.
- **`tcc-implantacao-e-validacao.md` é artefato órfão.** Nenhum arranjo de `build-word.mjs` o
  consome, e ele não chega à pasta gerada. Pelo conteúdo, o destino natural é a seção 4.8.

---

## 7. Como conferir

```
node scripts/verifica-rastreabilidade.mjs   # nenhuma citação órfã
node scripts/confere-modelo-pt.mjs          # figuras e C6 desenham o mesmo modelo
npm run lint && npm test                    # 378 testes
```
