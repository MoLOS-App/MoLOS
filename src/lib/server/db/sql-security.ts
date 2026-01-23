/**
 * SQL Security & Validation Layer
 *
 * Provides secure SQL parsing and validation for module migrations.
 * Ensures modules follow table naming conventions and don't execute dangerous operations.
 */

import { readFileSync } from 'fs';
import path from 'path';

interface SQLValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
	tables: string[];
}

/**
 * Whitelist of allowed SQL keywords/operations
 */
const ALLOWED_KEYWORDS = [
	'CREATE',
	'TABLE',
	'IF',
	'NOT',
	'EXISTS',
	'ALTER',
	'ADD',
	'COLUMN',
	'DROP',
	'CONSTRAINT',
	'PRIMARY',
	'KEY',
	'FOREIGN',
	'REFERENCES',
	'UNIQUE',
	'CHECK',
	'DEFAULT',
	'COLLATE',
	'TEXT',
	'INTEGER',
	'REAL',
	'BLOB',
	'NUMERIC',
	'AUTOINCREMENT',
	'ON',
	'DELETE',
	'CASCADE',
	'RESTRICT',
	'NO',
	'ACTION'
];

const DANGEROUS_KEYWORDS = [
	'DROP DATABASE',
	'DROP SCHEMA',
	'PRAGMA',
	'ATTACH',
	'DETACH',
	'VACUUM',
	'CREATE TRIGGER',
	'CREATE VIEW',
	'CREATE VIRTUAL TABLE'
];

const IGNORED_TABLE_TOKENS = new Set(['IF', 'NOT', 'EXISTS']);

/**
 * SQL Security Validator
 */
export class SQLValidator {
	/**
	 * Validate a SQL migration file
	 */
	static validateMigrationFile(filePath: string, moduleId: string): SQLValidationResult {
		try {
			const content = readFileSync(filePath, 'utf-8');
			return this.validateSQL(content, moduleId);
		} catch (error) {
			return {
				valid: false,
				errors: [
					`Failed to read migration file: ${error instanceof Error ? error.message : String(error)}`
				],
				warnings: [],
				tables: []
			};
		}
	}

	/**
	 * Validate SQL content string
	 */
	static validateSQL(content: string, moduleId: string): SQLValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		const tables: string[] = [];

		// Remove comments and normalize whitespace
		let normalized = this.normalizeSQL(content);

		// Check for dangerous operations
		for (const keyword of DANGEROUS_KEYWORDS) {
			if (normalized.includes(keyword)) {
				errors.push(`Dangerous operation detected: ${keyword}`);
			}
		}

		// Extract and validate table names
		const tableRegex =
			/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)*["'`]?([a-zA-Z0-9_-]+)["'`]?/gi;
		const tableMatches = normalized.matchAll(tableRegex);

		for (const match of tableMatches) {
			const tableName = match[1];
			if (!tableName) continue;
			if (IGNORED_TABLE_TOKENS.has(tableName.toUpperCase())) {
				continue;
			}

			tables.push(tableName);

			// Validate table naming convention
			const normalizedModuleId = moduleId.toLowerCase().replace(/-/g, '_');
			const normalizedTableName = tableName.toLowerCase().replace(/-/g, '_');
			const isValidPrefix =
				normalizedTableName.startsWith('molos_') ||
				normalizedTableName.startsWith(normalizedModuleId + '_') ||
				tableName.startsWith(moduleId + '_') ||
				normalizedTableName === normalizedModuleId;

			if (!isValidPrefix) {
				errors.push(
					`Table "${tableName}" must start with "molos_" or "${moduleId}_" prefix (module ID: ${moduleId})`
				);
			}

			// Warn about table name patterns
			if (tableName.toLowerCase().includes('temp') || tableName.toLowerCase().includes('test')) {
				warnings.push(`Table "${tableName}" appears to be temporary or for testing`);
			}
		}

		// Check for ALTER TABLE operations
		const alterMatches = normalized.match(/ALTER\s+TABLE\s+["'`]?(\w+)["'`]?/gi);
		if (alterMatches) {
			for (const match of alterMatches) {
				const tableName = match.replace(/ALTER\s+TABLE\s+["'`]?/gi, '').replace(/["'`]?$/g, '');

				// ALTER is allowed but warn if modifying existing tables
				if (!tables.includes(tableName)) {
					warnings.push(
						`ALTER TABLE "${tableName}" modifies existing table (not created in this migration)`
					);
				}
			}
		}

		// Check for DROP operations
		const dropMatches = normalized.match(/DROP\s+TABLE\s+["'`]?(\w+)["'`]?/gi);
		if (dropMatches) {
			warnings.push(`Migration includes DROP TABLE operations - ensure this is intentional`);
		}

		// Validate SQL syntax (basic checks)
		const semicolonCount = (content.match(/;/g) || []).length;
		const statements = content.split(';').filter((s) => s.trim());

		if (statements.length === 0 && content.trim()) {
			warnings.push('No SQL statements found (file might be empty or only comments)');
		}

		// Check for incomplete statements
		for (const statement of statements) {
			const trimmed = statement.trim();
			if (!trimmed) continue;
			if (trimmed.startsWith('--') || trimmed.startsWith('/*')) continue;

			if (!this.isValidStatement(trimmed)) {
				errors.push(`Invalid or incomplete SQL statement: ${trimmed.substring(0, 50)}...`);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
			tables
		};
	}

	/**
	 * Check if a SQL statement is valid (basic heuristic)
	 */
	private static isValidStatement(statement: string): boolean {
		const normalized = statement.trim().toUpperCase();

		// Must start with a valid keyword
		const startsWithValid = ALLOWED_KEYWORDS.some((kw) => normalized.startsWith(kw));

		if (!startsWithValid) {
			return false;
		}

		// Must have balanced parentheses
		const openParens = (statement.match(/\(/g) || []).length;
		const closeParens = (statement.match(/\)/g) || []).length;

		return openParens === closeParens;
	}

	/**
	 * Normalize SQL: remove comments, normalize whitespace
	 */
	private static normalizeSQL(sql: string): string {
		// Remove line comments
		let normalized = sql.replace(/--.*$/gm, '');

		// Remove block comments
		normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '');

		// Normalize whitespace
		normalized = normalized.replace(/\s+/g, ' ').trim();

		// Collapse duplicate IF NOT EXISTS sequences
		normalized = normalized.replace(
			/IF\s+NOT\s+EXISTS(\s+IF\s+NOT\s+EXISTS)+/gi,
			'IF NOT EXISTS'
		);

		return normalized.toUpperCase();
	}

	/**
	 * Analyze all SQL files in a drizzle directory
	 */
	static analyzeDirectory(
		drizzlePath: string,
		moduleId: string
	): {
		valid: boolean;
		files: Record<string, SQLValidationResult>;
		allTables: string[];
	} {
		const fs = require('fs');
		const files: Record<string, SQLValidationResult> = {};
		const allTables: string[] = [];

		try {
			const items = fs.readdirSync(drizzlePath);
			const sqlFiles = items.filter((f: string) => f.endsWith('.sql'));

			for (const file of sqlFiles) {
				const filePath = path.join(drizzlePath, file);
				const result = this.validateMigrationFile(filePath, moduleId);
				files[file] = result;
				allTables.push(...result.tables);
			}
		} catch (error) {
			return {
				valid: false,
				files: { error: { valid: false, errors: [String(error)], warnings: [], tables: [] } },
				allTables: []
			};
		}

		const valid = Object.values(files).every((result) => result.valid);

		return { valid, files, allTables };
	}
}

/**
 * Generate human-readable report from validation results
 */
export function formatValidationReport(result: SQLValidationResult, fileName: string): string {
	let report = `\n  File: ${fileName}\n`;

	if (result.valid) {
		report += `  ✅ Valid\n`;
	} else {
		report += `  ❌ Invalid\n`;
	}

	if (result.errors.length > 0) {
		report += `  Errors:\n`;
		result.errors.forEach((error) => {
			report += `    • ${error}\n`;
		});
	}

	if (result.warnings.length > 0) {
		report += `  Warnings:\n`;
		result.warnings.forEach((warning) => {
			report += `    • ${warning}\n`;
		});
	}

	if (result.tables.length > 0) {
		report += `  Tables: ${result.tables.join(', ')}\n`;
	}

	return report;
}
