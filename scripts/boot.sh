#!/usr/bin/env bash
# =============================================================================
# Aura Boot — orquestrador de boot completo
#
# Fases:
#   1. Pre-flight   — ambiente, logs, PATH
#   2. Ollama       — inicia se não estiver rodando
#   3. Modelo       — puxa qwen3.5:9b se ausente
#   4. Tunel        — ngrok com URL fixa em background
#   5. Supervisor   — exec run-aura-stack (bloqueia; launchd reinicia se cair)
#
# Idempotente: pode ser chamado múltiplas vezes sem efeitos colaterais.
# Sob launchd com KeepAlive=true, todo o stack é reiniciado automaticamente
# se o supervisor cair.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/aura-common.sh
source "$SCRIPT_DIR/lib/aura-common.sh"

aura_init_environment
ensure_local_env_files
load_backend_env
load_frontend_env

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
BOOT_LOG="${AURA_LOG_DIR}/boot.log"

log_boot() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  printf '[BOOT %s] %s\n' "$ts" "$*" | tee -a "$BOOT_LOG"
}

{
  printf '\n'
  printf '=%.0s' {1..60}
  printf '\n'
  printf '  AURA BOOT  %s\n' "$(date)"
  printf '=%.0s' {1..60}
  printf '\n'
} | tee -a "$BOOT_LOG"

# ---------------------------------------------------------------------------
# Fase 1 — Validações básicas
# ---------------------------------------------------------------------------
log_boot "Repo:    $REPO_ROOT"
log_boot "Backend: $BACKEND_DIR"
log_boot "Logs:    $AURA_LOG_DIR"

for cmd in python3 pnpm node curl ollama ngrok; do
  if command -v "$cmd" >/dev/null 2>&1; then
    log_boot "  [OK] $cmd → $(command -v "$cmd")"
  else
    log_boot "  [WARN] $cmd nao encontrado — alguns servicos podem falhar"
  fi
done

# ---------------------------------------------------------------------------
# Fase 2 — Ollama
# ---------------------------------------------------------------------------
read -r OLLAMA_HOST OLLAMA_PORT < <(ollama_url_parts)
OLLAMA_HEALTH="http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags"

if check_http "$OLLAMA_HEALTH"; then
  log_boot "Ollama ja esta rodando na porta ${OLLAMA_PORT}."
else
  log_boot "Iniciando Ollama..."
  nohup "$SCRIPT_DIR/run-ollama" >> "${AURA_LOG_DIR}/ollama.log" 2>&1 &
  log_boot "Aguardando Ollama responder (60s max)..."
  if wait_for_http "Ollama" "$OLLAMA_HEALTH" 60; then
    log_boot "Ollama online."
  else
    log_boot "AVISO: Ollama nao respondeu em 60s. Continuando sem garantias de LLM."
  fi
fi

# ---------------------------------------------------------------------------
# Fase 3 — Modelo
# ---------------------------------------------------------------------------
REQUIRED_MODEL="${AURA_MODEL:-qwen3.5:9b}"

pull_model_if_missing() {
  local model="$1"
  local model_base
  # ollama list exibe "nome:tag" — normaliza para comparar
  model_base="${model%%:*}"

  if ollama list 2>/dev/null | awk 'NR>1{print $1}' | grep -q "^${model_base}"; then
    log_boot "Modelo ${model} disponivel."
    return 0
  fi

  log_boot "Modelo ${model} nao encontrado. Baixando (pode demorar)..."
  if ollama pull "$model" >> "$BOOT_LOG" 2>&1; then
    log_boot "Modelo ${model} baixado com sucesso."
  else
    log_boot "AVISO: falha ao baixar ${model}. Verifique conexao e rode: ollama pull ${model}"
  fi
}

if command -v ollama >/dev/null 2>&1; then
  pull_model_if_missing "$REQUIRED_MODEL"
fi

# ---------------------------------------------------------------------------
# Fase 4 — Tunel ngrok (background independente)
# ---------------------------------------------------------------------------
if command -v ngrok >/dev/null 2>&1; then
  # Mata instâncias anteriores para evitar duplicatas
  pkill -f "ngrok http" 2>/dev/null || true
  sleep 1

  NGROK_URL="${NGROK_URL:-https://communistical-seedier-alisia.ngrok-free.dev}"
  NGROK_DOMAIN="${NGROK_URL#https://}"
  TUNNEL_LOG="${AURA_LOG_DIR}/tunnel.log"
  TUNNEL_URL_FILE="${REPO_ROOT}/data/logs/tunnel_url.txt"

  mkdir -p "$(dirname "$TUNNEL_URL_FILE")"

  log_boot "Iniciando tunel ngrok → ${NGROK_URL}..."
  nohup ngrok http "${AURA_BACKEND_PORT:-8000}" \
    --url "$NGROK_DOMAIN" \
    --log=stdout \
    >> "$TUNNEL_LOG" 2>&1 &
  NGROK_PID=$!

  echo "$NGROK_URL" > "$TUNNEL_URL_FILE"

  sleep 3
  if kill -0 "$NGROK_PID" 2>/dev/null; then
    log_boot "Tunel ativo: ${NGROK_URL}"
  else
    log_boot "AVISO: ngrok pode ter falhado. Verifique: $TUNNEL_LOG"
  fi
else
  log_boot "ngrok nao instalado. Acesso remoto desativado."
fi

# ---------------------------------------------------------------------------
# Fase 5 — Supervisor (exec: este processo vira o run-aura-stack)
# Com KeepAlive=true no launchd, se o supervisor cair, launchd reinicia
# o boot.sh inteiro — re-verificando Ollama e modelo antes de subir.
# ---------------------------------------------------------------------------
log_boot "Entregando controle ao supervisor (run-aura-stack)..."
exec "$SCRIPT_DIR/run-aura-stack"
