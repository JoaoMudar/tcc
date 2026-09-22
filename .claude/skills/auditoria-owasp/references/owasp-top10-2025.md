# Checklist OWASP Top 10:2025 para revisão de código

Para cada categoria: **O que procurar** → **Buscas sugeridas** (ripgrep) → **Correção padrão**. As buscas só apontam onde olhar; confirme lendo o código.

---
## A01 — Broken Access Control (inclui SSRF, IDOR, CSRF)
**Procurar**
- Rotas/endpoints sem verificação de autenticação ou papel (admin).
- Recurso buscado por ID vindo do usuário sem checar dono (`/pedidos/:id` devolve pedido de qualquer um) — IDOR/BOLA.
- Permissão checada só no front-end (botão escondido, rota protegida só no React).
- Supabase/Firebase: tabelas sem RLS, policies `using (true)`, `service_role` key no cliente.
- CORS `*` com credenciais; forms com cookie de sessão sem proteção CSRF.
- SSRF: servidor faz fetch em URL fornecida pelo usuário.

**Buscas**: `rg -n "req\.params|request\.args|findById|\.eq\(.id"` · `rg -n "service_role|SERVICE_ROLE"` · `rg -n "Access-Control-Allow-Origin|cors\("` · `rg -n "requests\.get\(|fetch\(|axios\.get\(|urlopen"` (ver se a URL vem do usuário)

**Correção**: negar por padrão; middleware de auth em todas as rotas; filtrar sempre por `owner_id = usuário autenticado`; RLS em toda tabela; allowlist de domínios para fetch no servidor e bloqueio de IPs internos (169.254.169.254, 10/8, 127/8).

## A02 — Security Misconfiguration
**Procurar**: debug em produção, stack trace para o usuário, credenciais padrão, headers de segurança ausentes (CSP, HSTS, X-Content-Type-Options, frame-ancestors), buckets/storage públicos, parser XML com entidades externas (XXE), permissões amplas em Docker/CI.

**Buscas**: `rg -n "DEBUG\s*=\s*True|debug=True"` · `rg -n "helmet|Content-Security-Policy"` · `rg -n "public.*bucket|acl.*public"`

**Correção**: config por ambiente; helmet ou middleware equivalente; storage privado + URLs assinadas; desabilitar DTD em parsers XML.

## A03 — Software Supply Chain Failures
**Procurar**: dependências com CVE, sem lockfile, versões `*`/`latest`, pacotes abandonados ou com nome suspeito (typosquatting — atenção a pacotes que a IA "inventou"), scripts `postinstall`, GitHub Actions sem pin por SHA, imagens Docker `:latest`, scripts de CDN sem SRI.

**Buscas**: saída de `npm audit` / `pip-audit` / `osv-scanner` · `rg -n "\"latest\"|\"\*\"" package.json` · `rg -n "uses: .*@(main|master)" .github` · `rg -n "<script src=\"https?://"` (sem `integrity=`)

**Correção**: lockfile commitado; atualizar/remover vulneráveis; confirmar que todo pacote existe e é o oficial; pin por versão/SHA; SRI; Dependabot/Renovate.

## A04 — Cryptographic Failures
**Procurar**: segredos no código ou `.env` commitado (inclusive no histórico do git), senha com MD5/SHA1/SHA256 puro, `Math.random`/`random` para tokens, HTTP sem TLS, dados sensíveis em claro, JWT fraco ou `alg: none`, `verify=False`.

**Buscas**: saída do gitleaks · `rg -n -i "md5|sha1\("` · `rg -n "Math\.random|random\.random\("` · `rg -n "verify=False|rejectUnauthorized:\s*false"` · `git log --all --oneline -- .env`

**Correção**: segredos em variáveis de ambiente/secret manager e **rotacionar** toda chave que já esteve no repositório; bcrypt/argon2; `crypto.randomBytes`/`secrets`; TLS obrigatório.

## A05 — Injection (SQL, NoSQL, comando, XSS, template)
**Procurar**: SQL por concatenação/f-string; `eval`, `exec`, `new Function`; `os.system`, `shell=True`, `child_process.exec` com entrada do usuário; `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, `|safe`, `mark_safe`, `unsafe_allow_html=True`; operadores Mongo vindos do body.

**Buscas**: `rg -n "f\"SELECT|f'SELECT|execute\(.*%|\.raw\(|\+ *\"? *(WHERE|AND)"` · `rg -n "eval\(|exec\(|new Function|shell=True|child_process|os\.system"` · `rg -n "innerHTML|dangerouslySetInnerHTML|v-html|\|safe|mark_safe|unsafe_allow_html=True"`

**Correção**: queries parametrizadas/ORM; argumentos em lista, sem shell; escapar saída por contexto; sanitizar HTML (DOMPurify/bleach); validar entrada com schema (zod/pydantic).

## A06 — Insecure Design
**Procurar**: fluxos sem limite de taxa (login, reset de senha, envio de e-mail/SMS, chamadas pagas de API/LLM); lógica de negócio confiando no cliente (preço, desconto, quantidade, papel enviados pelo front); reset de senha previsível; upload sem limite; operações críticas sem idempotência.

**Buscas**: `rg -n -i "price|preco|valor|total|desconto|discount|role|is_admin"` em handlers que leem `req.body`/`request.json` · `rg -n -i "rate.?limit|throttle"`

**Correção**: recalcular valores no servidor; rate limiting; limites de tamanho/quantidade; modelagem de ameaças simples para cada fluxo crítico.

## A07 — Authentication Failures
**Procurar**: auth caseira; sem proteção contra força bruta; sessão/JWT sem expiração; token em localStorage com XSS possível; cookies sem `HttpOnly`/`Secure`/`SameSite`; mensagens que revelam se o usuário existe; logout que não invalida sessão.

**Buscas**: `rg -n "jwt\.sign|expiresIn"` · `rg -n "localStorage\.setItem\(.*(token|jwt)"` · `rg -n -i "httponly|secure:|samesite"`

**Correção**: provedor pronto (Supabase Auth, Auth.js, Clerk); expiração curta + refresh; cookies seguros; MFA para admin; mensagens genéricas.

## A08 — Software or Data Integrity Failures
**Procurar**: desserialização insegura (`pickle.loads`, `yaml.load` sem SafeLoader, `unserialize`), webhooks sem verificação de assinatura, updates sem assinatura, CI rodando código de PR externo com segredos.

**Buscas**: `rg -n "pickle\.loads|yaml\.load\(|unserialize|marshal\.loads"` · `rg -n -i "webhook"` (conferir validação HMAC) · `rg -n "pull_request_target" .github`

**Correção**: `yaml.safe_load`; JSON em vez de pickle; validar assinatura de webhooks (Stripe, Mercado Pago etc.); isolar segredos no CI.

## A09 — Security Logging & Alerting Failures
**Procurar**: sem log de login falho, mudança de permissão e ações admin; logs com senha, token, CPF ou dados pessoais (LGPD); logs sem alerta; quebras de linha do usuário gravadas direto no log.

**Buscas**: `rg -n "console\.log|print\(|logger\."` perto de `password|senha|token|cpf|authorization`

**Correção**: log estruturado de eventos de segurança; mascarar dados sensíveis; alerta para picos de falha de login e erros 5xx.

## A10 — Mishandling of Exceptional Conditions
**Procurar**: `catch {}`/`except: pass` engolindo erro; **fail-open** (erro na checagem de auth libera acesso); stack trace/SQL devolvido ao usuário; recursos não liberados; transações sem rollback; chamadas externas sem timeout.

**Buscas**: `rg -n "except:\s*$|except Exception:\s*pass|catch\s*\(\w*\)\s*\{\s*\}"` · revisar blocos try/catch dentro de middlewares de auth

**Correção**: fail-closed (erro = negar); tratar exceções específicas; mensagem genérica ao usuário e detalhe só no log; rollback e timeouts.
