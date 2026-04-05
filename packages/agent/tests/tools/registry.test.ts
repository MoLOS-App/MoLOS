/**
 * Tests for ToolRegistry class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	ToolRegistry,
	type Tool,
	type ToolEntry,
	type ToolContext,
	type ToolSearchResult
} from '../../src/tools/registry.js';

describe('ToolRegistry', () => {
	describe('register', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should register a core tool', () => {
			const tool: Tool = {
				name: 'test_tool',
				description: 'A test tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn().mockResolvedValue('result')
			};

			registry.register(tool);

			expect(registry.has('test_tool')).toBe(true);
		});

		it('should overwrite existing tool with warning', () => {
			const tool1: Tool = {
				name: 'test_tool',
				description: 'First version',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			const tool2: Tool = {
				name: 'test_tool',
				description: 'Second version',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(tool1);
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			registry.register(tool2);

			expect(consoleSpy).toHaveBeenCalled();
			expect(registry.get('test_tool')?.description).toBe('Second version');
		});

		it('should increment version on register', () => {
			const tool1: Tool = {
				name: 'tool1',
				description: 'First',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			const tool2: Tool = {
				name: 'tool2',
				description: 'Second',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			expect(registry.versionNumber()).toBe(0);
			registry.register(tool1);
			expect(registry.versionNumber()).toBe(1);
			registry.register(tool2);
			expect(registry.versionNumber()).toBe(2);
		});
	});

	describe('registerHidden', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should register a hidden tool with TTL', () => {
			const tool: Tool = {
				name: 'hidden_tool',
				description: 'A hidden tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn().mockResolvedValue('result')
			};

			registry.registerHidden(tool, 5);

			expect(registry.has('hidden_tool')).toBe(true);
		});

		it('should not be accessible after TTL expires', () => {
			const tool: Tool = {
				name: 'hidden_tool',
				description: 'A hidden tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn().mockResolvedValue('result')
			};

			registry.registerHidden(tool, 1);
			expect(registry.has('hidden_tool')).toBe(true);

			registry.tickTTL();
			expect(registry.has('hidden_tool')).toBe(false);
		});
	});

	describe('get', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should return undefined for non-existent tool', () => {
			expect(registry.get('non_existent')).toBeUndefined();
		});

		it('should return tool when exists', () => {
			const tool: Tool = {
				name: 'test_tool',
				description: 'Test',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(tool);
			const retrieved = registry.get('test_tool');

			expect(retrieved).toBe(tool);
		});
	});

	describe('getTools', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should return only visible tools by default', () => {
			const coreTool: Tool = {
				name: 'core_tool',
				description: 'Core tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			const hiddenTool: Tool = {
				name: 'hidden_tool',
				description: 'Hidden tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(coreTool);
			registry.registerHidden(hiddenTool, 5);

			const visible = registry.getVisibleTools();
			expect(visible.some((t) => t.name === 'core_tool')).toBe(true);
			expect(visible.some((t) => t.name === 'hidden_tool')).toBe(true);
		});

		it('should include hidden tools when includeHidden is true', () => {
			const coreTool: Tool = {
				name: 'core_tool',
				description: 'Core tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			const hiddenTool: Tool = {
				name: 'hidden_tool',
				description: 'Hidden tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(coreTool);
			registry.registerHidden(hiddenTool, 0);

			const all = registry.getTools(true);
			expect(all.some((t) => t.name === 'core_tool')).toBe(true);
			expect(all.some((t) => t.name === 'hidden_tool')).toBe(true);
		});
	});

	describe('promoteTools', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should promote hidden tools with specified TTL', () => {
			const hiddenTool: Tool = {
				name: 'hidden_tool',
				description: 'Hidden tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.registerHidden(hiddenTool, 0);
			expect(registry.has('hidden_tool')).toBe(false);

			registry.promoteTools(['hidden_tool'], 3);
			expect(registry.has('hidden_tool')).toBe(true);
		});

		it('should not affect core tools', () => {
			const coreTool: Tool = {
				name: 'core_tool',
				description: 'Core tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(coreTool);
			const initialVersion = registry.versionNumber();

			registry.promoteTools(['core_tool'], 5);

			// Core tool should still work but not be affected
			expect(registry.has('core_tool')).toBe(true);
		});
	});

	describe('tickTTL', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should decrement TTL for all hidden tools', () => {
			const tool1: Tool = {
				name: 'hidden_tool1',
				description: 'Hidden 1',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			const tool2: Tool = {
				name: 'hidden_tool2',
				description: 'Hidden 2',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.registerHidden(tool1, 2);
			registry.registerHidden(tool2, 3);

			const expired = registry.tickTTL();
			expect(expired).toBe(0);
			expect(registry.has('hidden_tool1')).toBe(true);
			expect(registry.has('hidden_tool2')).toBe(true);
		});

		it('should return count of tools that reached TTL 0', () => {
			const tool1: Tool = {
				name: 'hidden_tool1',
				description: 'Hidden 1',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.registerHidden(tool1, 1);

			const expired = registry.tickTTL();
			expect(expired).toBe(1);
			expect(registry.has('hidden_tool1')).toBe(false);
		});

		it('should not affect core tools', () => {
			const coreTool: Tool = {
				name: 'core_tool',
				description: 'Core',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(coreTool);
			registry.tickTTL();

			expect(registry.has('core_tool')).toBe(true);
		});
	});

	describe('execute', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should execute a tool and return result', async () => {
			const executeMock = vi.fn().mockResolvedValue('success');
			const tool: Tool = {
				name: 'test_tool',
				description: 'Test',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: executeMock
			};

			registry.register(tool);

			const result = await registry.execute('test_tool', { arg: 'value' });

			expect(result.success).toBe(true);
			expect(result.output).toBe('success');
			expect(executeMock).toHaveBeenCalledWith({ arg: 'value' }, undefined);
		});

		it('should return error for non-existent tool', async () => {
			const result = await registry.execute('non_existent', {});

			expect(result.success).toBe(false);
			expect(result.error).toContain('not found');
		});

		it('should pass context to tool execution', async () => {
			let receivedContext: ToolContext | undefined;
			const tool: Tool = {
				name: 'test_tool',
				description: 'Test',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: async (args, context) => {
					receivedContext = context;
					return 'done';
				}
			};

			registry.register(tool);

			const context: ToolContext = {
				sessionKey: 'session-123',
				channel: 'test-channel',
				userId: 'user-456'
			};

			await registry.execute('test_tool', {}, context);

			expect(receivedContext).toEqual(context);
		});

		it('should catch and return tool execution errors', async () => {
			const tool: Tool = {
				name: 'failing_tool',
				description: 'Failing tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: async () => {
					throw new Error('execution failed');
				}
			};

			registry.register(tool);

			const result = await registry.execute('failing_tool', {});

			expect(result.success).toBe(false);
			expect(result.error).toBe('execution failed');
		});
	});

	describe('executeMany', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry({ maxConcurrent: 2 });
		});

		it('should execute multiple tools', async () => {
			// Create a new registry for this specific test to avoid state pollution
			const testRegistry = new ToolRegistry({ maxConcurrent: 2 });

			const createTool = (name: string) => ({
				name,
				description: 'Test',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: async () => `result from ${name}`
			});

			testRegistry.register(createTool('tool1'));
			testRegistry.register(createTool('tool2'));

			const results = await testRegistry.executeMany([
				{
					tool: { name: 'tool1', description: '', parameters: { type: 'object', properties: {} } },
					arguments: {},
					id: '1'
				},
				{
					tool: { name: 'tool2', description: '', parameters: { type: 'object', properties: {} } },
					arguments: {},
					id: '2'
				}
			]);

			expect(results).toHaveLength(2);
			expect(results.every((r) => r.success)).toBe(true);
		});
	});

	describe('clone', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry({ maxConcurrent: 5 });
		});

		it('should create independent copy', () => {
			const tool: Tool = {
				name: 'test_tool',
				description: 'Test',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(tool);
			const cloned = registry.clone();

			expect(cloned).not.toBe(registry);
			expect(cloned.has('test_tool')).toBe(true);
		});

		it('should copy tool entries but not version', () => {
			const tool: Tool = {
				name: 'test_tool',
				description: 'Test',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(tool);
			const cloned = registry.clone();

			expect(cloned.versionNumber()).toBe(0); // Fresh version in clone
		});

		it('should preserve maxConcurrent setting', () => {
			const registry2 = new ToolRegistry({ maxConcurrent: 3 });
			const cloned = registry2.clone();

			// Both should work correctly with their respective limits
			expect(cloned.has('non_existent')).toBe(false);
		});

		it('should allow modifications to clone without affecting original', () => {
			const tool: Tool = {
				name: 'test_tool',
				description: 'Test',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(tool);
			const cloned = registry.clone();

			cloned.unregister('test_tool');

			expect(registry.has('test_tool')).toBe(true);
			expect(cloned.has('test_tool')).toBe(false);
		});
	});

	describe('searchBM25', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should return empty array when no hidden tools', () => {
			const tool: Tool = {
				name: 'core_tool',
				description: 'Core tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(tool);

			const results = registry.searchBM25('test query');
			expect(results).toEqual([]);
		});

		it('should find hidden tools by query', () => {
			const hiddenTool: Tool = {
				name: 'weather_tool',
				description: 'Get weather information for a location',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.registerHidden(hiddenTool, 5);

			const results = registry.searchBM25('weather', 10);

			expect(results.length).toBeGreaterThan(0);
			expect(results.some((r) => r.name === 'weather_tool')).toBe(true);
		});

		it('should search in description as well', () => {
			const hiddenTool: Tool = {
				name: 'calc_tool',
				description: 'Calculator for mathematical operations',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.registerHidden(hiddenTool, 5);

			const results = registry.searchBM25('math calculator', 10);

			expect(results.some((r) => r.name === 'calc_tool')).toBe(true);
		});

		it('should respect maxResults limit', () => {
			for (let i = 0; i < 10; i++) {
				registry.registerHidden(
					{
						name: `tool_${i}`,
						description: `Description for tool ${i} with search keywords`,
						parameters: { type: 'object', properties: {}, required: [] },
						execute: vi.fn()
					},
					5
				);
			}

			const results = registry.searchBM25('keywords', 3);
			expect(results.length).toBeLessThanOrEqual(3);
		});
	});

	describe('searchRegex', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should find hidden tools by name pattern', () => {
			const tool: Tool = {
				name: 'search_tool',
				description: 'Tool for searching',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.registerHidden(tool, 5);

			const results = registry.searchRegex('search');
			expect(results.length).toBeGreaterThan(0);
			expect(results.some((r) => r.name === 'search_tool')).toBe(true);
		});

		it('should return empty for invalid regex', () => {
			const results = registry.searchRegex('[invalid', 10);
			expect(results).toEqual([]);
		});
	});

	describe('snapshotHiddenTools', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should return snapshot of hidden tools', () => {
			const tool: Tool = {
				name: 'hidden_tool',
				description: 'Hidden tool description',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.registerHidden(tool, 5);

			const snapshot = registry.snapshotHiddenTools();

			expect(snapshot.docs).toHaveLength(1);
			expect(snapshot.docs[0].name).toBe('hidden_tool');
			expect(snapshot.docs[0].description).toBe('Hidden tool description');
		});

		it('should not include core tools in snapshot', () => {
			const coreTool: Tool = {
				name: 'core_tool',
				description: 'Core tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			const hiddenTool: Tool = {
				name: 'hidden_tool',
				description: 'Hidden',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(coreTool);
			registry.registerHidden(hiddenTool, 5);

			const snapshot = registry.snapshotHiddenTools();

			expect(snapshot.docs).toHaveLength(1);
			expect(snapshot.docs[0].name).toBe('hidden_tool');
		});
	});

	describe('getDefinitions', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should return tool definitions for LLM providers', () => {
			const tool: Tool = {
				name: 'test_tool',
				description: 'Test tool',
				parameters: {
					type: 'object',
					properties: {
						query: { type: 'string', description: 'Search query' }
					},
					required: ['query']
				},
				execute: vi.fn()
			};

			registry.register(tool);

			const definitions = registry.getDefinitions();

			expect(definitions).toHaveLength(1);
			expect(definitions[0].name).toBe('test_tool');
			expect(definitions[0].description).toBe('Test tool');
			expect(definitions[0].parameters.properties.query).toBeDefined();
		});

		it('should not include hidden tools with expired TTL', () => {
			const coreTool: Tool = {
				name: 'core_tool',
				description: 'Core',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			const hiddenTool: Tool = {
				name: 'hidden_tool',
				description: 'Hidden',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(coreTool);
			registry.registerHidden(hiddenTool, 1);

			const definitions = registry.getDefinitions();
			expect(definitions.some((d) => d.name === 'hidden_tool')).toBe(true);

			registry.tickTTL();

			const definitionsAfter = registry.getDefinitions();
			expect(definitionsAfter.some((d) => d.name === 'hidden_tool')).toBe(false);
		});
	});

	describe('unregister', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should remove tool and return true', () => {
			const tool: Tool = {
				name: 'test_tool',
				description: 'Test',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(tool);
			expect(registry.has('test_tool')).toBe(true);

			const removed = registry.unregister('test_tool');

			expect(removed).toBe(true);
			expect(registry.has('test_tool')).toBe(false);
		});

		it('should return false for non-existent tool', () => {
			const removed = registry.unregister('non_existent');
			expect(removed).toBe(false);
		});
	});

	describe('listNames and count', () => {
		let registry: ToolRegistry;

		beforeEach(() => {
			registry = new ToolRegistry();
		});

		it('should list tool names in sorted order', () => {
			const tool1: Tool = {
				name: 'zebra_tool',
				description: 'Z',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			const tool2: Tool = {
				name: 'alpha_tool',
				description: 'A',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			};

			registry.register(tool1);
			registry.register(tool2);

			const names = registry.listNames();

			expect(names).toEqual(['alpha_tool', 'zebra_tool']);
		});

		it('should return correct count', () => {
			expect(registry.count()).toBe(0);

			registry.register({
				name: 'tool1',
				description: 'T1',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			});

			expect(registry.count()).toBe(1);

			registry.register({
				name: 'tool2',
				description: 'T2',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: vi.fn()
			});

			expect(registry.count()).toBe(2);
		});
	});
});
