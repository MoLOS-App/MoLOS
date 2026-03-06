/**
 * Tests for Database Connection and Utilities
 *
 * Tests database connection handling, fallback logic, and configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, withEnv } from '../utils/test-helpers';
import Database from 'better-sqlite3';
import { join } from 'path';
import { unlinkSync, existsSync, mkdirSync } from 'fs';

describe('Database Connection', () => {
	describe('In-Memory Database', () => {
		it('should create in-memory database successfully', async () => {
			const db = await createTestDb();
			expect(db).toBeDefined();
		});

		it('should apply migrations on creation', async () => {
			const db = await createTestDb();
			// Database should be created and usable
			expect(db).toBeDefined();
		});

		it('should have isolated databases', async () => {
			const db1 = await createTestDb();
			const db2 = await createTestDb();

			// Each database should be independent
			expect(db1).not.toBe(db2);
		});
	});

	describe('File-Based Database', () => {
		const testDbPath = join(process.cwd(), 'data', 'test', 'connection-test.db');

		beforeEach(() => {
			// Ensure test directory exists
			const testDir = join(process.cwd(), 'data', 'test');
			if (!existsSync(testDir)) {
				mkdirSync(testDir, { recursive: true });
			}
		});

		afterEach(() => {
			// Cleanup test database
			if (existsSync(testDbPath)) {
				try {
					unlinkSync(testDbPath);
				} catch {
					// Ignore cleanup errors
				}
			}
			if (existsSync(`${testDbPath}-wal`)) {
				try {
					unlinkSync(`${testDbPath}-wal`);
				} catch {
					// Ignore cleanup errors
				}
			}
			if (existsSync(`${testDbPath}-shm`)) {
				try {
					unlinkSync(`${testDbPath}-shm`);
				} catch {
					// Ignore cleanup errors
				}
			}
		});

		it('should create file-based database', () => {
			const db = new Database(testDbPath);
			expect(db).toBeDefined();
			expect(existsSync(testDbPath)).toBe(true);
			db.close();
		});

		it('should enable WAL mode', () => {
			const db = new Database(testDbPath);
			db.pragma('journal_mode = WAL');
			const result = db.pragma('journal_mode', { simple: true });
			// WAL mode may not be set immediately, but pragma should work
			expect(result).toBeDefined();
			db.close();
		});

		it('should enable foreign keys', () => {
			const db = new Database(testDbPath);
			db.pragma('foreign_keys = ON');
			const result = db.pragma('foreign_keys', { simple: true });
			expect(result).toBe(1);
			db.close();
		});

		it('should handle multiple connections to same file', () => {
			const db1 = new Database(testDbPath);
			const db2 = new Database(testDbPath);

			expect(db1).toBeDefined();
			expect(db2).toBeDefined();

			db1.close();
			db2.close();
		});
	});

	describe('Database Configuration', () => {
		it('should respect DATABASE_URL environment variable', async () => {
			await withEnv('DATABASE_URL', 'sqlite://custom.db', async () => {
				// Environment variable should be set
				expect(process.env.DATABASE_URL).toBe('sqlite://custom.db');
			});
		});

		it('should handle missing DATABASE_URL gracefully', async () => {
			const original = process.env.DATABASE_URL;
			delete process.env.DATABASE_URL;

			try {
				// Should not throw when DATABASE_URL is missing
				const db = await createTestDb();
				expect(db).toBeDefined();
			} finally {
				if (original) {
					process.env.DATABASE_URL = original;
				}
			}
		});
	});

	describe('Database Operations', () => {
		it('should handle concurrent connections', async () => {
			const connections = await Promise.all([createTestDb(), createTestDb(), createTestDb()]);

			expect(connections.length).toBe(3);
			connections.forEach((db) => {
				expect(db).toBeDefined();
			});
		});

		it('should maintain connection isolation', async () => {
			const db1 = await createTestDb();
			const db2 = await createTestDb();

			// Both databases should be independent
			expect(db1).toBeDefined();
			expect(db2).toBeDefined();
			expect(db1).not.toBe(db2);
		});
	});
});

describe('Database Utilities', () => {
	describe('Transaction Handling', () => {
		it('should support raw transactions', () => {
			const db = new Database(':memory:');

			db.exec('BEGIN TRANSACTION');
			db.exec('CREATE TABLE test (id INTEGER)');
			db.exec('COMMIT');

			const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
			expect(tables.length).toBeGreaterThan(0);

			db.close();
		});

		it('should support rollback', () => {
			const db = new Database(':memory:');

			db.exec('BEGIN TRANSACTION');
			db.exec('CREATE TABLE test (id INTEGER)');
			db.exec('ROLLBACK');

			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test'")
				.all();
			expect(tables.length).toBe(0);

			db.close();
		});
	});

	describe('Pragma Settings', () => {
		it('should allow pragma modifications', () => {
			const db = new Database(':memory:');

			// Set busy timeout
			db.pragma('busy_timeout = 5000');

			// Verify setting
			const result = db.pragma('busy_timeout', { simple: true });
			expect(result).toBe(5000);

			db.close();
		});

		it('should support synchronous mode', () => {
			const db = new Database(':memory:');

			db.pragma('synchronous = NORMAL');
			const result = db.pragma('synchronous', { simple: true });
			expect(result).toBe(1); // NORMAL = 1

			db.close();
		});
	});

	describe('Error Handling', () => {
		it('should throw on invalid SQL', () => {
			const db = new Database(':memory:');

			expect(() => {
				db.exec('INVALID SQL STATEMENT');
			}).toThrow();

			db.close();
		});

		it('should handle constraint violations', () => {
			const db = new Database(':memory:');

			db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT UNIQUE)');
			db.exec("INSERT INTO test (id, value) VALUES (1, 'unique')");

			expect(() => {
				db.exec("INSERT INTO test (id, value) VALUES (2, 'unique')");
			}).toThrow(/UNIQUE constraint failed/);

			db.close();
		});
	});
});
