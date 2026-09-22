# Relatório de Segurança, Viveiro Mudar

**Data:** 2026-09-22 · **Commit base:** `313c12e` (branch `feat/fase-8-comercial`, com as alterações não commitadas da P9) · **Referências:** OWASP Top 10:2025
**Stack:** TypeScript, Next.js 16 (App Router) + React 19, PostgreSQL (`pg` local / `@neondatabase/serverless` na Vercel), Server Actions com SQL direto, sessão própria em cookie. Sem uso de LLM: o Top 10 para LLM não se aplica.

## 1. Resumo executivo

| Severidade | Qtd | Corrigidos |
|---|---|---|
| Crítica | 0 | 0 |
| Alta | 0 | 0 |
| Média | 4 | 0 |
| Baixa | 3 | 0 |

**Veredito:** pode ir para produção depois de resolver SEC-001 e SEC-002. Nenhum achado é explorável por quem não tem conta, e não há injeção, segredo exposto nem falha de controle de acesso.

**Top 3 ações imediatas:**
1. Adicionar cabeçalhos de segurança em `next.config.ts` (CSP, X-Frame-Options, HSTS, Referrer-Policy).
2. Garantir `sslmode=require` na `DATABASE_URL` de qualquer banco que não esteja em `localhost`, e recusar no código a conexão remota sem TLS.
3. Limitar tentativas de login por origem, além do bloqueio por usuário que já existe.

O que está bem, e não é pouco: toda Server Action passa por `requirePermission`, toda página por `requirePageAccess`, todo SQL usa parâmetro posicional, a senha usa scrypt com sal, o token de sessão só existe em resumo SHA-256 no banco, o cookie é `httpOnly` + `secure` + `sameSite=lax`, as transições de pedido travam a linha com `FOR UPDATE` e conferem o perfil no servidor, e o CI já roda varredura de segredos, lint, tipos e testes contra Postgres real.

## 2. Cobertura

| Categoria | Status | Achados |
|---|---|---|
| A01 Broken Access Control | Revisado | nenhum |
| A02 Security Misconfiguration | Revisado | SEC-001 |
| A03 Software Supply Chain Failures | Revisado | SEC-007 |
| A04 Cryptographic Failures | Revisado | SEC-002 |
| A05 Injection | Revisado | nenhum |
| A06 Insecure Design | Revisado | SEC-003 |
| A07 Authentication Failures | Revisado | SEC-003 |
| A08 Software or Data Integrity Failures | Revisado | SEC-007 |
| A09 Security Logging & Alerting Failures | Revisado | SEC-005 |
| A10 Mishandling of Exceptional Conditions | Revisado | SEC-004, SEC-006 |
| LLM01–LLM10 | N/A | o sistema não chama modelo de linguagem |

**Ferramentas executadas:** osv-scanner 2.6.0 ✓ (588 pacotes, nenhuma vulnerabilidade) · gitleaks 8.30.1 ✓ (histórico de 93 commits limpo; 14 achados na árvore de trabalho, todos dentro de `.next/`, que é gerado e ignorado pelo git) · semgrep 1.177.0 ✓ (325 regras em duas passagens: `p/typescript`, `p/javascript`, `p/react`, `p/nextjs`, `p/secrets`, `p/sql-injection`, `p/owasp-top-ten`, `p/xss`, `p/command-injection`, `p/default`) · pip-audit ✗ não se aplica, o projeto não tem dependência Python.

**Falsos positivos descartados:** 18. Os 14 do gitleaks são chaves que o próprio Next gera em `.next/` a cada build (`previewModeSigningKey`, `encryptionKey`) e não estão versionadas. Os 4 do semgrep são `new RegExp` com variável em `scripts/build-b3-derivado.mjs:103` e `scripts/build-b5-matriz.mjs:204`, scripts de geração de documento que rodam na máquina do desenvolvedor sobre arquivos do próprio repositório.

## 3. Achados (ordem de severidade)

### [SEC-001] Aplicação servida sem cabeçalhos de segurança, MÉDIA · Confirmado
- **Categoria:** A02 Security Misconfiguration · **CWE:** CWE-1021, CWE-693
- **Local:** `next.config.ts:3`
- **Trecho vulnerável:**
```ts
const nextConfig: NextConfig = {
  /* config options here */
};
```
- **Cenário de ataque:** nada impede que o sistema seja carregado num `<iframe>` invisível numa página de terceiro. A chefia autenticada clica no que acha ser outro botão e dispara um `<form>` de Server Action já montado na tela sobreposta (aprovar, cancelar ou excluir um pedido). Sem `Content-Security-Policy`, qualquer XSS que apareça mais tarde ganha liberdade total para carregar script externo e exfiltrar dados; sem `Strict-Transport-Security`, o primeiro acesso em HTTP fica exposto a interceptação.
- **Correção:**
```diff
 import type { NextConfig } from "next";

 const nextConfig: NextConfig = {
-  /* config options here */
+  async headers() {
+    return [
+      {
+        source: '/:path*',
+        headers: [
+          // O app não embute nada de fora: script e estilo próprios, imagem do próprio domínio
+          {
+            key: 'Content-Security-Policy',
+            value: [
+              "default-src 'self'",
+              "script-src 'self' 'unsafe-inline'",
+              "style-src 'self' 'unsafe-inline'",
+              "img-src 'self' data: blob:",
+              "connect-src 'self'",
+              "font-src 'self'",
+              "object-src 'none'",
+              "base-uri 'none'",
+              "form-action 'self'",
+              "frame-ancestors 'none'",
+            ].join('; '),
+          },
+          { key: 'X-Frame-Options', value: 'DENY' },
+          { key: 'X-Content-Type-Options', value: 'nosniff' },
+          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
+          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(), microphone=()' },
+          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
+        ],
+      },
+    ];
+  },
 };

 export default nextConfig;
```
Nota sobre `camera=(self)`: o formulário de espécie usa a câmera do celular pelo `<input type="file" capture>`, que não depende do Permissions-Policy, mas deixar `self` evita quebrar a tela se algum dia ela passar a usar `getUserMedia`.
- **Como verificar:** `curl -sI https://<host>/pedidos | grep -iE 'content-security|x-frame|strict-transport'` devolve as três linhas. Em desenvolvimento, `npm run build && npm start` e a aba Network do navegador mostram os cabeçalhos em cada resposta de documento.
- **Status:** Pendente

### [SEC-002] Conexão com Postgres remoto pode subir sem TLS, MÉDIA · Suspeito
- **Categoria:** A04 Cryptographic Failures · **CWE:** CWE-319
- **Local:** `src/lib/db-pool.ts:19`
- **Trecho vulnerável:**
```ts
  return new PgPool({ connectionString });
```
- **Cenário de ataque:** o `CLAUDE.md` prevê implantação em VPS, e nesse caso a `DATABASE_URL` aponta para um host que não é `*.neon.tech`, ou seja, cai neste `PgPool`. O `node-postgres` só negocia TLS se a URL trouxer `sslmode=require` (ou se `ssl` for passado): se a URL vier sem isso e o banco não estiver na mesma máquina, a senha do banco e todas as consultas, incluindo CPF e CNPJ de `cadastro.pessoas`, trafegam em texto claro pela rede. O achado é Suspeito porque depende da URL usada em produção, que não está no repositório.
- **Correção:** exigir TLS para qualquer host que não seja local, em vez de confiar na URL.
```diff
 export function createPool(connectionString: string | undefined): PgPool {
   if (!connectionString) {
     throw new Error('DATABASE_URL não está definida.');
   }
   if (isNeonHost(connectionString)) {
     neonConfig.webSocketConstructor = ws;
     // O Pool do Neon implementa a mesma interface do pg.Pool
     return new NeonPool({ connectionString }) as unknown as PgPool;
   }
-  return new PgPool({ connectionString });
+  // Banco fora da máquina exige TLS: a senha e o CPF do cadastro não andam em texto claro
+  return new PgPool(
+    isLocalHost(connectionString) ? { connectionString } : { connectionString, ssl: { rejectUnauthorized: true } },
+  );
 }
```
E em `src/lib/db-host.ts`, ao lado de `isNeonHost`:
```ts
/** Banco na própria máquina: é o único caso em que a conexão sem TLS não expõe nada na rede. */
export function isLocalHost(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}
```
- **Como verificar:** teste unitário em `src/lib/__tests__/db-host.test.ts` cobrindo `isLocalHost` para localhost, 127.0.0.1 e um host remoto. Em produção, `SELECT ssl FROM pg_stat_ssl JOIN pg_stat_activity USING (pid) WHERE pid = pg_backend_pid();` devolve `t`.
- **Status:** Pendente

### [SEC-003] Login sem limite por origem, e cada tentativa custa um scrypt, MÉDIA · Confirmado
- **Categoria:** A07 Authentication Failures, A06 Insecure Design · **CWE:** CWE-307, CWE-799
- **Local:** `src/lib/auth/login.ts:23`, `src/app/login/actions.ts:12`
- **Trecho vulnerável:**
```ts
  const user = await findUserForLogin(db, login);
  if (!user) {
    await dummyVerify(input.senha);   // scrypt N=16384, ~16 MB e ~100 ms por tentativa
    await record(null, false);
    return { ok: false, message: INVALID_CREDENTIALS };
  }
```
- **Cenário de ataque:** o bloqueio de `lockout.ts` conta falhas por usuário (5 em 15 minutos), e nada conta por origem. Um atacante sem conta testa uma senha provável contra todos os logins que adivinhar (`joao`, `debora`, `gilberto`), sem nunca chegar a cinco erros em nenhum deles. Em paralelo, cada requisição de login, mesmo com usuário inexistente, executa um scrypt de 16 MB: algumas centenas de requisições simultâneas consomem CPU e memória do servidor e derrubam o sistema para quem está em campo.
- **Correção:** contar tentativas por IP numa janela curta, antes de tocar no scrypt. O registro já existe em `eventos_login`, então dá para fazer sem tabela nova:
```ts
// src/lib/auth/lockout.ts
export const MAX_FAILURES_POR_IP = 20;
export const JANELA_IP_MINUTOS = 15;

// src/lib/auth/user-store.ts
/** Falhas recentes vindas desta origem, para barrar varredura de senha entre vários logins. */
export async function countRecentFailuresByIp(db: Db, ip: string, desde: Date): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    'SELECT COUNT(*)::int AS total FROM eventos_login WHERE ip = $1 AND NOT sucesso AND criado_em > $2',
    [ip, desde],
  );
  return rows[0].total;
}

// src/lib/auth/login.ts, no início de attemptLogin, antes de findUserForLogin
if (input.ip) {
  const desde = new Date(input.now.getTime() - JANELA_IP_MINUTOS * 60_000);
  if ((await countRecentFailuresByIp(db, input.ip, desde)) >= MAX_FAILURES_POR_IP) {
    await record(null, false);
    return { ok: false, message: `Muitas tentativas deste aparelho. Tente de novo em ${JANELA_IP_MINUTOS} minutos.` };
  }
}
```
Pede um índice, na mesma migration: `CREATE INDEX eventos_login_ip_recente ON eventos_login (ip, criado_em DESC) WHERE NOT sucesso;`
- **Como verificar:** teste em `src/lib/auth/__tests__/login.test.ts` que grava 20 falhas do mesmo IP com logins diferentes e confirma que a 21ª tentativa é recusada sem chamar `verifyPassword`. Confirmar também que o bloqueio some depois da janela.
- **Status:** Pendente

### [SEC-004] Leitor de lista colada trava a aba com texto longo, MÉDIA · Confirmado
- **Categoria:** A10 Mishandling of Exceptional Conditions · **CWE:** CWE-1333
- **Local:** `src/lib/pedidos-colagem.ts:76`
- **Trecho vulnerável:**
```ts
  const noFim = linha.match(new RegExp(`^(.+?)[\\s\\-:–—xX×]*\\s*([\\d.,]+)\\s*${SUFIXO_UNIDADE}\\s*$`, 'i'));
```
- **Cenário de ataque:** `(.+?)` preguiçoso seguido de `[\s...]*` e `\s*`, que casam a mesma coisa, faz o motor de regex tentar todas as divisões possíveis quando a linha não termina em número. Medido nesta auditoria: linha com 2.000 espaços, 1,5 s; com 4.000 espaços, 45 s. O código roda no navegador (`ColarLista.tsx` é Client Component), então quem cola do WhatsApp uma lista com uma linha de espaços longa congela o próprio celular e perde o pedido que estava digitando. Não é ataque de terceiro, é a tela travando na mão de quem trabalha, mas a causa é a mesma classe de defeito.
- **Correção:** tirar a ambiguidade e limitar o tamanho da linha.
```diff
 function separaNomeEQuantidade(linha: string): { nome: string; quantidade: number | null } {
-  const noFim = linha.match(new RegExp(`^(.+?)[\\s\\-:–—xX×]*\\s*([\\d.,]+)\\s*${SUFIXO_UNIDADE}\\s*$`, 'i'));
+  // `[\s\-:–—xX×]*` já cobre o espaço: um `\s*` a mais fazia o motor testar toda divisão possível
+  const noFim = linha.match(new RegExp(`^(.+?)[\\s\\-:–—xX×]*([\\d.,]+)\\s*${SUFIXO_UNIDADE}\\s*$`, 'i'));
```
E em `parseLinhasPedido`, um teto por linha, que é higiene de entrada e não muda nenhum caso real:
```diff
   for (const original of texto.split(/\r?\n/)) {
-    const bruta = original.trim();
+    // Nome de espécie com quantidade não passa de 200 caracteres; o resto é colagem acidental
+    const bruta = original.trim().slice(0, 200);
     if (!bruta) continue;
```
- **Como verificar:** acrescentar em `src/lib/__tests__/pedidos-colagem.test.ts` um caso com `'Ipê' + ' '.repeat(5000) + 'x'` medindo o tempo, com expectativa abaixo de 50 ms, e confirmar que os casos existentes ("Ipê amarelo 500", "2x pitanga", "500un araucária") continuam passando.
- **Status:** Pendente

### [SEC-005] Registro de acesso aceita o IP que o cliente disser, BAIXA · Confirmado
- **Categoria:** A09 Security Logging & Alerting Failures · **CWE:** CWE-348
- **Local:** `src/lib/auth/session.ts:18`
- **Trecho vulnerável:**
```ts
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    ip: forwarded || h.get('x-real-ip') || null,
```
- **Cenário de ataque:** `X-Forwarded-For` é cabeçalho de requisição, e qualquer cliente pode mandar o valor que quiser. O primeiro item da lista é justamente o que o cliente controla, não o que o proxy acrescentou. Quem tenta entrar à força envia `X-Forwarded-For: 10.0.0.1` a cada tentativa e a auditoria de acesso de RF-04 passa a apontar para uma origem inventada; a tela de sessões mostra à pessoa um IP que não é o do aparelho dela. Isso também esvazia a defesa proposta em SEC-003, que precisa de um IP confiável.
- **Correção:** ler da direita para a esquerda, descontando os proxies confiáveis. Na Vercel, o valor correto é o último item que o proxy acrescentou:
```diff
 export async function requestOrigin(): Promise<{ ip: string | null; agenteUsuario: string | null }> {
   const h = await headers();
-  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
+  // O cliente controla o começo da lista; quem o proxy viu de verdade é o último item
+  const cadeia = h.get('x-forwarded-for')?.split(',').map((parte) => parte.trim()).filter(Boolean) ?? [];
+  const forwarded = cadeia.at(-1);
   return {
     ip: forwarded || h.get('x-real-ip') || null,
```
- **Como verificar:** teste que passa `x-forwarded-for: 1.2.3.4, 200.200.200.200` e espera `200.200.200.200`. Em produção, confirmar que o IP gravado em `eventos_login` bate com o da máquina que fez o login.
- **Status:** Pendente

### [SEC-006] Pedido aceita qualquer número de itens numa transação só, BAIXA · Confirmado
- **Categoria:** A10 Mishandling of Exceptional Conditions · **CWE:** CWE-770
- **Local:** `src/app/(sistema)/pedidos/actions.ts:54`, `src/lib/pedidos.ts:305`
- **Trecho vulnerável:**
```ts
  if (itens.length === 0) return { error: 'O pedido precisa de ao menos um item.' };
  return { value: itens };
```
`inserirItens` faz um `INSERT` por item dentro da mesma transação, sem teto.
- **Cenário de ataque:** exige conta de chefia, então não é porta de fora. Um formulário montado à mão com milhares de linhas (o limite prático é o corpo de 1 MB da Server Action, o que dá muitos milhares de itens) mantém uma transação aberta com milhares de `INSERT`, segurando conexão do pool e travando quem estiver usando o sistema ao mesmo tempo.
- **Correção:**
```diff
+/** Teto do que é pedido de verdade: a maior lista já vista no viveiro tem dezenas de linhas. */
+const MAX_ITENS_POR_ENVIO = 200;
+
 function lerItens(formData: FormData): { error: string } | { value: pedidos.NovoItem[] } {
   const especies = formData.getAll('item_especie').map(String);
+  if (especies.length > MAX_ITENS_POR_ENVIO) {
+    return { error: `O pedido aceita até ${MAX_ITENS_POR_ENVIO} itens por vez. Divida em mais de um envio.` };
+  }
```
- **Como verificar:** teste em `src/app/(sistema)/pedidos/__tests__/actions.test.ts` montando um `FormData` com 201 itens e esperando a mensagem, sem chegar ao banco.
- **Status:** Pendente

### [SEC-007] Ações do CI referenciadas por tag móvel, BAIXA · Confirmado
- **Categoria:** A03 Software Supply Chain Failures, A08 Software or Data Integrity Failures · **CWE:** CWE-829
- **Local:** `.github/workflows/ci.yml:30`, `.github/workflows/ci.yml:32`
- **Trecho vulnerável:**
```yaml
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
```
- **Cenário de ataque:** `@v4` é uma tag que se move. Quem conseguir publicar na tag (comprometendo a conta da ação) passa a executar código dentro do CI deste repositório, com acesso ao token do workflow e ao código antes do merge. O risco é baixo porque são ações oficiais do GitHub, mas o custo de fixar é uma linha.
- **Correção:** fixar pelo SHA do commit, mantendo a versão no comentário.
```diff
-      - uses: actions/checkout@v4
+      - uses: actions/checkout@<sha-da-v4>  # v4
-      - uses: actions/setup-node@v4
+      - uses: actions/setup-node@<sha-da-v4>  # v4
```
Os SHA saem de `gh api repos/actions/checkout/git/ref/tags/v4 --jq .object.sha`.
- **Como verificar:** o próprio CI verde depois da alteração, e `grep -n '@v[0-9]' .github/workflows/ci.yml` sem resultado.
- **Status:** Pendente

## 4. Melhorias (sem risco imediato)

- **`confirmarPedido` escreve antes de conferir o perfil.** Em `src/lib/pedidos.ts:518`, o `DELETE` dos itens indisponíveis e o `UPDATE` dos parciais acontecem antes de `mudarSituacao`, que é quem chama `podeTransicionar`. Hoje isso não causa dano, porque tudo roda dentro de `withTransaction` e o `UserError` reverte; mas a ordem faz a permissão depender do rollback. Chamar `travarPedido` e conferir a transição logo na primeira linha deixa a regra explícita.
- **`verifyPassword` obedece aos parâmetros gravados no hash.** `src/lib/auth/password.ts:33` lê `N`, `r` e `p` da string armazenada. É o que permite endurecer o custo sem invalidar senha antiga, e é uma boa decisão; vale só somar um teto (`N` até 2^20, por exemplo) para que uma linha corrompida em `usuarios.senha_hash` não vire um scrypt impossível de terminar.
- **Sessão de 30 dias sem prazo absoluto.** `SESSION_DAYS = 30` renovado a cada uso (`src/lib/auth/session-config.ts:8`) significa que um cookie roubado vale para sempre enquanto for usado. É decisão consciente e documentada (D4 §5, quem trabalha em campo não digita senha no meio do serviço); um prazo máximo de, digamos, 180 dias desde a criação fecharia a ponta sem atrapalhar o uso.
- **Sem alerta sobre o registro de acesso.** `eventos_login` guarda tudo (RF-04) e a tela `/admin/acessos` mostra, mas ninguém é avisado. Um aviso quando um usuário passa de N falhas no dia daria valor ao que já está gravado.
- **`.next/` tem chaves de assinatura do Next.** Não estão no git e são regeradas a cada build, então não é achado. Vale só lembrar de não copiar a pasta `.next/` de uma máquina para outra nem anexá-la a nada.

## 5. Limites desta auditoria

Revisão estática do repositório, no commit `313c12e` mais as alterações não commitadas da P9. Não inclui teste dinâmico contra o app rodando (OWASP ZAP ou equivalente), nem pentest humano. Não foi auditada a configuração fora do repositório: variáveis de ambiente e domínio na Vercel, regras de rede e backup do Neon, acesso ao Postgres da VPS. O conteúdo de `docs/` foi excluído da varredura de código por ser prosa. A suíte `test:db` não foi executada nesta auditoria; as conclusões sobre comportamento vêm de leitura do código e dos testes existentes.
