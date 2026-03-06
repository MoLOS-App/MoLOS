/**
 * Comprehensive Test Utilities for MoLOS
 *
 * This module provides test helpers, factories, and utilities for testing
 * all aspects of the MoLOS core system.
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../src/lib/server/db/schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { randomUUID } from 'crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

// ============================================================================
// Database Test Utilities
// ============================================================================

/**
 * Creates an in-memory SQLite database for testing with all migrations applied.
 */
export async function createTestDb(): Promise<BetterSQLite3Database<Record<string, unknown>>> {
	const client = new Database(':memory:');
	const db = drizzle(client, { schema });

	// Apply core migrations
	const migrationsPath = path.resolve('drizzle');
	migrate(db, { migrationsFolder: migrationsPath });

	return db;
}

/**
 * Creates a file-based test database (useful for debugging)
 */
export function createFileTestDb(name: string = `test-${randomUUID()}`): {
	db: BetterSQLite3Database<Record<string, unknown>>;
	path: string;
	client: Database.Database;
} {
	const dbPath = path.join(process.cwd(), 'data', 'test', `${name}.db`);
	const client = new Database(dbPath);
	const db = drizzle(client, { schema });

	// Apply migrations
	const migrationsPath = path.resolve('drizzle');
	migrate(db, { migrationsFolder: migrationsPath });

	return { db, path: dbPath, client };
}

/**
 * Cleanup file-based test database
 */
export function cleanupFileTestDb(client: Database.Database, dbPath: string): void {
	try {
		client.close();
	} catch {
		// Ignore close errors
	}

	try {
		const fs = require('fs');
		if (fs.existsSync(dbPath)) {
			fs.unlinkSync(dbPath);
		}
		// Also cleanup WAL and SHM files
		if (fs.existsSync(`${dbPath}-wal`)) {
			fs.unlinkSync(`${dbPath}-wal`);
		}
		if (fs.existsSync(`${dbPath}-shm`)) {
			fs.unlinkSync(`${dbPath}-shm`);
		}
	} catch {
		// Ignore deletion errors
	}
}

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Factory for creating mock user data
 */
export const UserFactory = {
	build: (overrides: Partial<any> = {}) => ({
		id: randomUUID(),
		email: `test-${randomUUID()}@example.com`,
		emailVerified: true,
		name: 'Test User',
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	}),

	buildList: (count: number, overrides: Partial<any> = {}) => {
		return Array.from({ length: count }, () => UserFactory.build(overrides));
	}
};

/**
 * Factory for creating mock session data
 */
export const SessionFactory = {
	build: (overrides: Partial<any> = {}) => ({
		id: randomUUID(),
		userId: randomUUID(),
		expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
		...overrides
	}),

	buildList: (count: number, overrides: Partial<any> = {}) => {
		return Array.from({ length: count }, () => SessionFactory.build(overrides));
	}
};

/**
 * Factory for creating mock AI session data
 */
export const AiSessionFactory = {
	build: (overrides: Partial<any> = {}) => ({
		id: randomUUID(),
		userId: randomUUID(),
		title: 'Test Session',
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	}),

	buildList: (count: number, overrides: Partial<any> = {}) => {
		return Array.from({ length: count }, () => AiSessionFactory.build(overrides));
	}
};

/**
 * Factory for creating mock AI message data
 */
export const AiMessageFactory = {
	build: (overrides: Partial<any> = {}) => ({
		id: randomUUID(),
		sessionId: randomUUID(),
		userId: randomUUID(),
		role: 'user' as const,
		content: 'Test message',
		createdAt: new Date(),
		...overrides
	}),

	buildList: (count: number, overrides: Partial<any> = {}) => {
		return Array.from({ length: count }, () => AiMessageFactory.build(overrides));
	}
};

/**
 * Factory for creating mock module config data
 */
export const ModuleConfigFactory = {
	build: (overrides: Partial<any> = {}) => ({
		id: `test-module-${randomUUID()}`,
		name: 'Test Module',
		href: '/test-module',
		icon: {} as any, // Lucide icon placeholder
		description: 'A test module',
		navigation: [],
		...overrides
	}),

	buildList: (count: number, overrides: Partial<any> = {}) => {
		return Array.from({ length: count }, (_, i) =>
			ModuleConfigFactory.build({
				id: `test-module-${i}`,
				name: `Test Module ${i}`,
				href: `/test-module-${i}`,
				...overrides
			})
		);
	}
};

/**
 * Factory for creating mock settings data
 */
export const SettingsFactory = {
	buildUserSettings: (overrides: Partial<any> = {}) => ({
		userId: randomUUID(),
		theme: 'system' as const,
		language: 'en',
		...overrides
	}),

	buildSystemSetting: (overrides: Partial<any> = {}) => ({
		key: `test-key-${randomUUID()}`,
		value: 'test-value',
		description: 'Test setting',
		...overrides
	}),

	buildModuleState: (overrides: Partial<any> = {}) => ({
		userId: randomUUID(),
		moduleId: 'test-module',
		submoduleId: 'main',
		enabled: true,
		menuOrder: 0,
		...overrides
	})
};

// ============================================================================
// API Test Helpers
// ============================================================================

/**
 * Creates a mock Request object for testing API endpoints
 */
export function createMockRequest(
	data: {
		method?: string;
		url?: string;
		headers?: Record<string, string>;
		body?: any;
		params?: Record<string, string>;
	} = {}
): Request {
	const {
		method = 'GET',
		url = 'http://localhost/api/test',
		headers = {},
		body,
		params = {}
	} = data;

	const requestInit: RequestInit = {
		method,
		headers: new Headers(headers)
	};

	if (body && method !== 'GET') {
		requestInit.body = JSON.stringify(body);
		(requestInit.headers as Headers).set('Content-Type', 'application/json');
	}

	return new Request(url, requestInit);
}

/**
 * Validates API response structure
 */
export function validateApiResponse(response: Response, expectedStatus: number = 200) {
	return {
		status: response.status,
		ok: response.ok,
		headers: response.headers,
		async json() {
			const data = await response.json();
			return data;
		}
	};
}

/**
 * Creates mock event for SvelteKit server functions
 */
export function createMockEvent(overrides: Partial<any> = {}) {
	const defaultRequest = createMockRequest();

	return {
		params: {},
		request: defaultRequest,
		locals: {
			user: null,
			session: null
		},
		url: new URL('http://localhost'),
		cookies: {
			get: () => null,
			set: () => {},
			delete: () => {},
			serialize: () => ''
		},
		fetch: fetch,
		getClientAddress: () => '127.0.0.1',
		platform: {},
		route: { id: null },
		setHeaders: () => {},
		isSubRequest: false,
		...overrides
	};
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that an error was thrown with a specific message
 */
export async function assertThrowsAsync(
	fn: () => Promise<any>,
	expectedMessage?: string | RegExp
): Promise<Error> {
	let error: Error | null = null;
	try {
		await fn();
	} catch (e) {
		error = e as Error;
	}

	if (!error) {
		throw new Error('Expected function to throw an error, but it did not');
	}

	if (expectedMessage) {
		if (typeof expectedMessage === 'string') {
			if (!error.message.includes(expectedMessage)) {
				throw new Error(
					`Expected error message to include "${expectedMessage}", but got "${error.message}"`
				);
			}
		} else {
			if (!expectedMessage.test(error.message)) {
				throw new Error(
					`Expected error message to match ${expectedMessage}, but got "${error.message}"`
				);
			}
		}
	}

	return error;
}

/**
 * Assert that an object has specific properties
 */
export function assertHasProperties(obj: any, properties: string[]) {
	for (const prop of properties) {
		if (!(prop in obj)) {
			throw new Error(`Expected object to have property "${prop}"`);
		}
	}
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
	condition: () => boolean | Promise<boolean>,
	timeout: number = 5000,
	interval: number = 100
): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		if (await condition()) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, interval));
	}
	throw new Error(`Condition not met within ${timeout}ms`);
}

// ============================================================================
// Database Assertion Helpers
// ============================================================================

/**
 * Assert that a table exists in the database
 */
export function assertTableExists(db: Database.Database, tableName: string) {
	const row = db
		.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
		.get(tableName);
	if (!row) {
		throw new Error(`Expected table "${tableName}" to exist`);
	}
}

/**
 * Assert that a table does not exist in the database
 */
export function assertTableNotExists(db: Database.Database, tableName: string) {
	const row = db
		.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
		.get(tableName);
	if (row) {
		throw new Error(`Expected table "${tableName}" to not exist`);
	}
}

/**
 * Assert that a table has a specific number of rows
 */
export function assertTableRowCount(
	db: Database.Database,
	tableName: string,
	expectedCount: number
) {
	const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
	if (row.count !== expectedCount) {
		throw new Error(
			`Expected table "${tableName}" to have ${expectedCount} rows, but found ${row.count}`
		);
	}
}

// ============================================================================
// Test Setup/Teardown Helpers
// ============================================================================

/**
 * Creates a test context with automatic cleanup
 */
export function createTestContext<T extends Record<string, any>>(
	setup: () => Promise<T> | T,
	teardown: (ctx: T) => Promise<void> | void
) {
	return {
		async run(testFn: (ctx: T) => Promise<void> | void) {
			const ctx = await setup();
			try {
				await testFn(ctx);
			} finally {
				await teardown(ctx);
			}
		}
	};
}

/**
 * Runs a test with a temporary environment variable
 */
export async function withEnv<T>(key: string, value: string, fn: () => Promise<T>): Promise<T> {
	const original = process.env[key];
	process.env[key] = value;
	try {
		return await fn();
	} finally {
		if (original === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = original;
		}
	}
}

/**
 * Runs a test with multiple temporary environment variables
 */
export async function withEnvs<T>(envs: Record<string, string>, fn: () => Promise<T>): Promise<T> {
	const originals: Record<string, string | undefined> = {};

	for (const [key, value] of Object.entries(envs)) {
		originals[key] = process.env[key];
		process.env[key] = value;
	}

	try {
		return await fn();
	} finally {
		for (const [key, original] of Object.entries(originals)) {
			if (original === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = original;
			}
		}
	}
}

// ============================================================================
// Timing and Performance Helpers
// ============================================================================

/**
 * Measure execution time of an async function
 */
export async function measureTime<T>(
	fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
	const start = Date.now();
	const result = await fn();
	const duration = Date.now() - start;
	return { result, duration };
}

/**
 * Assert that a function completes within a time limit
 */
export async function assertCompletesWithin<T>(
	fn: () => Promise<T>,
	maxDuration: number
): Promise<T> {
	const { result, duration } = await measureTime(fn);
	if (duration > maxDuration) {
		throw new Error(
			`Expected function to complete within ${maxDuration}ms, but it took ${duration}ms`
		);
	}
	return result;
}
