#!/bin/bash
set -e

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [Entrypoint] $@"
}

error() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [Entrypoint] ERROR: $@" >&2
}

log "Starting MoLOS Production Environment..."

# 1. Handle Database Setup and Migrations
log "Setting up database..."
if [ -z "$DATABASE_URL" ]; then
  error "DATABASE_URL is not set; cannot proceed with database setup."
  exit 1
fi

# Ensure database directory exists and is writable
DB_DIR=$(dirname "$DATABASE_URL")
if [ ! -d "$DB_DIR" ]; then
  log "Creating database directory: $DB_DIR"
  mkdir -p "$DB_DIR"
  if [ $? -ne 0 ]; then
    error "Failed to create database directory: $DB_DIR"
    exit 1
  fi
  chmod 755 "$DB_DIR"
fi

if [ ! -f "$DATABASE_URL" ]; then
  log "Creating database file: $DATABASE_URL"
  touch "$DATABASE_URL"
  if [ $? -ne 0 ]; then
    error "Failed to create database file: $DATABASE_URL"
    exit 1
  fi
  chmod 666 "$DATABASE_URL"
fi

# Run migrations
log "Running database migrations..."
if npm run db:migrate; then
  log "Database migrations completed successfully."
else
  error "Database migrations failed. Cannot proceed without a properly initialized database."
  exit 1
fi

# 2. Refresh External Modules
log "Refreshing external modules..."
if [ -d "/app/external_modules" ]; then
  # Run module sync if available
  if command -v npm >/dev/null 2>&1; then
    npm run module:sync || log "Module sync failed; continuing."
  else
    log "npm not available; skipping module sync."
  fi
else
  log "External modules directory not found; skipping refresh."
fi

# 3. Check for rebuild needs (if app supports self-rebuild)
log "Checking for rebuild requirements..."
if [ -f "package.json" ] && { [ "$NODE_ENV" != "production" ] || [ ! -d "build" ] || [ -n "$FORCE_REBUILD" ]; }; then
  log "Rebuilding application..."
  if npm run build; then
    log "Rebuild completed successfully."
  else
    error "Rebuild failed."
    exit 1
  fi
fi

# 4. Start the application
log "Starting MoLOS server..."
exec npm run serve
