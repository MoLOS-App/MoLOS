import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * @deprecated Use molosMigrations instead
 *
 * Module Migrations Tracking (Legacy)
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
	checksum: text('checksum'),
	rolledBackAt: integer('rolled_back_at', { mode: 'timestamp_ms' }),
	rollbackSql: text('rollback_sql')
});

/**
 * Unified Migration Tracking (NEW)
 *
 * Replaces both __drizzle_migrations and core_module_migrations.
 *
 * Tracks all migrations (core and modules) in a single table.
 * Includes checksums for validation and execution metrics.
 */
export const molosMigrations = sqliteTable(
	'molos_migrations',
	{
		// Primary key
		id: integer('id').primaryKey({ autoIncrement: true }),

		// Migration identification
		migration_name: text('migration_name').notNull(), // '0001_add_settings'
		module: text('module').notNull(), // 'core' or 'MoLOS-Tasks'
		version: integer('version').notNull(), // Extracted from filename: 1

		// Validation
		checksum: text('checksum').notNull(), // SHA-256 of SQL content

		// Execution details
		applied_at: integer('applied_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
		execution_time_ms: integer('execution_time_ms').notNull(),

		// Status
		success: integer('success', { mode: 'boolean' }).notNull(),
		rollback_available: integer('rollback_available', { mode: 'boolean' }).notNull(),

		// Metadata
		sql_content: text('sql_content'), // Original SQL (optional, for debugging)
		error_message: text('error_message') // If failed
	},
	(table) => ({
		// Fast lookups
		moduleVersionIdx: index('idx_migrations_module_version').on(table.module, table.version),
		nameIdx: index('idx_migrations_name').on(table.migration_name),
		moduleIdx: index('idx_migrations_module').on(table.module)
	})
);

// Type exports
export type CoreModuleMigration = typeof coreModuleMigrations.$inferSelect;
export type NewCoreModuleMigration = typeof coreModuleMigrations.$inferInsert;

/**
 * Unified Migration Tracking
 *
 * Modern migration tracking table with checksums and execution metrics.
 * This replaces the dual-system of __drizzle_migrations and core_module_migrations.
 */
export type MolosMigration = typeof molosMigrations.$inferSelect;
export type NewMolosMigration = typeof molosMigrations.$inferInsert;
