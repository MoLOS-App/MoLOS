/**
 * Test Harness for MoLOS Agent Package
 *
 * Provides isolated test environment with:
 * - Isolated temp directory for HOME/state
 * - Mock tool registry
 * - Mock event bus
 * - Test agent factory
 *
 * @module test-harness
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// =============================================================================
// Types
// =============================================================================

/**
 * Mock event bus for testing
 */
export interface TestEvent {
	type: string;
	payload: unknown;
	timestamp: number;
	source?: string;
}

/**
 * Mock event bus for testing
 */
export class MockEventBus {
	private handlers: Map<string, Set<(event: TestEvent) => void | Promise<void>>> = new Map();
	private events: TestEvent[] = [];

	emit<T>(type: string, payload: T, source?: string): void {
		const event: TestEvent = {
			type,
			payload,
			timestamp: Date.now(),
			source
		};
		this.events.push(event);
		const handlers = this.handlers.get(type);
		if (handlers) {
			for (const handler of handlers) {
				handler(event);
			}
		}
	}

	subscribe(type: string, handler: (event: TestEvent) => void | Promise<void>): () => void {
		if (!this.handlers.has(type)) {
			this.handlers.set(type, new Set());
		}
		this.handlers.get(type)!.add(handler);
		return () => this.unsubscribe(type, handler);
	}

	unsubscribe(type: string, handler: (event: TestEvent) => void | Promise<void>): void {
		const handlers = this.handlers.get(type);
		if (handlers) {
			handlers.delete(handler);
		}
	}

	clear(): void {
		this.handlers.clear();
		this.events = [];
	}

	getEvents(): TestEvent[] {
		return [...this.events];
	}

	getEventsByType(type: string): TestEvent[] {
		return this.events.filter((e) => e.type === type);
	}
}

/**
 * Mock function for tool execution
 */
export interface MockToolExecute {
	(args: Record<string, unknown>): Promise<unknown>;
	mockResolvedValue: (value: unknown) => void;
	mockRejectedValue: (error: unknown) => void;
	mockClear: () => void;
}

/**
 * Creates a mock tool execute function
 */
function createMockExecute(): MockToolExecute {
	let resolvedValue: unknown;
	let rejectedValue: unknown;

	const fn = (args: Record<string, unknown>): Promise<unknown> => {
		if (rejectedValue !== undefined) {
			return Promise.reject(rejectedValue);
		}
		return Promise.resolve(resolvedValue);
	};

	fn.mockResolvedValue = (value: unknown) => {
		resolvedValue = value;
		rejectedValue = undefined;
	};

	fn.mockRejectedValue = (error: unknown) => {
		rejectedValue = error;
	};

	fn.mockClear = () => {
		resolvedValue = undefined;
		rejectedValue = undefined;
	};

	return fn;
}

/**
 * Mock tool for testing
 */
export interface MockTool {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
	};
	execute: MockToolExecute;
}

/**
 * Mock tool registry for testing
 */
export class MockToolRegistry {
	private tools: Map<string, MockTool> = new Map();
	private hiddenTools: Map<string, { tool: MockTool; ttl: number }> = new Map();

	register(tool: MockTool): void {
		this.tools.set(tool.name, tool);
	}

	registerHidden(tool: MockTool, _ttl: number = 5): void {
		this.hiddenTools.set(tool.name, { tool, ttl: 5 });
	}

	unregister(name: string): void {
		this.tools.delete(name);
		this.hiddenTools.delete(name);
	}

	get(name: string): MockTool | undefined {
		return this.tools.get(name) ?? this.hiddenTools.get(name)?.tool;
	}

	getAll(): MockTool[] {
		return Array.from(this.tools.values());
	}

	getHidden(): MockTool[] {
		return Array.from(this.hiddenTools.values()).map((h) => h.tool);
	}

	clear(): void {
		this.tools.clear();
		this.hiddenTools.clear();
	}

	async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
		const tool = this.get(name);
		if (!tool) {
			throw new Error(`Tool not found: ${name}`);
		}
		return tool.execute(args);
	}
}

/**
 * Test harness interface
 */
export interface TestHarness {
	/**
	 * Unique ID for this test harness instance
	 */
	id: string;

	/**
	 * Isolated temp directory path
	 */
	tempDir: string;

	/**
	 * Mock tool registry
	 */
	tools: MockToolRegistry;

	/**
	 * Mock event bus
	 */
	eventBus: MockEventBus;

	/**
	 * Set up the harness - must be called before tests
	 */
	setup(): Promise<void>;

	/**
	 * Tear down the harness - must be called after tests
	 */
	cleanup(): Promise<void>;
}

/**
 * Test harness configuration
 */
export interface TestHarnessConfig {
	/**
	 * Prefix for temp directories
	 */
	tempDirPrefix?: string;

	/**
	 * Whether to isolate in a worker thread
	 */
	isolated?: boolean;

	/**
	 * Environment variables to set
	 */
	env?: Record<string, string | undefined>;
}

// =============================================================================
// Helper Functions
// =============================================================================

type RestoreEntry = { key: string; value: string | undefined };

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

/**
 * Creates an isolated temp directory
 */
export async function createIsolatedTempDir(prefix: string = 'molos-agent-test-'): Promise<string> {
	const tempDir = path.join(os.tmpdir(), `${prefix}${randomUUID()}`);
	await fs.promises.mkdir(tempDir, { recursive: true });
	return tempDir;
}

/**
 * Cleans up a directory
 */
export async function cleanupDir(dirPath: string): Promise<void> {
	try {
		await fs.promises.rm(dirPath, { recursive: true, force: true });
	} catch {
		// Ignore cleanup errors
	}
}

/**
 * Creates a fake tool for testing
 */
export function createFakeTool(params?: {
	name?: string;
	description?: string;
	parameters?: Record<string, unknown>;
	result?: unknown;
	error?: string;
}): MockTool {
	const name = params?.name ?? `test_tool_${randomUUID().slice(0, 8)}`;
	const execute = createMockExecute();

	if (params?.error) {
		execute.mockRejectedValue(new Error(params.error));
	} else {
		execute.mockResolvedValue(params?.result ?? 'ok');
	}

	return {
		name,
		description: params?.description ?? `Test tool: ${name}`,
		parameters: {
			type: 'object',
			properties: params?.parameters ?? {},
			required: []
		},
		execute
	};
}

// =============================================================================
// Simple Test Harness (no worker isolation)
// =============================================================================

/**
 * Simple test harness without worker isolation
 * Suitable for most unit tests
 */
export class SimpleTestHarness implements TestHarness {
	id: string;
	tempDir: string;
	tools: MockToolRegistry;
	eventBus: MockEventBus;
	private readonly config: Required<TestHarnessConfig>;
	private envRestoreEntries: RestoreEntry[] = [];

	constructor(config: TestHarnessConfig = {}) {
		this.id = randomUUID();
		this.tempDir = '';
		this.tools = new MockToolRegistry();
		this.eventBus = new MockEventBus();
		this.config = {
			tempDirPrefix: config.tempDirPrefix ?? 'molos-agent-test-',
			isolated: false,
			env: config.env ?? {}
		};
	}

	async setup(): Promise<void> {
		// Create isolated temp directory
		this.tempDir = await createIsolatedTempDir(this.config.tempDirPrefix);

		// Save original env
		this.envRestoreEntries = [
			{ key: 'HOME', value: process.env.HOME },
			{ key: 'USERPROFILE', value: process.env.USERPROFILE },
			{ key: 'XDG_CONFIG_HOME', value: process.env.XDG_CONFIG_HOME },
			{ key: 'XDG_DATA_HOME', value: process.env.XDG_DATA_HOME },
			{ key: 'XDG_STATE_HOME', value: process.env.XDG_STATE_HOME },
			{ key: 'XDG_CACHE_HOME', value: process.env.XDG_CACHE_HOME },
			{ key: 'TEMP', value: process.env.TEMP },
			{ key: 'TMP', value: process.env.TMP }
		];

		// Set isolated environment
		process.env.HOME = this.tempDir;
		process.env.USERPROFILE = this.tempDir;
		process.env.TEMP = this.tempDir;
		process.env.TMP = this.tempDir;
		process.env.XDG_CONFIG_HOME = path.join(this.tempDir, '.config');
		process.env.XDG_DATA_HOME = path.join(this.tempDir, '.local', 'share');
		process.env.XDG_STATE_HOME = path.join(this.tempDir, '.local', 'state');
		process.env.XDG_CACHE_HOME = path.join(this.tempDir, '.cache');

		// Apply custom env vars
		for (const [key, value] of Object.entries(this.config.env)) {
			if (value !== undefined) {
				process.env[key] = value;
			} else {
				delete process.env[key];
			}
		}
	}

	async cleanup(): Promise<void> {
		// Restore environment
		restoreEnv(this.envRestoreEntries);
		this.envRestoreEntries = [];

		// Clean up temp directory
		await cleanupDir(this.tempDir);

		// Clear mocks
		this.tools.clear();
		this.eventBus.clear();
	}
}

// =============================================================================
// Isolated Test Harness (with worker thread)
// =============================================================================

/**
 * Test harness with worker thread isolation
 */
export class IsolatedTestHarness implements TestHarness {
	id: string;
	tempDir: string;
	tools: MockToolRegistry;
	eventBus: MockEventBus;
	private readonly config: Required<TestHarnessConfig>;
	private envRestoreEntries: RestoreEntry[] = [];

	constructor(config: TestHarnessConfig = {}) {
		this.id = randomUUID();
		this.tempDir = '';
		this.tools = new MockToolRegistry();
		this.eventBus = new MockEventBus();
		this.config = {
			tempDirPrefix: config.tempDirPrefix ?? 'molos-agent-test-',
			isolated: config.isolated ?? true,
			env: config.env ?? {}
		};
	}

	async setup(): Promise<void> {
		// Create isolated temp directory
		this.tempDir = await createIsolatedTempDir(this.config.tempDirPrefix);

		// Save original env
		this.envRestoreEntries = [
			{ key: 'HOME', value: process.env.HOME },
			{ key: 'USERPROFILE', value: process.env.USERPROFILE },
			{ key: 'XDG_CONFIG_HOME', value: process.env.XDG_CONFIG_HOME },
			{ key: 'XDG_DATA_HOME', value: process.env.XDG_DATA_HOME },
			{ key: 'XDG_STATE_HOME', value: process.env.XDG_STATE_HOME },
			{ key: 'XDG_CACHE_HOME', value: process.env.XDG_CACHE_HOME },
			{ key: 'TEMP', value: process.env.TEMP },
			{ key: 'TMP', value: process.env.TMP }
		];

		// Set isolated environment
		process.env.HOME = this.tempDir;
		process.env.USERPROFILE = this.tempDir;
		process.env.TEMP = this.tempDir;
		process.env.TMP = this.tempDir;
		process.env.XDG_CONFIG_HOME = path.join(this.tempDir, '.config');
		process.env.XDG_DATA_HOME = path.join(this.tempDir, '.local', 'share');
		process.env.XDG_STATE_HOME = path.join(this.tempDir, '.local', 'state');
		process.env.XDG_CACHE_HOME = path.join(this.tempDir, '.cache');

		// Apply custom env vars
		for (const [key, value] of Object.entries(this.config.env)) {
			if (value !== undefined) {
				process.env[key] = value;
			} else {
				delete process.env[key];
			}
		}

		// Note: True worker thread isolation would require a separate worker script
		// For now, we rely on directory and environment isolation
	}

	async cleanup(): Promise<void> {
		// Restore environment
		restoreEnv(this.envRestoreEntries);
		this.envRestoreEntries = [];

		// Clean up temp directory
		await cleanupDir(this.tempDir);

		// Clear mocks
		this.tools.clear();
		this.eventBus.clear();
	}
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Creates a test harness
 */
export function createTestHarness(config?: TestHarnessConfig): TestHarness {
	if (config?.isolated) {
		return new IsolatedTestHarness(config);
	}
	return new SimpleTestHarness(config);
}

/**
 * Creates a mock provider config for testing
 */
export function createMockProviderConfig(
	overrides?: Partial<{
		provider:
			| 'openai'
			| 'anthropic'
			| 'ollama'
			| 'lmstudio'
			| 'groq'
			| 'deepseek'
			| 'mistral'
			| 'custom';
		apiKey: string;
		baseUrl: string;
	}>
): {
	provider:
		| 'openai'
		| 'anthropic'
		| 'ollama'
		| 'lmstudio'
		| 'groq'
		| 'deepseek'
		| 'mistral'
		| 'custom';
	apiKey: string;
	baseUrl: string;
	timeout: number;
	maxRetries: number;
} {
	return {
		provider: overrides?.provider ?? 'openai',
		apiKey: overrides?.apiKey ?? 'test-api-key',
		baseUrl: overrides?.baseUrl ?? 'https://api.test.com',
		timeout: 30000,
		maxRetries: 3
	};
}
