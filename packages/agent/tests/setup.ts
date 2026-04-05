/**
 * Global Test Setup for MoLOS Agent Package
 *
 * This module provides global test configuration and utilities:
 * - Environment isolation for tests
 * - Global beforeEach/afterEach hooks
 * - Test environment helpers
 *
 * @module test-setup
 */

import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// =============================================================================
// Environment Setup
// =============================================================================

type RestoreEntry = { key: string; value: string | undefined };

/**
 * Saves current environment for later restoration
 */
function saveEnv(): RestoreEntry[] {
	return [
		{ key: 'HOME', value: process.env.HOME },
		{ key: 'USERPROFILE', value: process.env.USERPROFILE },
		{ key: 'XDG_CONFIG_HOME', value: process.env.XDG_CONFIG_HOME },
		{ key: 'XDG_DATA_HOME', value: process.env.XDG_DATA_HOME },
		{ key: 'XDG_STATE_HOME', value: process.env.XDG_STATE_HOME },
		{ key: 'XDG_CACHE_HOME', value: process.env.XDG_CACHE_HOME },
		{ key: 'TEMP', value: process.env.TEMP },
		{ key: 'TMP', value: process.env.TMP },
		{ key: 'MOLOS_AGENT_TEST_HOME', value: process.env.MOLOS_AGENT_TEST_HOME }
	];
}

/**
 * Restores environment variables
 */
function restoreEnv(entries: RestoreEntry[]): void {
	for (const { key, value } of entries) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

// =============================================================================
// Test Environment Manager
// =============================================================================

/**
 * Manages isolated test environment
 */
export class TestEnvironment {
	private tempDir: string;
	private envRestore: RestoreEntry[];
	private originalCwd: string;

	constructor() {
		this.tempDir = '';
		this.envRestore = [];
		this.originalCwd = process.cwd();
	}

	/**
	 * Sets up isolated environment
	 */
	install(): { tempDir: string } {
		// Save original environment
		this.envRestore = saveEnv();

		// Create isolated temp directory
		this.tempDir = path.join(os.tmpdir(), `molos-agent-test-${randomUUID()}`);
		fs.mkdirSync(this.tempDir, { recursive: true });

		// Set isolated environment
		process.env.HOME = this.tempDir;
		process.env.USERPROFILE = this.tempDir;
		process.env.TEMP = this.tempDir;
		process.env.TMP = this.tempDir;
		process.env.MOLOS_AGENT_TEST_HOME = this.tempDir;
		process.env.XDG_CONFIG_HOME = path.join(this.tempDir, '.config');
		process.env.XDG_DATA_HOME = path.join(this.tempDir, '.local', 'share');
		process.env.XDG_STATE_HOME = path.join(this.tempDir, '.local', 'state');
		process.env.XDG_CACHE_HOME = path.join(this.tempDir, '.cache');

		// Set test mode
		process.env.VITEST = 'true';
		process.env.MOLOS_AGENT_TEST = '1';

		return { tempDir: this.tempDir };
	}

	/**
	 * Tears down isolated environment
	 */
	async cleanup(): Promise<void> {
		// Restore environment
		restoreEnv(this.envRestore);
		this.envRestore = [];

		// Restore working directory
		try {
			process.chdir(this.originalCwd);
		} catch {
			// Ignore errors if directory was deleted
		}

		// Clean up temp directory
		if (this.tempDir) {
			try {
				await fs.promises.rm(this.tempDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
			this.tempDir = '';
		}
	}

	/**
	 * Gets the temp directory path
	 */
	getTempDir(): string {
		return this.tempDir;
	}
}

// =============================================================================
// Global Test Environment Instance
// =============================================================================

const globalTestEnv = new TestEnvironment();

// =============================================================================
// Test Isolation Utilities
// =============================================================================

/**
 * Runs a function in an isolated environment
 */
export async function withIsolatedEnv<T>(fn: () => T | Promise<T>): Promise<T> {
	const env = new TestEnvironment();
	env.install();
	try {
		return await fn();
	} finally {
		await env.cleanup();
	}
}

/**
 * Creates a temporary directory for tests
 */
export async function createTestTempDir(prefix?: string): Promise<string> {
	const tempDir = path.join(os.tmpdir(), `molos-agent-test-${prefix ?? ''}${randomUUID()}`);
	await fs.promises.mkdir(tempDir, { recursive: true });
	return tempDir;
}

/**
 * Cleans up a temporary directory
 */
export async function cleanupTestTempDir(dirPath: string): Promise<void> {
	try {
		await fs.promises.rm(dirPath, { recursive: true, force: true });
	} catch {
		// Ignore cleanup errors
	}
}

/**
 * Test environment utilities
 */
export const testEnv = {
	/**
	 * Isolates a test function
	 */
	isolate<T>(fn: () => T): () => Promise<T> {
		return async () => {
			const env = new TestEnvironment();
			env.install();
			try {
				return fn();
			} finally {
				await env.cleanup();
			}
		};
	},

	/**
	 * Gets the current test home directory
	 */
	getTempDir(): string {
		return globalTestEnv.getTempDir();
	}
};

// =============================================================================
// Global Setup/Teardown
// =============================================================================

// Install global test environment before all tests
beforeAll(() => {
	globalTestEnv.install();
});

// Clean up after all tests
afterAll(async () => {
	await globalTestEnv.cleanup();
});

// Clean up after each test
afterEach(async () => {
	// Clean up any remaining test directories
	const tempDir = process.env.MOLOS_AGENT_TEST_HOME;
	if (tempDir && tempDir.includes('molos-agent-test-')) {
		try {
			await fs.promises.rm(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	}
});

// =============================================================================
// Mock Helper Exports
// =============================================================================

// Re-export common test utilities
export { createFakeTool } from './harness.js';
export { createMockProviderConfig } from './harness.js';
export { createIsolatedTempDir, cleanupDir } from './harness.js';
