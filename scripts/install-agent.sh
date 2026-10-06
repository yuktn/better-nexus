#!/usr/bin/env bash

set -Eeuo pipefail

VERSION="${NEXUS_VERSION:-v0.1.0}"
REPO="https://github.com/yuktn/better-nexus.git"

INSTALL_DIR="/opt/better-nexus"
CONFIG_DIR="/etc/better-nexus/agent"
SERVICE_FILE="/etc/systemd/system/nexus-agent.service"
COMMAND_FILE="/usr/local/bin/nexus-agent"

NEXUS_USER="nexus"
NEXUS_GROUP="nexus"

info() {
  printf '\n\033[1;34m[nexus]\033[0m %s\n' "$1"
}

die() {
  printf '\n\033[1;31m[nexus]\033[0m %s\n' "$1" >&2
  exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
  die "Run this installer as root (for example: curl ... | sudo bash)."
fi

for command in git node npm systemctl; do
  command -v "$command" >/dev/null 2>&1 ||
    die "'$command' is required but was not found."
done

# Next.js isn't used by the agent itself, but the monorepo tooling targets
# modern Node. Keep the supported baseline simple for v0.1.
if ! node -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  process.exit(
    major > 20 || (major === 20 && minor >= 9)
      ? 0
      : 1
  );
'; then
  die "Node.js 20.9 or newer is required. Found $(node --version)."
fi

info "Installing Better Nexus Agent ${VERSION}"

# ---------------------------------------------------------------------------
# Service user
# ---------------------------------------------------------------------------

if ! getent group "$NEXUS_GROUP" >/dev/null 2>&1; then
  groupadd --system "$NEXUS_GROUP"
fi

if ! id "$NEXUS_USER" >/dev/null 2>&1; then
  useradd \
    --system \
    --gid "$NEXUS_GROUP" \
    --home-dir /var/lib/better-nexus \
    --create-home \
    --shell /usr/sbin/nologin \
    "$NEXUS_USER"
fi

# ---------------------------------------------------------------------------
# Build release
# ---------------------------------------------------------------------------

TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

info "Downloading ${VERSION}"

git clone \
  --branch "$VERSION" \
  --depth 1 \
  "$REPO" \
  "$TMP_DIR/repo"

cd "$TMP_DIR/repo"

info "Installing dependencies"
npm ci

info "Building shared package and agent"
npm run build -w shared
npm run build -w agent

# Replace only application code. Persistent configuration is in /etc.
rm -rf "$INSTALL_DIR"
mv "$TMP_DIR/repo" "$INSTALL_DIR"

chown -R root:root "$INSTALL_DIR"

# ---------------------------------------------------------------------------
# Configuration directory
# ---------------------------------------------------------------------------

mkdir -p "$CONFIG_DIR"

chown "$NEXUS_USER:$NEXUS_GROUP" "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

# ---------------------------------------------------------------------------
# nexus-agent command
# ---------------------------------------------------------------------------

cat > "$COMMAND_FILE" <<'EOF'
#!/usr/bin/env bash
set -e

cd /etc/better-nexus/agent

exec /usr/bin/node \
  /opt/better-nexus/agent/dist/cli/index.js \
  "$@"
EOF

chmod 755 "$COMMAND_FILE"

# ---------------------------------------------------------------------------
# systemd
# ---------------------------------------------------------------------------

cat > "$SERVICE_FILE" <<'EOF'
[Unit]
Description=Better Nexus Agent
Documentation=https://github.com/yuktn/better-nexus
After=network-online.target
Wants=network-online.target

[Service]
Type=simple

User=nexus
Group=nexus

WorkingDirectory=/etc/better-nexus/agent

ExecStart=/usr/local/bin/nexus-agent start

Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------

info "Agent binaries installed."

if [[ ! -f "$CONFIG_DIR/config.json" || ! -f "$CONFIG_DIR/agent.token" ]]; then
  info "Starting agent setup."

  echo
  echo "You will need:"
  echo "  1. The URL of your Nexus server"
  echo "  2. An enrollment token from 'sudo nexus-server enroll'"
  echo

  # Explicit /dev/tty makes interactive prompts work even when this installer
  # itself is executed through: curl ... | sudo bash
  "$COMMAND_FILE" setup </dev/tty >/dev/tty

  chown -R "$NEXUS_USER:$NEXUS_GROUP" "$CONFIG_DIR"
  chmod 700 "$CONFIG_DIR"

  [[ -f "$CONFIG_DIR/agent.token" ]] &&
    chmod 600 "$CONFIG_DIR/agent.token"

  [[ -f "$CONFIG_DIR/config.json" ]] &&
    chmod 600 "$CONFIG_DIR/config.json"
else
  info "Existing agent configuration found; keeping it."
fi

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------

info "Enabling Nexus Agent"
systemctl enable --now nexus-agent.service

echo
echo "Better Nexus Agent ${VERSION} installed."
echo
echo "Commands:"
echo "  nexus-agent edit"
echo "  systemctl status nexus-agent"
echo "  journalctl -u nexus-agent -f"
echo