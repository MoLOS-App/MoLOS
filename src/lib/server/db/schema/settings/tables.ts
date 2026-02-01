import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { user } from '../auth-schema';
import { textEnum } from '../../utils';

export const ExternalModuleStatus = {
	PENDING: 'pending',
	ACTIVE: 'active',
	ERROR_MANIFEST: 'error_manifest',
	ERROR_MIGRATION: 'error_migration',
	ERROR_CONFIG: 'error_config',
	DISABLED: 'disabled',
	DELETING: 'deleting'
} as const;

export const ServerLogLevel = {
	INFO: 'info',
	WARN: 'warn',
	ERROR: 'error'
} as const;

/**
 * Settings - User Preferences
 * Stores general user settings like theme, layout, etc.
 */
export const settingsUser = sqliteTable('settings_user', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	theme: text('theme').notNull().default('light'),
	layoutConfig: text('layout_config', { mode: 'json' }),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * Settings - Module Activation
 * Stores which modules and submodules are enabled for each user
 */
export const settingsModules = sqliteTable(
	'settings_modules',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		moduleId: text('module_id').notNull(),
		submoduleId: text('submodule_id').notNull().default('main'), // Use "main" instead of null
		enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
		menuOrder: integer('menu_order').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [primaryKey({ columns: [table.userId, table.moduleId, table.submoduleId] })]
);

/**
 * Settings - External Modules
 * Tracks modules installed via git clone
 */
export const settingsExternalModules = sqliteTable('settings_external_modules', {
	id: text('id').primaryKey(), // folder name
	repoUrl: text('repo_url').notNull(),
	status: textEnum('status', ExternalModuleStatus).notNull().default(ExternalModuleStatus.PENDING),
	gitRef: text('git_ref').notNull().default('main'), // Git tag/branch to checkout
	blockUpdates: integer('block_updates', { mode: 'boolean' }).notNull().default(false), // Prevent sync script from pulling updates
	lastError: text('last_error'),
	errorDetails: text('error_details'), // JSON serialized error info
	errorType: text('error_type'), // 'manifest_validation', 'migration_failed', 'config_export', etc.
	recoverySteps: text('recovery_steps'), // JSON array of suggested recovery actions
	retryCount: integer('retry_count').notNull().default(0), // Number of retry attempts
	lastRetryAt: integer('last_retry_at', { mode: 'timestamp_ms' }), // Timestamp of last retry
	installedAt: integer('installed_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

/**
 * Settings - Server Logs
 * Tracks system events, module installations, and errors
 */
export const settingsServerLogs = sqliteTable('settings_server_logs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	level: textEnum('level', ServerLogLevel).notNull().default(ServerLogLevel.INFO),
	source: text('source').notNull(), // e.g., "ModuleManager", "Auth", "System"
	message: text('message').notNull(),
	details: text('details'), // JSON or stack trace
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});

/**
 * Settings - System Configuration
 * Stores global system settings like registration allowed, etc.
 */
export const settingsSystem = sqliteTable('settings_system', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	description: text('description'),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

/**
 * Legacy exports for backward compatibility
 */
export const userSettings = settingsUser;
export const moduleSettings = settingsModules;
export const externalModules = settingsExternalModules;
