/**
 * Schema Validation Utility
 *
 * Compares actual database schema against expected tables from Drizzle definitions.
 * Used to verify migrations were applied correctly and detect schema drift.
 */

import Database from 'better-sqlite3';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export interface ColumnInfo {
	name: string;
	type: string;
	notnull: number;
	pk: number;
	dflt_value: string | null;
}

export interface TableInfo {
	name: string;
	columns: ColumnInfo[];
}

export interface SchemaDiff {
	valid: boolean;
	missingTables: string[];
	extraTables: string[];
	missingColumns: { table: string; column: string }[];
	extraColumns: { table: string; column: string }[];
	typeMismatches: { table: string; column: string; expected: string; actual: string }[];
	warnings: string[];
}

export interface SchemaValidationOptions {
	ignoreTables?: string[];
	ignoreColumns?: { table: string; column: string }[];
	checkTypes?: boolean;
}

const DEFAULT_IGNORE_TABLES = ['sqlite_', '__drizzle', '__new', 'core_module_migrations'];

function getDatabasePath(): string {
	const rawDbPath =
		process.env.DATABASE_URL?.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '') ||
		(process.env.NODE_ENV === 'production' ? '/data/molos.db' : 'molos.db');
	return rawDbPath;
}

function extractTablesFromModuleSchemas(): Set<string> {
	const expectedTables = new Set<string>();
	const modulesPath = join(process.cwd(), 'modules');

	if (!existsSync(modulesPath)) {
		return expectedTables;
	}

	const modules = readdirSync(modulesPath, { withFileTypes: true })
		.filter((d) => d.isDirectory() && (d.name.startsWith('MoLOS-') || d.name === 'ai'))
		.map((d) => d.name);

	for (const moduleName of modules) {
		const drizzlePath = join(modulesPath, moduleName, 'drizzle');
		if (!existsSync(drizzlePath)) continue;

		const sqlFiles = readdirSync(drizzlePath).filter((f) => f.endsWith('.sql'));
		for (const sqlFile of sqlFiles) {
			const sql = readFileSync(join(drizzlePath, sqlFile), 'utf-8');
			const matches = sql.matchAll(
				/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([\w-]+)[`"']?/gi
			);
			for (const match of matches) {
				if (match[1] && !match[1].startsWith('__')) {
					expectedTables.add(match[1]);
				}
			}
		}
	}

	return expectedTables;
}

function extractCoreTablesFromMigrations(): Set<string> {
	const expectedTables = new Set<string>();
	const drizzlePath = join(process.cwd(), 'drizzle');

	if (!existsSync(drizzlePath)) {
		return expectedTables;
	}

	const sqlFiles = readdirSync(drizzlePath).filter((f) => f.endsWith('.sql'));
	for (const sqlFile of sqlFiles) {
		const sql = readFileSync(join(drizzlePath, sqlFile), 'utf-8');
		const matches = sql.matchAll(
			/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([\w-]+)[`"']?/gi
		);
		for (const match of matches) {
			if (match[1] && !match[1].startsWith('__')) {
				expectedTables.add(match[1]);
			}
		}
	}

	return expectedTables;
}

export function validateSchema(dbPath?: string, options: SchemaValidationOptions = {}): SchemaDiff {
	const actualDbPath = dbPath || getDatabasePath();
	const diff: SchemaDiff = {
		valid: true,
		missingTables: [],
		extraTables: [],
		missingColumns: [],
		extraColumns: [],
		typeMismatches: [],
		warnings: []
	};

	if (!existsSync(actualDbPath)) {
		diff.valid = false;
		diff.warnings.push(`Database file not found: ${actualDbPath}`);
		return diff;
	}

	const db = new Database(actualDbPath, { readonly: true });

	try {
		const ignoreTables = [...DEFAULT_IGNORE_TABLES, ...(options.ignoreTables || [])];

		// Get actual tables
		const actualTables = db
			.prepare(
				`SELECT name FROM sqlite_master 
         WHERE type='table' 
         AND name NOT LIKE 'sqlite_%' 
         AND name NOT LIKE '__drizzle%'`
			)
			.all() as { name: string }[];

		const actualTableNames = new Set(actualTables.map((t) => t.name));

		// Get expected tables from migrations
		const expectedTables = new Set([
			...extractCoreTablesFromMigrations(),
			...extractTablesFromModuleSchemas()
		]);

		// Find missing and extra tables
		for (const expectedTable of expectedTables) {
			let shouldCheck = true;
			for (const ignore of ignoreTables) {
				if (expectedTable.includes(ignore)) {
					shouldCheck = false;
					break;
				}
			}
			if (shouldCheck && !actualTableNames.has(expectedTable)) {
				diff.missingTables.push(expectedTable);
			}
		}

		for (const actualTable of actualTableNames) {
			let shouldCheck = true;
			for (const ignore of ignoreTables) {
				if (actualTable.includes(ignore)) {
					shouldCheck = false;
					break;
				}
			}
			if (shouldCheck && !expectedTables.has(actualTable)) {
				diff.extraTables.push(actualTable);
			}
		}

		// Get column info for expected tables
		const ignoreColumnsSet = new Set(
			(options.ignoreColumns || []).map((ic) => `${ic.table}.${ic.column}`)
		);

		for (const tableName of expectedTables) {
			if (!actualTableNames.has(tableName)) continue;

			try {
				const columns = db.pragma(`table_info("${tableName}")`) as ColumnInfo[];
				const actualColumns = new Set(columns.map((c) => c.name));

				// Check for missing columns by comparing table structure
				// Note: We can't easily check expected columns without parsing schema files
				// For now, we just report the actual structure
			} catch (e) {
				diff.warnings.push(`Could not read columns for table ${tableName}`);
			}
		}

		// Set validity
		if (diff.missingTables.length > 0 || diff.extraTables.length > 0) {
			diff.valid = false;
		}
	} finally {
		db.close();
	}

	return diff;
}

export function formatSchemaDiff(diff: SchemaDiff, verbose: boolean = false): string {
	const lines: string[] = [];

	if (diff.valid) {
		lines.push('✅ Schema validation passed');
	} else {
		lines.push('❌ Schema validation failed');
	}

	if (diff.missingTables.length > 0) {
		lines.push(`\n📦 Missing tables (${diff.missingTables.length}):`);
		diff.missingTables.forEach((t) => lines.push(`  - ${t}`));
	}

	if (diff.extraTables.length > 0) {
		lines.push(`\n📦 Extra tables (${diff.extraTables.length}):`);
		diff.extraTables.forEach((t) => lines.push(`  - ${t}`));
	}

	if (diff.missingColumns.length > 0) {
		lines.push(`\n📝 Missing columns (${diff.missingColumns.length}):`);
		diff.missingColumns.forEach((c) => lines.push(`  - ${c.table}.${c.column}`));
	}

	if (diff.extraColumns.length > 0) {
		lines.push(`\n📝 Extra columns (${diff.extraColumns.length}):`);
		diff.extraColumns.forEach((c) => lines.push(`  - ${c.table}.${c.column}`));
	}

	if (diff.typeMismatches.length > 0) {
		lines.push(`\n⚠️ Type mismatches (${diff.typeMismatches.length}):`);
		diff.typeMismatches.forEach((t) =>
			lines.push(`  - ${t.table}.${t.column}: expected ${t.expected}, got ${t.actual}`)
		);
	}

	if (diff.warnings.length > 0) {
		lines.push(`\n⚡ Warnings (${diff.warnings.length}):`);
		diff.warnings.forEach((w) => lines.push(`  - ${w}`));
	}

	return lines.join('\n') || 'Schema is valid';
}

export function getSchemaStats(dbPath?: string): {
	tableCount: number;
	tables: string[];
	moduleTableCounts: Record<string, number>;
	coreTableCount: number;
} {
	const actualDbPath = dbPath || getDatabasePath();
	const db = new Database(actualDbPath, { readonly: true });

	try {
		const tables = db
			.prepare(
				`SELECT name FROM sqlite_master 
         WHERE type='table' 
         AND name NOT LIKE 'sqlite_%' 
         AND name NOT LIKE '__drizzle%'
         ORDER BY name`
			)
			.all() as { name: string }[];

		const tableNames = tables.map((t) => t.name);
		const moduleTableCounts: Record<string, number> = {};

		let coreTableCount = 0;
		for (const tableName of tableNames) {
			if (tableName.startsWith('MoLOS-') || tableName.startsWith('MoLOS_')) {
				const moduleName = tableName.split('_')[0];
				moduleTableCounts[moduleName] = (moduleTableCounts[moduleName] || 0) + 1;
			} else {
				coreTableCount++;
			}
		}

		return {
			tableCount: tableNames.length,
			tables: tableNames,
			moduleTableCounts,
			coreTableCount
		};
	} finally {
		db.close();
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const diff = validateSchema();
	console.log(formatSchemaDiff(diff));
	console.log('\n--- Schema Stats ---');
	const stats = getSchemaStats();
	console.log(`Total tables: ${stats.tableCount}`);
	console.log(`Core tables: ${stats.coreTableCount}`);
	console.log(`Module tables: ${stats.tableCount - stats.coreTableCount}`);

	const moduleEntries = Object.entries(stats.moduleTableCounts);
	if (moduleEntries.length > 0) {
		console.log('\nTables by module:');
		moduleEntries.forEach(([module, count]) => {
			console.log(`  ${module}: ${count}`);
		});
	}

	if (!diff.valid) {
		process.exit(1);
	}
}
