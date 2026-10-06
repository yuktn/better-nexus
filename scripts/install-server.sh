#!/usr/bin/env bash

set -Eeuo pipefail

VERSION="${NEXUS_VERSION:-v0.1.0}"
REPO="https://github.com/yuktn/better-nexus.git"

INSTALL_DIR="/opt/better-nexus"

SERVER_CONFIG_DIR="/etc/better-nexus/server"
SERVER_ENV="/etc/better-nexus/server.env"
WEB_ENV="/etc/better-nexus/web.env"

SERVER_SERVICE="/etc/systemd/system/nexus-server.service"
WEB_SERVICE="/etc/systemd/system/nexus-web.service"

SERVER_COMMAND="/usr/local/bin/nexus-server"

NEXUS_USER="nexus"
NEXUS_GROUP="nexus"

# Can be overridden:
#
#   MONGODB_URI='mongodb://...' curl ... | sudo -E bash
#
# Normally localhost is exactly what we want.
MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017}"

# Web and Nexus server are installed together by this script.
NEXUS_SERVER_URL="${NEXUS_SERVER_URL:-http://127.0.0.1:8081}"

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

info "Building Better Nexus"
npm run build

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

cat > "$SERVER_COMMAND" <<'EOF'
#!/usr/bin/env bash
set -e

cd /etc/better-nexus/server

exec /usr/bin/node \
  /opt/better-nexus/server/dist/cli/index.js \
  "$@"
EOF

chmod 755 "$SERVER_COMMAND"

# ---------------------------------------------------------------------------
# Server systemd unit
# ---------------------------------------------------------------------------

cat > "$SERVER_SERVICE" <<'EOF'
[Unit]
Description=Better Nexus Server
Documentation=https://github.com/yuktn/better-nexus
After=network-online.target
Wants=network-online.target

[Service]
Type=simple

User=nexus
Group=nexus

WorkingDirectory=/etc/better-nexus/server
EnvironmentFile=/etc/better-nexus/server.env

ExecStart=/usr/local/bin/nexus-server start

Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# ---------------------------------------------------------------------------
# Web systemd unit
# ---------------------------------------------------------------------------

cat > "$WEB_SERVICE" <<'EOF'
[Unit]
Description=Better Nexus Web Dashboard
Documentation=https://github.com/yuktn/better-nexus
After=network-online.target nexus-server.service
Wants=network-online.target
Requires=nexus-server.service

[Service]
Type=simple

User=nexus
Group=nexus

WorkingDirectory=/opt/better-nexus/web
EnvironmentFile=/etc/better-nexus/web.env

ExecStart=/usr/bin/npm start

Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# ---------------------------------------------------------------------------
# Initial TOTP setup
# ---------------------------------------------------------------------------

if [[ ! -f "$SERVER_CONFIG_DIR/server.token" ]]; then
  info "Starting Nexus server setup."

  echo
  echo "Your authenticator QR code will be shown now."
  echo

  "$SERVER_COMMAND" setup </dev/tty >/dev/tty

  chown -R "$NEXUS_USER:$NEXUS_GROUP" "$SERVER_CONFIG_DIR"
  chmod 700 "$SERVER_CONFIG_DIR"

  [[ -f "$SERVER_CONFIG_DIR/server.token" ]] &&
    chmod 600 "$SERVER_CONFIG_DIR/server.token"
else
  info "Existing server credentials found; keeping them."
fi

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------

info "Starting Nexus Server"
systemctl enable --now nexus-server.service

# Give systemd a moment to determine whether it immediately crashed.
sleep 1

if ! systemctl is-active --quiet nexus-server.service; then
  echo
  echo "Nexus Server failed to start."
  echo
  echo "The most likely cause is that MongoDB is unavailable at:"
  echo "  ${MONGODB_URI}"
  echo
  echo "Logs:"
  echo "  journalctl -u nexus-server -n 50"
  exit 1
fi

info "Starting Nexus Web"
systemctl enable --now nexus-web.service

echo
echo "Better Nexus Server ${VERSION} installed."
echo
echo "API:       http://<this-machine>:8081"
echo "Admin API: http://127.0.0.1:8082"
echo "Web:       http://<this-machine>:3000"
echo
echo "Enroll a new agent with:"
echo
echo "  sudo nexus-server enroll"
echo
echo "Useful commands:"
echo "  systemctl status nexus-server"
echo "  systemctl status nexus-web"
echo "  journalctl -u nexus-server -f"
echo "  journalctl -u nexus-web -f"
echo