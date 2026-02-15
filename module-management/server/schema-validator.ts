/**
 * Schema Validator - Build-Time Schema Export Validation
 *
 * Validates that module schema files export expected tables/exports
 * using regex-based pattern matching (simpler and faster than full AST parsing).
 */

import { readFileSync } from 'fs';
import path from 'path';

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
	valid: boolean;
	missingExports: string[];
	foundExports: string[];
}

/**
 * Module prefix to expected exports mapping
 * Based on common MoLOS module patterns
 */
const MODULE_EXPORT_PATTERNS: Record<string, string[]> = {
	// Tasks module would export these
	tasks: ['tasks', 'tasksTasks', 'task'],
	tasksTasks: ['tasksTasks', 'tasks'],
	task: ['task', 'tasksTasks'],

	// Common patterns
	dashboard: ['dashboard'],
	settings: ['settings', 'userSettings'],
	auth: ['user', 'session'],
	ai: ['ai', 'aiChat', 'aiMessages']
};

/**
 * Get expected exports for a module based on its ID
 */
function getExpectedExportsForModule(moduleId: string): string[] {
	// Normalize module ID
	const normalizedId = moduleId
		.toLowerCase()
		.replace(/^molos-/i, '')
		.replace(/-/g, '');

	// Check for direct match
	if (MODULE_EXPORT_PATTERNS[normalizedId]) {
		return MODULE_EXPORT_PATTERNS[normalizedId];
	}

	// Try to infer from module name
	// e.g., "MoLOS-Tasks" -> ["tasks", "tasksTasks"]
	const baseName = normalizedId.replace('module', '');
	const pluralName = `${baseName}s`;
	const tableName = `${baseName}${baseName}`;

	return [
		baseName,
		pluralName,
		tableName,
		`${baseName}Settings`,
		`${pluralName}Settings`
	];
}

/**
 * Extract export names from a TypeScript file using regex
 * This is faster than full AST parsing and works for most cases
 *
 * Matches patterns like:
 * - export const tableName = sqliteTable(...)
 * - export const table = sqliteTable(...)
 * - export const config = ...
 * - export { foo, bar } from ...
 * - export * from ...
 */
export function extractExports(fileContent: string): Set<string> {
	const exports = new Set<string>();

	// Match: export const foo = ...
	const constExportRegex = /export\s+(?:const|let|var)\s+(\w+)\s*=/g;
	let match;
	while ((match = constExportRegex.exec(fileContent)) !== null) {
		exports.add(match[1]);
	}

	// Match: export function foo(...) {
	const functionExportRegex = /export\s+function\s+(\w+)\s*\(/g;
	while ((match = functionExportRegex.exec(fileContent)) !== null) {
		exports.add(match[1]);
	}

	// Match: export class Foo {
	const classExportRegex = /export\s+class\s+(\w+)\s*(?:\{|extends)/g;
	while ((match = classExportRegex.exec(fileContent)) !== null) {
		exports.add(match[1]);
	}

	// Match: export enum Foo {
	const enumExportRegex = /export\s+enum\s+(\w+)\s*\{/g;
	while ((match = enumExportRegex.exec(fileContent)) !== null) {
		exports.add(match[1]);
	}

	// Match: export interface Foo {
	const interfaceExportRegex = /export\s+interface\s+(\w+)\s*\{/g;
	while ((match = interfaceExportRegex.exec(fileContent)) !== null) {
		exports.add(match[1]);
	}

	// Match: export type Foo =
	const typeExportRegex = /export\s+type\s+(\w+)\s*=/g;
	while ((match = typeExportRegex.exec(fileContent)) !== null) {
		exports.add(match[1]);
	}

	// Match: export { foo, bar } (named exports from other files)
	const namedExportRegex = /export\s*\{\s*([^}]+)\s*\}/g;
	while ((match = namedExportRegex.exec(fileContent)) !== null) {
		const items = match[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]);
		items.forEach((item) => {
			if (item && item !== '*') {
				exports.add(item);
			}
		});
	}

	return exports;
}

/**
 * Check if a file contains any table definitions (Drizzle ORM pattern)
 */
export function hasTableDefinitions(fileContent: string): boolean {
	return /sqliteTable\s*\(/.test(fileContent) || /pgTable\s*\(/.test(fileContent);
}

/**
 * Validate that a schema file has expected exports
 *
 * This is a basic check - it verifies that some exports exist,
 * but doesn't fully validate the export structure (which would require full TypeScript parsing).
 *
 * @param moduleId - The module ID
 * @param schemaPath - Path to the schema file
 * @returns Validation result with missing exports if any
 */
export function validateSchemaExports(
	moduleId: string,
	schemaPath: string
): SchemaValidationResult {
	try {
		const content = readFileSync(schemaPath, 'utf-8');
		const foundExports = extractExports(content);

		// If this is an index file, it might just re-export
		// In that case, we need to check the imported files
		const isIndexFile = path.basename(schemaPath) === 'index.ts';

		if (isIndexFile) {
			// Index files usually just re-export, check if they have any exports at all
			if (foundExports.size === 0) {
				return {
					valid: false,
					missingExports: ['*'],
					foundExports: []
				};
			}
			return {
				valid: true,
				missingExports: [],
				foundExports: Array.from(foundExports)
			};
		}

		// For non-index files, check if they have table definitions
		if (!hasTableDefinitions(content)) {
			// File exists but doesn't define tables - might be utilities
			return {
				valid: true,
				missingExports: [],
				foundExports: Array.from(foundExports)
			};
		}

		// Get expected exports for this module
		// For schema files, we expect at least some table definitions
		if (foundExports.size === 0) {
			return {
				valid: false,
				missingExports: ['<any exports>'],
				foundExports: []
			};
		}

		// If the file has table definitions but no obvious table exports, warn
		const hasTableExport = Array.from(foundExports).some((name) =>
			/table/i.test(name) || /schema/i.test(name)
		);

		if (!hasTableExport && content.includes('sqliteTable')) {
			// Has table definitions but unclear export names
			// This is a soft warning - module might still work
			return {
				valid: true,
				missingExports: [],
				foundExports: Array.from(foundExports)
			};
		}

		return {
			valid: true,
			missingExports: [],
			foundExports: Array.from(foundExports)
		};
	} catch (error) {
		return {
			valid: false,
			missingExports: [`<read error: ${error instanceof Error ? error.message : String(error)}>`],
			foundExports: []
		};
	}
}

/**
 * Quick check if a schema file is likely valid
 * Returns true if the file exists and has some exports
 */
export function quickValidateSchema(schemaPath: string): boolean {
	try {
		const content = readFileSync(schemaPath, 'utf-8');

		// Check for at least one export statement
		return /export\s+/.test(content);
	} catch {
		return false;
	}
}

/**
 * Validate all schema files in a directory
 */
export function validateSchemaDirectory(
	moduleId: string,
	schemaDirPath: string
): { valid: boolean; fileResults: Map<string, SchemaValidationResult> } {
	const { readdirSync } = require('fs');
	const fileResults = new Map<string, SchemaValidationResult>();
	let allValid = true;

	try {
		const files = readdirSync(schemaDirPath)
			.filter((f: string) => f.endsWith('.ts'))
			.filter((f: string) => f !== 'index.ts'); // Skip index, validate source files

		for (const file of files) {
			const filePath = path.join(schemaDirPath, file);
			const result = validateSchemaExports(moduleId, filePath);

			fileResults.set(file, result);

			if (!result.valid) {
				allValid = false;
			}
		}
	} catch (error) {
		// Can't read directory
		return {
			valid: false,
			fileResults: new Map([
				[
					'<directory>',
					{
						valid: false,
						missingExports: [`<directory read error: ${error}>`],
						foundExports: []
					}
				]
			])
		};
	}

	return { valid: allValid, fileResults };
}

/**
 * Find schema files in a module directory
 */
export function findSchemaFiles(modulePath: string): string[] {
	const { existsSync, readdirSync } = require('fs');

	const schemaDir = path.join(modulePath, 'lib/server/db/schema');

	if (!existsSync(schemaDir)) {
		return [];
	}

	try {
		return readdirSync(schemaDir)
			.filter((f: string) => f.endsWith('.ts'))
			.filter((f: string) => f !== 'index.ts')
			.map((f: string) => path.join(schemaDir, f));
	} catch {
		return [];
	}
}
