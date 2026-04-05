-- Create unified migration tracking table
-- Migration: 0017_add_migration_tracking | Module: core | Created: 2026-03-06
CREATE TABLE IF NOT EXISTS molos_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT NOT NULL,
  module TEXT NOT NULL,
  version INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  applied_at INTEGER NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  success INTEGER NOT NULL,
  rollback_available INTEGER NOT NULL,
  sql_content TEXT,
  error_message TEXT
);

--> statement-breakpoint

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_migrations_module_version ON molos_migrations(module, version);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_migrations_name ON molos_migrations(migration_name);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_migrations_module ON molos_migrations(module);

--> statement-breakpoint

-- Migrate existing data from __drizzle_migrations if it exists
-- Note: The __drizzle_migrations table migration is handled separately to avoid
-- errors on fresh installs where the table doesn't exist.
-- This migration creates the new tracking table; legacy data migration is optional.
