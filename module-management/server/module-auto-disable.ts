/**
 * Module Auto-Disable
 *
 * Automatically marks failed modules as disabled in the database
 * to prevent build failures from breaking the entire application.
 */

import { createRequire } from 'module';
import path from 'path';
import { existsSync } from 'fs';

/**
 * Get database path from environment or default
 */
function getDatabasePath(): string {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) {
		throw new Error('DATABASE_URL environment variable not set');
	}

	// Normalize database URL
	if (dbUrl.startsWith('file:')) return dbUrl.replace(/^file:/, '');
	if (dbUrl.startsWith('sqlite://')) return dbUrl.replace(/^sqlite:\/\//, '');
	if (dbUrl.startsWith('sqlite:')) return dbUrl.replace(/^sqlite:/, '');

	return dbUrl;
}

/**
 * Format error for database storage
 * Truncates long error messages to fit in database text columns
 */
function formatError(error: unknown): string {
	let errorMessage: string;

	if (error instanceof Error) {
		errorMessage = error.message;
		// Add stack trace if available (truncated)
		if (error.stack) {
			const stack = error.stack.split('\n').slice(1, 3).join('; ');
			errorMessage += ` | ${stack}`;
		}
	} else {
		errorMessage = String(error);
	}

	// Truncate to prevent database overflow (SQLite TEXT has reasonable limits)
	const MAX_ERROR_LENGTH = 2000;
	if (errorMessage.length > MAX_ERROR_LENGTH) {
		errorMessage = errorMessage.substring(0, MAX_ERROR_LENGTH - 3) + '...';
	}

	return errorMessage;
}

/**
 * Categorize the error for better diagnostics
 */
function categorizeError(error: unknown): string {
	const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

	if (message.includes('export') || message.includes('undefined') || message.includes('not found')) {
		return 'export_error';
	}
	if (message.includes('yaml') || message.includes('syntax')) {
		return 'syntax_error';
	}
	if (message.includes('schema') || message.includes('table')) {
		return 'schema_error';
	}
	if (message.includes('symlink') || message.includes('link')) {
		return 'symlink_error';
	}
	return 'unknown_error';
}

/**
 * Mark a module as disabled in the database
 *
 * This function is called when a module fails to load during build.
 * It updates the module's status to 'disabled' with error details.
 *
 * @param moduleId - The ID of the module to disable
 * @param error - The error that caused the failure
 * @returns Promise that resolves when the database is updated
 */
export async function markModuleForDisable(
	moduleId: string,
	error: unknown
): Promise<void> {
	const dbPath = getDatabasePath();

	// Check if database exists
	if (!existsSync(dbPath)) {
		console.warn(`[ModuleAutoDisable] Database not found at ${dbPath}, skipping disable`);
		return;
	}

	try {
		const require = createRequire(import.meta.url);
		const Database = require('better-sqlite3');
		const db = new Database(dbPath);

		const errorMessage = formatError(error);
		const errorCategory = categorizeError(error);
		const now = new Date().toISOString();

		// Check if module exists in database
		const existingRow = db
			.prepare('SELECT id, status FROM settings_external_modules WHERE id = ?')
			.get(moduleId);

		if (!existingRow) {
			// Module not in database - this can happen during initial setup
			// Just log a warning and don't create an entry
			console.warn(
				`[ModuleAutoDisable] Module ${moduleId} not found in database, cannot auto-disable`
			);
			db.close();
			return;
		}

		// Update status to disabled with error information
		db.prepare(`
			UPDATE settings_external_modules
			SET status = 'disabled',
			    last_error = ?,
			    error_type = ?,
			    updated_at = ?
			WHERE id = ?
		`).run(errorMessage, errorCategory, now, moduleId);

		db.close();

		console.warn(`[ModuleAutoDisable] Module ${moduleId} marked as disabled:`);
		console.warn(`  Error: ${errorMessage}`);
		console.warn(`  Category: ${errorCategory}`);
		console.warn(`  To re-enable, fix the issue and manually update status to 'active'`);
	} catch (dbError) {
		console.error(
			`[ModuleAutoDisable] Failed to mark module ${moduleId} as disabled:`,
			dbError
		);
	}
}

/**
 * Check if a module is currently marked as disabled
 *
 * @param moduleId - The ID of the module to check
 * @returns True if the module is disabled
 */
export function isModuleDisabled(moduleId: string): boolean {
	const dbPath = getDatabasePath();

	if (!existsSync(dbPath)) {
		return false;
	}

	try {
		const require = createRequire(import.meta.url);
		const Database = require('better-sqlite3');
		const db = new Database(dbPath, { readonly: true });

		const row = db
			.prepare('SELECT status FROM settings_external_modules WHERE id = ?')
			.get(moduleId) as { status: string } | undefined;

		db.close();

		return row?.status === 'disabled';
	} catch {
		return false;
	}
}

/**
 * Get list of disabled modules
 *
 * @returns Array of disabled module IDs
 */
export function getDisabledModules(): string[] {
	const dbPath = getDatabasePath();

	if (!existsSync(dbPath)) {
		return [];
	}

	try {
		const require = createRequire(import.meta.url);
		const Database = require('better-sqlite3');
		const db = new Database(dbPath, { readonly: true });

		const rows = db
			.prepare('SELECT id FROM settings_external_modules WHERE status = ?')
			.all('disabled') as Array<{ id: string }>;

		db.close();

		return rows.map((r) => r.id);
	} catch {
		return [];
	}
}

/**
 * Re-enable a module that was previously disabled
 *
 * @param moduleId - The ID of the module to re-enable
 * @returns Promise that resolves when the database is updated
 */
export async function reenableModule(moduleId: string): Promise<void> {
	const dbPath = getDatabasePath();

	if (!existsSync(dbPath)) {
		throw new Error('Database not found');
	}

	try {
		const require = createRequire(import.meta.url);
		const Database = require('better-sqlite3');
		const db = new Database(dbPath);

		db.prepare(`
			UPDATE settings_external_modules
			SET status = 'pending',
			    last_error = NULL,
			    error_type = NULL,
			    updated_at = ?
			WHERE id = ?
		`).run(new Date().toISOString(), moduleId);

		db.close();

		console.log(`[ModuleAutoDisable] Module ${moduleId} re-enabled`);
	} catch (dbError) {
		console.error(`[ModuleAutoDisable] Failed to re-enable module ${moduleId}:`, dbError);
		throw dbError;
	}
}

/**
 * Clear all disabled module errors (for testing/recovery)
 *
 * @returns Promise that resolves when the database is updated
 */
export async function clearDisabledErrors(): Promise<void> {
	const dbPath = getDatabasePath();

	if (!existsSync(dbPath)) {
		return;
	}

	try {
		const require = createRequire(import.meta.url);
		const Database = require('better-sqlite3');
		const db = new Database(dbPath);

		const result = db.prepare(`
			UPDATE settings_external_modules
			SET status = 'pending',
			    last_error = NULL,
			    error_type = NULL,
			    updated_at = ?
			WHERE status = 'disabled'
		`).run(new Date().toISOString());

		db.close();

		console.log(
			`[ModuleAutoDisable] Cleared errors for ${result.changes} disabled modules`
		);
	} catch (dbError) {
		console.error('[ModuleAutoDisable] Failed to clear disabled errors:', dbError);
		throw dbError;
	}
}
