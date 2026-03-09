-- Migration: 0017_add_migration_tracking
-- Module: core
-- Created: 2026-03-06
-- Purpose: Add unified migration tracking table

-- Create unified migration tracking table
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
-- Note: We keep __drizzle_migrations for backward compatibility during transition
-- It will be deprecated in a future version
INSERT OR IGNORE INTO molos_migrations (migration_name, module, version, checksum, applied_at, execution_time_ms, success, rollback_available)
SELECT 
  'migrated_from_drizzle' as migration_name,
  'core' as module,
  0 as version,
  'unknown' as checksum,
  created_at as applied_at,
  0 as execution_time_ms,
  1 as success,
  0 as rollback_available
FROM __drizzle_migrations;
