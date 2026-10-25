
#!/usr/bin/env bash
# Production deployment for Hostel Ghar Dashboard on cPanel.
# App: /home/hostelgh/hostelghar_dashboard
# Node environment: /home/hostelgh/nodevenv/hostelghar_dashboard/20

set -Eeuo pipefail
umask 077

APP_DIR="${APP_DIR:-/home/hostelgh/hostelghar_dashboard}"
BACKUP_DIR="${BACKUP_DIR:-/home/hostelgh/dashboard_backups}"
REMOTE_TMP_DIR="${REMOTE_TMP_DIR:-/home/hostelgh/tmp_dashboard_deploy}"
BUNDLE_FILE="${BUNDLE_FILE:-deploy-bundle.tar.gz}"
HEALTH_URL="${HEALTH_URL:-https://dashboard.hostelghar.com}"
NODE_VENV_PATH="${NODE_VENV_PATH:-/home/hostelgh/nodevenv/hostelghar_dashboard/20}"

CPANEL_HOST="${CPANEL_HOST:-}"
CPANEL_USER="${CPANEL_USER:-hostelgh}"
CPANEL_PORT="${CPANEL_PORT:-22}"
SSH_KEY_PATH="${SSH_KEY_PATH:-}"

MAX_HEALTH_ATTEMPTS="${MAX_HEALTH_ATTEMPTS:-12}"
HEALTH_SLEEP_SECONDS="${HEALTH_SLEEP_SECONDS:-5}"

MODE="runner"
SCRIPT_PATH="${BASH_SOURCE[0]}"

log_info()    { printf '[INFO] %s\n' "$*"; }
log_success() { printf '[SUCCESS] %s\n' "$*"; }
log_warn()    { printf '[WARN] %s\n' "$*" >&2; }
log_error()   { printf '[ERROR] %s\n' "$*" >&2; }

cleanup_local() {
  local code=$?
  if [[ "$MODE" == "runner" ]]; then
    rm -f /tmp/sftp_dashboard_commands 2>/dev/null || true
  fi
  if (( code != 0 )); then
    log_error "Deployment failed with exit code $code."
  fi
}
trap cleanup_local EXIT

if [[ "$SSH_KEY_PATH" == \~* ]]; then
  SSH_KEY_PATH="${SSH_KEY_PATH/#\~/$HOME}"
fi
if [[ -z "$SSH_KEY_PATH" && -f "$HOME/.ssh/cpanel_key" ]]; then
  SSH_KEY_PATH="$HOME/.ssh/cpanel_key"
fi

get_ssh_opts() {
  printf '%s\n' \
    "-p $CPANEL_PORT -i $SSH_KEY_PATH -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=3"
}

# Runner: executed by GitHub Actions.
validate_runner_environment() {
  local errors=0

  [[ -n "$CPANEL_HOST" ]] || { log_error "Missing CPANEL_HOST secret."; errors=$((errors+1)); }
  [[ -n "$CPANEL_USER" ]] || { log_error "Missing CPANEL_USER."; errors=$((errors+1)); }
  [[ -f "$SSH_KEY_PATH" ]] || { log_error "SSH key file not found: ${SSH_KEY_PATH:-unset}"; errors=$((errors+1)); }
  [[ -f "$BUNDLE_FILE" ]] || { log_error "Bundle not found: $BUNDLE_FILE"; errors=$((errors+1)); }

  if (( errors > 0 )); then
    log_error "Check GitHub Secrets: CPANEL_HOST, CPANEL_USER, CPANEL_PORT, CPANEL_SSH_KEY."
    exit 1
  fi

  chmod 600 "$SSH_KEY_PATH"
  log_info "Target: $CPANEL_USER@$CPANEL_HOST:$CPANEL_PORT"
  log_info "Application directory: $APP_DIR"
  log_info "Health URL: $HEALTH_URL"
}

test_ssh_connection() {
  local output
  # shellcheck disable=SC2046
  if output=$(ssh $(get_ssh_opts) "$CPANEL_USER@$CPANEL_HOST" "echo SSH_CONNECTION_OK" 2>&1) &&
     [[ "$output" == *SSH_CONNECTION_OK* ]]; then
    log_success "SSH connection verified."
    return
  fi

  log_error "SSH command test failed: $output"
  log_error "Do not deploy until SSH access works."
  exit 1
}

upload_artifacts_to_cpanel() {
  local sftp_file
  sftp_file="$(mktemp)"
  cat > "$sftp_file" <<EOF
-mkdir $REMOTE_TMP_DIR
-mkdir $BACKUP_DIR
put $BUNDLE_FILE $REMOTE_TMP_DIR/$BUNDLE_FILE
put $SCRIPT_PATH $REMOTE_TMP_DIR/deploy.sh
chmod 700 $REMOTE_TMP_DIR/deploy.sh
EOF

  if ! sftp -P "$CPANEL_PORT" -i "$SSH_KEY_PATH" \
      -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
      -b "$sftp_file" "$CPANEL_USER@$CPANEL_HOST"; then
    rm -f "$sftp_file"
    log_error "SFTP upload failed."
    exit 1
  fi

  rm -f "$sftp_file"
  log_success "Deployment files uploaded."
}

dispatch_remote_deployment() {
  log_info "Starting remote deployment."
  # shellcheck disable=SC2046
  ssh -tt $(get_ssh_opts) "$CPANEL_USER@$CPANEL_HOST" \
    "APP_DIR='$APP_DIR' BACKUP_DIR='$BACKUP_DIR' REMOTE_TMP_DIR='$REMOTE_TMP_DIR' BUNDLE_FILE='$BUNDLE_FILE' NODE_VENV_PATH='$NODE_VENV_PATH' CPANEL_USER='$CPANEL_USER' bash '$REMOTE_TMP_DIR/deploy.sh' --remote"
}

trigger_remote_rollback() {
  log_warn "Requesting rollback."
  # shellcheck disable=SC2046
  ssh -tt $(get_ssh_opts) "$CPANEL_USER@$CPANEL_HOST" \
    "APP_DIR='$APP_DIR' BACKUP_DIR='$BACKUP_DIR' REMOTE_TMP_DIR='$REMOTE_TMP_DIR' NODE_VENV_PATH='$NODE_VENV_PATH' CPANEL_USER='$CPANEL_USER' bash '$REMOTE_TMP_DIR/deploy.sh' --rollback" \
    || log_error "Automatic rollback command failed; inspect cPanel logs."
}

verify_public_health() {
  local attempt code
  for ((attempt=1; attempt<=MAX_HEALTH_ATTEMPTS; attempt++)); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' -L --max-time 15 "$HEALTH_URL" || true)"
    log_info "Health check $attempt/$MAX_HEALTH_ATTEMPTS: HTTP ${code:-000}"

    if [[ "$code" =~ ^(200|301|302|307|308)$ ]]; then
      log_success "Public health check passed."
      return 0
    fi
    if (( attempt < MAX_HEALTH_ATTEMPTS )); then
      sleep "$HEALTH_SLEEP_SECONDS"
    fi
  done

  log_error "Health check failed."
  trigger_remote_rollback
  exit 1
}

run_runner_pipeline() {
  log_info "Starting Hostel Ghar Dashboard deployment."
  validate_runner_environment
  test_ssh_connection
  upload_artifacts_to_cpanel
  dispatch_remote_deployment
  verify_public_health
  log_success "Deployment and health check completed."
}

# Remote cPanel functions.
remote_restart_application() {
  mkdir -p "$APP_DIR/tmp"
  touch "$APP_DIR/tmp/restart.txt"
  log_info "Passenger restart signal created."

  if command -v cloudlinux-selector >/dev/null 2>&1; then
    cloudlinux-selector restart --json --interpreter nodejs --app-root "$APP_DIR" \
      >/dev/null 2>&1 || log_warn "CloudLinux restart command failed; Passenger trigger was created."
  elif [[ -x /usr/sbin/cloudlinux-selector ]]; then
    /usr/sbin/cloudlinux-selector restart --json --interpreter nodejs --app-root "$APP_DIR" \
      >/dev/null 2>&1 || log_warn "CloudLinux restart command failed; Passenger trigger was created."
  fi
}

remote_execute_deploy() {
  log_info "Starting remote cPanel deployment."
  mkdir -p "$BACKUP_DIR" "$APP_DIR" "$REMOTE_TMP_DIR"

  local bundle="$REMOTE_TMP_DIR/$BUNDLE_FILE"
  local stage="$REMOTE_TMP_DIR/extracted"
  local candidate="$REMOTE_TMP_DIR/next-candidate"
  local previous="$REMOTE_TMP_DIR/next-previous"
  local backup="$BACKUP_DIR/backup-$(date +%Y%m%d%H%M%S).tar.gz"
  local old_build new_build

  [[ -f "$bundle" ]] || { log_error "Bundle missing: $bundle"; exit 1; }

  # Preserve the current release before making changes.
  if [[ -f "$APP_DIR/server.js" && -d "$APP_DIR/.next" ]]; then
    tar -czf "$backup" -C "$APP_DIR" \
      --exclude='./.env*' --exclude='./tmp' --exclude='./uploads' \
      --exclude='*.log' server.js app.js package.json .next node_modules public \
      2>/dev/null || log_warn "Backup may be incomplete; verify before proceeding."
  fi

  rm -rf "$stage" "$candidate"
  mkdir -p "$stage"
  tar -xzf "$bundle" -C "$stage"

  [[ -f "$stage/server.js" ]] || { log_error "Bundle has no server.js."; exit 1; }
  [[ -f "$stage/.next/BUILD_ID" ]] || { log_error "Bundle has no .next/BUILD_ID."; exit 1; }
  [[ -f "$stage/.next/required-server-files.json" ]] || {
    log_error "Bundle lacks .next/required-server-files.json."
    exit 1
  }

  new_build="$(cat "$stage/.next/BUILD_ID")"
  [[ -n "$new_build" ]] || { log_error "Staged build ID is empty."; exit 1; }

  # Assemble a fresh .next directory. Never merge build files.
  mkdir -p "$candidate"
  cp -a "$stage/.next/." "$candidate/"
  [[ -f "$candidate/BUILD_ID" ]] || { log_error "Candidate BUILD_ID missing."; exit 1; }
  [[ "$(cat "$candidate/BUILD_ID")" == "$new_build" ]] || {
    log_error "Candidate build ID mismatch."
    exit 1
  }

  # Verify runtime files before touching the active release.
  if [[ ! -f "$stage/app.js" ]]; then
    cat > "$stage/app.js" <<'EOF'
const path = require('path');
process.env.NODE_ENV = 'production';
require(path.join(__dirname, 'server.js'));
EOF
  fi

  [[ -f "$stage/package.json" ]] || { log_error "Bundle has no package.json."; exit 1; }

  # Back up the old build directory, then atomically switch to the new one.
  rm -rf "$previous"
  if [[ -d "$APP_DIR/.next" ]]; then
    mv "$APP_DIR/.next" "$previous"
  fi

  if ! mv "$candidate" "$APP_DIR/.next"; then
    [[ ! -d "$APP_DIR/.next" && -d "$previous" ]] && mv "$previous" "$APP_DIR/.next"
    log_error "Could not activate the new .next build."
    exit 1
  fi

  # Confirm the active build matches the staged build.
  old_build="$new_build"
  if [[ "$(cat "$APP_DIR/.next/BUILD_ID" 2>/dev/null || true)" != "$old_build" ]]; then
    rm -rf "$APP_DIR/.next"
    [[ -d "$previous" ]] && mv "$previous" "$APP_DIR/.next"
    log_error "Active BUILD_ID verification failed; restored prior .next."
    exit 1
  fi

  # Sync standalone runtime dependencies, without touching .env or user data.
  if [[ -d "$stage/node_modules" ]]; then
    mkdir -p "$APP_DIR/node_modules"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete "$stage/node_modules/" "$APP_DIR/node_modules/"
    else
      rm -rf "$APP_DIR/node_modules"
      cp -a "$stage/node_modules" "$APP_DIR/node_modules"
    fi
  fi

  if [[ -d "$stage/public" ]]; then
    mkdir -p "$APP_DIR/public"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a "$stage/public/" "$APP_DIR/public/"
    else
      cp -a "$stage/public/." "$APP_DIR/public/"
    fi
  fi

  cp "$stage/server.js" "$APP_DIR/server.js"
  cp "$stage/package.json" "$APP_DIR/package.json"
  cp "$stage/app.js" "$APP_DIR/app.js"

  # Keep only the three most recent backups.
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'backup-*.tar.gz' \
    -printf '%T@ %p\n' 2>/dev/null | sort -nr | tail -n +4 | cut -d' ' -f2- |
    xargs -r rm -f || true

  rm -rf "$stage" "$previous"
  rm -f "$bundle"

  log_success "Activated build ID $new_build."
  remote_restart_application
}

remote_execute_rollback() {
  log_warn "Starting rollback."
  [[ -d "$BACKUP_DIR" ]] || { log_error "Backup directory missing."; exit 1; }

  local latest
  latest="$(ls -1t "$BACKUP_DIR"/backup-*.tar.gz 2>/dev/null | head -n 1 || true)"
  [[ -n "$latest" && -f "$latest" ]] || {
    log_error "No backup archive found."
    exit 1
  }

  tar -xzf "$latest" -C "$APP_DIR"
  remote_restart_application
  log_success "Backup restored. Verify application and logs."
}

case "${1:-}" in
  --remote)
    MODE="remote"
    remote_execute_deploy
    ;;
  --rollback)
    MODE="rollback"
    remote_execute_rollback
    ;;
  --runner|run|"")
    MODE="runner"
    run_runner_pipeline
    ;;
  *)
    log_error "Usage: $0 [--runner|--remote|--rollback]"
    exit 1
    ;;
esac
