# OWASP Top 10 para Aplicações LLM (2025) — usar quando o app chama Claude ou outro LLM

| ID | Risco | O que procurar no código | Correção |
|---|---|---|---|
| LLM01 | Prompt Injection | Texto do usuário, páginas web, PDFs ou e-mails concatenados no prompt sem separação; LLM com ferramentas agindo sobre conteúdo externo | Separar instruções de dados, tratar conteúdo externo como não confiável, confirmação humana para ações |
| LLM02 | Vazamento de informação sensível | Dados de clientes ou segredos enviados ao modelo sem necessidade | Minimizar dados no prompt; mascarar PII; nunca pôr chaves no prompt |
| LLM03 | Supply chain | Modelos, plugins ou MCP servers de origem duvidosa | Fontes oficiais, versões fixadas |
| LLM04 | Envenenamento de dados/modelo | Base de RAG alimentada por usuários sem moderação | Controlar quem escreve na base |
| LLM05 | Tratamento inadequado da saída | Saída do LLM indo para innerHTML, SQL, shell, eval, URLs ou markdown com imagens remotas | Tratar saída do LLM como entrada de usuário (A05): escapar, validar schema, allowlist |
| LLM06 | Agência excessiva | Ferramentas com permissões amplas (apagar, pagar, enviar e-mail) sem aprovação | Menor privilégio; só-leitura por padrão; confirmação humana |
| LLM07 | Vazamento do system prompt | Regras de autorização ou segredos dentro do system prompt | Autorização no código, não no prompt; segredos fora dele |
| LLM08 | Fraquezas em vetores/embeddings | RAG multiusuário sem filtro por dono do documento | Filtrar busca vetorial por usuário/tenant |
| LLM09 | Desinformação | Resposta usada como fato em decisão (preço, jurídico) sem verificação | Citações, validação, revisão humana |
| LLM10 | Consumo ilimitado | Endpoint que chama o LLM sem auth, rate limit ou max_tokens | Auth + rate limit por usuário + limite de tokens + teto de gasto |

**Sempre Crítico**: chave da API do LLM no front-end (JS do navegador, app mobile, artifact publicado). A chamada ao modelo deve passar por backend.
