# Relatório de Segurança, Viveiro Mudar

**Data:** 2026-09-22 (segunda rodada) · **Commit base:** `25ad646` (branch `fix/seguranca-owasp`, com as alterações não commitadas da planilha de itens e do cadastro de cliente dentro do pedido) · **Referências:** OWASP Top 10:2025
**Stack:** TypeScript, Next.js 16.3.5 (App Router) + React 19, PostgreSQL (`pg` 8.23 local / `@neondatabase/serverless` na Vercel), Server Actions com SQL direto, sessão própria em cookie. Sem uso de LLM: o Top 10 para LLM não se aplica.

Esta rodada faz duas coisas: confere se as sete correções da primeira auditoria (commit `25ad646`) fecham o que prometem, e revisa de novo o código inteiro, incluindo o que entrou depois dela.

## 1. Resumo executivo

| Severidade | Qtd | Corrigidos |
|---|---|---|
| Crítica | 0 | 0 |
| Alta | 0 | 0 |
| Média | 5 | 4 |
| Baixa | 6 | 3 |

Os corrigidos são os sete da primeira rodada (SEC-001 a SEC-007), todos conferidos no código e nos testes. Os quatro pendentes (SEC-008 a SEC-011) são novos, e três deles são o que sobrou de correções anteriores.

**Veredito:** pode ir para produção **na Vercel** como está. Em **VPS**, só depois de SEC-008: ali o IP do cliente é forjável, e isso anula o limite de login por origem e permite trancar o escritório inteiro para fora do sistema.

**Top 3 ações imediatas:**
1. Em VPS, nunca expor o `next start` direto: nginx na frente reescrevendo `X-Forwarded-For`, e o Next ouvindo só em `127.0.0.1` (SEC-008).
2. Limitar quantas verificações de senha rodam ao mesmo tempo, para que uma rajada de logins não passe inteira pelo contador por origem (SEC-009).
3. Recusar na inicialização a `DATABASE_URL` remota com `sslmode=disable` ou `no-verify` (SEC-010).

O que continua bem: as 60 Server Actions exportadas passam por `requirePermission` (ou `requireUser`, no caso da troca de senha), inclusive as sete que entraram depois da primeira rodada (conferência, cargas e preços); toda escrita em item de pedido filtra `AND pedido_id = $1`, o que impede usar o identificador de um item de outro pedido; os identificadores interpolados no SQL (`coluna` em `travarSemana`, `colunaDocumento` em pessoas) são constantes do código, nunca entrada; o cadastro de cliente aberto de dentro do pedido reaproveita o guard de `dados_fiscais` para o CPF e o CNPJ; a foto só é servida com o tipo detectado pelos bytes, com `nosniff`.

## 2. Cobertura

| Categoria | Status | Achados |
|---|---|---|
| A01 Broken Access Control | Revisado | nenhum |
| A02 Security Misconfiguration | Revisado | SEC-001 (corrigido), SEC-008 |
| A03 Software Supply Chain Failures | Revisado | SEC-007 (corrigido) |
| A04 Cryptographic Failures | Revisado | SEC-002 (corrigido), SEC-010 |
| A05 Injection | Revisado | nenhum |
| A06 Insecure Design | Revisado | SEC-003 (corrigido), SEC-009 |
| A07 Authentication Failures | Revisado | SEC-003 (corrigido), SEC-009, SEC-011 |
| A08 Software or Data Integrity Failures | Revisado | SEC-007 (corrigido) |
| A09 Security Logging & Alerting Failures | Revisado | SEC-005 (corrigido), SEC-008 |
| A10 Mishandling of Exceptional Conditions | Revisado | SEC-004, SEC-006 (corrigidos) |
| LLM01–LLM10 | N/A | o sistema não chama modelo de linguagem |

**Ferramentas executadas:** semgrep 1.177.0 ✓ (`p/owasp-top-ten`, `p/secrets`, `p/default`, `p/typescript`, `p/react`, `p/nextjs`, `p/sql-injection`, `p/xss`; 378 arquivos, `.next/`, `node_modules/` e `docs/` excluídos) · gitleaks 8.30.1 ✓ (histórico de 96 commits e a pasta `src/`, nenhum vazamento) · osv-scanner 2.6.0 ✓ (588 pacotes do `package-lock.json`, nenhuma vulnerabilidade) · npm audit ✓ (0 em todas as severidades) · nenhum `.env` versionado (só `.env.example`, sem valor) · `npm test` ✓ (751 testes passando) · pip-audit ✗ não se aplica, sem dependência Python.

**Falsos positivos descartados:** 4, os mesmos da primeira rodada: `new RegExp` com variável em `scripts/build-b3-derivado.mjs:103` e `scripts/build-b5-matriz.mjs:204`, scripts de geração de documento que rodam na máquina do desenvolvedor sobre arquivos do próprio repositório. O semgrep também avisou erro de leitura em `scripts/scan-secrets.mjs:50` (caractere nulo dentro de uma regex, de propósito); o arquivo foi lido à mão e não tem risco.

## 3. Achados novos (ordem de severidade)

### [SEC-008] IP do cliente é forjável quando o Next recebe a conexão direto, MÉDIA · Suspeito
- **Categoria:** A02 Security Misconfiguration, A07 Authentication Failures · **CWE:** CWE-348, CWE-290
- **Local:** `src/lib/auth/client-ip.ts:10`, `package.json:9`
- **Trecho vulnerável:**
```ts
  const cadeia = forwardedFor?.split(',').map((parte) => parte.trim()).filter(Boolean) ?? [];
  const ip = cadeia.at(-1) || realIp?.trim() || null;
```
- **Por que é Suspeito:** depende de como o sistema é publicado, que não está no repositório. Na Vercel o achado não existe: a plataforma reescreve o `X-Forwarded-For`. O `CLAUDE.md` prevê também "deploy VPS/local", e é aí que ele aparece.
- **Cenário de ataque:** o Next só preenche o `X-Forwarded-For` com o IP da conexão **quando o cabeçalho não veio** (`req.headers['x-forwarded-for'] ??= socket.remoteAddress`, em `node_modules/next/dist/server/base-server.js:612`). Com `next start` exposto direto na VPS, o cabeçalho é inteiro do cliente, inclusive o último item que SEC-005 passou a ler. Duas consequências: (1) quem tenta adivinhar senha troca o `X-Forwarded-For` a cada requisição e o limite de 20 falhas por origem (SEC-003) nunca dispara; (2) quem souber o IP público do viveiro manda 20 tentativas com `X-Forwarded-For: <ip do viveiro>` e tranca por 15 minutos todo mundo que entra de lá, com a senha certa ou não. O IP gravado em `eventos_login` passa a ser o que o atacante quiser.
  Há um caso vizinho: atrás de CDN mais nginx, o último item é o IP da CDN, todas as pessoas parecem vir da mesma origem, e 20 erros somados de quem estiver usando trancam todos.
- **Correção:** o código não tem como saber o IP da conexão dentro de uma Server Action, então a correção é de publicação: garantir que o cabeçalho que chega ao Next foi escrito por um proxy seu.
  1. Na VPS, o Next só ouve na própria máquina e o nginx reescreve o cabeçalho, em vez de acrescentar:
```diff
-    "start": "next start",
+    "start": "next start -H 127.0.0.1",
```
```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  # Reescreve, não acrescenta: o que o cliente mandou é descartado
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header Host $host;
}
```
  2. Registrar isso no documento de implantação (hoje nenhum arquivo de `docs/` fala de proxy), incluindo que, se houver CDN na frente, o nginx precisa usar `real_ip_header` com a lista de IPs da CDN, e não `$remote_addr`.
- **Como verificar:** na VPS, `curl -s -H 'X-Forwarded-For: 1.2.3.4' -d ... https://<host>/login` seguido de `SELECT ip FROM eventos_login ORDER BY criado_em DESC LIMIT 1;` devolve o IP real da máquina que fez o `curl`, e não `1.2.3.4`. De fora, `curl http://<host>:3000` não conecta.
- **Status:** Pendente

### [SEC-009] Rajada simultânea de logins passa inteira pelo limite por origem, BAIXA · Confirmado
- **Categoria:** A06 Insecure Design, A07 Authentication Failures · **CWE:** CWE-367, CWE-400
- **Local:** `src/lib/auth/login.ts:51`
- **Trecho vulnerável:**
```ts
  if (input.ip) {
    const desde = new Date(input.now.getTime() - JANELA_IP_MINUTOS * 60_000);
    if ((await countRecentFailuresByIp(db, input.ip, desde)) >= MAX_FAILURES_POR_IP) {
```
- **Cenário de ataque:** a falha só é gravada em `eventos_login` depois do scrypt (cerca de 100 ms e 16 MB). Quinhentas requisições disparadas no mesmo instante leem, todas, uma contagem abaixo de 20, e as quinhentas chegam ao scrypt. O contador de SEC-003 barra o ataque em série, mas não a rajada, que é justamente a forma de esgotar CPU e memória do servidor. Na Vercel isso vira custo de execução; em VPS, lentidão para quem está em campo. Não exige conta.
- **Correção:** teto de verificações de senha simultâneas por instância, que limita o custo qualquer que seja a origem.
```ts
// src/lib/auth/password.ts
/** Verificações de senha rodando ao mesmo tempo nesta instância (SEC-009). */
export const MAX_VERIFICACOES_SIMULTANEAS = 8;
let emCurso = 0;

/** Roda a verificação se houver vaga; `null` quando o servidor já está no limite. */
export async function comVagaDeVerificacao<T>(verificar: () => Promise<T>): Promise<T | null> {
  if (emCurso >= MAX_VERIFICACOES_SIMULTANEAS) return null;
  emCurso++;
  try {
    return await verificar();
  } finally {
    emCurso--;
  }
}
```
```diff
 // src/lib/auth/login.ts
+const OCUPADO = 'O sistema está recebendo muitas entradas agora. Tente de novo em alguns segundos.';
+
   const user = await findUserForLogin(db, login);
   if (!user) {
-    await dummyVerify(input.senha);
+    if ((await comVagaDeVerificacao(() => dummyVerify(input.senha))) === null) return { ok: false, message: OCUPADO };
     await record(null, false);
     return { ok: false, message: INVALID_CREDENTIALS };
   }
 ...
-  const valid = await verifyPassword(input.senha, user.senhaHash);
+  const valid = await comVagaDeVerificacao(() => verifyPassword(input.senha, user.senhaHash));
+  if (valid === null) return { ok: false, message: OCUPADO };
```
  Com nove pessoas usando o sistema, oito verificações simultâneas nunca faltam para quem entra de verdade.
- **Como verificar:** teste em `src/lib/auth/__tests__/password.test.ts` que abre 9 chamadas de `comVagaDeVerificacao` com uma promessa que não resolve e confirma que a nona devolve `null`, e que a vaga volta depois que uma termina, inclusive quando ela lança erro.
- **Status:** Pendente

### [SEC-010] `sslmode=disable` na URL desfaz o TLS obrigatório de SEC-002, BAIXA · Suspeito
- **Categoria:** A04 Cryptographic Failures · **CWE:** CWE-319, CWE-295
- **Local:** `src/lib/db-pool.ts:21`
- **Trecho vulnerável:**
```ts
  return new PgPool(
    isLocalHost(connectionString) ? { connectionString } : { connectionString, ssl: { rejectUnauthorized: true } },
  );
```
- **Cenário de ataque:** o `pg` monta a configuração com `Object.assign({}, config, parse(connectionString))` (`node_modules/pg/lib/connection-parameters.js:60`): o que vem da URL vence o que o código passou. Medido nesta auditoria contra um host remoto: sem parâmetro, `ssl` fica `{"rejectUnauthorized":true}`, como SEC-002 quer; com `?sslmode=disable`, vira `false`; com `?sslmode=no-verify`, `{"rejectUnauthorized":false}`. Uma URL copiada de um tutorial com `sslmode=disable`, ou `no-verify` para "resolver" um erro de certificado, põe de volta a senha do banco e o CPF de `cadastro.pessoas` em texto claro, ou aceita qualquer servidor no meio do caminho. É Suspeito porque depende de alguém escrever essa URL.
- **Correção:** recusar a URL insegura em vez de confiar nela.
```diff
+/** Parâmetros de URL que desligam o TLS ou a checagem do certificado (SEC-010). */
+const SSL_INSEGURO = new Set(['disable', 'allow', 'no-verify']);
+
 export function createPool(connectionString: string | undefined): PgPool {
   if (!connectionString) {
     throw new Error('DATABASE_URL não está definida.');
   }
+  if (!isLocalHost(connectionString)) {
+    const params = new URL(connectionString).searchParams;
+    if (SSL_INSEGURO.has(params.get('sslmode') ?? '') || ['0', 'false'].includes(params.get('ssl') ?? '')) {
+      throw new Error('DATABASE_URL de banco remoto não pode desligar o TLS. Use sslmode=verify-full.');
+    }
+  }
```
- **Como verificar:** casos em `src/lib/__tests__/db-pool.test.ts` com `postgresql://u:p@db.exemplo.com/v?sslmode=disable` e `?sslmode=no-verify` esperando o erro, e `localhost` com `sslmode=disable` sendo aceito.
- **Status:** Pendente

### [SEC-011] Troca de senha testa a senha atual sem limite de tentativas, BAIXA · Confirmado
- **Categoria:** A07 Authentication Failures · **CWE:** CWE-307
- **Local:** `src/app/trocar-senha/actions.ts:27`
- **Trecho vulnerável:**
```ts
    const stored = await findPasswordHash(pool, user.usuarioId);
    if (!stored || !(await verifyPassword(atual, stored))) return { error: 'A senha atual não confere.' };
```
- **Cenário de ataque:** exige uma sessão aberta. Quem pega o celular de alguém desbloqueado, ou um cookie de sessão, usa a tela de troca como oráculo: tenta senhas no campo "senha atual" sem bloqueio de E4 A-01 e sem linha em `eventos_login`. Ao acertar, tem a senha, que continua valendo depois que a sessão for encerrada em `/conta/sessoes` e que talvez seja a mesma do e-mail da pessoa.
- **Correção:** a senha atual errada conta como falha de login do próprio usuário, com o mesmo bloqueio, e o bloqueio encerra a sessão.
```diff
+import { isLocked, registerFailure } from '@/lib/auth/lockout';
+import { endCurrentSession, requestOrigin } from '@/lib/auth/session';
+import { findUserForLogin, recordLoginEvent, saveFailure } from '@/lib/auth/user-store';
 ...
   try {
-    const stored = await findPasswordHash(pool, user.usuarioId);
-    if (!stored || !(await verifyPassword(atual, stored))) return { error: 'A senha atual não confere.' };
+    const conta = await findUserForLogin(pool, user.login);
+    const agora = new Date();
+    if (!conta || isLocked(conta.bloqueadoAte, agora)) bloqueado = true;
+    else if (!(await verifyPassword(atual, conta.senhaHash))) {
+      // Senha atual errada é tentativa de senha como qualquer outra (SEC-011)
+      const falha = registerFailure(conta.tentativas, agora);
+      await saveFailure(pool, conta.id, falha.tentativas, falha.bloqueadoAte);
+      await recordLoginEvent(pool, { usuarioId: conta.id, loginTentado: user.login, sucesso: false, ...(await requestOrigin()) });
+      if (!falha.bloqueadoAte) return { error: 'A senha atual não confere.' };
+      bloqueado = true;
+    }
+    if (!bloqueado) {
       await updatePassword(pool, user.usuarioId, await hashPassword(nova), false);
       await deleteOtherSessions(pool, user.usuarioId, user.sessaoId);
+    }
   } catch (error) {
     return { error: toUserMessage(error) };
   }
+  if (bloqueado) {
+    await endCurrentSession();
+    redirect('/login');
+  }
   redirect('/');
```
  (`let bloqueado = false;` declarado antes do `try`; o `redirect` fica fora dele porque lança de propósito, como em `login/actions.ts`.)
- **Como verificar:** teste em `src/app/trocar-senha/__tests__/actions.test.ts`, com o banco mockado, que envia cinco senhas atuais erradas e espera `saveFailure` com `bloqueadoAte` na quinta, `endCurrentSession` chamado e o redirecionamento para `/login`.
- **Status:** Pendente

## 4. Achados da primeira rodada, conferidos

Cada correção foi lida no código de `25ad646` e tem teste passando na suíte de 751.

| ID | Achado | Correção conferida | Resíduo |
|---|---|---|---|
| SEC-001 · Média | Sem cabeçalhos de segurança | `next.config.ts:4-30`: CSP com `frame-ancestors 'none'` e `form-action 'self'`, `X-Frame-Options`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`. `unsafe-eval` só em desenvolvimento. | CSP ainda aceita `'unsafe-inline'` em script (ver Melhorias) |
| SEC-002 · Média | Postgres remoto sem TLS | `src/lib/db-pool.ts:20` exige `ssl: { rejectUnauthorized: true }` fora de localhost; `isLocalHost` trata `[::1]` com colchetes, que é como o `URL` devolve o IPv6. | SEC-010 |
| SEC-003 · Média | Login sem limite por origem | `src/lib/auth/login.ts:51` conta falhas do IP antes do scrypt; índice parcial em `migrations/20260922000003`. | SEC-008, SEC-009 |
| SEC-004 · Média | Regex da lista colada com retrocesso | `src/lib/pedidos-colagem.ts`: `\s*` redundante removido e linha cortada em 200 caracteres; teste de tempo com 5.000 espaços. | nenhum |
| SEC-005 · Baixa | IP lido do começo do `X-Forwarded-For` | `src/lib/auth/client-ip.ts` lê o último item e corta em 45 caracteres. Correto na Vercel. | SEC-008 (VPS sem proxy) |
| SEC-006 · Baixa | Pedido com itens sem teto | `src/app/(sistema)/pedidos/actions.ts:31` recusa acima de 200 antes de abrir transação. | outras listas paralelas sem teto (ver Melhorias) |
| SEC-007 · Baixa | Ações do CI por tag móvel | `.github/workflows/ci.yml:31,33` fixadas por SHA. | imagem `postgres:17` ainda por tag (ver Melhorias) |

**Status:** Corrigido, os sete.

## 5. Melhorias (sem risco imediato)

- **CSP sem nonce.** `script-src 'self' 'unsafe-inline'` (`next.config.ts:7`) é o que o Next exige sem nonce, e hoje não há XSS a proteger: nenhum `dangerouslySetInnerHTML`, `innerHTML` ou `eval` no código. Mas é a linha que decide se um XSS futuro roda. O Next 16 aceita CSP com nonce gerado no `proxy.ts`, ao custo de renderizar toda página sob demanda.
- **Outras listas paralelas sem teto.** `salvarObservacoesAction`, `definirComposicaoAction`, `definirPrecosAction` e `criarCargasAction` fazem uma escrita por linha dentro da transação, como `lerItens` fazia antes de SEC-006. Todas exigem conta e o corpo da action tem 1 MB, então o risco é pequeno; aplicar o mesmo `MAX_ITENS_POR_ENVIO` deixa a regra uniforme.
- **Guard da divisão de lote aponta para o recurso vizinho.** `dividirLoteAction` (`src/app/(sistema)/producao/lotes/actions.ts:209`) confere `movimentos_lote` e não `divisao_lote`, que existe na matriz para isso. As letras coincidem hoje (gerência `C` nos dois); se a matriz mudar só em `divisao_lote`, o guard não acompanha.
- **`confirmarPedido` escreve antes de conferir o perfil** (`src/lib/pedidos.ts:541`), da rodada anterior e ainda valendo: o `DELETE` e o `UPDATE` rodam antes de `mudarSituacao`, e a recusa depende do rollback.
- **`verifyPassword` sem teto nos parâmetros gravados** (`src/lib/auth/password.ts:33`), da rodada anterior: `maxmem` de 64 MB já barra o pior caso de memória, mas um `N` alto com `r` baixo cabe no limite e demora; um teto explícito (`N` até 2^20) fecha a ponta.
- **Sessão sem prazo absoluto** (`src/lib/auth/session-config.ts:7`), da rodada anterior: 30 dias renovados no uso; um máximo de 180 dias desde a criação não atrapalha quem trabalha em campo.
- **Sem alerta sobre `eventos_login`**, da rodada anterior.
- **Imagem do CI por tag.** `postgres:17` em `.github/workflows/ci.yml:14` se move como as ações se moviam; fixar por digest (`postgres:17@sha256:...`) completa SEC-007. É o banco descartável da suíte, sem segredo, por isso fica aqui e não como achado.
- **`.next/` tem chaves de assinatura do Next**, fora do git e regeradas a cada build: não copiar a pasta entre máquinas.

## 6. Limites desta auditoria

Revisão estática do repositório, no commit `25ad646` mais as alterações não commitadas listadas no cabeçalho. Não inclui teste dinâmico contra o app rodando (OWASP ZAP ou equivalente), nem pentest humano. Não foi auditada a configuração fora do repositório: variáveis de ambiente e domínio na Vercel, a publicação em VPS (se houver, é ela que decide SEC-008), regras de rede e backup do Neon. O conteúdo de `docs/` foi excluído da varredura de código por ser prosa. A suíte `test:db` não foi executada nesta rodada; `npm test` (unitários) foi, com 751 testes passando.
