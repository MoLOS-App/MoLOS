/**
 * Module Error Handling & Recovery
 *
 * Provides utilities for categorizing, logging, and recording module errors
 * with suggested recovery steps.
 */

import type { ModuleError } from '../config/module-types.ts';

export type ErrorCategory =
	| 'manifest_validation'
	| 'migration_failed'
	| 'config_export'
	| 'symlink_failed'
	| 'unknown';

type ErrorRecoveryMap = {
	[key in ErrorCategory]: string[];
};

const recoverySteps: ErrorRecoveryMap = {
	manifest_validation: [
		'Check manifest.yaml exists in module root',
		'Validate manifest.yaml syntax (YAML format)',
		'Ensure required fields: id, name, version',
		'Module ID must match folder name',
		'Module ID must contain only alphanumeric characters, hyphens, and underscores'
	],
	migration_failed: [
		'Check drizzle folder exists with migration SQL files',
		'Ensure all table names start with "molos_" or module ID prefix',
		'Validate SQL syntax in migration files',
		'Check database has proper SQLite support',
		'Review migration logs for specific SQL errors'
	],
	config_export: [
		'Ensure config.ts exports default or moduleConfig',
		'Verify config object has required fields: id, name, href, icon, navigation',
		'Check href format (must start with /ui/)',
		'Ensure icon is a valid Lucide icon component',
		'Verify navigation array contains valid NavItem objects'
	],
	symlink_failed: [
		'Check file system permissions for src/ directory',
		'Ensure no conflicting files/symlinks exist',
		'Verify source paths exist in module folder',
		'Check disk space availability',
		'Review system symlink support'
	],
	unknown: [
		'Contact module developer for support',
		'Check module documentation',
		'Review system logs for details'
	]
};

/**
 * Create a structured ModuleError object
 */
export function createModuleError(
	category: ErrorCategory,
	message: string,
	details?: Record<string, unknown>
): ModuleError {
	return {
		status:
			category === 'manifest_validation'
				? 'error_manifest'
				: category === 'migration_failed'
					? 'error_migration'
					: category === 'config_export'
						? 'error_config'
						: 'error_migration',
		errorType: category,
		message,
		timestamp: new Date(),
		details,
		recoverySteps: recoverySteps[category]
	};
}

/**
 * Categorize error based on exception type and message
 */
export function categorizeError(error: unknown): ErrorCategory {
	const message = error instanceof Error ? error.message : String(error);

	if (message.includes('manifest') || message.includes('Missing required')) {
		return 'manifest_validation';
	}
	if (
		message.includes('migration') ||
		message.includes('SQL') ||
		message.includes('table prefix') ||
		message.includes('schema')
	) {
		return 'migration_failed';
	}
	if (message.includes('config') || message.includes('export') || message.includes('hrefs')) {
		return 'config_export';
	}
	if (message.includes('symlink') || message.includes('EACCES') || message.includes('EEXIST')) {
		return 'symlink_failed';
	}

	return 'unknown';
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(
	moduleId: string,
	error: unknown,
	operation: string
): { category: ErrorCategory; message: string; details: string } {
	const category = categorizeError(error);
	const errorMessage = error instanceof Error ? error.message : String(error);
	const errorStack = error instanceof Error ? error.stack : undefined;

	return {
		category,
		message: `Module ${moduleId} failed during ${operation}: ${errorMessage}`,
		details: errorStack || errorMessage
	};
}
