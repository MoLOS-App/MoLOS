#!/bin/bash
set -e

# MoLOS SQLite Backup Script
# This script creates a timestamped backup of the SQLite database.

DB_PATH=${DATABASE_URL:-"/data/molos.db"}
BACKUP_DIR=${BACKUP_DIR:-"/data/backups"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/molos_$TIMESTAMP.db"

echo "📂 Starting database backup..."

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Error: Database file not found at $DB_PATH"
    exit 1
fi

# Use sqlite3 .backup command for a safe online backup
# If sqlite3 is not available, fallback to cp (less safe if DB is being written to)
if command -v sqlite3 &> /dev/null; then
    echo "🔄 Using sqlite3 to create a safe backup..."
    sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
else
    echo "⚠️ sqlite3 not found, using cp (not recommended for active databases)..."
    cp "$DB_PATH" "$BACKUP_FILE"
fi

# Compress the backup
echo "📦 Compressing backup..."
gzip "$BACKUP_FILE"

# Cleanup old backups (keep last 7 days)
echo "🧹 Cleaning up old backups (keeping last 7 days)..."
find "$BACKUP_DIR" -name "molos_*.db.gz" -mtime +7 -delete

echo "✅ Backup completed: ${BACKUP_FILE}.gz"