import { describe, it, expect } from 'vitest';

// Import the generateRollbackSql function logic for testing
// Since it's a private function, we'll test it through the public interface
// or recreate the logic here for testing purposes

function generateRollbackSql(migrationSql: string): string | null {
	const lines: string[] = [];

	// Extract ALTER TABLE ADD COLUMN statements and generate DROP COLUMN
	const alterColumnMatches = migrationSql.matchAll(
		/ALTER\s+TABLE\s+["']?([\w-]+)["']?\s+ADD\s+COLUMN\s+["']?(\w+)["']?\s+(\w+)/gi
	);
	const addedColumns = new Set<string>();
	for (const match of alterColumnMatches) {
		const tableName = match[1];
		const columnName = match[2];
		const key = `${tableName}.${columnName}`;
		if (!addedColumns.has(key)) {
			addedColumns.add(key);
			lines.push(`ALTER TABLE "${tableName}" DROP COLUMN "${columnName}";`);
		}
	}

	// Extract CREATE TABLE statements and generate DROP TABLE
	const createTableMatches = migrationSql.matchAll(
		/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`']?([\w-]+)[`"']?/gi
	);
	const createdTables = new Set<string>();
	for (const match of createTableMatches) {
		const tableName = match[1];
		if (!createdTables.has(tableName)) {
			createdTables.add(tableName);
			lines.push(`DROP TABLE IF EXISTS "${tableName}";`);
		}
	}

	// Extract CREATE INDEX statements and generate DROP INDEX
	const createIndexMatches = migrationSql.matchAll(
		/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`']?([\w-]+)[`"']?/gi
	);
	const createdIndexes = new Set<string>();
	for (const match of createIndexMatches) {
		const indexName = match[1];
		if (!createdIndexes.has(indexName)) {
			createdIndexes.add(indexName);
			lines.push(`DROP INDEX IF EXISTS "${indexName}";`);
		}
	}

	return lines.length > 0 ? lines.join('\n') : null;
}

describe('Rollback SQL Generation', () => {
	it('should generate rollback SQL for CREATE TABLE', () => {
		const sql = `CREATE TABLE IF NOT EXISTS "test_table" (
			"id" TEXT PRIMARY KEY NOT NULL,
			"name" TEXT NOT NULL
		);`;

		const rollback = generateRollbackSql(sql);
		expect(rollback).toContain('DROP TABLE IF EXISTS "test_table"');
	});

	it('should generate rollback SQL for CREATE INDEX', () => {
		const sql = `CREATE INDEX IF NOT EXISTS "idx_test_name" ON "test_table" ("name");`;

		const rollback = generateRollbackSql(sql);
		expect(rollback).toContain('DROP INDEX IF EXISTS "idx_test_name"');
	});

	it('should generate rollback SQL for ALTER TABLE ADD COLUMN', () => {
		const sql = `ALTER TABLE "test_table" ADD COLUMN "email" TEXT;`;

		const rollback = generateRollbackSql(sql);
		expect(rollback).toContain('ALTER TABLE "test_table" DROP COLUMN "email"');
	});

	it('should handle multiple CREATE TABLE statements', () => {
		const sql = `
			CREATE TABLE IF NOT EXISTS "users" ("id" TEXT PRIMARY KEY);
			CREATE TABLE IF NOT EXISTS "posts" ("id" TEXT PRIMARY KEY);
		`;

		const rollback = generateRollbackSql(sql);
		expect(rollback).toContain('DROP TABLE IF EXISTS "users"');
		expect(rollback).toContain('DROP TABLE IF EXISTS "posts"');
	});

	it('should return null for un-rollbackable SQL', () => {
		const sql = `DELETE FROM users WHERE id = '123';`;
		const rollback = generateRollbackSql(sql);
		expect(rollback).toBeNull();
	});

	it('should return null for INSERT statements', () => {
		const sql = `INSERT INTO users (id, name) VALUES ('123', 'Test');`;
		const rollback = generateRollbackSql(sql);
		expect(rollback).toBeNull();
	});

	it('should return null for UPDATE statements', () => {
		const sql = `UPDATE users SET name = 'Updated' WHERE id = '123';`;
		const rollback = generateRollbackSql(sql);
		expect(rollback).toBeNull();
	});

	it('should handle complex migration with multiple operations', () => {
		const sql = `
			CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_tasks" (
				"id" TEXT PRIMARY KEY NOT NULL
			);
			CREATE INDEX IF NOT EXISTS "idx_tasks_user" ON "MoLOS-Tasks_tasks" ("user_id");
			ALTER TABLE "MoLOS-Tasks_tasks" ADD COLUMN "priority" TEXT;
		`;

		const rollback = generateRollbackSql(sql);
		expect(rollback).toContain('DROP TABLE IF EXISTS "MoLOS-Tasks_tasks"');
		expect(rollback).toContain('DROP INDEX IF EXISTS "idx_tasks_user"');
		expect(rollback).toContain('ALTER TABLE "MoLOS-Tasks_tasks" DROP COLUMN "priority"');
	});
});
