import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Test the migration logger
describe('Migration Logger', () => {
	const testLogDir = join(process.cwd(), 'test-logs');
	const testLogFile = join(testLogDir, 'test-migrations.log');

	beforeEach(() => {
		// Create test log directory
		if (!existsSync(testLogDir)) {
			mkdirSync(testLogDir, { recursive: true });
		}
		// Clean up any existing test log
		if (existsSync(testLogFile)) {
			unlinkSync(testLogFile);
		}
	});

	afterEach(() => {
		// Clean up test logs
		if (existsSync(testLogDir)) {
			rmSync(testLogDir, { recursive: true, force: true });
		}
	});

	it('should create log entries with correct structure', async () => {
		const { logMigration } = await import('@molos/database/migration-logger');

		logMigration({
			level: 'info',
			operation: 'apply',
			target: 'test-module',
			migrationName: '0001_test',
			duration: 100,
			success: true
		});

		// Read and parse the log file
		const logContent = readFileSync(join(process.cwd(), 'logs', 'migrations.log'), 'utf-8');
		const lines = logContent.trim().split('\n');
		const lastLine = lines[lines.length - 1];
		const entry = JSON.parse(lastLine);

		expect(entry.level).toBe('info');
		expect(entry.operation).toBe('apply');
		expect(entry.target).toBe('test-module');
		expect(entry.migrationName).toBe('0001_test');
		expect(entry.duration).toBe(100);
		expect(entry.success).toBe(true);
		expect(entry.timestamp).toBeDefined();
	});

	it('should log error entries', async () => {
		const { logMigration } = await import('@molos/database/migration-logger');

		logMigration({
			level: 'error',
			operation: 'apply',
			target: 'core',
			migrationName: '0001_fail',
			success: false,
			error: 'Test error message'
		});

		const logContent = readFileSync(join(process.cwd(), 'logs', 'migrations.log'), 'utf-8');
		const lines = logContent.trim().split('\n');
		const lastLine = lines[lines.length - 1];
		const entry = JSON.parse(lastLine);

		expect(entry.level).toBe('error');
		expect(entry.success).toBe(false);
		expect(entry.error).toBe('Test error message');
	});

	it('should include checksum in log entries', async () => {
		const { logMigration } = await import('@molos/database/migration-logger');

		logMigration({
			level: 'info',
			operation: 'apply',
			target: 'core',
			migrationName: '0001_test',
			success: true,
			checksum: 'abc123def456'
		});

		const logContent = readFileSync(join(process.cwd(), 'logs', 'migrations.log'), 'utf-8');
		const lines = logContent.trim().split('\n');
		const lastLine = lines[lines.length - 1];
		const entry = JSON.parse(lastLine);

		expect(entry.checksum).toBe('abc123def456');
	});
});

describe('Schema Validator', () => {
	it('should validate current database schema', async () => {
		const { validateSchema } = await import('@molos/database/schema-validator');

		const diff = validateSchema();

		expect(diff.valid).toBe(true);
		expect(diff.missingTables).toHaveLength(0);
	});

	it('should return schema stats', async () => {
		const { getSchemaStats } = await import('@molos/database/schema-validator');

		const stats = getSchemaStats();

		expect(stats.tableCount).toBeGreaterThan(0);
		expect(stats.coreTableCount).toBeGreaterThan(0);
		expect(stats.tables).toBeInstanceOf(Array);
		expect(stats.moduleTableCounts).toBeInstanceOf(Object);
	});

	it('should format schema diff correctly', async () => {
		const { formatSchemaDiff } = await import('@molos/database/schema-validator');

		const diff = {
			valid: true,
			missingTables: [] as string[],
			extraTables: [] as string[],
			missingColumns: [] as { table: string; column: string }[],
			extraColumns: [] as { table: string; column: string }[],
			typeMismatches: [] as { table: string; column: string; expected: string; actual: string }[],
			warnings: [] as string[]
		};

		const formatted = formatSchemaDiff(diff);
		expect(formatted).toContain('passed');
	});

	it('should report missing tables in diff', async () => {
		const { formatSchemaDiff } = await import('@molos/database/schema-validator');

		const diff = {
			valid: false,
			missingTables: ['test_missing_table'],
			extraTables: [] as string[],
			missingColumns: [] as { table: string; column: string }[],
			extraColumns: [] as { table: string; column: string }[],
			typeMismatches: [] as { table: string; column: string; expected: string; actual: string }[],
			warnings: [] as string[]
		};

		const formatted = formatSchemaDiff(diff);
		expect(formatted).toContain('failed');
		expect(formatted).toContain('test_missing_table');
	});
});
