# Relatório de Segurança — [Nome do projeto]

**Data:** [AAAA-MM-DD] · **Commit/versão:** [hash] · **Referências:** OWASP Top 10:2025 [+ OWASP Top 10 LLM 2025]
**Stack:** [linguagens, frameworks, banco, hospedagem]

## 1. Resumo executivo
| Severidade | Qtd | Corrigidos |
|---|---|---|
| Crítica | 0 | 0 |
| Alta | 0 | 0 |
| Média | 0 | 0 |
| Baixa | 0 | 0 |

**Veredito:** [Pode ir para produção / Só após corrigir Críticas e Altas / Não publicar]
**Top 3 ações imediatas:** 1) … 2) … 3) …

## 2. Cobertura
| Categoria | Status | Achados |
|---|---|---|
| A01 Broken Access Control | Revisado | |
| A02 Security Misconfiguration | Revisado | |
| A03 Software Supply Chain Failures | Revisado | |
| A04 Cryptographic Failures | Revisado | |
| A05 Injection | Revisado | |
| A06 Insecure Design | Revisado | |
| A07 Authentication Failures | Revisado | |
| A08 Software or Data Integrity Failures | Revisado | |
| A09 Security Logging & Alerting Failures | Revisado | |
| A10 Mishandling of Exceptional Conditions | Revisado | |
| LLM01–LLM10 (se aplicável) | Revisado / N/A | |

**Ferramentas executadas:** [semgrep ✓ / gitleaks ✗ não instalado / …] · **Falsos positivos descartados:** [n]

## 3. Achados (ordem de severidade)

### [SEC-001] [Título curto] — CRÍTICA · Confirmado
- **Categoria:** A05 Injection · **CWE:** CWE-89
- **Local:** `src/api/pedidos.py:42`
- **Trecho vulnerável:**
```
[código]
```
- **Cenário de ataque:** [1–2 frases: quem, como, o que obtém]
- **Correção:**
```diff
- [antes]
+ [depois]
```
- **Como verificar:** [teste manual ou automatizado que prova a correção]
- **Status:** Pendente

## 4. Melhorias (sem risco imediato)
- …

## 5. Limites desta auditoria
Revisão estática do repositório. Não inclui teste dinâmico (ex.: OWASP ZAP no app rodando), configuração de nuvem fora do repositório nem pentest humano.
