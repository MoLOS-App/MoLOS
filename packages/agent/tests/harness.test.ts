/**
 * Tests for Test Harness Infrastructure
 *
 * Validates the test harness, mock utilities, and environment isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
	createTestHarness,
	SimpleTestHarness,
	IsolatedTestHarness,
	createIsolatedTempDir,
	cleanupDir,
	createFakeTool,
	createMockProviderConfig,
	MockToolRegistry,
	MockEventBus
} from './harness.js';

describe('TestHarness', () => {
	describe('SimpleTestHarness', () => {
		let harness: SimpleTestHarness;

		beforeEach(async () => {
			harness = new SimpleTestHarness();
		});

		afterEach(async () => {
			await harness.cleanup();
		});

		it('should create with unique id', async () => {
			await harness.setup();
			expect(harness.id).toBeDefined();
			expect(harness.id.length).toBeGreaterThan(0);
		});

		it('should setup isolated temp directory', async () => {
			await harness.setup();
			expect(harness.tempDir).toBeDefined();
			expect(harness.tempDir).toContain('molos-agent-test-');

			// Verify temp directory exists
			const exists = await fs.promises
				.access(harness.tempDir)
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(true);
		});

		it('should isolate HOME environment variable', async () => {
			const originalHome = process.env.HOME;
			await harness.setup();

			expect(process.env.HOME).toBe(harness.tempDir);
			expect(process.env.USERPROFILE).toBe(harness.tempDir);

			// Cleanup
			await harness.cleanup();

			// Original should be restored after cleanup
			if (originalHome) {
				expect(process.env.HOME).toBe(originalHome);
			}
		});

		it('should set XDG environment variables', async () => {
			await harness.setup();

			expect(process.env.XDG_CONFIG_HOME).toBe(path.join(harness.tempDir, '.config'));
			expect(process.env.XDG_DATA_HOME).toBe(path.join(harness.tempDir, '.local', 'share'));
			expect(process.env.XDG_STATE_HOME).toBe(path.join(harness.tempDir, '.local', 'state'));
			expect(process.env.XDG_CACHE_HOME).toBe(path.join(harness.tempDir, '.cache'));
		});

		it('should provide mock tool registry', async () => {
			await harness.setup();
			expect(harness.tools).toBeInstanceOf(MockToolRegistry);
		});

		it('should provide mock event bus', async () => {
			await harness.setup();
			expect(harness.eventBus).toBeInstanceOf(MockEventBus);
		});

		it('should cleanup temp directory on cleanup', async () => {
			await harness.setup();
			const tempDir = harness.tempDir;

			await harness.cleanup();

			// Verify temp directory was deleted
			const exists = await fs.promises
				.access(tempDir)
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(false);
		});

		it('should clear mocks on cleanup', async () => {
			await harness.setup();

			// Add some tools
			const tool = createFakeTool({ name: 'test_tool' });
			harness.tools.register(tool);

			// Add event handler
			harness.eventBus.subscribe('test', () => {});

			await harness.cleanup();

			// After cleanup, tools should be cleared
			expect(harness.tools.get('test_tool')).toBeUndefined();
			expect(harness.eventBus.getEvents()).toHaveLength(0);
		});
	});

	describe('IsolatedTestHarness', () => {
		let harness: IsolatedTestHarness;

		beforeEach(async () => {
			harness = new IsolatedTestHarness();
		});

		afterEach(async () => {
			await harness.cleanup();
		});

		it('should have same interface as SimpleTestHarness', async () => {
			await harness.setup();
			expect(harness.id).toBeDefined();
			expect(harness.tempDir).toBeDefined();
			expect(harness.tools).toBeInstanceOf(MockToolRegistry);
			expect(harness.eventBus).toBeInstanceOf(MockEventBus);
		});

		it('should setup isolated environment', async () => {
			await harness.setup();
			expect(process.env.HOME).toBe(harness.tempDir);
		});
	});

	describe('createTestHarness factory', () => {
		afterEach(async () => {});

		it('should create SimpleTestHarness by default', async () => {
			const harness = createTestHarness();
			expect(harness).toBeInstanceOf(SimpleTestHarness);
			await harness.cleanup();
		});

		it('should create IsolatedTestHarness when isolated=true', async () => {
			const harness = createTestHarness({ isolated: true });
			expect(harness).toBeInstanceOf(IsolatedTestHarness);
			await harness.cleanup();
		});

		it('should pass custom config to harness', async () => {
			const harness = createTestHarness({
				tempDirPrefix: 'custom-prefix-'
			});
			await harness.setup();
			expect(harness.tempDir).toContain('custom-prefix-');
			await harness.cleanup();
		});
	});
});

describe('MockToolRegistry', () => {
	let registry: MockToolRegistry;

	beforeEach(() => {
		registry = new MockToolRegistry();
	});

	describe('register', () => {
		it('should register a tool', () => {
			const tool = createFakeTool({ name: 'test_tool' });
			registry.register(tool);

			expect(registry.get('test_tool')).toBe(tool);
		});

		it('should return undefined for non-existent tool', () => {
			expect(registry.get('non_existent')).toBeUndefined();
		});
	});

	describe('registerHidden', () => {
		it('should register a hidden tool', () => {
			const tool = createFakeTool({ name: 'hidden_tool' });
			registry.registerHidden(tool, 10);

			expect(registry.get('hidden_tool')).toBe(tool);
		});
	});

	describe('unregister', () => {
		it('should unregister a tool', () => {
			const tool = createFakeTool({ name: 'test_tool' });
			registry.register(tool);
			registry.unregister('test_tool');

			expect(registry.get('test_tool')).toBeUndefined();
		});
	});

	describe('getAll', () => {
		it('should return all registered tools', () => {
			const tool1 = createFakeTool({ name: 'tool_1' });
			const tool2 = createFakeTool({ name: 'tool_2' });
			registry.register(tool1);
			registry.register(tool2);

			const all = registry.getAll();
			expect(all).toHaveLength(2);
			expect(all.map((t) => t.name)).toContain('tool_1');
			expect(all.map((t) => t.name)).toContain('tool_2');
		});
	});

	describe('clear', () => {
		it('should clear all tools', () => {
			const tool = createFakeTool({ name: 'test_tool' });
			registry.register(tool);
			registry.clear();

			expect(registry.getAll()).toHaveLength(0);
		});
	});

	describe('execute', () => {
		it('should execute a tool', async () => {
			const tool = createFakeTool({ name: 'test_tool', result: 'success' });
			registry.register(tool);

			const result = await registry.execute('test_tool', {});
			expect(result).toBe('success');
		});

		it('should throw for non-existent tool', async () => {
			await expect(registry.execute('non_existent', {})).rejects.toThrow(
				'Tool not found: non_existent'
			);
		});
	});
});

describe('MockEventBus', () => {
	let eventBus: MockEventBus;

	beforeEach(() => {
		eventBus = new MockEventBus();
	});

	describe('emit', () => {
		it('should emit an event', () => {
			eventBus.emit('test', { data: 'hello' });

			const events = eventBus.getEvents();
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('test');
			expect(events[0].payload).toEqual({ data: 'hello' });
		});

		it('should include timestamp and source', () => {
			eventBus.emit('test', { data: 'hello' }, 'source-1');

			const events = eventBus.getEvents();
			expect(events[0].source).toBe('source-1');
			expect(events[0].timestamp).toBeDefined();
		});
	});

	describe('subscribe', () => {
		it('should receive emitted events', () => {
			const handler = vi.fn();
			eventBus.subscribe('test', handler);

			eventBus.emit('test', { data: 'hello' });

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler.mock.calls[0][0].type).toBe('test');
		});

		it('should return unsubscribe function', () => {
			const handler = vi.fn();
			const unsubscribe = eventBus.subscribe('test', handler);

			unsubscribe();
			eventBus.emit('test', {});

			expect(handler).not.toHaveBeenCalled();
		});

		it('should only receive events of subscribed type', () => {
			const handler = vi.fn();
			eventBus.subscribe('test', handler);

			eventBus.emit('other', {});
			eventBus.emit('test', {});

			expect(handler).toHaveBeenCalledTimes(1);
		});
	});

	describe('getEventsByType', () => {
		it('should filter events by type', () => {
			eventBus.emit('test', { data: '1' });
			eventBus.emit('other', { data: '2' });
			eventBus.emit('test', { data: '3' });

			const testEvents = eventBus.getEventsByType('test');
			expect(testEvents).toHaveLength(2);
		});
	});

	describe('clear', () => {
		it('should clear all events', () => {
			eventBus.emit('test', {});
			eventBus.emit('other', {});
			eventBus.clear();

			expect(eventBus.getEvents()).toHaveLength(0);
		});
	});
});

describe('createFakeTool', () => {
	it('should create a tool with default values', () => {
		const tool = createFakeTool();

		expect(tool.name).toMatch(/^test_tool_[a-z0-9]+$/);
		expect(tool.description).toContain('Test tool');
		expect(tool.parameters.type).toBe('object');
	});

	it('should create a tool with custom name', () => {
		const tool = createFakeTool({ name: 'custom_tool' });
		expect(tool.name).toBe('custom_tool');
	});

	it('should create a tool with custom result', () => {
		const tool = createFakeTool({ name: 'custom_tool', result: 'custom_result' });

		return expect(tool.execute({})).resolves.toBe('custom_result');
	});

	it('should create a tool that rejects on error', async () => {
		const tool = createFakeTool({ name: 'error_tool', error: 'something went wrong' });

		await expect(tool.execute({})).rejects.toThrow('something went wrong');
	});
});

describe('createMockProviderConfig', () => {
	it('should create config with defaults', () => {
		const config = createMockProviderConfig();

		expect(config.provider).toBe('openai');
		expect(config.apiKey).toBe('test-api-key');
		expect(config.baseUrl).toBe('https://api.test.com');
		expect(config.timeout).toBe(30000);
		expect(config.maxRetries).toBe(3);
	});

	it('should override with provided values', () => {
		const config = createMockProviderConfig({
			provider: 'anthropic',
			apiKey: 'secret-key'
		});

		expect(config.provider).toBe('anthropic');
		expect(config.apiKey).toBe('secret-key');
		expect(config.baseUrl).toBe('https://api.test.com'); // still default
	});
});

describe('createIsolatedTempDir', () => {
	it('should create a temp directory', async () => {
		const tempDir = await createIsolatedTempDir();
		expect(tempDir).toContain('molos-agent-test-');

		// Verify it exists
		const exists = await fs.promises
			.access(tempDir)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(true);

		// Cleanup
		await cleanupDir(tempDir);
	});

	it('should create with custom prefix', async () => {
		const tempDir = await createIsolatedTempDir('custom-');
		expect(tempDir).toContain('custom-');

		await cleanupDir(tempDir);
	});
});

describe('cleanupDir', () => {
	it('should delete a directory', async () => {
		// Create a temp dir
		const tempDir = await createIsolatedTempDir('cleanup-test-');

		// Verify it exists
		let exists = await fs.promises
			.access(tempDir)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(true);

		// Cleanup
		await cleanupDir(tempDir);

		// Verify it's gone
		exists = await fs.promises
			.access(tempDir)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(false);
	});

	it('should not throw for non-existent directory', async () => {
		await expect(cleanupDir('/non/existent/path')).resolves.not.toThrow();
	});
});
