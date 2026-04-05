/**
 * Tests for BaseRepository Pattern
 *
 * Tests the base repository class that all repositories extend
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseRepository } from '../../src/lib/repositories/base-repository';
import { createTestDb } from '../utils/test-helpers';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

// Create a concrete implementation for testing
class TestRepository extends BaseRepository {
	async testQuery() {
		return this.db.select().from({} as any);
	}
}

describe('BaseRepository', () => {
	let db: BetterSQLite3Database<Record<string, unknown>>;
	let repository: TestRepository;

	beforeEach(async () => {
		db = await createTestDb();
		repository = new TestRepository(db);
	});

	describe('Constructor', () => {
		it('should accept a database instance', () => {
			const repo = new TestRepository(db);
			expect(repo).toBeDefined();
		});

		it('should use default database when no instance provided', () => {
			// This test verifies that the default db import works
			// We can't easily test this without mocking, but we can verify
			// that the constructor doesn't throw
			expect(() => new TestRepository()).not.toThrow();
		});
	});

	describe('Database Access', () => {
		it('should provide access to database instance', () => {
			expect(repository['db']).toBeDefined();
		});

		it('should use the provided database instance', () => {
			// The repository should use the db we provided
			expect(repository['db']).toBe(db);
		});
	});

	describe('Protected Properties', () => {
		it('should have protected db property accessible in subclasses', () => {
			// This is verified by the fact that TestRepository can access this.db
			expect(repository['db']).toBeDefined();
		});
	});

	describe('Error Handling', () => {
		it('should propagate database errors', async () => {
			// Try to perform an invalid query
			await expect(repository.testQuery()).rejects.toThrow();
		});
	});
});

describe('Repository Pattern Validation', () => {
	it('should enforce BaseRepository inheritance', () => {
		class CustomRepository extends BaseRepository {
			customMethod() {
				return 'custom';
			}
		}

		const repo = new CustomRepository();
		expect(repo).toBeInstanceOf(BaseRepository);
		expect(repo.customMethod()).toBe('custom');
	});

	it('should allow multiple repository instances', async () => {
		const db1 = await createTestDb();
		const db2 = await createTestDb();

		const repo1 = new TestRepository(db1);
		const repo2 = new TestRepository(db2);

		// Each repository should have its own db instance
		expect(repo1['db']).toBe(db1);
		expect(repo2['db']).toBe(db2);
		expect(repo1['db']).not.toBe(repo2['db']);
	});
});
