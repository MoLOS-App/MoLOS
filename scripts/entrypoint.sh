#!/bin/bash
set -e

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [Entrypoint] $@"
}

error() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [Entrypoint] ERROR: $@" >&2
}

log "Starting MoLOS Production Environment..."

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

# Migrations
log "Running database migrations..."
if npm run db:migrate; then
  log "Database migrations completed successfully."
else
  error "Database migrations failed. Cannot proceed without a properly initialized database."
  exit 1
fi

# External Modules
log "Refreshing external modules..."
if [ -d "/app/external_modules" ]; then
  if command -v npm >/dev/null 2>&1; then
    npm run module:sync || log "Module sync failed; continuing."
  else
    log "npm not available; skipping module sync."
  fi
else
  log "External modules directory not found; skipping refresh."
fi


# Start (supervisor handles builds)
log "Starting MoLOS server..."
exec npm run serve
