import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	wrapToolWithHooks,
	convertToolsToAiSdk,
	clearToolCache
} from './tool-wrapper';
import type { ToolDefinition } from '../types';
import type { EventBus } from '../events/event-bus';

// Mock EventBus
const createMockEventBus = () => ({
	emitSync: vi.fn(),
	emit: vi.fn(),
	subscribe: vi.fn(),
	unsubscribe: vi.fn()
});

describe('Tool Wrapper', () => {
	beforeEach(() => {
		clearToolCache();
	});

	describe('wrapToolWithHooks', () => {
		it('should wrap a simple tool definition', () => {
			const toolDef: ToolDefinition = {
				name: 'test_tool',
				description: 'A test tool',
				parameters: {
					type: 'object',
					properties: {
						input: { type: 'string' }
					},
					required: ['input']
				},
				execute: async (params) => ({ result: `processed: ${params.input}` })
			};

			const wrappedTool = wrapToolWithHooks(toolDef);

			expect(wrappedTool).toBeDefined();
		});

		it('should execute tool and return result', async () => {
			const toolDef: ToolDefinition = {
				name: 'echo',
				description: 'Echo tool',
				parameters: {
					type: 'object',
					properties: {
						message: { type: 'string' }
					},
					required: ['message']
				},
				execute: async (params) => ({ echoed: params.message })
			};

			const wrappedTool = wrapToolWithHooks(toolDef) as any;
			const result = await wrappedTool.execute({ message: 'hello' });

			expect(result.success).toBe(true);
			expect(result.result.echoed).toBe('hello');
		});

		it('should include duration in result', async () => {
			const toolDef: ToolDefinition = {
				name: 'quick_tool',
				description: 'Quick tool',
				execute: async () => ({ done: true })
			};

			const wrappedTool = wrapToolWithHooks(toolDef) as any;
			const result = await wrappedTool.execute({});

			expect(result.durationMs).toBeDefined();
			expect(result.durationMs).toBeGreaterThanOrEqual(0);
		});

		it('should handle tool execution errors', async () => {
			const toolDef: ToolDefinition = {
				name: 'failing_tool',
				description: 'A tool that fails',
				execute: async () => {
					throw new Error('Tool failed!');
				}
			};

			const wrappedTool = wrapToolWithHooks(toolDef) as any;
			const result = await wrappedTool.execute({});

			expect(result.success).toBe(false);
			expect(result.error).toBe('Tool failed!');
		});

		it('should handle tools without execute function', async () => {
			const toolDef: ToolDefinition = {
				name: 'no_execute',
				description: 'Tool without execute'
			};

			const wrappedTool = wrapToolWithHooks(toolDef) as any;
			const result = await wrappedTool.execute({});

			expect(result.success).toBe(false);
			expect(result.error).toBe('Tool has no execute function');
		});

		it('should emit events to EventBus', async () => {
			const mockEventBus = createMockEventBus() as unknown as EventBus;

			const toolDef: ToolDefinition = {
				name: 'event_tool',
				description: 'Tool with events',
				execute: async () => ({ success: true })
			};

			const wrappedTool = wrapToolWithHooks(toolDef, {
				eventBus: mockEventBus
			}) as any;

			await wrappedTool.execute({});

			expect(mockEventBus.emitSync).toHaveBeenCalledTimes(2);

			// First call: tool_start
			const startCall = (mockEventBus.emitSync as any).mock.calls[0];
			expect(startCall[0].type).toBe('tool_start');
			expect(startCall[0].data.toolName).toBe('event_tool');

			// Second call: tool_complete
			const completeCall = (mockEventBus.emitSync as any).mock.calls[1];
			expect(completeCall[0].type).toBe('tool_complete');
			expect(completeCall[0].data.toolName).toBe('event_tool');
		});

		it('should cache results when caching is enabled', async () => {
			let callCount = 0;

			const toolDef: ToolDefinition = {
				name: 'cached_tool',
				description: 'Tool with caching',
				execute: async (params) => {
					callCount++;
					return { value: params.input, callCount };
				}
			};

			const wrappedTool = wrapToolWithHooks(toolDef, {
				enableCache: true,
				cacheTtlMs: 60000
			}) as any;

			// First call
			const result1 = await wrappedTool.execute({ input: 'test' });
			expect(result1.result.callCount).toBe(1);
			expect(result1.cached).toBe(false);

			// Second call with same params - should be cached
			const result2 = await wrappedTool.execute({ input: 'test' });
			expect(result2._cached).toBe(true);

			// Third call with different params - should not be cached
			const result3 = await wrappedTool.execute({ input: 'different' });
			expect(result3.result.callCount).toBe(2);
		});

		it('should not cache results when caching is disabled', async () => {
			let callCount = 0;

			const toolDef: ToolDefinition = {
				name: 'uncached_tool',
				description: 'Tool without caching',
				execute: async () => {
					callCount++;
					return { callCount };
				}
			};

			const wrappedTool = wrapToolWithHooks(toolDef, {
				enableCache: false
			}) as any;

			await wrappedTool.execute({});
			await wrappedTool.execute({});

			expect(callCount).toBe(2);
		});

		it('should not cache failed results', async () => {
			let failCount = 0;

			const toolDef: ToolDefinition = {
				name: 'sometimes_fails',
				description: 'Tool that can fail',
				execute: async () => {
					failCount++;
					throw new Error(`Failure ${failCount}`);
				}
			};

			const wrappedTool = wrapToolWithHooks(toolDef, {
				enableCache: true
			}) as any;

			await wrappedTool.execute({});
			await wrappedTool.execute({});

			// Both calls should have executed since errors aren't cached
			expect(failCount).toBe(2);
		});

		it('should include tool call ID in events', async () => {
			const mockEventBus = createMockEventBus() as unknown as EventBus;

			const toolDef: ToolDefinition = {
				name: 'id_tool',
				description: 'Tool with ID tracking',
				execute: async () => ({ done: true })
			};

			const wrappedTool = wrapToolWithHooks(toolDef, {
				eventBus: mockEventBus
			}) as any;

			await wrappedTool.execute({});

			const startCall = (mockEventBus.emitSync as any).mock.calls[0];
			expect(startCall[0].data.toolCallId).toBeDefined();
			expect(startCall[0].data.toolCallId).toMatch(/^tc_/);
		});

		it('should handle tools without parameters schema', async () => {
			const toolDef: ToolDefinition = {
				name: 'no_params',
				description: 'Tool without params schema',
				execute: async () => ({ status: 'ok' })
			};

			const wrappedTool = wrapToolWithHooks(toolDef) as any;
			const result = await wrappedTool.execute({});

			expect(result.success).toBe(true);
		});
	});

	describe('convertToolsToAiSdk', () => {
		it('should convert array of tools to ToolSet', () => {
			const tools: ToolDefinition[] = [
				{
					name: 'tool1',
					description: 'First tool',
					execute: async () => ({ tool: 1 })
				},
				{
					name: 'tool2',
					description: 'Second tool',
					execute: async () => ({ tool: 2 })
				}
			];

			const toolSet = convertToolsToAiSdk(tools);

			expect(toolSet.tool1).toBeDefined();
			expect(toolSet.tool2).toBeDefined();
		});

		it('should pass options to all wrapped tools', async () => {
			const mockEventBus = createMockEventBus() as unknown as EventBus;

			const tools: ToolDefinition[] = [
				{
					name: 'tool_a',
					description: 'Tool A',
					execute: async () => ({ a: true })
				},
				{
					name: 'tool_b',
					description: 'Tool B',
					execute: async () => ({ b: true })
				}
			];

			const toolSet = convertToolsToAiSdk(tools, {
				eventBus: mockEventBus
			});

			await (toolSet.tool_a as any).execute({});
			await (toolSet.tool_b as any).execute({});

			// Each tool emits 2 events (start + complete)
			expect(mockEventBus.emitSync).toHaveBeenCalledTimes(4);
		});

		it('should return empty object for empty array', () => {
			const toolSet = convertToolsToAiSdk([]);

			expect(Object.keys(toolSet)).toHaveLength(0);
		});
	});

	describe('clearToolCache', () => {
		it('should clear all cached results', async () => {
			let callCount = 0;

			const toolDef: ToolDefinition = {
				name: 'cache_clear_test',
				description: 'Cache clear test',
				execute: async () => {
					callCount++;
					return { callCount };
				}
			};

			const wrappedTool = wrapToolWithHooks(toolDef, {
				enableCache: true
			}) as any;

			// First call
			await wrappedTool.execute({});
			expect(callCount).toBe(1);

			// Second call - cached
			await wrappedTool.execute({});
			expect(callCount).toBe(1);

			// Clear cache
			clearToolCache();

			// Third call - not cached anymore
			await wrappedTool.execute({});
			expect(callCount).toBe(2);
		});
	});
});
