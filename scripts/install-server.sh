#!/usr/bin/env bash

set -Eeuo pipefail

VERSION="${NEXUS_VERSION:-v0.1.2}"
REPO="https://github.com/yuktn/better-nexus.git"

INSTALL_DIR="/opt/better-nexus-server"

SERVER_CONFIG_DIR="/etc/better-nexus/server"
SERVER_ENV="/etc/better-nexus/server.env"
WEB_ENV="/etc/better-nexus/web.env"

SERVER_SERVICE="/etc/systemd/system/nexus-server.service"
WEB_SERVICE="/etc/systemd/system/nexus-web.service"

SERVER_COMMAND="/usr/local/bin/nexus-server"

NEXUS_USER="nexus"
NEXUS_GROUP="nexus"

MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017}"
NEXUS_SERVER_URL="${NEXUS_SERVER_URL:-http://127.0.0.1:8081}"

info() {
  printf '\n\033[1;34m[nexus]\033[0m %s\n' "$1"
}

die() {
  printf '\n\033[1;31m[nexus]\033[0m %s\n' "$1" >&2
  exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
  die "Run this installer as root."
fi

for command in git node npm systemctl runuser; do
  command -v "$command" >/dev/null 2>&1 ||
    die "'$command' is required but was not found."
done

NODE_BIN="$(command -v node)"
NPM_BIN="$(command -v npm)"

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

info "Installing Better Nexus Server ${VERSION}"

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
# Download/build
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

info "Building Better Nexus"
npm run build

info "Installing application"

rm -rf "$INSTALL_DIR"
mv "$TMP_DIR/repo" "$INSTALL_DIR"

chown -R root:root "$INSTALL_DIR"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

mkdir -p "$SERVER_CONFIG_DIR"

chown "$NEXUS_USER:$NEXUS_GROUP" "$SERVER_CONFIG_DIR"
chmod 700 "$SERVER_CONFIG_DIR"

cat > "$SERVER_ENV" <<EOF
MONGODB_URI=${MONGODB_URI}
EOF

cat > "$WEB_ENV" <<EOF
NEXUS_SERVER_URL=${NEXUS_SERVER_URL}
NODE_ENV=production
EOF

chown root:"$NEXUS_GROUP" "$SERVER_ENV" "$WEB_ENV"
chmod 640 "$SERVER_ENV" "$WEB_ENV"

# ---------------------------------------------------------------------------
# nexus-server command
# ---------------------------------------------------------------------------

cat > "$SERVER_COMMAND" <<EOF
#!/usr/bin/env bash

set -Eeuo pipefail

export NEXUS_CONFIG_DIR="${SERVER_CONFIG_DIR}"

exec "${NODE_BIN}" \
  "${INSTALL_DIR}/server/dist/cli/index.js" \
  "\$@"
EOF

chmod 755 "$SERVER_COMMAND"

# ---------------------------------------------------------------------------
# nexus-server systemd unit
# ---------------------------------------------------------------------------

cat > "$SERVER_SERVICE" <<EOF
[Unit]
Description=Better Nexus Server
Documentation=https://github.com/yuktn/better-nexus
After=network-online.target
Wants=network-online.target

[Service]
Type=simple

User=${NEXUS_USER}
Group=${NEXUS_GROUP}

WorkingDirectory=${SERVER_CONFIG_DIR}

EnvironmentFile=${SERVER_ENV}
Environment=NEXUS_CONFIG_DIR=${SERVER_CONFIG_DIR}

ExecStart=${SERVER_COMMAND} start

Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# ---------------------------------------------------------------------------
# nexus-web systemd unit
# ---------------------------------------------------------------------------

cat > "$WEB_SERVICE" <<EOF
[Unit]
Description=Better Nexus Web Dashboard
Documentation=https://github.com/yuktn/better-nexus
After=network-online.target nexus-server.service
Wants=network-online.target
Requires=nexus-server.service

[Service]
Type=simple

User=${NEXUS_USER}
Group=${NEXUS_GROUP}

WorkingDirectory=${INSTALL_DIR}/web

EnvironmentFile=${WEB_ENV}

ExecStart=${NPM_BIN} start

Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# ---------------------------------------------------------------------------
# Initial server/TOTP setup
# ---------------------------------------------------------------------------

if [[ ! -f "$SERVER_CONFIG_DIR/server.token" ]]; then
  info "Starting Nexus server setup"

  echo
  echo "Scan the QR code with your authenticator."
  echo

  runuser -u "$NEXUS_USER" -- \
    "$SERVER_COMMAND" setup \
    </dev/tty >/dev/tty

  if [[ ! -f "$SERVER_CONFIG_DIR/server.token" ]]; then
    die "Server setup did not create server.token."
  fi

  chown "$NEXUS_USER:$NEXUS_GROUP" \
    "$SERVER_CONFIG_DIR/server.token"

  chmod 600 \
    "$SERVER_CONFIG_DIR/server.token"
else
  info "Existing server credentials found; keeping them"
fi

# ---------------------------------------------------------------------------
# Start/restart server
# ---------------------------------------------------------------------------

info "Starting Nexus Server"

systemctl enable nexus-server.service
systemctl restart nexus-server.service

sleep 1

if ! systemctl is-active --quiet nexus-server.service; then
  echo
  echo "Nexus Server failed to start."
  echo
  echo "MongoDB URI:"
  echo "  ${MONGODB_URI}"
  echo
  echo "Logs:"
  echo "  journalctl -u nexus-server -n 50"
  exit 1
fi

# ---------------------------------------------------------------------------
# Start/restart web
# ---------------------------------------------------------------------------

info "Starting Nexus Web"

systemctl enable nexus-web.service
systemctl restart nexus-web.service

sleep 1

if ! systemctl is-active --quiet nexus-web.service; then
  echo
  echo "Nexus Web failed to start."
  echo
  echo "Logs:"
  echo "  journalctl -u nexus-web -n 50"
  exit 1
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

echo
echo "Better Nexus Server ${VERSION} installed."
echo
echo "API:"
echo "  http://<this-machine>:8081"
echo
echo "Admin API:"
echo "  http://127.0.0.1:8082"
echo
echo "Web:"
echo "  http://<this-machine>:3000"
echo
echo "Enroll a new agent:"
echo "  sudo nexus-server enroll"
echo
echo "Useful commands:"
echo "  systemctl status nexus-server"
echo "  systemctl status nexus-web"
echo "  journalctl -u nexus-server -f"
echo "  journalctl -u nexus-web -f"
echo