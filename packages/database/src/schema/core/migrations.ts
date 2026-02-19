import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Module Migrations Tracking
 *
 * Tracks applied migrations for external modules to enable:
 * - Rollback capability when uninstalling modules
 * - Detection of changed migrations
 * - Migration history per module
 */
export const coreModuleMigrations = sqliteTable('core_module_migrations', {
	id: text('id').primaryKey(),
	moduleId: text('module_id').notNull(),
	migrationName: text('migration_name').notNull(),
	appliedAt: integer('applied_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	/**
	 * MD5 or similar checksum of the migration SQL
	 * Used to detect if a migration file has changed since being applied
	 */
	checksum: text('checksum'),
	/**
	 * Timestamp when this migration was rolled back
	 * Null if the migration is still active
	 */
	rolledBackAt: integer('rolled_back_at', { mode: 'timestamp_ms' }),
	/**
	 * SQL to reverse this migration (for rollback)
	 * Generated automatically for simple operations (CREATE TABLE -> DROP TABLE)
	 */
	rollbackSql: text('rollback_sql')
});

// Type exports
export type CoreModuleMigration = typeof coreModuleMigrations.$inferSelect;
export type NewCoreModuleMigration = typeof coreModuleMigrations.$inferInsert;
