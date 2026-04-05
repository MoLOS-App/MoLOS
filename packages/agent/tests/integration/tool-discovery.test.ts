/**
 * Integration tests for Tool Discovery with BM25
 *
 * Tests the BM25 search functionality for discovering hidden tools.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry, type Tool } from '../../src/tools/registry.js';

describe('Tool Discovery Integration', () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
	});

	describe('BM25 search for hidden tools', () => {
		it('should find hidden tools via BM25 search', () => {
			// Register visible tool
			const visibleTool: Tool = {
				name: 'read_file',
				description: 'Read contents of a file',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'file contents'
			};

			// Register hidden tool (not directly callable)
			const hiddenTool: Tool = {
				name: 'git_commit',
				description: 'Create a git commit with a message',
				parameters: {
					type: 'object',
					properties: {
						message: { type: 'string', description: 'Commit message' }
					},
					required: ['message']
				},
				execute: async () => 'committed'
			};

			registry.register(visibleTool);
			registry.registerHidden(hiddenTool, 5);

			// Search should find the hidden tool
			const results = registry.searchBM25('git commit', 5);

			expect(results.some((r) => r.name === 'git_commit')).toBe(true);
		});

		it('should find hidden tools by description keywords', () => {
			const hiddenTool: Tool = {
				name: 'weather_lookup',
				description: 'Get weather information for any city worldwide',
				parameters: {
					type: 'object',
					properties: {
						city: { type: 'string', description: 'City name' }
					},
					required: ['city']
				},
				execute: async () => '{"weather": "sunny"}'
			};

			registry.registerHidden(hiddenTool, 5);

			// Search by different terms that match the description
			const results1 = registry.searchBM25('weather', 5);
			expect(results1.some((r) => r.name === 'weather_lookup')).toBe(true);

			const results2 = registry.searchBM25('city', 5);
			expect(results2.some((r) => r.name === 'weather_lookup')).toBe(true);

			const results3 = registry.searchBM25('worldwide', 5);
			expect(results3.some((r) => r.name === 'weather_lookup')).toBe(true);
		});

		it('should not find core tools via BM25 search', () => {
			// BM25 only searches hidden tools
			const coreTool: Tool = {
				name: 'always_visible',
				description: 'Always visible core tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'result'
			};

			registry.register(coreTool);

			const results = registry.searchBM25('always visible', 5);

			// Core tools should NOT appear in BM25 search
			expect(results.some((r) => r.name === 'always_visible')).toBe(false);
		});

		it('should respect maxResults limit', () => {
			// Register multiple hidden tools
			for (let i = 0; i < 20; i++) {
				registry.registerHidden(
					{
						name: `hidden_tool_${i}`,
						description: `Hidden tool number ${i} with searchable content`,
						parameters: {
							type: 'object',
							properties: {},
							required: []
						},
						execute: async () => `result ${i}`
					},
					5
				);
			}

			const results = registry.searchBM25('searchable content', 3);

			expect(results.length).toBeLessThanOrEqual(3);
		});

		it('should return empty array when no hidden tools exist', () => {
			const coreTool: Tool = {
				name: 'core_tool',
				description: 'Core tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'result'
			};

			registry.register(coreTool);

			const results = registry.searchBM25('anything', 5);

			expect(results).toEqual([]);
		});

		it('should return empty array for empty query', () => {
			registry.registerHidden(
				{
					name: 'hidden_tool',
					description: 'Some description',
					parameters: {
						type: 'object',
						properties: {},
						required: []
					},
					execute: async () => 'result'
				},
				5
			);

			const results = registry.searchBM25('', 5);

			expect(results).toEqual([]);
		});
	});

	describe('TTL behavior for hidden tools', () => {
		it('should expire hidden tools after TTL', () => {
			const hiddenTool: Tool = {
				name: 'temp_tool',
				description: 'Temporary tool with short TTL',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'temp'
			};

			// Register with TTL of 1
			registry.registerHidden(hiddenTool, 1);

			// Should be accessible initially
			expect(registry.has('temp_tool')).toBe(true);

			// After tickTTL, should be expired
			const expired = registry.tickTTL();
			expect(expired).toBe(1);
			expect(registry.has('temp_tool')).toBe(false);
		});

		it('should decrement TTL for all hidden tools on tick', () => {
			const tool1: Tool = {
				name: 'tool_1',
				description: 'Tool 1',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => '1'
			};

			const tool2: Tool = {
				name: 'tool_2',
				description: 'Tool 2',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => '2'
			};

			registry.registerHidden(tool1, 2);
			registry.registerHidden(tool2, 3);

			// First tick
			let expired = registry.tickTTL();
			expect(expired).toBe(0); // Neither has expired yet
			expect(registry.has('tool_1')).toBe(true);
			expect(registry.has('tool_2')).toBe(true);

			// Second tick
			expired = registry.tickTTL();
			expect(expired).toBe(1); // tool_1 should expire
			expect(registry.has('tool_1')).toBe(false);
			expect(registry.has('tool_2')).toBe(true);

			// Third tick
			expired = registry.tickTTL();
			expect(expired).toBe(1); // tool_2 should expire
			expect(registry.has('tool_1')).toBe(false);
			expect(registry.has('tool_2')).toBe(false);
		});

		it('should promote tools with new TTL', () => {
			const hiddenTool: Tool = {
				name: 'promoted_tool',
				description: 'Tool to promote',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'promoted'
			};

			// Register with TTL of 0 (not accessible)
			registry.registerHidden(hiddenTool, 0);

			expect(registry.has('promoted_tool')).toBe(false);

			// Promote with new TTL
			registry.promoteTools(['promoted_tool'], 3);

			expect(registry.has('promoted_tool')).toBe(true);

			// After TTL expires, should be inaccessible again
			registry.tickTTL();
			registry.tickTTL();
			registry.tickTTL();

			expect(registry.has('promoted_tool')).toBe(false);
		});

		it('should not affect core tools during TTL operations', () => {
			const coreTool: Tool = {
				name: 'core_tool',
				description: 'Core tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'core'
			};

			registry.register(coreTool);

			// Tick TTL many times
			for (let i = 0; i < 10; i++) {
				registry.tickTTL();
			}

			// Core tool should still be accessible
			expect(registry.has('core_tool')).toBe(true);
		});
	});

	describe('tool registry visibility', () => {
		it('should only return visible tools from getVisibleTools', () => {
			const coreTool: Tool = {
				name: 'core',
				description: 'Core tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'core'
			};

			const hiddenTool: Tool = {
				name: 'hidden',
				description: 'Hidden tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'hidden'
			};

			registry.register(coreTool);
			registry.registerHidden(hiddenTool, 0); // TTL 0 = not visible

			const visibleTools = registry.getVisibleTools();
			const visibleNames = visibleTools.map((t) => t.name);

			expect(visibleNames).toContain('core');
			expect(visibleNames).not.toContain('hidden');
		});

		it('should return hidden tools with active TTL from getVisibleTools', () => {
			const coreTool: Tool = {
				name: 'core',
				description: 'Core tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'core'
			};

			const hiddenTool: Tool = {
				name: 'hidden',
				description: 'Hidden tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'hidden'
			};

			registry.register(coreTool);
			registry.registerHidden(hiddenTool, 5); // Active TTL

			const visibleTools = registry.getVisibleTools();
			const visibleNames = visibleTools.map((t) => t.name);

			expect(visibleNames).toContain('core');
			expect(visibleNames).toContain('hidden');
		});
	});

	describe('regex search', () => {
		it('should find hidden tools via regex pattern matching', () => {
			const hiddenTool: Tool = {
				name: 'database_query',
				description: 'Execute SQL queries against the database',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'query result'
			};

			registry.registerHidden(hiddenTool, 5);

			const results = registry.searchRegex('database', 5);

			expect(results.some((r) => r.name === 'database_query')).toBe(true);
		});

		it('should return empty for invalid regex', () => {
			const results = registry.searchRegex('[invalid', 5);

			expect(results).toEqual([]);
		});

		it('should match tool name with higher score than description', () => {
			const hiddenTool: Tool = {
				name: 'api_call',
				description: 'Make an API request',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'api result'
			};

			registry.registerHidden(hiddenTool, 5);

			const results = registry.searchRegex('api', 5);

			expect(results.length).toBeGreaterThan(0);
			// Name matches should have higher score than description matches
			const toolResult = results.find((r) => r.name === 'api_call');
			expect(toolResult).toBeDefined();
			expect(toolResult?.score).toBe(2); // Name match = score 2
		});
	});

	describe('snapshot and versioning', () => {
		it('should create snapshot of hidden tools', () => {
			const hiddenTool1: Tool = {
				name: 'hidden_1',
				description: 'First hidden tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => '1'
			};

			const hiddenTool2: Tool = {
				name: 'hidden_2',
				description: 'Second hidden tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => '2'
			};

			registry.registerHidden(hiddenTool1, 5);
			registry.registerHidden(hiddenTool2, 5);

			const snapshot = registry.snapshotHiddenTools();

			expect(snapshot.docs).toHaveLength(2);
			expect(snapshot.docs.some((d) => d.name === 'hidden_1')).toBe(true);
			expect(snapshot.docs.some((d) => d.name === 'hidden_2')).toBe(true);
			expect(snapshot.version).toBe(2);
		});

		it('should not include core tools in snapshot', () => {
			const coreTool: Tool = {
				name: 'core',
				description: 'Core tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'core'
			};

			const hiddenTool: Tool = {
				name: 'hidden',
				description: 'Hidden tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'hidden'
			};

			registry.register(coreTool);
			registry.registerHidden(hiddenTool, 5);

			const snapshot = registry.snapshotHiddenTools();

			expect(snapshot.docs).toHaveLength(1);
			expect(snapshot.docs[0].name).toBe('hidden');
		});

		it('should increment version on register/unregister', () => {
			expect(registry.versionNumber()).toBe(0);

			registry.registerHidden(
				{
					name: 'hidden',
					description: 'Hidden',
					parameters: {
						type: 'object',
						properties: {},
						required: []
					},
					execute: async () => 'hidden'
				},
				5
			);

			expect(registry.versionNumber()).toBe(1);

			registry.unregister('hidden');

			expect(registry.versionNumber()).toBe(2);
		});
	});

	describe('clone functionality', () => {
		it('should create independent copy of registry', () => {
			const tool: Tool = {
				name: 'test_tool',
				description: 'Test tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'test'
			};

			registry.register(tool);

			const cloned = registry.clone();

			expect(cloned).not.toBe(registry);
			expect(cloned.has('test_tool')).toBe(true);
		});

		it('should allow modifications to clone without affecting original', () => {
			const tool: Tool = {
				name: 'test_tool',
				description: 'Test tool',
				parameters: {
					type: 'object',
					properties: {},
					required: []
				},
				execute: async () => 'test'
			};

			registry.register(tool);
			const cloned = registry.clone();

			cloned.unregister('test_tool');

			expect(registry.has('test_tool')).toBe(true);
			expect(cloned.has('test_tool')).toBe(false);
		});
	});
});
