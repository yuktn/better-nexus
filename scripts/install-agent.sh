#!/usr/bin/env bash

set -Eeuo pipefail

VERSION="${NEXUS_VERSION:-v0.1.1}"
REPO="https://github.com/yuktn/better-nexus.git"

INSTALL_DIR="/opt/better-nexus-agent"

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
  die "Run this installer as root."
fi

for command in git node npm systemctl runuser; do
  command -v "$command" >/dev/null 2>&1 ||
    die "'$command' is required but was not found."
done

NODE_BIN="$(command -v node)"

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

info "Building Better Nexus Agent"

npm run build -w shared
npm run build -w agent

info "Installing application"

rm -rf "$INSTALL_DIR"
mv "$TMP_DIR/repo" "$INSTALL_DIR"

chown -R root:root "$INSTALL_DIR"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

mkdir -p "$CONFIG_DIR"

chown "$NEXUS_USER:$NEXUS_GROUP" "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

# ---------------------------------------------------------------------------
# nexus-agent command
# ---------------------------------------------------------------------------

cat > "$COMMAND_FILE" <<EOF
#!/usr/bin/env bash

set -Eeuo pipefail

export NEXUS_CONFIG_DIR="${CONFIG_DIR}"

exec "${NODE_BIN}" \
  "${INSTALL_DIR}/agent/dist/cli/index.js" \
  "\$@"
EOF

chmod 755 "$COMMAND_FILE"

# ---------------------------------------------------------------------------
# systemd unit
# ---------------------------------------------------------------------------

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Better Nexus Agent
Documentation=https://github.com/yuktn/better-nexus
After=network-online.target
Wants=network-online.target

[Service]
Type=simple

User=${NEXUS_USER}
Group=${NEXUS_GROUP}

WorkingDirectory=${CONFIG_DIR}

Environment=NEXUS_CONFIG_DIR=${CONFIG_DIR}

ExecStart=${COMMAND_FILE} start

Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# ---------------------------------------------------------------------------
# Initial enrollment
# ---------------------------------------------------------------------------

if [[ ! -f "$CONFIG_DIR/config.json" || ! -f "$CONFIG_DIR/agent.token" ]]; then
  info "Starting Nexus Agent setup"

  echo
  echo "You will need:"
  echo "  - your Nexus server URL"
  echo "  - a fresh enrollment token from 'sudo nexus-server enroll'"
  echo

  runuser -u "$NEXUS_USER" -- \
    "$COMMAND_FILE" setup \
    </dev/tty >/dev/tty

  # Do not trust the CLI exit code alone.
  # v0.1 development versions previously returned exit 0 on setup failure.
  if [[ ! -f "$CONFIG_DIR/config.json" ]]; then
    die "Agent setup failed: config.json was not created."
  fi

  if [[ ! -f "$CONFIG_DIR/agent.token" ]]; then
    die "Agent setup failed: agent.token was not created."
  fi

  chown \
    "$NEXUS_USER:$NEXUS_GROUP" \
    "$CONFIG_DIR/config.json" \
    "$CONFIG_DIR/agent.token"

  chmod 600 \
    "$CONFIG_DIR/config.json" \
    "$CONFIG_DIR/agent.token"
else
  info "Existing agent configuration found; updating the agent version"

  runuser -u "$NEXUS_USER" -- \
    "$NODE_BIN" --input-type=module - \
    "$INSTALL_DIR/agent/package.json" "$CONFIG_DIR/config.json" <<'NODE'
import { readFile, writeFile, rename, rm } from "node:fs/promises";

const [packagePath, configPath] = process.argv.slice(2);
const metadata = JSON.parse(await readFile(packagePath, "utf8"));
const config = JSON.parse(await readFile(configPath, "utf8"));

if (typeof metadata.version !== "string" || !metadata.version) {
  throw new Error("Installed agent package has no version.");
}

const version = `v${metadata.version}`;
if (config.agentNexusVersion !== version) {
  config.agentNexusVersion = version;
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    await rename(temporaryPath, configPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

console.log(`Agent configuration version: ${version}`);
NODE
fi

# ---------------------------------------------------------------------------
# Start/restart
# ---------------------------------------------------------------------------

info "Starting Nexus Agent"

systemctl enable nexus-agent.service
systemctl restart nexus-agent.service

sleep 1

if ! systemctl is-active --quiet nexus-agent.service; then
  echo
  echo "Nexus Agent failed to start."
  echo
  echo "Logs:"
  echo "  journalctl -u nexus-agent -n 50"
  exit 1
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

echo
echo "Better Nexus Agent ${VERSION} installed."
echo
echo "Useful commands:"
echo "  sudo nexus-agent edit"
echo "  systemctl status nexus-agent"
echo "  journalctl -u nexus-agent -f"
echo
