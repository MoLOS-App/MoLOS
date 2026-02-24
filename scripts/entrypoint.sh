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

# Run database migrations
log "Running database migrations..."
if bun run db:migrate; then
  log "Database migrations completed successfully."
else
  error "Database migrations failed. Cannot proceed without a properly initialized database."
  exit 1
fi

# Start the built application
log "Starting MoLOS server on port ${PORT:-4173}..."
exec node build/index.js
