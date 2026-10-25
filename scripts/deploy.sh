#!/usr/bin/env bash
# ==============================================================================
# scripts/deploy.sh
# Production Deployment Script for Hostel Ghar Dashboard to cPanel
#
# Context:
#   Repository  : CodynexNepal/Hostel_Ghar_Dashboard
#   Domain      : https://dashboard.hostelghar.com
#   cPanel User : hostelgh
#   App Dir     : /home/hostelgh/hostelghar_dashboard
#   Node.js Venv: /home/hostelgh/nodevenv/hostelghar_dashboard/20
#
# Usage:
#   1. Local Runner Execution (default - called from GitHub Actions):
#        bash scripts/deploy.sh
#      Or explicitly:
#        bash scripts/deploy.sh --runner
#
#   2. Remote cPanel Execution (dispatched remotely over SSH):
#        bash scripts/deploy.sh --remote
#
#   3. Remote cPanel Rollback (dispatched remotely over SSH if health check fails):
#        bash scripts/deploy.sh --rollback
# ==============================================================================

set -Eeuo pipefail

# ------------------------------------------------------------------------------
# Configuration & Defaults
# ------------------------------------------------------------------------------
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

# Expand literal leading '~' if provided by CI env without shell expansion
if [[ "$SSH_KEY_PATH" == \~* ]]; then
  SSH_KEY_PATH="${SSH_KEY_PATH/#\~/$HOME}"
fi
if [ -z "$SSH_KEY_PATH" ] && [ -f "$HOME/.ssh/cpanel_key" ]; then
  SSH_KEY_PATH="$HOME/.ssh/cpanel_key"
fi

MAX_HEALTH_ATTEMPTS="${MAX_HEALTH_ATTEMPTS:-12}"
HEALTH_SLEEP_SECONDS="${HEALTH_SLEEP_SECONDS:-5}"

SCRIPT_PATH="${BASH_SOURCE[0]}"

# ------------------------------------------------------------------------------
# Logging Helpers
# ------------------------------------------------------------------------------
log_info()    { printf '\033[0;34m[INFO]\033[0m %s\n' "$*"; }
log_success() { printf '\033[0;32m[SUCCESS]\033[0m %s\n' "$*"; }
log_warn()    { printf '\033[0;33m[WARN]\033[0m %s\n' "$*" >&2; }
log_error()   { printf '\033[0;31m[ERROR]\033[0m %s\n' "$*" >&2; }

# ------------------------------------------------------------------------------
# Cleanup Handler (Local Runner)
# ------------------------------------------------------------------------------
cleanup_local() {
  local exit_code=$?
  if [ "$MODE" = "runner" ]; then
    rm -f /tmp/sftp_dashboard_commands 2>/dev/null || true
  fi
  if [ $exit_code -ne 0 ]; then
    log_error "Deployment process terminated with exit code $exit_code."
  fi
}

# ==============================================================================
# PHASE 1: LOCAL RUNNER PROCEDURES (Runs on GitHub Actions Runner)
# ==============================================================================

validate_runner_environment() {
  log_info "Validating deployment runner environment and parameters..."
  local errors=0

  if [ -z "$CPANEL_HOST" ]; then
    log_error "Missing required variable: CPANEL_HOST"
    errors=$((errors + 1))
  fi

  if [ -z "$CPANEL_USER" ]; then
    log_error "Missing required variable: CPANEL_USER"
    errors=$((errors + 1))
  fi

  if [ -z "$SSH_KEY_PATH" ] || [ ! -f "$SSH_KEY_PATH" ]; then
    log_error "SSH key file not found at SSH_KEY_PATH: '${SSH_KEY_PATH:-<unset>}'"
    errors=$((errors + 1))
  fi

  if [ ! -f "$BUNDLE_FILE" ]; then
    log_error "Deployment bundle not found: '$BUNDLE_FILE'"
    errors=$((errors + 1))
  fi

  if [ $errors -gt 0 ]; then
    log_error "Environment validation failed with $errors error(s)."
    log_error "Please verify GitHub Secrets (CPANEL_HOST, CPANEL_USER, CPANEL_SSH_KEY, CPANEL_PORT)."
    exit 1
  fi

  # Ensure correct local permissions on SSH key
  chmod 600 "$SSH_KEY_PATH" 2>/dev/null || true

  log_success "Runner environment validated."
  log_info "  Host             : $CPANEL_HOST"
  log_info "  User             : $CPANEL_USER"
  log_info "  Port             : $CPANEL_PORT"
  log_info "  Target App Dir   : $APP_DIR"
  log_info "  Health Check URL : $HEALTH_URL"
  log_info "  Bundle File      : $BUNDLE_FILE ($(du -h "$BUNDLE_FILE" | cut -f1))"
}

get_ssh_opts() {
  echo "-p $CPANEL_PORT -i $SSH_KEY_PATH -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=3"
}

test_ssh_connection() {
  log_info "Testing SSH connectivity to $CPANEL_USER@$CPANEL_HOST:$CPANEL_PORT..."
  local ssh_output
  local ssh_code=0
  # shellcheck disable=SC2046
  ssh_output=$(ssh $(get_ssh_opts) -o ConnectTimeout=15 "$CPANEL_USER@$CPANEL_HOST" "echo SSH_CONNECTION_OK" 2>&1) || ssh_code=$?

  if [ $ssh_code -eq 0 ] && [[ "$ssh_output" == *"SSH_CONNECTION_OK"* ]]; then
    log_success "SSH connection established successfully."
  else
    log_warn "Direct command execution test failed or restricted shell in effect. (SSH output: $ssh_output)"
    log_info "Attempting SFTP probe..."
    local sftp_probe="/tmp/sftp_probe_$$"
    echo "pwd" > "$sftp_probe"
    local sftp_output
    local sftp_code=0
    # shellcheck disable=SC2046
    sftp_output=$(sftp -P "$CPANEL_PORT" -i "$SSH_KEY_PATH" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -b "$sftp_probe" "$CPANEL_USER@$CPANEL_HOST" 2>&1) || sftp_code=$?
    rm -f "$sftp_probe"

    if [ $sftp_code -eq 0 ]; then
      log_success "SFTP subsystem is accessible."
    else
      log_error "Could not establish SSH or SFTP connection to $CPANEL_USER@$CPANEL_HOST:$CPANEL_PORT."
      log_error "  SSH details : $ssh_output"
      log_error "  SFTP details: $sftp_output"
      log_error "Verify server hostname, port, firewall/IP whitelisting, and that the SSH public key is authorized on cPanel."
      exit 1
    fi
  fi
}

upload_artifacts_to_cpanel() {
  log_info "Uploading deployment bundle and execution script via SFTP subsystem..."
  local sftp_file="/tmp/sftp_dashboard_commands"

  cat << EOF > "$sftp_file"
-mkdir $REMOTE_TMP_DIR
-mkdir $BACKUP_DIR
-mkdir $APP_DIR
put $BUNDLE_FILE $REMOTE_TMP_DIR/$BUNDLE_FILE
put $SCRIPT_PATH $REMOTE_TMP_DIR/deploy.sh
chmod 755 $REMOTE_TMP_DIR/deploy.sh
EOF

  # shellcheck disable=SC2046
  if sftp -P "$CPANEL_PORT" -i "$SSH_KEY_PATH" \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=accept-new \
    -b "$sftp_file" \
    "$CPANEL_USER@$CPANEL_HOST"; then
    log_success "Deployment payload successfully transferred to remote staging ($REMOTE_TMP_DIR)."
  else
    log_error "SFTP transfer of deployment bundle failed."
    rm -f "$sftp_file"
    exit 1
  fi
  rm -f "$sftp_file"
}

dispatch_remote_deployment() {
  log_info "Executing remote deployment procedure on cPanel..."

  # Allocate pseudo-terminal (-tt) for cPanel Jailed Shell compatibility
  # shellcheck disable=SC2046
  if ssh -tt $(get_ssh_opts) "$CPANEL_USER@$CPANEL_HOST" \
    "APP_DIR='$APP_DIR' BACKUP_DIR='$BACKUP_DIR' REMOTE_TMP_DIR='$REMOTE_TMP_DIR' BUNDLE_FILE='$BUNDLE_FILE' NODE_VENV_PATH='$NODE_VENV_PATH' bash $REMOTE_TMP_DIR/deploy.sh --remote"; then
    log_success "Remote deployment script executed successfully over SSH."
  else
    log_warn "Remote execution over SSH shell failed or was rejected by host."
    log_info "Initiating direct fallback synchronization using SFTP/SCP..."
    execute_sftp_fallback_sync
  fi
}

execute_sftp_fallback_sync() {
  local stage_dir="/tmp/dashboard_sftp_stage_$$"
  mkdir -p "$stage_dir"
  log_info "Extracting local standalone bundle for direct sync: $stage_dir"
  tar -xzf "$BUNDLE_FILE" -C "$stage_dir"

  # Ensure app.js entrypoint exists
  if [ ! -f "$stage_dir/app.js" ]; then
    cat << 'EOF' > "$stage_dir/app.js"
const fs = require('fs');
const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || 3000;
const serverPath = path.join(__dirname, 'server.js');
if (fs.existsSync(serverPath)) {
  require(serverPath);
} else {
  console.error('[cPanel Startup] server.js not found');
  process.exit(1);
}
EOF
  fi

  # Prepare restart trigger
  mkdir -p "$stage_dir/tmp"
  touch "$stage_dir/tmp/restart.txt"

  log_info "Synchronizing files directly to $APP_DIR over SCP..."
  # shellcheck disable=SC2046
  scp -P "$CPANEL_PORT" -i "$SSH_KEY_PATH" \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=accept-new \
    -r "$stage_dir/." "$CPANEL_USER@$CPANEL_HOST:$APP_DIR/"

  rm -rf "$stage_dir"
  log_success "Fallback SCP synchronization complete and restart trigger placed."
}

verify_public_health() {
  log_info "Verifying deployment health against $HEALTH_URL (max attempts: $MAX_HEALTH_ATTEMPTS)..."
  local attempt=1
  local success=0

  while [ "$attempt" -le "$MAX_HEALTH_ATTEMPTS" ]; do
    local http_code
    http_code=$(curl -k -s -o /dev/null -w "%{http_code}" -L --max-time 15 "$HEALTH_URL" || echo "000")
    log_info "Health check attempt $attempt/$MAX_HEALTH_ATTEMPTS: HTTP response code $http_code"

    if [[ "$http_code" =~ ^(200|301|302|307|308)$ ]]; then
      log_success "Health check passed! Service is responding with HTTP $http_code."
      success=1
      break
    fi

    attempt=$((attempt + 1))
    if [ "$attempt" -le "$MAX_HEALTH_ATTEMPTS" ]; then
      sleep "$HEALTH_SLEEP_SECONDS"
    fi
  done

  if [ "$success" -ne 1 ]; then
    log_error "Health check failed after $MAX_HEALTH_ATTEMPTS attempts."
    log_error "Triggering automated rollback to restore the previous working release..."
    trigger_remote_rollback
    exit 1
  fi
}

trigger_remote_rollback() {
  log_warn "Dispatched remote rollback sequence on cPanel..."
  # shellcheck disable=SC2046
  ssh -tt $(get_ssh_opts) "$CPANEL_USER@$CPANEL_HOST" \
    "APP_DIR='$APP_DIR' BACKUP_DIR='$BACKUP_DIR' REMOTE_TMP_DIR='$REMOTE_TMP_DIR' NODE_VENV_PATH='$NODE_VENV_PATH' bash $REMOTE_TMP_DIR/deploy.sh --rollback" || {
      log_error "Automated rollback command over SSH encountered an error. Manual check required."
    }
}

run_runner_pipeline() {
  log_info "=== Starting Hostel Ghar Dashboard Deployment (GitHub Runner) ==="
  validate_runner_environment
  test_ssh_connection
  upload_artifacts_to_cpanel
  dispatch_remote_deployment
  verify_public_health
  log_success "=== Deployment and Health Verification Completed Successfully ==="
}

# ==============================================================================
# PHASE 2: REMOTE cPANEL PROCEDURES (Runs on cPanel Server)
# ==============================================================================

remote_execute_deploy() {
  log_info "=== Starting Remote Deployment Procedure on cPanel Host ==="
  log_info "Working Application Directory : $APP_DIR"
  log_info "Backup Directory              : $BACKUP_DIR"
  log_info "Remote Staging Directory      : $REMOTE_TMP_DIR"

  mkdir -p "$BACKUP_DIR" "$APP_DIR"

  # --- Step A: Backup Current Active Release ---
  if [ -f "$APP_DIR/server.js" ] || [ -d "$APP_DIR/.next" ] || [ -f "$APP_DIR/app.js" ]; then
    local timestamp
    timestamp=$(date +%Y%m%d%H%M%S)
    local backup_file="$BACKUP_DIR/backup-${timestamp}.tar.gz"
    log_info "Creating snapshot backup of active application: $backup_file"

    tar -czf "$backup_file" -C "$APP_DIR" \
      --exclude="./tmp" \
      --exclude="./.env*" \
      --exclude="./uploads" \
      --exclude="*.log" \
      server.js app.js package.json .next node_modules public 2>/dev/null || true

    log_success "Backup archive created."

    # Retain only the last 3 backups to conserve disk quota and inodes on shared hosting
    cd "$BACKUP_DIR"
    # shellcheck disable=SC2012
    ls -1t backup-*.tar.gz 2>/dev/null | tail -n +4 | xargs -r rm -f || true
    log_info "Backup rotation complete (kept last 3 archives)."
  else
    log_info "No previous active deployment detected to back up."
  fi

  # --- Step B: Extract Standalone Build in Isolated Staging ---
  local stage_extract="$REMOTE_TMP_DIR/extracted"
  log_info "Extracting new standalone build into isolated staging: $stage_extract"
  rm -rf "$stage_extract"
  mkdir -p "$stage_extract"

  if [ ! -f "$REMOTE_TMP_DIR/$BUNDLE_FILE" ]; then
    log_error "Deployment bundle missing in staging: $REMOTE_TMP_DIR/$BUNDLE_FILE"
    exit 1
  fi

  tar -xzf "$REMOTE_TMP_DIR/$BUNDLE_FILE" -C "$stage_extract"

  # Validate extracted standalone output
  if [ ! -f "$stage_extract/server.js" ]; then
    log_error "Corrupted build bundle: server.js not found in standalone root."
    exit 1
  fi
  if [ ! -d "$stage_extract/.next" ]; then
    log_error "Corrupted build bundle: .next directory not found."
    exit 1
  fi

  # Ensure app.js startup wrapper exists inside extracted bundle
  if [ ! -f "$stage_extract/app.js" ]; then
    log_info "Creating cPanel entrypoint app.js in extracted bundle..."
    cat << 'EOF' > "$stage_extract/app.js"
const fs = require('fs');
const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || 3000;
const serverPath = path.join(__dirname, 'server.js');
if (fs.existsSync(serverPath)) {
  require(serverPath);
} else {
  console.error('[cPanel Startup] server.js not found');
  process.exit(1);
}
EOF
  fi

  # --- Step C: Safe Component Synchronization (Preserving .env & Data) ---
  log_info "Synchronizing standalone runtime into $APP_DIR..."

  # 1. Sync .next build directory
  mkdir -p "$APP_DIR/.next"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$stage_extract/.next/" "$APP_DIR/.next/"
  else
    cp -r "$stage_extract/.next/"* "$APP_DIR/.next/"
  fi

  # 2. Sync node_modules
  if [ -d "$stage_extract/node_modules" ]; then
    mkdir -p "$APP_DIR/node_modules"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete "$stage_extract/node_modules/" "$APP_DIR/node_modules/"
    else
      cp -r "$stage_extract/node_modules/"* "$APP_DIR/node_modules/"
    fi
  fi

  # 3. Sync public static directory
  if [ -d "$stage_extract/public" ]; then
    mkdir -p "$APP_DIR/public"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a "$stage_extract/public/" "$APP_DIR/public/"
    else
      cp -r "$stage_extract/public/"* "$APP_DIR/public/"
    fi
  fi

  # 4. Copy root files (NEVER overwriting .env)
  cp "$stage_extract/server.js" "$APP_DIR/server.js"
  cp "$stage_extract/package.json" "$APP_DIR/package.json"
  cp "$stage_extract/app.js" "$APP_DIR/app.js"

  # Cleanup staging extraction
  rm -rf "$stage_extract"
  rm -f "$REMOTE_TMP_DIR/$BUNDLE_FILE"
  log_success "Application files synchronized safely. .env was strictly preserved."

  # --- Step D: Restart Application ---
  remote_restart_application
  log_success "=== Remote Deployment Procedure Finished Successfully ==="
}

remote_restart_application() {
  log_info "Triggering cPanel application restart..."

  # 1. Standard Phusion Passenger restart signal
  mkdir -p "$APP_DIR/tmp"
  touch "$APP_DIR/tmp/restart.txt"
  log_info "Touched $APP_DIR/tmp/restart.txt (Phusion Passenger restart trigger)."

  # 2. CloudLinux Node.js Selector integration
  local restarted=0
  if command -v cloudlinux-selector >/dev/null 2>&1; then
    log_info "Executing cloudlinux-selector restart..."
    cloudlinux-selector restart --json --interpreter nodejs --app-root "$APP_DIR" 2>/dev/null && restarted=1 || true
  elif [ -x /usr/sbin/cloudlinux-selector ]; then
    log_info "Executing /usr/sbin/cloudlinux-selector restart..."
    /usr/sbin/cloudlinux-selector restart --json --interpreter nodejs --app-root "$APP_DIR" 2>/dev/null && restarted=1 || true
  elif command -v selectorctl >/dev/null 2>&1; then
    log_info "Executing selectorctl restart..."
    selectorctl --interpreter=nodejs --user="$CPANEL_USER" --restart-app --app-root="$APP_DIR" 2>/dev/null && restarted=1 || true
  fi

  if [ $restarted -eq 1 ]; then
    log_success "CloudLinux Node.js Selector notified of application restart."
  else
    log_info "cPanel Node.js restart handled via tmp/restart.txt."
  fi
}

remote_execute_rollback() {
  log_warn "=== Initiating Remote Rollback Procedure on cPanel Host ==="
  if [ ! -d "$BACKUP_DIR" ]; then
    log_error "Backup directory not found: $BACKUP_DIR. Cannot perform rollback."
    exit 1
  fi

  # shellcheck disable=SC2012
  local latest_backup
  latest_backup=$(ls -1t "$BACKUP_DIR"/backup-*.tar.gz 2>/dev/null | head -n 1 || echo "")

  if [ -n "$latest_backup" ] && [ -f "$latest_backup" ]; then
    log_warn "Restoring application from previous backup: $latest_backup"
    tar -xzf "$latest_backup" -C "$APP_DIR"
    remote_restart_application
    log_success "Rollback archive restored and application restart triggered."
  else
    log_error "No valid backup archives found in $BACKUP_DIR. Unable to roll back automatically."
    exit 1
  fi
}

# ==============================================================================
# MAIN ROUTING
# ==============================================================================
MODE="runner"
trap 'cleanup_local' EXIT ERR

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
    log_error "Unknown argument: ${1:-}"
    echo "Usage: $0 [--runner | --remote | --rollback]"
    exit 1
    ;;
esac
