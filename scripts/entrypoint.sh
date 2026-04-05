#!/bin/bash
set -e

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [Entrypoint] $@"
}

error() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [Entrypoint] ERROR: $@" >&2
}

# Get the UID/GID that should own the data directory
# Default to bun user (UID 1000 in oven/bun image)
BUN_UID=${BUN_UID:-1000}
BUN_GID=${BUN_GID:-1000}

# If running as root, fix permissions and drop privileges
if [ "$(id -u)" = '0' ]; then
  log "Running as root, fixing permissions on /data..."
  
  # Ensure data directory exists with correct subdirectories
  mkdir -p /data/.db_backups /data/modules
  
  # Fix ownership of the data directory (volume mount may have root ownership)
  chown -R "${BUN_UID}:${BUN_GID}" /data
  
  log "Permissions fixed, dropping privileges to bun user..."
  
  # Use gosu to drop privileges and re-run this script as bun user
  exec gosu bun "$0" "$@"
fi

# Now running as non-root user (bun)
log "Starting MoLOS Production Environment as $(whoami) (UID: $(id -u))..."

# Default to production settings
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-4173}"

normalize_db_path() {
  case "$1" in
    file:*) echo "${1#file:}" ;;
    sqlite://*) echo "${1#sqlite://}" ;;
    sqlite:*) echo "${1#sqlite:}" ;;
    *) echo "$1" ;;
  esac
}

log "Setting up database..."
if [ -z "$DATABASE_URL" ]; then
  error "DATABASE_URL is not set; cannot proceed with database setup."
  exit 1
fi

DB_PATH=$(normalize_db_path "$DATABASE_URL")

# Ensure database directory
DB_DIR=$(dirname "$DB_PATH")
if [ ! -d "$DB_DIR" ]; then
  log "Creating database directory: $DB_DIR"
  mkdir -p "$DB_DIR"
  if [ $? -ne 0 ]; then
    error "Failed to create database directory: $DB_DIR"
    exit 1
  fi
  chmod 755 "$DB_DIR"
fi

if [ ! -f "$DB_PATH" ]; then
  log "Creating database file: $DB_PATH"
  touch "$DB_PATH"
  if [ $? -ne 0 ]; then
    error "Failed to create database file: $DB_PATH"
    exit 1
  fi
  chmod 666 "$DB_PATH"
fi

# Run database migrations
log "Running database migrations..."
if node /app/packages/database/dist/migrate-improved.js; then
  log "Database migrations completed successfully."
else
  error "Database migrations failed. Cannot proceed without a properly initialized database."
  exit 1
fi

# Start the built application
log "Starting MoLOS server on port ${PORT:-4173}..."
exec node build/index.js
