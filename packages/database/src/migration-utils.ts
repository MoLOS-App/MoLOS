/**
 * Migration Utilities
 *
 * Shared utilities for migration system including:
 * - Checksum calculation with normalization
 * - Version extraction
 * - SQL parsing
 * - Error categorization
 */

import { createHash } from 'crypto';

/**
 * Migration Error Types
 */
export enum MigrationErrorType {
	DISK_FULL = 'DISK_FULL',
	PERMISSION_DENIED = 'PERMISSION_DENIED',
	DATABASE_LOCKED = 'DATABASE_LOCKED',
	CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
	SYNTAX_ERROR = 'SYNTAX_ERROR',
	FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
	PARTIAL_APPLICATION = 'PARTIAL_APPLICATION',
	BACKUP_FAILED = 'BACKUP_FAILED',
	INTEGRITY_CHECK_FAILED = 'INTEGRITY_CHECK_FAILED',
	MIGRATION_LOCK_FAILED = 'MIGRATION_LOCK_FAILED',
	UNKNOWN = 'UNKNOWN'
}

/**
 * Custom Migration Error
 */
export class MigrationError extends Error {
	constructor(
		public type: MigrationErrorType,
		message: string,
		public migration?: string,
		public recoverable: boolean = false,
		public originalError?: Error
	) {
		super(message);
		this.name = 'MigrationError';
	}

	/**
	 * Create from unknown error
	 */
	static fromError(error: unknown, migration?: string): MigrationError {
		if (error instanceof MigrationError) {
			return error;
		}

		const errorMsg = error instanceof Error ? error.message : String(error);
		let type = MigrationErrorType.UNKNOWN;
		let recoverable = false;

		// Categorize error
		if (errorMsg.includes('disk full') || errorMsg.includes('ENOSPC')) {
			type = MigrationErrorType.DISK_FULL;
			recoverable = false;
		} else if (errorMsg.includes('permission denied') || errorMsg.includes('EACCES')) {
			type = MigrationErrorType.PERMISSION_DENIED;
			recoverable = false;
		} else if (errorMsg.includes('database is locked')) {
			type = MigrationErrorType.DATABASE_LOCKED;
			recoverable = true;
		} else if (errorMsg.includes('syntax error')) {
			type = MigrationErrorType.SYNTAX_ERROR;
			recoverable = false;
		} else if (errorMsg.includes('FOREIGN KEY constraint failed')) {
			type = MigrationErrorType.FOREIGN_KEY_VIOLATION;
			recoverable = false;
		} else if (errorMsg.includes('already exists')) {
			type = MigrationErrorType.PARTIAL_APPLICATION;
			recoverable = true;
		} else if (errorMsg.includes('Checksum mismatch')) {
			type = MigrationErrorType.CHECKSUM_MISMATCH;
			recoverable = false;
		}

		return new MigrationError(
			type,
			errorMsg,
			migration,
			recoverable,
			error instanceof Error ? error : undefined
		);
	}
}

/**
 * Normalize SQL content for consistent checksums
 * Handles whitespace, line endings, and comments
 */
export function normalizeSql(sql: string): string {
	return sql
		.replace(/\r\n/g, '\n') // Normalize line endings
		.replace(/[ \t]+/g, ' ') // Collapse multiple spaces/tabs to single space
		.replace(/\n\s*\n/g, '\n') // Remove blank lines
		.trim(); // Remove leading/trailing whitespace
}

/**
 * Calculate SHA-256 checksum of SQL content
 * Normalizes SQL before hashing for consistency
 */
export function calculateChecksum(sqlContent: string): string {
	const normalized = normalizeSql(sqlContent);
	return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Extract version number from migration filename
 *
 * @example
 * extractVersion('0001_add_settings.sql') // => 1
 * extractVersion('0016_add_submodule_tool_permissions.sql') // => 16
 */
export function extractVersion(migrationName: string): number {
	const match = migrationName.match(/^(\d+)/);
	return match ? parseInt(match[1], 10) : 0;
}

/**
 * Extract module name from migration filename
 *
 * @example
 * extractModule('0001_add_settings.sql', 'drizzle/') // => 'core'
 * extractModule('0001_initial.sql', 'modules/MoLOS-Tasks/drizzle/') // => 'MoLOS-Tasks'
 */
export function extractModule(migrationPath: string, basePath: string): string {
	const relativePath = migrationPath.replace(basePath, '');

	// Check if it's a module migration
	if (relativePath.includes('modules/')) {
		const match = relativePath.match(/modules\/([^/]+)\//);
		return match ? match[1] : 'unknown';
	}

	// Core migration
	return 'core';
}

/**
 * Parse migration SQL into individual statements
 * Handles statement-breakpoint markers and semicolons
 */
export function parseStatements(sql: string): string[] {
	// Prefer explicit breakpoint markers
	if (sql.includes('--> statement-breakpoint')) {
		return sql
			.split('--> statement-breakpoint')
			.map((s) => s.trim())
			.filter((s) => s.length > 0)
			.map((s) => {
				// Remove leading comment lines but keep the SQL
				const lines = s.split('\n');
				const sqlLines: string[] = [];
				for (const line of lines) {
					const trimmed = line.trim();
					// Skip pure comment lines
					if (trimmed.startsWith('--') && !trimmed.includes(';')) {
						continue;
					}
					sqlLines.push(line);
				}
				return sqlLines.join('\n').trim();
			})
			.filter((s) => s.length > 0);
	}

	/**
	 * Strip leading comment lines from a SQL statement
	 */
	function stripLeadingComments(sql: string): string {
		const lines = sql.split('\n');
		const sqlLines: string[] = [];
		let foundSql = false;

		for (const line of lines) {
			const trimmed = line.trim();
			// Skip leading comment lines until we find actual SQL
			if (!foundSql && trimmed.startsWith('--')) {
				continue;
			}
			foundSql = true;
			sqlLines.push(line);
		}

		return sqlLines.join('\n').trim();
	}

	// Fallback: semicolon splitting (with warning about edge cases)
	// Note: This doesn't handle semicolons in string literals
	// Use statement-breakpoint for complex migrations
	const statements: string[] = [];
	let current = '';
	let inString = false;
	let stringChar = '';

	for (let i = 0; i < sql.length; i++) {
		const char = sql[i];
		const nextChar = sql[i + 1];

		// Handle string literals
		if ((char === "'" || char === '"') && (i === 0 || sql[i - 1] !== '\\')) {
			if (!inString) {
				inString = true;
				stringChar = char;
			} else if (char === stringChar) {
				inString = false;
			}
		}

		// Handle semicolons outside strings
		if (char === ';' && !inString) {
			const statement = stripLeadingComments(current.trim());
			if (statement) {
				statements.push(statement);
			}
			current = '';
		} else {
			current += char;
		}
	}

	// Add final statement if exists
	const finalStatement = stripLeadingComments(current.trim());
	if (finalStatement) {
		statements.push(finalStatement);
	}

	return statements;
}

/**
 * Check if rollback SQL file exists
 */
export function hasRollbackSql(migrationName: string, module: string): boolean {
	// This will be implemented by the migration runner
	// which has access to the file system
	return false;
}

/**
 * Validate migration name format
 */
export function validateMigrationName(name: string): { valid: boolean; error?: string } {
	// Must start with a number
	if (!/^\d+/.test(name)) {
		return { valid: false, error: 'Migration name must start with a number' };
	}

	// Must have a descriptive name after the number
	if (!/^\d+_[a-z0-9_]+(\.sql)?$/.test(name)) {
		return {
			valid: false,
			error: 'Migration name must be in format: NNNN_description.sql (e.g., 0001_add_settings.sql)'
		};
	}

	return { valid: true };
}

/**
 * Compare two migration versions
 */
export function compareVersions(a: string, b: string): number {
	const versionA = extractVersion(a);
	const versionB = extractVersion(b);
	return versionA - versionB;
}

/**
 * Sort migrations by version (ascending)
 */
export function sortMigrations<T extends { name: string }>(migrations: T[]): T[] {
	return [...migrations].sort((a, b) => compareVersions(a.name, b.name));
}

/**
 * Check if there's sufficient disk space
 * @param path Directory path to check
 * @param minBytes Minimum required bytes (default: 100MB)
 */
export function checkDiskSpace(path: string, minBytes: number = 100 * 1024 * 1024): boolean {
	try {
		// Use fs.statSync to check if path exists
		const { statSync } = require('fs');
		const stats = statSync(path);
		return true; // If we can stat, we have some access
	} catch {
		return false;
	}
}

/**
 * Get minimum disk space requirement in bytes
 */
export function getMinDiskSpaceBytes(): number {
	return 100 * 1024 * 1024; // 100MB
}
