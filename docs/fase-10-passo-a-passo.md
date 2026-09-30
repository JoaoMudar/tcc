# Fase 10: o que falta fazer, e como

> Escrito em 29/09/2026, junto com a branch `feat/fase-10-operar`. O código da Fase 10 que dava para
> fazer sem você está pronto e testado (ver "O que já está pronto", no fim). O que sobra depende de
> acesso seu (GitHub, Neon, Vercel), de dado real ou de gente no viveiro.
>
> Siga na ordem: o passo 1 é urgente, e os passos 2 a 4 destravam os seguintes.

---

## Passo 1. URGENTE: tirar do repositório público o quadro de funcionários

**O que acontece.** O repositório `JoaoMudar/tcc` é **público**, e o arquivo
`docs/funcionarios-viveiro-mudar.md` está no `master` desde 28/08/2026. Ele traz, com nome, a
gestação de uma funcionária, a condição de saúde de outro e avaliações pessoais ("não é astuto",
"produtividade muito baixa"). Gestação e saúde são **dado pessoal sensível** (LGPD, art. 5º, II), e
publicá-lo não tem base legal nenhuma. É o achado mais grave da revisão do T10.2, e o único que é
risco já materializado.

Não mexi nele: apagar do histórico reescreve o `master` e exige `push --force`, e isso é decisão sua.

**Como resolver (escolha uma):**

- **A. Tornar o repositório privado** (mais simples e imediato). GitHub > `JoaoMudar/tcc` > Settings >
  General > Danger Zone > Change visibility > Private. O CI continua funcionando. Se o TCC precisa do
  repositório público, faça a opção B e depois volte a publicar.
- **B. Apagar o arquivo de todo o histórico** (mantém público):
  1. Copie o arquivo para fora do repositório (ex.: sua pasta pessoal), para não perder o conteúdo.
  2. Instale o filter-repo: `pip install git-filter-repo`.
  3. Num clone novo e limpo: `git filter-repo --path docs/funcionarios-viveiro-mudar.md --invert-paths`
  4. `git remote add origin https://github.com/JoaoMudar/tcc.git` e
     `git push --force --all` e `git push --force --tags`.
  5. Tire a referência a ele do `docs/README.md` (item 3 de "Por onde começar").
  6. Peça ao suporte do GitHub a limpeza das visualizações em cache
     (https://support.github.com, "Remove sensitive data").

Em qualquer das duas, **não recoloque** o arquivo no repositório. Se ele for útil ao trabalho, deixe
só o que o sistema usa: nome, fixo ou diarista, turno. Nada de saúde, salário ou avaliação.

---

## Passo 2. Juntar as Fases 9 e 10 no `master`

O agendamento do backup **só roda a partir da branch padrão**, então o workflow novo precisa estar
no `master`.

1. A Fase 9 (`feat/fase-9-pwa`) ainda não foi mergeada, e a `feat/fase-10-operar` nasceu dela.
   Abra o PR da Fase 9 primeiro: `gh pr create --base master --head feat/fase-9-pwa`.
2. Depois do merge, abra o da Fase 10: `gh pr create --base master --head feat/fase-10-operar`.
3. Espere o check `verificar` ficar verde e faça o merge pelo GitHub.

---

## Passo 3. Configurar a cópia diária do banco (T10.1)

1. **Confira a versão do Postgres no Neon.** Console do Neon > SQL Editor > `SHOW server_version;`.
   O workflow usa `pg_dump` 17. Se aparecer 16 ou 17, está certo. Se aparecer 18, troque as duas
   ocorrências de `postgres:17` em `.github/workflows/backup.yml` por `postgres:18`.
2. **Pegue a URL de conexão direta.** Console do Neon > Connection Details > desligue "Connection
   pooling". A URL certa **não** tem `-pooler` no host. (A da Vercel tem, e o `pg_dump` não funciona
   com ela.)
3. **Gere a frase da cifra**, no terminal:
   `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
   Guarde a frase **fora do GitHub**, num gerenciador de senhas e num papel com o Gilberto. Sem ela,
   nenhuma cópia se abre, nunca.
4. **Cadastre os dois segredos**:
   ```
   gh secret set BACKUP_DATABASE_URL
   gh secret set BACKUP_PASSPHRASE
   ```
   (cada um pede o valor; cole e dê Enter). Ou pelo site: Settings > Secrets and variables > Actions.
5. **Rode uma vez à mão**: `gh workflow run Backup`, depois `gh run watch`. Os quatro passos têm de
   ficar verdes: copiar, cifrar, retenção e saldo dos lotes.
6. **Ative o aviso de falha.** GitHub > seu avatar > Settings > Notifications > Actions: marque
   "Send notifications for failed workflows only" por e-mail.

> O GitHub desliga o agendamento de repositório público depois de 60 dias sem commit. Se o projeto
> ficar parado, um commit qualquer reativa. Vale olhar a aba Actions uma vez por mês.

---

## Passo 4. A restauração cronometrada (T10.1, E6 §5)

É o que fecha o T10.1: **backup nunca restaurado não é backup.**

1. Baixe a cópia mais recente: `gh run list --workflow Backup` para pegar o número da execução, e
   `gh run download <número>`. Vem uma pasta `viveiro-AAAA-MM-DD/` com o arquivo `.dump.cifrado`.
2. Crie um banco vazio no Postgres local (PowerShell):
   ```
   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE viveiro_restaurado"
   ```
3. Restaure (PowerShell, na raiz do projeto):
   ```
   $env:BACKUP_PASSPHRASE = 'a frase do passo 3'
   $env:DESTINO_DATABASE_URL = 'postgresql://postgres:<senha>@localhost:5432/viveiro_restaurado'
   npm run backup:restaurar -- --arquivo .\viveiro-AAAA-MM-DD\viveiro-AAAA-MM-DD.dump.cifrado
   ```
   O destino vai por variável, e não por argumento, porque o npm ecoa os argumentos no terminal com a
   senha junto. O script recusa banco que não esteja vazio e recusa o banco da `DATABASE_URL`.
4. Ele imprime as contagens, se o saldo de todo lote bate com os movimentos, as migrations e **o
   tempo gasto**.
5. **Passo 4 do E6, que é de gente:** no viveiro, conte três canteiros e compare com o saldo dos
   lotes deles na cópia restaurada.
6. Anote o resultado na tabela "Registro dos testes" do
   [`E6`](engenharia/E-qualidade/E6-plano-backup-recuperacao.md) §5 (data, momento restaurado, tempo,
   resultado), e marque o T10.1 no [`P1`](../plans/P1-sistema-reduzido.md).
7. Apague o banco de ensaio: `psql -U postgres -c "DROP DATABASE viveiro_restaurado"`, e apague o
   arquivo baixado.

Repita a cada seis meses e depois de qualquer mudança de infraestrutura (E6 §5).

---

## Passo 5. Carga inicial real (T10.5)

1. Copie os modelos: `Copy-Item -Recurse scripts\carga-inicial-modelo carga-inicial`. A pasta
   `carga-inicial/` está no `.gitignore`, porque leva nome e telefone de gente.
2. Abra cada CSV no Excel e preencha. **Salve como "CSV (separado por ponto e vírgula)"**, que é o
   padrão do Excel em português. Linha começada por `#` é comentário e é ignorada.
   - `recipientes.csv`: já vem com tubete, os quatro sacos e balde. Complete o volume em litros se
     souber (com vírgula: `0,055`).
   - `canteiros.csv`: uma linha por canteiro: letra da área, nome da área (opcional), número, capacidade (opcional).
   - `especies.csv`: nome científico e nomes populares separados por vírgula, na mesma célula. O
     primeiro popular é o principal. O `docs/README.md` cita um export de 142 espécies do aplicativo
     antigo em `data/seeds/`; essa pasta não existe neste repositório, mas, se você tiver o export,
     ele vira este arquivo.
   - `funcionarios.csv`: nome, telefone (opcional) e `fixo` ou `diarista`. Só isso.
3. **Ensaie contra o banco local**: `npm run db:carga -- --pasta carga-inicial`. Ele grava, mostra
   quantos criou e quantos já existiam, e **desfaz**. Com erro, aponta arquivo e linha, e nada é gravado.
4. **Grave em produção**, com a `DATABASE_URL` apontando para o Neon (PowerShell):
   ```
   $env:DATABASE_URL = 'a URL do Neon'
   npm run db:carga -- --pasta carga-inicial
   npm run db:carga -- --pasta carga-inicial --gravar
   Remove-Item Env:DATABASE_URL
   ```
   Rodar de novo não duplica: o que já existe é pulado.
5. **Os três usuários.** Se ainda não existe admin em produção:
   `npm run db:seed-admin -- --login joao --nome "João"` (com a `DATABASE_URL` do Neon). Entre com
   ele, troque a senha, e pela tela **Usuários** crie o da chefia (Gilberto) e o da gerência
   (Débora), vinculando cada um à pessoa, se ela estiver cadastrada.
6. Tipos de tarefa já vêm da migration; turnos também (manhã 07:30 a 11:30, tarde 13:00 a 17:00):
   confira em **Configurações** se batem com o viveiro.
7. Monte pela tela os **protocolos** de cada recipiente (Cadastros > Protocolos), com a Débora.

---

## Passo 6. Decisões que ficaram para você

A revisão encontrou três pontos que mudam comportamento de tela. Não mexi porque cada um é escolha:

1. **Saída de venda no lote (RF-37).** O RF-37 pede registrar "perda, contagem física e saída de
   venda sobre o lote", mas **nenhuma tela grava a saída de venda**. A porta única aceita o
   movimento (o teste ponta a ponta o usa), falta o formulário. Hoje, quando a muda sai no
   caminhão, o saldo pronto continua contando com ela até alguém fazer uma contagem física. Opções:
   (a) um formulário "Saída de venda" na ficha do lote, igual ao de perda, sem causa; (b) deixar a
   contagem física como o jeito de acertar e registrar isso como decisão no `B2`. Recomendo a (a),
   antes de operar: sem ela, o número que o pedido lê fica errado depois da primeira entrega.
2. **Confirmação de tarefa com muita gente (RNF-01).** A tarefa quantitativa com lote mostra: lote,
   um campo por participante, "quantas morreram" e causa. Com dois participantes dá cinco; com três,
   seis, acima do limite. Opções: aceitar e registrar no `B2` que o campo por pessoa é o mesmo campo
   repetido, ou dividir em duas telas.
3. **Alvos de toque abaixo de 48 px (RNF-03)** nas telas novas do Comercial (planejar pedido e
   colagem de lista). Os formulários de campo estão todos certos. Os que ficaram pequenos:
   - `src/app/(sistema)/pedidos/planejar/[data]/RotaDaViagem.tsx`: linhas 120 (36 px), 132 e 141
     (32 px de altura, as setas de subir e descer a parada);
   - `src/app/(sistema)/pedidos/novo/ColarLista.tsx`: linhas 370 e 383 (botões em forma de link);
   - 44 px (`h-11` ou `min-h-11`): `ColarLista.tsx:451`, `src/components/pedidos/GradeItens.tsx:244`
     e `:260`, `MontarCarga.tsx:135`, `BOTAO_QUADRADO` de `CabecalhoViagem.tsx`, e `RotaDaViagem.tsx:231`.
   São telas de escritório mais que de campo; se forem usadas no galpão, trocar por `min-h-touch`.

---

## Passo 7. Executar os casos do E2 que dependem de navegador (T10.6)

A rastreabilidade está limpa (`node scripts/verifica-rastreabilidade.mjs`, em 29/09/2026). Dos 78
casos do [`E2`](engenharia/E-qualidade/E2-casos-de-teste-de-aceite.md), 57 são citados por algum teste
automático. Os que pedem gente, celular ou navegador:

| Caso | O que fazer | Onde |
|---|---|---|
| TA-01, TA-02, TA-06 | Entrar sem sessão, primeiro acesso com senha provisória, sair e tentar voltar | computador |
| TA-62 | Criar o usuário da gerência e entrar com ele | computador |
| TA-11 | Abrir a confirmação de "Irrigação" e a de "Repicar" e comparar os campos | celular |
| TA-35 | Montar o protocolo de um recipiente com duas etapas | computador |
| TA-49 | Concluir um pedido com cliente novo pelo cadastro rápido, sem sair da tela | celular |
| TA-57 | Todas as rotinas de campo no celular, sem rolagem horizontal | celular |
| TA-58 | O viveiro inteiro no mapa no computador, e em lista no celular | os dois |
| TA-69, TA-70 | Clicar e arrastar na grade da semana, publicada e fechada | computador |
| TA-71 a TA-78 | Conferência, genérico, aprovação, cargas, calendário e viagem | celular e computador |
| TA-23, TA-59 | Registrar perda em modo avião, recarregar, voltar a rede | celular |
| TA-60, TA-61 | Inspeção: bundle sem SQL nem matriz (`npm run build`), senha e sessão só em resumo no banco | computador |
| RNF-23 | Instalar pelo navegador do celular ("Adicionar à tela inicial") | celular |

Para cada um, troque "Não executado" por "Aprovado" ou "Reprovado" na coluna Situação do `E2`. Os
casos já cobertos por teste automático também podem ser marcados "Aprovado", citando o teste; o
mapa caso a caso sai de `grep -rn "TA-51" src` (troque o número).

---

## Passo 8. Avaliação de usabilidade com a chefia e a gerência (T10.7)

Siga o roteiro do [`F3`](engenharia/F-ux/F3-plano-avaliacao-usabilidade.md), com o Gilberto e a
Débora, **depois** da carga inicial (as tarefas precisam de espécie, lote e cliente de verdade) e,
de preferência, no viveiro e no celular deles. Anote tempo, erro e comentário de cada tarefa, como o
F3 pede. Os achados viram ajuste de tela ou pendência registrada.

---

## Passo 9. Fechar a fase

1. Marque no [`P1`](../plans/P1-sistema-reduzido.md) o que concluiu (T10.1, T10.5, T10.6, T10.7).
2. Avise a equipe (o LGPD pede isso, [`E5`](engenharia/E-qualidade/E5-mapeamento-lgpd.md) §2.4): os
   seis funcionários de campo precisam ser informados, **por escrito**, de que o sistema registra a
   tarefa atribuída a eles e a quantidade que fizeram, para planejar o trabalho, e não para avaliar
   ninguém, e por quanto tempo. É pendência de implantação, e não de código.
3. Atualize a linha da Fase 10 no [`EXECUTION-GUIDE`](EXECUTION-GUIDE.md).

---

## Anexo A. Revisão contra o E4 (ameaças) e o E5 (LGPD), T10.2

Conferido no código em 29/09/2026.

| Item | Controle declarado | Situação no código |
|---|---|---|
| A-01 senha fraca | política na definição, troca no primeiro acesso, 5 falhas bloqueiam 15 min | implementado (Fase 1) |
| A-02 vazamento de credencial | registro de tentativa com origem e aparelho, sessões com encerramento à distância | implementado: `eventos_login` e `sessoes` guardam IP e aparelho |
| A-03 aparelho perdido | encerrar sessão à distância; gerência sem dado fiscal | implementado |
| A-04 escalada | guard por operação no servidor | implementado, com teste estático de que toda Server Action chama o guard |
| A-05 injeção | consulta parametrizada | implementado; as duas consultas montadas com texto usam só nome validado ou constante |
| A-06 credencial no código | ambiente, varredura no pre-commit e no CI | implementado; nenhum `.env` versionado |
| A-07 interceptação | TLS, HSTS, cookie `Secure`/`HttpOnly` | implementado, com CSP e cabeçalhos em `next.config.ts` |
| A-08 dado no aparelho | fila só com pendente; sair apaga | implementado (Fase 9) |
| A-09 alteração de consolidado | semana fechada e pedido confirmado travados; saldo conferível | implementado; **a conferência do saldo passou a rodar todo dia** (T10.1) |
| A-10 perda por infraestrutura | backup e restauração | implementado em 29/09/2026; falta a primeira restauração de produção (passo 4) |
| A-11 indisponibilidade | fila local | implementado (Fase 9) |
| **Fora do E4** | documento com dado sensível de funcionário no repositório público | **aberto** (passo 1) |

**E5.** A retenção de 12 meses do registro de acesso passou a ser automática (`npm run db:retencao`,
no workflow diário), e a sessão expirada também sai. Continuam pendentes, como o E5 §3 já declara:
eliminação por prazo de cliente e de funcionário, aviso de privacidade aos titulares (o dos seis
funcionários está no passo 9), portabilidade, e a transparência do registro de acesso, parcial.

## Anexo B. Varredura dos requisitos de campo, T10.4

Automatizada em `src/app/(sistema)/producao/__tests__/requisitos-campo.test.tsx`, que roda no `npm test`:

- **Perda**: três campos (quantidade, causa, observação), causa em lista fechada, todos os alvos com 48 px.
- **Contagem**: dois campos, alvos com 48 px.
- **Confirmação de tarefa**: com lote, dois participantes e mudas mortas, cinco campos; com três
  participantes, seis (passo 6, item 2).
- **Confirmação visual**: os três mostram aviso de gravado, de guardado sem rede ou de recusa na
  mesma tela (testes da Fase 9).
- **Vocabulário do A2**: nenhum termo técnico (status, ID, null, estoque) encontrado nos textos de
  tela por busca; a conferência fina fica para a avaliação do F3 (passo 8).

## O que já está pronto

| Tarefa | O que foi feito |
|---|---|
| T10.1 | `.github/workflows/backup.yml` (cópia diária, cifrada, 30 dias, a do dia 1º por 90); `npm run backup:restaurar` cronometra a restauração; ensaiado contra o banco local em 29/09/2026 |
| T10.2 | Anexo A; retenção automática; `E5` e `E6` atualizados |
| T10.3 | `src/lib/__tests__/ponta-a-ponta.db.test.ts`: lote e perda, semana montada e fechada, pedido com saldo, sobre o mesmo lote, com a soma dos movimentos conferida a cada passo |
| T10.4 | Anexo B, com teste automático |
| T10.5 | `npm run db:carga`, modelos em `scripts/carga-inicial-modelo/`, validação igual à da tela |
| T10.6 | Rastreabilidade limpa; tabela do passo 7 |
| T10.8 | `EXECUTION-GUIDE`, `divida-tecnica` e `contexto-projeto` com o estado real |
