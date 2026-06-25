#!/usr/bin/env bash
set -euo pipefail

TOKEN="${1:-}"
if [ -z "$TOKEN" ]; then
  echo "Usage: curl -fsSL <INSTALL_SCRIPT_URL> | bash -s -- <AGENT_TOKEN>"
  exit 1
fi

BACKEND_URL="${BACKEND_URL:-${ARGUSOPS_BACKEND_URL:-http://localhost:4000}}"
BACKEND_URL="${BACKEND_URL%/}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
CONFIG_DIR="${CONFIG_DIR:-/etc/argusops}"

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

detect_home() {
  if [ -n "${HOME:-}" ]; then
    echo "$HOME"
  elif [ "$(id -u)" -eq 0 ]; then
    echo "/root"
  else
    echo "$(eval echo ~"$(id -un)")"
  fi
}

detect_pm2_bin() {
  local home_dir="$1"
  local pm2_bin=""

  if command -v pm2 >/dev/null 2>&1; then
    command -v pm2
    return 0
  fi

  if [ -d "${home_dir}/.nvm/versions/node" ]; then
    pm2_bin="$(find "${home_dir}/.nvm/versions/node" -name pm2 -type f 2>/dev/null | sort -V | tail -1 || true)"
    if [ -n "$pm2_bin" ]; then
      echo "$pm2_bin"
      return 0
    fi
  fi

  for candidate in /usr/bin/pm2 /usr/local/bin/pm2; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

build_service_path() {
  local home_dir="$1"
  local pm2_bin="${2:-}"
  local path_dirs=()

  if [ -n "$pm2_bin" ]; then
    path_dirs+=("$(dirname "$pm2_bin")")
  fi
  if command -v docker >/dev/null 2>&1; then
    path_dirs+=("$(dirname "$(command -v docker)")")
  fi

  path_dirs+=(
    /usr/local/sbin
    /usr/local/bin
    /usr/sbin
    /usr/bin
    /sbin
    /bin
    /snap/bin
  )

  local joined=""
  local seen=""
  local dir
  for dir in "${path_dirs[@]}"; do
    case ":$seen:" in
      *":$dir:"*) continue ;;
    esac
    seen="${seen:+$seen:}$dir"
    joined="${joined:+$joined:}$dir"
  done
  echo "$joined"
}

run_smoke_test() {
  local home_dir="$1"
  local pm2_bin="${2:-}"
  local service_path="$3"

  echo ""
  echo "=== Post-install smoke test ==="

  if command -v docker >/dev/null 2>&1; then
    docker_count="$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')"
    echo "Docker: OK (${docker_count} running container(s))"
  else
    echo "Docker: not installed (optional)"
  fi

  if [ -n "$pm2_bin" ] && [ -x "$pm2_bin" ]; then
    pm2_count="$(env HOME="$home_dir" PM2_HOME="${home_dir}/.pm2" PATH="$service_path" "$pm2_bin" jlist 2>/dev/null | grep -c '"name"' || true)"
    echo "PM2: OK (${pm2_count} process(es) at ${pm2_bin})"
  else
    echo "PM2: not found (optional — Docker-only servers are supported)"
  fi

  echo "Smoke test complete."
}

AGENT_HOME="$(detect_home)"
PM2_BIN=""
if PM2_BIN="$(detect_pm2_bin "$AGENT_HOME")"; then
  :
else
  PM2_BIN=""
fi
SERVICE_PATH="$(build_service_path "$AGENT_HOME" "$PM2_BIN")"

BINARY_URL="${BACKEND_URL}/agent/releases/argusops-agent"
TMP="$(mktemp)"
echo "Downloading agent from ${BINARY_URL}..."
curl -fsSL "$BINARY_URL" -o "$TMP"
chmod +x "$TMP"

if [ "$(id -u)" -eq 0 ]; then
  install -m 0755 "$TMP" "${INSTALL_DIR}/argusops-agent"
else
  mkdir -p "${HOME}/.local/bin"
  install -m 0755 "$TMP" "${HOME}/.local/bin/argusops-agent"
  INSTALL_DIR="${HOME}/.local/bin"
  CONFIG_DIR="${HOME}/.argusops"
  export PATH="${HOME}/.local/bin:${PATH}"
fi
rm -f "$TMP"

mkdir -p "$CONFIG_DIR"
export ARGUSOPS_CONFIG="${CONFIG_DIR}/config.yaml"
export BACKEND_URL
export API_URL="${API_URL:-${BACKEND_URL}/api}"
export WS_URL="${WS_URL:-${BACKEND_URL}/agent/ws}"

echo "Registering agent..."
"${INSTALL_DIR}/argusops-agent" --register --token "$TOKEN"

if command -v systemctl >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
  cat > /etc/systemd/system/argusops-agent.service <<EOF
[Unit]
Description=ArgusOps Infrastructure Agent
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=${INSTALL_DIR}/argusops-agent
Environment=ARGUSOPS_CONFIG=${CONFIG_DIR}/config.yaml
Environment=BACKEND_URL=${BACKEND_URL}
Environment=WS_URL=${WS_URL}
Environment=HOME=${AGENT_HOME}
Environment=PM2_HOME=${AGENT_HOME}/.pm2
Environment=PATH=${SERVICE_PATH}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable argusops-agent
  systemctl restart argusops-agent
  echo "Agent installed and started via systemd"
  sleep 2
  if systemctl is-active --quiet argusops-agent; then
    echo "Agent service: running"
  else
    echo "WARNING: Agent service failed to start. Check: journalctl -u argusops-agent -n 30"
  fi
else
  echo "Starting agent in background (no systemd)..."
  nohup env HOME="${AGENT_HOME}" PM2_HOME="${AGENT_HOME}/.pm2" PATH="${SERVICE_PATH}" \
    "${INSTALL_DIR}/argusops-agent" > "${CONFIG_DIR}/agent.log" 2>&1 &
  echo "Agent log: ${CONFIG_DIR}/agent.log"
fi

run_smoke_test "$AGENT_HOME" "$PM2_BIN" "$SERVICE_PATH"
echo "Done."
