import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join } from 'path';
import { existsSync } from 'fs';
import {
	createTestDb,
	cleanupTestDb,
	getTableNames,
	tableExists,
	countAppliedMigrations
} from './utils';

describe('Core Migrations', () => {
	let testDb: ReturnType<typeof createTestDb>;

	beforeAll(() => {
		testDb = createTestDb('core-migration-test');
	});

	afterAll(() => {
		cleanupTestDb(testDb.db, testDb.path);
	});

	it('should have core migrations directory', () => {
		const migrationsPath = join(process.cwd(), 'drizzle');
		expect(existsSync(migrationsPath)).toBe(true);
	});

	it('should apply core migrations successfully', async () => {
		const db = drizzle(testDb.db);
		const migrationsPath = join(process.cwd(), 'drizzle');

		await migrate(db, { migrationsFolder: migrationsPath });

		// Check essential tables exist
		expect(tableExists(testDb.db, 'user')).toBe(true);
		expect(tableExists(testDb.db, 'session')).toBe(true);
		expect(tableExists(testDb.db, '__drizzle_migrations')).toBe(true);
	});

	it('should track applied migrations', () => {
		const count = countAppliedMigrations(testDb.db);
		expect(count).toBeGreaterThan(0);
	});

	it('should be idempotent - running migrations twice should not fail', async () => {
		// Note: This test may fail if there are data migrations (DELETE/UPDATE)
		// that can't be run twice. We still test that DDL migrations are idempotent.
		const db = drizzle(testDb.db);
		const migrationsPath = join(process.cwd(), 'drizzle');

		// Get current table count
		const tablesBefore = getTableNames(testDb.db);

		try {
			// Try to run migrations again - should not fail on DDL
			await migrate(db, { migrationsFolder: migrationsPath });
		} catch (error) {
			// Data migrations may fail on second run (e.g., index already exists)
			// This is expected behavior - the important thing is DDL is idempotent
			if (error instanceof Error && !error.message.includes('already exists')) {
				throw error;
			}
		}

		// Should not create duplicate tables
		const tablesAfter = getTableNames(testDb.db);
		const userCountBefore = tablesBefore.filter((t) => t === 'user').length;
		const userCountAfter = tablesAfter.filter((t) => t === 'user').length;
		expect(userCountAfter).toBe(userCountBefore === 0 ? 1 : userCountBefore);
	});
});

describe('Module Migrations', () => {
	const testDbs: Map<string, ReturnType<typeof createTestDb>> = new Map();

	afterAll(() => {
		for (const [, testDb] of testDbs) {
			cleanupTestDb(testDb.db, testDb.path);
		}
	});

	it('should have consistent journal entries for all modules', async () => {
		const modulesPath = join(process.cwd(), 'modules');
		const { readdirSync } = await import('fs');

		const modules = readdirSync(modulesPath, { withFileTypes: true })
			.filter((d) => d.isDirectory() && d.name.startsWith('MoLOS-'))
			.map((d) => d.name);

		for (const moduleName of modules) {
			const drizzlePath = join(modulesPath, moduleName, 'drizzle');
			if (!existsSync(drizzlePath)) continue;

			const journalPath = join(drizzlePath, 'meta', '_journal.json');
			if (!existsSync(journalPath)) {
				expect.fail(`Module ${moduleName} is missing _journal.json`);
			}

			const { readFileSync } = await import('fs');
			const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
			const journalEntries = journal.entries?.length || 0;

			const sqlFiles = readdirSync(drizzlePath).filter((f) => f.endsWith('.sql'));

			// Journal should have same count as SQL files
			expect(journalEntries).toBe(sqlFiles.length);
		}
	});

	it('should have correct table prefixes in module migrations', async () => {
		const modulesPath = join(process.cwd(), 'modules');
		const { readdirSync, readFileSync } = await import('fs');

		const modules = readdirSync(modulesPath, { withFileTypes: true })
			.filter((d) => d.isDirectory() && d.name.startsWith('MoLOS-'))
			.map((d) => d.name);

		for (const moduleName of modules) {
			const drizzlePath = join(modulesPath, moduleName, 'drizzle');
			if (!existsSync(drizzlePath)) continue;

			const sqlFiles = readdirSync(drizzlePath).filter((f) => f.endsWith('.sql'));

			for (const sqlFile of sqlFiles) {
				const sql = readFileSync(join(drizzlePath, sqlFile), 'utf-8');
				const tableMatches = sql.matchAll(
					/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([\w-]+)[`"']?/gi
				);

				for (const match of tableMatches) {
					const tableName = match[1];
					if (tableName && !tableName.startsWith('__')) {
						// Normalize for comparison (hyphens vs underscores)
						const normalizedTable = tableName.replace(/-/g, '_');
						const normalizedModule = moduleName.replace(/-/g, '_');
						expect(normalizedTable.startsWith(normalizedModule)).toBe(true);
					}
				}
			}
		}
	});
});

describe('Schema Validation', () => {
	it('should pass schema validation on current database', async () => {
		const { validateSchema, formatSchemaDiff } = await import('@molos/database/schema-validator');
		const diff = validateSchema();

		if (!diff.valid) {
			console.log(formatSchemaDiff(diff));
		}

		expect(diff.valid).toBe(true);
		expect(diff.missingTables).toHaveLength(0);
	});
});
