---
name: auditoria-owasp
description: Audita código contra o OWASP Top 10:2025 (e o OWASP Top 10 para LLM quando o app usa IA) e entrega um relatório de reparos priorizado com correções prontas. Use SEMPRE que o usuário pedir "auditoria de segurança", "revisar segurança", "OWASP", "vulnerabilidades", "está seguro?", "pentest do código", "relatório de reparos", antes de publicar/deploy de um app, ou ao terminar um app gerado com Claude — mesmo que não cite OWASP.
---

# Auditoria OWASP → Relatório de Reparos

Objetivo: varrer TODO o código do projeto contra os maiores riscos OWASP e devolver um relatório acionável, com cada achado ligado a arquivo:linha, severidade e a correção pronta.

## Fluxo (siga na ordem)

### 1. Mapear o projeto
- Liste a árvore de arquivos (ignore node_modules, .venv, dist, build, .git).
- Identifique: linguagens, frameworks, manifestos de dependência (package.json, requirements.txt, pyproject.toml, lockfiles), arquivos de config (.env*, docker*, CI em .github/workflows), rotas/endpoints, camada de dados (SQL, ORM, Supabase/Firebase), autenticação.
- Detecte se o app chama um LLM (anthropic, openai, fetch para /v1/messages, langchain etc.). Se sim, ative também `references/owasp-llm-top10.md`.
- Registre as **fronteiras de confiança**: onde entra dado do usuário (forms, query params, headers, uploads, webhooks, saída de LLM) e onde ele chega (banco, shell, HTML, filesystem, URLs externas).

### 2. Varredura automática (se houver shell)
Rode `bash scripts/scan.sh <pasta-do-projeto>`. Ele usa o que estiver instalado (Semgrep com regras OWASP, Gitleaks, OSV-Scanner / npm audit / pip-audit) e salva saídas em `./security-scan/`. Ferramenta ausente = registre "não executado" no relatório; não invente resultado.
Trate achados automáticos como **candidatos**: confirme cada um lendo o código antes de reportar (descarte falsos positivos e diga quantos descartou).

### 3. Revisão manual por categoria
Percorra `references/owasp-top10-2025.md` categoria por categoria (A01→A10). Para cada uma: aplique as buscas sugeridas, leia o código encontrado, siga o fluxo do dado da entrada até o destino. A revisão manual é obrigatória — ferramentas não pegam controle de acesso quebrado nem falhas de design.

Regras de qualidade:
- Só reporte o que você consegue apontar em arquivo:linha com cenário de exploração plausível.
- Diferencie **Confirmado** (caminho explorável visível) de **Suspeito** (depende de config/contexto que você não vê).
- Não reporte estilo, nem "boa prática" sem risco concreto — isso vai para "Melhorias" no fim.

### 4. Severidade
- **Crítica**: exploração remota sem autenticação levando a vazamento de dados, execução de código ou tomada de conta (ex.: SQLi, segredo exposto no repo, IDOR em dados de clientes, RLS desligado no Supabase).
- **Alta**: exige conta comum ou condição simples; impacto relevante.
- **Média**: exige condições específicas ou impacto limitado.
- **Baixa**: endurecimento / defesa em profundidade.

### 5. Relatório
Preencha `assets/relatorio-template.md` e salve como `RELATORIO-SEGURANCA.md` na raiz do projeto (ou entregue como arquivo no chat). Ordene achados por severidade. Cada achado DEVE ter: ID, categoria OWASP, CWE, arquivo:linha, trecho vulnerável, cenário de ataque em 1–2 frases, correção com código pronto (diff ou bloco "antes/depois") e como testar que foi corrigido.

### 6. Aplicar reparos (só se o usuário pedir)
Por padrão, NÃO altere código — entregue o relatório. Se o usuário pedir para corrigir: corrija na ordem Crítica→Baixa, um achado por commit/alteração, rode os testes existentes e reexecute o scan para confirmar. Atualize o status no relatório (Corrigido / Pendente / Aceito como risco).

## Limites (diga isso no relatório)
Revisão estática não substitui teste dinâmico (OWASP ZAP contra o app rodando) nem pentest humano para apps com dados sensíveis ou pagamentos. Config de nuvem/infra que não está no repositório não foi auditada.
