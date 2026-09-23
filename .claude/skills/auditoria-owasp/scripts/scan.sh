#!/usr/bin/env bash
# Varredura automática OWASP. Uso: bash scan.sh <pasta-do-projeto>
# Usa apenas as ferramentas instaladas; registra as ausentes.
set -u
ALVO="${1:-.}"
OUT="$ALVO/security-scan"
mkdir -p "$OUT"
RESUMO="$OUT/resumo.txt"
: > "$RESUMO"
tem() { command -v "$1" >/dev/null 2>&1; }
log() { echo "$1" | tee -a "$RESUMO"; }

log "== Varredura em $ALVO ($(date)) =="

# SAST — Semgrep com regras OWASP Top 10 + segredos
if tem semgrep; then
  semgrep scan --config p/owasp-top-ten --config p/secrets --config p/default \
    --json --output "$OUT/semgrep.json" --quiet "$ALVO" \
    && log "[ok] semgrep -> semgrep.json" || log "[erro] semgrep"
else log "[ausente] semgrep  (pip install semgrep)"; fi

# Segredos no código e no histórico do git
if tem gitleaks; then
  gitleaks detect --source "$ALVO" --report-format json --report-path "$OUT/gitleaks.json" --no-banner --exit-code 0 \
    && log "[ok] gitleaks -> gitleaks.json" || log "[erro] gitleaks"
else log "[ausente] gitleaks (https://github.com/gitleaks/gitleaks)"; fi

# Dependências (A03)
if tem osv-scanner; then
  osv-scanner scan -r --format json "$ALVO" > "$OUT/osv.json" 2>/dev/null
  log "[ok] osv-scanner -> osv.json"
else log "[ausente] osv-scanner (https://github.com/google/osv-scanner)"; fi

if [ -f "$ALVO/package-lock.json" ] && tem npm; then
  (cd "$ALVO" && npm audit --json > security-scan/npm-audit.json 2>/dev/null); log "[ok] npm audit -> npm-audit.json"
elif [ -f "$ALVO/package.json" ]; then log "[aviso] package.json sem package-lock.json (A03)"; fi

if ls "$ALVO"/requirements*.txt >/dev/null 2>&1; then
  if tem pip-audit; then
    for f in "$ALVO"/requirements*.txt; do pip-audit -r "$f" -f json -o "$OUT/pip-audit-$(basename "$f" .txt).json" 2>/dev/null; done
    log "[ok] pip-audit"
  else log "[ausente] pip-audit (pip install pip-audit)"; fi
fi

# Arquivos .env versionados
if [ -d "$ALVO/.git" ]; then
  ENVS=$(cd "$ALVO" && git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v -E '\.example$|\.sample$' || true)
  [ -n "$ENVS" ] && log "[CRÍTICO] .env versionado: $ENVS" || log "[ok] nenhum .env versionado"
fi

log "== Fim. Confirme cada achado lendo o código antes de reportar. =="
