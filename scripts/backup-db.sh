#!/bin/bash
set -e

# Creates a timestamped backup of the SQLite database.

DB_URL=${DATABASE_URL:-"/data/molos.db"}
case "$DB_URL" in
  file:*) DB_PATH="${DB_URL#file:}" ;;
  sqlite://*) DB_PATH="${DB_URL#sqlite://}" ;;
  sqlite:*) DB_PATH="${DB_URL#sqlite:}" ;;
  *) DB_PATH="$DB_URL" ;;
esac
BACKUP_DIR=${BACKUP_DIR:-"/data/backups"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/molos_$TIMESTAMP.db"

echo "Starting database backup..."
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database file not found at $DB_PATH"
    exit 1
fi

# If sqlite3 is not available, fallback to cp
if command -v sqlite3 &> /dev/null; then
    echo "Using sqlite3 to create a safe backup..."
    sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
else
    echo "sqlite3 not found, using cp (not recommended for active databases)..."
    cp "$DB_PATH" "$BACKUP_FILE"
fi

echo "Compressing backup..."
gzip "$BACKUP_FILE"
echo "Cleaning up old backups (keeping last 7 days)..."
find "$BACKUP_DIR" -name "molos_*.db.gz" -mtime +7 -delete
echo "Backup completed: ${BACKUP_FILE}.gz"
