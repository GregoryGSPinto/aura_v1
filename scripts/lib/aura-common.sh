#!/usr/bin/env bash

if [[ -n "${AURA_COMMON_SH_LOADED:-}" ]]; then
  return 0
fi
readonly AURA_COMMON_SH_LOADED=1

readonly AURA_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT="$(cd "${AURA_SCRIPT_DIR}/.." && pwd)"
readonly BACKEND_DIR="${REPO_ROOT}/aura/backend"
readonly FRONTEND_DIR="${REPO_ROOT}/aura/frontend"
readonly AURA_HOME_DIR="${AURA_HOME_DIR:-${HOME:-$(eval echo "~$(id -un)")}/Library/Application Support/Aura}"
readonly AURA_RUN_DIR="${AURA_RUN_DIR:-${AURA_HOME_DIR}/run}"
readonly AURA_LOG_DIR="${AURA_LOG_DIR:-${HOME:-$(eval echo "~$(id -un)")}/Library/Logs/Aura}"
readonly AURA_LAUNCH_AGENTS_DIR="${AURA_LAUNCH_AGENTS_DIR:-${HOME:-$(eval echo "~$(id -un)")}/Library/LaunchAgents}"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME:-}/.local/bin:${HOME:-}/bin${PATH:+:${PATH}}"

log_info() {
  printf '[INFO] %s\n' "$*"
}

log_warn() {
  printf '[WARN] %s\n' "$*" >&2
}

log_error() {
  printf '[ERROR] %s\n' "$*" >&2
}

aura_init_environment() {
  mkdir -p "$AURA_RUN_DIR" "$AURA_LOG_DIR"
}

load_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

load_backend_env() {
  load_env_file "${BACKEND_DIR}/.env"
}

load_frontend_env() {
  load_env_file "${FRONTEND_DIR}/.env.local"
}

ensure_env_file() {
  local target_file="$1"
  local template_file="$2"

  if [[ -f "$target_file" || ! -f "$template_file" ]]; then
    return 0
  fi

  cp "$template_file" "$target_file"
  log_info "Created $(basename "$target_file") from $(basename "$template_file")."
}

ensure_local_env_files() {
  ensure_env_file "${BACKEND_DIR}/.env" "${BACKEND_DIR}/.env.example"
  ensure_env_file "${FRONTEND_DIR}/.env.local" "${FRONTEND_DIR}/.env.example"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    log_error "Missing required command: $command_name"
    exit 1
  fi
}

resolve_backend_python() {
  local venv_python="${BACKEND_DIR}/.venv/bin/python"
  if [[ -x "$venv_python" ]]; then
    printf '%s\n' "$venv_python"
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    printf '%s\n' "$(command -v python3)"
    return 0
  fi

  log_error "Python 3 not found."
  exit 1
}

port_is_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1
}

listening_pids() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u
}

listening_process_table() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | tail -n +2
}

pid_command() {
  local pid="$1"
  ps -p "$pid" -o command= 2>/dev/null || true
}

pid_cwd() {
  local pid="$1"
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1
}

is_running_pid() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

pid_matches_service() {
  local pid="$1"
  local service_name="$2"
  local command cwd

  command="$(pid_command "$pid")"
  cwd="$(pid_cwd "$pid")"

  case "$service_name" in
    aura_backend)
      [[ "$command" == *"uvicorn app.main:app"* ]] && [[ "$cwd" == "$BACKEND_DIR" ]]
      ;;
    aura_frontend)
      [[ "$cwd" == "$FRONTEND_DIR" ]] && [[ "$command" == *"next"* ]]
      ;;
    aura_ollama)
      [[ "$command" == *"ollama serve"* ]]
      ;;
    aura_stack)
      [[ "$command" == *"/scripts/run-aura-stack"* ]]
      ;;
    *)
      return 1
      ;;
  esac
}

service_port_owned_by_aura() {
  local port="$1"
  local service_name="$2"
  local pid command cwd

  while read -r command pid _; do
    if pid_matches_service "$pid" "$service_name"; then
      return 0
    fi

    cwd="$(pid_cwd "$pid")"
    case "$service_name" in
      aura_ollama)
        [[ "$command" == "ollama" ]] && return 0
        ;;
      aura_backend)
        [[ "$command" == python* ]] && [[ "$cwd" == "$BACKEND_DIR" ]] && return 0
        ;;
      aura_frontend)
        [[ "$command" == node* ]] && [[ "$cwd" == "$FRONTEND_DIR" ]] && return 0
        ;;
    esac
  done < <(listening_process_table "$port")

  return 1
}

kill_pid_gracefully() {
  local pid="$1"
  if ! is_running_pid "$pid"; then
    return 0
  fi

  kill "$pid" 2>/dev/null || true
  local attempt
  for attempt in 1 2 3 4 5; do
    if ! is_running_pid "$pid"; then
      return 0
    fi
    sleep 1
  done

  kill -9 "$pid" 2>/dev/null || true
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local timeout_seconds="$3"
  local start_ts
  start_ts="$(date +%s)"

  while true; do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi

    if (( "$(date +%s)" - start_ts >= timeout_seconds )); then
      log_error "Timed out waiting for ${name} at ${url}."
      return 1
    fi

    sleep 2
  done
}

check_http() {
  local url="$1"
  curl -fsS --max-time 2 "$url" >/dev/null 2>&1
}

http_status_code() {
  local url="$1"
  curl -sS -o /dev/null -w '%{http_code}' --max-time 4 "$url" 2>/dev/null || printf '000'
}

find_free_port() {
  python3 - <<'PY'
import socket
with socket.socket() as sock:
    sock.bind(('', 0))
    print(sock.getsockname()[1])
PY
}

describe_port_owner() {
  local port="$1"
  local line
  local found=0
  while IFS= read -r line; do
    if [[ -z "$line" ]]; then
      continue
    fi
    if [[ "$found" -eq 0 ]]; then
      log_warn "Port ${port} is occupied by:"
    fi
    log_warn "  ${line}"
    found=1
  done < <(listening_process_table "$port")

  if [[ "$found" -eq 0 ]]; then
    log_warn "Port ${port} is listening but unable to identify the owner."
  fi
}

frontend_env_value() {
  local file="$1"
  local key="$2"
  if [[ ! -f "$file" ]]; then
    return 1
  fi
  local line
  line="$(grep -E "^${key}=" "$file" | tail -n1 || true)"
  if [[ -z "$line" ]]; then
    return 1
  fi
  local value="${line#*=}"
  # Trim leading/trailing whitespace
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

ensure_env_key() {
  local file="$1"
  local key="$2"
  local value="$3"
  local current
  current="$(frontend_env_value "$file" "$key" || true)"
  if [[ -n "$current" ]]; then
    return 0
  fi
  log_info "Applying local default ${key}=${value} in $(basename "$file")."
  python3 - "$file" "$key" "$value" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
text = path.read_text() if path.exists() else ""
lines = text.splitlines()
for index, line in enumerate(lines):
    if line.startswith(f"{key}="):
        current = line[len(key) + 1 :].strip()
        if current:
            raise SystemExit(0)
        lines[index] = f"{key}={value}"
        path.write_text("\n".join(lines) + ("\n" if lines else ""))
        raise SystemExit(0)
lines.append(f"{key}={value}")
path.write_text("\n".join(lines) + ("\n" if lines else ""))
PY
}

ensure_frontend_env_defaults() {
  local env_file="${FRONTEND_DIR}/.env.local"
  local aura_env
  aura_env="$(frontend_env_value "$env_file" "NEXT_PUBLIC_AURA_ENV" || true)"
  aura_env="${aura_env,,}"
  aura_env="${aura_env:-local}"
  if [[ "$aura_env" != "local" ]]; then
    return 0
  fi

  ensure_env_key "$env_file" "NEXT_PUBLIC_API_URL" "${NEXT_PUBLIC_API_URL:-http://localhost:8000/api/v1}"

  local token_value="${NEXT_PUBLIC_AURA_TOKEN:-}"
  if [[ -z "$token_value" ]]; then
    token_value="${AURA_AUTH_TOKEN:-change-me}"
  fi
  ensure_env_key "$env_file" "NEXT_PUBLIC_AURA_TOKEN" "$token_value"
}

resolve_frontend_port() {
  local preferred="$1"
  if ! port_is_listening "$preferred"; then
    printf '%s' "$preferred"
    return 0
  fi

  if service_port_owned_by_aura "$preferred" aura_frontend; then
    printf '%s' "$preferred"
    return 0
  fi

  log_warn "Port ${preferred} is occupied by another process; Aura frontend will move."
  describe_port_owner "$preferred"
  local fallback
  fallback="$(find_free_port)"
  while port_is_listening "$fallback"; do
    fallback="$(find_free_port)"
  done
  log_info "Aura frontend will bind to port ${fallback}."
  printf '%s' "$fallback"
}

ollama_url_parts() {
  local url="${OLLAMA_URL:-http://127.0.0.1:11434}"
  local stripped host port

  stripped="${url#*://}"
  stripped="${stripped%%/*}"
  host="${stripped%%:*}"
  port="${stripped##*:}"

  if [[ "$host" == "$port" ]]; then
    port="11434"
  fi

  printf '%s %s\n' "$host" "$port"
}

pidfile_path() {
  local name="$1"
  printf '%s/%s.pid\n' "$AURA_RUN_DIR" "$name"
}

read_pidfile() {
  local file="$1"
  [[ -f "$file" ]] && cat "$file"
}

write_pidfile() {
  local file="$1"
  local pid="$2"
  printf '%s\n' "$pid" >"$file"
}

remove_pidfile() {
  local file="$1"
  rm -f "$file"
}

launch_agent_label() {
  printf 'com.gregory.aura.stack\n'
}

backend_base_url() {
  local host="${AURA_BACKEND_HOST:-localhost}"
  local port="${AURA_BACKEND_PORT:-8000}"
  printf 'http://%s:%s\n' "$host" "$port"
}

frontend_base_url() {
  local host="${AURA_FRONTEND_HOST:-localhost}"
  local port="${AURA_FRONTEND_PORT:-3000}"
  printf 'http://%s:%s\n' "$host" "$port"
}
