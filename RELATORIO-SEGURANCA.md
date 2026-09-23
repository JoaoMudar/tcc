# Relatório de Segurança, Viveiro Mudar

**Data:** 2026-09-23 (terceira rodada) · **Commit base:** `15b8068` (branch `fix/seguranca-owasp`, árvore limpa) · **Referências:** OWASP Top 10:2025
**Stack:** TypeScript, Next.js 16.3.5 (App Router) + React 19, PostgreSQL (`pg` 8.23 local / `@neondatabase/serverless` na Vercel), Server Actions com SQL direto, sessão própria em cookie. Sem uso de LLM: o Top 10 para LLM não se aplica.

Esta rodada revisa o código inteiro de novo, do zero, e confere as onze correções das duas rodadas anteriores (SEC-001 a SEC-011) no commit `15b8068`.

## 1. Resumo executivo

| Severidade | Qtd | Corrigidos |
|---|---|---|
| Crítica | 0 | 0 |
| Alta | 0 | 0 |
| Média | 2 | 0 |
| Baixa | 0 | 0 |

Dois achados novos, os dois Confirmados e os dois no caminho do login: SEC-012 (tentativas simultâneas furam o bloqueio de cinco erros) e SEC-013 (redirecionamento para fora do sistema pelo parâmetro `next`). Nenhum deles veio de código novo: os dois estavam lá nas rodadas anteriores e passaram. Os onze anteriores continuam corrigidos.

**Veredito:** pode ir para produção depois de corrigir SEC-012 e SEC-013. Os dois são pequenos, locais (`src/lib/auth/`) e têm teste fácil. Em VPS, continua valendo o nginx do D3 §6.1 (SEC-008).

**Top 3 ações imediatas:**
1. Reservar a tentativa de senha no banco **antes** do scrypt, com `UPDATE ... RETURNING` atômico, em vez de ler o contador, verificar e gravar `lido + 1` (SEC-012).
2. Validar o `next` com o próprio parser de URL e exigir a mesma origem, em vez de olhar só os primeiros caracteres (SEC-013).
3. Gravar o evento de login antes de contar as falhas da origem, para a contagem por IP também deixar de ter corrida (parte de SEC-012).

O que continua bem: as 60 Server Actions exportadas passam por `requirePermission` (58), `requireUser` (troca de senha) ou são públicas de propósito (`login`, `logout`); as 45 páginas chamam `requirePageAccess` ou `requireUser`; a única rota de API (`/api/fotos/[id]`) confere sessão e permissão. Toda escrita em item de pedido filtra `AND pedido_id = $1`, e a divisão em cargas recusa item de outro pedido (`validarDivisaoCargas`). Os identificadores interpolados no SQL (`coluna` em `travarSemana`, `colunaDocumento` em pessoas, `nomeEspecieSql('e')`) são constantes do código. O CPF e o CNPJ não saem do banco para a gerência, nem na busca. A foto é servida com o tipo detectado pelos bytes e `nosniff`, e `foto_url` é sempre gerada no servidor. Nenhum `dangerouslySetInnerHTML`, `eval` ou `child_process` em `src/`.

## 2. Cobertura

| Categoria | Status | Achados |
|---|---|---|
| A01 Broken Access Control | Revisado | SEC-013 |
| A02 Security Misconfiguration | Revisado | SEC-001, SEC-008 (corrigidos) |
| A03 Software Supply Chain Failures | Revisado | SEC-007 (corrigido) |
| A04 Cryptographic Failures | Revisado | SEC-002, SEC-010 (corrigidos) |
| A05 Injection | Revisado | nenhum |
| A06 Insecure Design | Revisado | SEC-012; SEC-003, SEC-009 (corrigidos) |
| A07 Authentication Failures | Revisado | SEC-012; SEC-003, SEC-009, SEC-011 (corrigidos) |
| A08 Software or Data Integrity Failures | Revisado | SEC-007 (corrigido) |
| A09 Security Logging & Alerting Failures | Revisado | SEC-005 (corrigido) |
| A10 Mishandling of Exceptional Conditions | Revisado | SEC-004, SEC-006 (corrigidos) |
| LLM01–LLM10 | N/A | o sistema não chama modelo de linguagem |

**Ferramentas executadas:** semgrep 1.177.0 ✓ (`p/owasp-top-ten`, `p/secrets`, `p/default`, `p/typescript`, `p/react`, `p/nextjs`, `p/sql-injection`, `p/xss`; 380 arquivos, `.next/`, `node_modules/` e `docs/` excluídos) · gitleaks 8.30.1 ✓ (histórico de 98 commits e a pasta `src/`, nenhum vazamento) · osv-scanner 2.6.0 ✓ (588 pacotes do `package-lock.json`, nenhuma vulnerabilidade) · npm audit ✓ (0 em todas as severidades) · nenhum `.env` versionado (só `.env.example`, sem valor) · `npm test` ✓ (772 testes em 79 arquivos) · pip-audit ✗ não se aplica, sem dependência Python.

**Falsos positivos descartados:** 4, os mesmos das rodadas anteriores: `new RegExp` com variável em `scripts/build-b3-derivado.mjs:103` e `scripts/build-b5-matriz.mjs:204` (duas regras cada), scripts de geração de documento que rodam na máquina do desenvolvedor sobre arquivos do próprio repositório. O semgrep também avisou erro de leitura em `scripts/scan-secrets.mjs:50` (caractere nulo dentro de uma regex, de propósito); o arquivo foi lido à mão e não tem risco.

## 3. Achados novos (ordem de severidade)

### [SEC-012] Tentativas simultâneas furam o bloqueio de cinco erros, MÉDIA · Confirmado
- **Categoria:** A07 Authentication Failures, A06 Insecure Design · **CWE:** CWE-362, CWE-307
- **Local:** `src/lib/auth/login.ts:68-91`, `src/lib/auth/lockout.ts:25`, `src/lib/auth/user-store.ts:46`, `src/app/trocar-senha/actions.ts:98`
- **Trecho vulnerável:**
```ts
  if (isLocked(user.bloqueadoAte, input.now)) { ... }          // lido antes do scrypt
  const valid = await comVagaDeVerificacao(() => verifyPassword(input.senha, user.senhaHash));
  ...
  if (!valid) {
    const failure = registerFailure(user.tentativas, input.now); // user.tentativas também é o valor lido lá atrás
    await saveFailure(db, user.id, failure.tentativas, failure.bloqueadoAte);
```
- **Cenário de ataque:** o contador é lido, o scrypt roda (cerca de 100 ms) e só então se grava `lido + 1`. Tentativas que chegam juntas leem todas o mesmo valor, testam todas a senha, e gravam todas o mesmo `+1`. Medido nesta auditoria com o banco simulado: **8 senhas erradas simultâneas contra uma conta testaram 8 senhas, o contador ficou em 1 e a conta não bloqueou**. Na mesma instância, o teto de SEC-009 limita a rajada a 8; na Vercel, que distribui a rajada entre várias instâncias, cada uma tem as suas 8 vagas, e a contagem por IP de SEC-003 tem a mesma corrida (conta, depois grava). O limite que o E4 A-01 promete, cinco senhas a cada 15 minutos por conta, passa a ser "cinco rajadas", sem conta aberta e sem nada de especial além de disparar as requisições em paralelo. Com a política de senha de 8 caracteres, é o que separa um ataque inviável de um que acerta senha fraca.
- **Correção:** reservar a tentativa no banco antes do scrypt, num `UPDATE` só. O Postgres trava a linha e reavalia o `WHERE` depois da trava, então de N requisições simultâneas passam exatamente as que cabem.
```ts
// src/lib/auth/user-store.ts
/**
 * Reserva uma tentativa antes do scrypt (SEC-012). O UPDATE trava a linha e
 * reavalia o WHERE: de uma rajada simultânea, só passam as que cabem no limite.
 * `null` quando a conta está bloqueada ou já gastou as tentativas.
 */
export async function reservarTentativa(db: Db, usuarioId: string, now: Date, max: number): Promise<number | null> {
  const { rows } = await db.query<{ tentativas: number }>(
    `UPDATE usuarios SET tentativas_login_falhas = tentativas_login_falhas + 1
      WHERE id = $1 AND (bloqueado_ate IS NULL OR bloqueado_ate <= $2) AND tentativas_login_falhas < $3
      RETURNING tentativas_login_falhas AS tentativas`,
    [usuarioId, now, max],
  );
  return rows[0]?.tentativas ?? null;
}

/** Devolve a tentativa reservada que não chegou a testar senha (servidor ocupado). */
export async function devolverTentativa(db: Db, usuarioId: string): Promise<void> {
  await db.query(
    'UPDATE usuarios SET tentativas_login_falhas = GREATEST(tentativas_login_falhas - 1, 0) WHERE id = $1',
    [usuarioId],
  );
}

export async function bloquear(db: Db, usuarioId: string, ate: Date): Promise<void> {
  await db.query('UPDATE usuarios SET tentativas_login_falhas = 0, bloqueado_ate = $2 WHERE id = $1', [usuarioId, ate]);
}
```
```diff
 // src/lib/auth/login.ts, depois do isLocked (que continua dando a mensagem com os minutos)
+  const reservada = await reservarTentativa(db, user.id, input.now, MAX_FAILURES);
+  if (reservada === null) {
+    await record(user.id, false);
+    return { ok: false, message: `Muitas tentativas erradas. Tente de novo em ${LOCK_MINUTES} minutos.` };
+  }
   const valid = await comVagaDeVerificacao(() => verifyPassword(input.senha, user.senhaHash));
-  if (valid === null) return { ok: false, message: OCUPADO };
+  if (valid === null) {
+    await devolverTentativa(db, user.id);
+    return { ok: false, message: OCUPADO };
+  }
 ...
   if (!valid) {
-    const failure = registerFailure(user.tentativas, input.now);
-    await saveFailure(db, user.id, failure.tentativas, failure.bloqueadoAte);
     await record(user.id, false);
-    if (failure.bloqueadoAte) {
+    if (reservada >= MAX_FAILURES) {
+      await bloquear(db, user.id, new Date(input.now.getTime() + LOCK_MINUTES * 60_000));
       return { ok: false, message: `Muitas tentativas erradas. O acesso ficou bloqueado por ${LOCK_MINUTES} minutos.` };
     }
```
  O caminho de sucesso não muda: `resetFailures` zera o que foi reservado. A troca de senha (`trocar-senha/actions.ts:98`) passa a usar o mesmo par `reservarTentativa`/`bloquear` no lugar de `registerFailure` + `saveFailure`, que saem do código.
  Para a contagem por origem, gravar o evento **antes** de contar, e contar incluindo a própria linha: a requisição que grava em k-ésimo lugar enxerga pelo menos k linhas, então no máximo 20 passam.
```diff
-  if (input.ip) {
-    const desde = ...;
-    if ((await countRecentFailuresByIp(db, input.ip, desde)) >= MAX_FAILURES_POR_IP) {
+  // Grava antes de contar: a tentativa em curso já pesa para quem vier junto (SEC-012)
+  const eventoId = await recordLoginEvent(db, { usuarioId: null, loginTentado: login.slice(0, 100), sucesso: false, ip: input.ip, agenteUsuario: input.agenteUsuario });
+  if (input.ip) {
+    const desde = ...;
+    if ((await countRecentFailuresByIp(db, input.ip, desde)) > MAX_FAILURES_POR_IP) {
```
  Com isso `recordLoginEvent` devolve o `id` (`RETURNING id`), e os demais `record(...)` viram um `UPDATE eventos_login SET usuario_id = $2, sucesso = $3 WHERE id = $1`, de modo que cada tentativa continua sendo uma linha só em `eventos_login` (RF-04).
- **Como verificar:** teste de banco em `src/lib/auth/__tests__/login.db.test.ts` (suíte `test:db`, Postgres real) que dispara 20 `attemptLogin` com senha errada em `Promise.all` contra a mesma conta e confere que no máximo 5 chegaram ao scrypt (espião em `verifyPassword`) e que `bloqueado_ate` ficou preenchido. Outro, com 40 logins inexistentes do mesmo IP em paralelo, confere que no máximo 20 receberam `INVALID_CREDENTIALS` e os demais a mensagem de "muitas tentativas deste aparelho". O teste unitário com banco mockado não serve: é o `UPDATE` do Postgres que garante a atomicidade.
- **Status:** Pendente

### [SEC-013] Tabulação no `next` do login leva para outro site, MÉDIA · Confirmado
- **Categoria:** A01 Broken Access Control · **CWE:** CWE-601
- **Local:** `src/lib/auth/route-rules.ts:12-17`, usada em `src/app/login/page.tsx:10` e `src/app/login/actions.ts:33`
- **Trecho vulnerável:**
```ts
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (isPublicPath(value.split('?')[0])) return '/';
  return value;
}
```
- **Cenário de ataque:** a checagem olha os dois primeiros caracteres, mas o navegador descarta tabulação e quebra de linha ao ler uma URL (WHATWG URL, a mesma regra do Node). `/login?next=/%09/golpe.com` chega como `"/\t/golpe.com"`, passa pela função, e o Next grava esse texto como está no cabeçalho `Location` (`node_modules/next/dist/server/app-render/app-render.js:2397`, sem codificar; o Node aceita tabulação em cabeçalho). O navegador lê `//golpe.com`. Medido nesta auditoria: `new URL("/\t/golpe.com", "https://viveiro").href` dá `https://golpe.com/`. Duas portas: quem **já está logado** e toca no link é mandado direto para fora (`login/page.tsx:12` redireciona antes de mostrar o formulário); quem não está, entra com a senha certa no sistema de verdade e cai numa cópia dizendo "senha incorreta, tente de novo", que é onde a senha é roubada. O link chega por WhatsApp, que é o canal da empresa, e começa com o endereço verdadeiro do viveiro.
- **Correção:** deixar o próprio parser de URL decidir e aceitar só o que continua na mesma origem.
```diff
+/** Origem fictícia só para o parser resolver o caminho; nunca sai daqui. */
+const ORIGEM_INTERNA = 'http://interno.invalid';
+
 export function safeNextPath(value: unknown): string {
-  if (typeof value !== 'string') return '/';
-  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
-  if (isPublicPath(value.split('?')[0])) return '/';
-  return value;
+  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
+  let url: URL;
+  try {
+    url = new URL(value, ORIGEM_INTERNA);
+  } catch {
+    return '/';
+  }
+  // O parser descarta tab e quebra de linha como o navegador: "/\t/golpe" vira "//golpe" (SEC-013)
+  if (url.origin !== ORIGEM_INTERNA) return '/';
+  if (isPublicPath(url.pathname)) return '/';
+  return url.pathname + url.search + url.hash;
 }
```
  Conferido nesta auditoria: `"/\t/golpe.com"`, `"/\n/golpe.com"` e `"//golpe.com"` viram `/`; `"/producao?semana=37"` e `"/pedidos/<id>?x=1#a"` passam iguais; `"/login?next=/x"` vira `/`.
- **Como verificar:** casos novos em `src/lib/auth/__tests__/route-rules.test.ts` com `'/\t/golpe.com'`, `'/\n/golpe.com'`, `'/\t\\golpe.com'` e `'/%09/golpe.com'` (este último deve continuar interno, porque já chega decodificado na página), todos esperando `'/'` menos o último. Com o app rodando e logado: abrir `/login?next=/%09/example.com` e confirmar que o destino é `/`.
- **Status:** Pendente

## 4. Achados das rodadas anteriores, conferidos

Cada correção foi relida no código de `15b8068` e tem teste passando na suíte de 772.

| ID | Achado | Correção conferida | Resíduo |
|---|---|---|---|
| SEC-001 · Média | Sem cabeçalhos de segurança | `next.config.ts:4-30`: CSP com `frame-ancestors 'none'` e `form-action 'self'`, `X-Frame-Options`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`. `unsafe-eval` só em desenvolvimento. | CSP ainda aceita `'unsafe-inline'` em script (ver Melhorias) |
| SEC-002 · Média | Postgres remoto sem TLS | `src/lib/db-pool.ts:40-42` exige `ssl: { rejectUnauthorized: true }` fora de localhost. | nenhum |
| SEC-003 · Média | Login sem limite por origem | `src/lib/auth/login.ts:52` conta falhas do IP antes do scrypt. | contagem com corrida (SEC-012) |
| SEC-004 · Média | Regex da lista colada com retrocesso | `src/lib/pedidos-colagem.ts`, com teste de tempo. | nenhum |
| SEC-005 · Baixa | IP lido do começo do `X-Forwarded-For` | `src/lib/auth/client-ip.ts:14` lê o último item e corta em 45 caracteres. | depende do proxy em VPS (SEC-008) |
| SEC-006 · Baixa | Pedido com itens sem teto | `src/app/(sistema)/pedidos/actions.ts:31`. | outras listas paralelas sem teto (ver Melhorias) |
| SEC-007 · Baixa | Ações do CI por tag móvel | `.github/workflows/ci.yml:31,33` por SHA. | imagem `postgres:17` por tag (ver Melhorias) |
| SEC-008 · Média | IP forjável sem proxy | `package.json:9`: `next start -H 127.0.0.1`; nginx no D3 §6.1. | conferir na VPS ao publicar |
| SEC-009 · Baixa | Rajada de logins sem teto de CPU | `src/lib/auth/password.ts:50` (`comVagaDeVerificacao`), usada no login e na troca de senha. | o teto é por instância; não limita a contagem (SEC-012) |
| SEC-010 · Baixa | `sslmode` inseguro na URL | `src/lib/db-pool.ts:109-133` recusa `disable`, `allow`, `prefer`, `no-verify` e `ssl=0/false` em host remoto. | nenhum |
| SEC-011 · Baixa | Troca de senha como oráculo | `src/app/trocar-senha/actions.ts:94-115`: senha atual errada soma no bloqueio e encerra a sessão. | mesma corrida do login (SEC-012) |

**Status:** Corrigido, os onze.

## 5. Melhorias (sem risco imediato)

- **CSP sem nonce.** `script-src 'self' 'unsafe-inline'` (`next.config.ts:7`) é o que o Next exige sem nonce, e hoje não há XSS a proteger. Mas é a linha que decide se um XSS futuro roda. O Next 16 aceita CSP com nonce gerado no `proxy.ts`, ao custo de renderizar toda página sob demanda.
- **Outras listas paralelas sem teto.** `salvarObservacoesAction`, `definirComposicaoAction`, `definirPrecosAction` e `criarCargasAction` fazem uma escrita por linha dentro da transação. Todas exigem conta e o corpo da action tem 1 MB; aplicar o mesmo `MAX_ITENS_POR_ENVIO` deixa a regra uniforme.
- **Guard da divisão de lote aponta para o recurso vizinho.** `dividirLoteAction` confere `movimentos_lote` e não `divisao_lote`. As letras coincidem hoje; se a matriz mudar só em `divisao_lote`, o guard não acompanha.
- **`confirmarPedido` escreve antes de conferir o perfil** (`src/lib/pedidos.ts:541`): o `DELETE` roda antes de `mudarSituacao`, e a recusa depende do rollback.
- **`verifyPassword` sem teto nos parâmetros gravados** (`src/lib/auth/password.ts:32`): `maxmem` de 64 MB barra o pior caso de memória, mas não o de tempo; um teto explícito (`N` até 2^20) fecha a ponta.
- **Sessão sem prazo absoluto** (`src/lib/auth/session-config.ts:7`): 30 dias renovados no uso; um máximo de 180 dias desde a criação não atrapalha quem trabalha em campo.
- **Sem alerta sobre `eventos_login`.** O registro existe; ninguém é avisado de um pico de falhas.
- **Foto servida a quem ainda está com senha provisória.** `/api/fotos/[id]` usa `getCurrentSession` e não `requireUser`, então pula a troca obrigatória (RF-02). Só expõe foto de espécie, mas é a única porta que não segue a regra.
- **CI sem `permissions:`.** `.github/workflows/ci.yml` herda a permissão padrão do repositório para o `GITHUB_TOKEN`. `permissions: contents: read` no topo do arquivo deixa explícito que a verificação só lê.
- **Imagem do CI por tag.** `postgres:17` em `.github/workflows/ci.yml:14`; fixar por digest completa SEC-007.
- **`.next/` tem chaves de assinatura do Next**, fora do git e regeradas a cada build: não copiar a pasta entre máquinas.

## 6. Limites desta auditoria

Revisão estática do repositório no commit `15b8068`. SEC-012 foi medido com banco simulado e SEC-013 com o parser de URL do Node e a leitura do código do Next; nenhum dos dois foi reproduzido contra o app rodando. Não inclui teste dinâmico (OWASP ZAP ou equivalente) nem pentest humano. Não foi auditada a configuração fora do repositório: variáveis de ambiente e domínio na Vercel, a publicação em VPS (é ela que decide SEC-008), regras de rede e backup do Neon. O conteúdo de `docs/` foi excluído da varredura de código por ser prosa. A suíte `test:db` não foi executada nesta rodada; `npm test` foi, com 772 testes passando.
