/**
 * Integration tests for AgentLoop
 *
 * Tests the full agent loop with mock providers, tools, events, and hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentLoop } from '../../src/core/agent-loop.js';
import { ToolRegistry, type Tool } from '../../src/tools/registry.js';
import { EventBus, createEventBus } from '../../src/events/event-bus.js';
import { HookManager, createHookManager } from '../../src/hooks/hook-manager.js';
import type { AgentMessage } from '../../src/types/index.js';

// Re-export LLMProviderClient from the module
type LLMProviderClient = {
	chat(request: { model: string; messages: AgentMessage[]; tools?: unknown[] }): Promise<{
		model: string;
		message: AgentMessage;
		usage: { inputTokens: number; outputTokens: number; totalTokens: number };
		finishReason: string;
	}>;
};

describe('AgentLoop Integration', () => {
	// Test state
	let eventBus: EventBus;
	let hookManager: HookManager;
	let toolRegistry: ToolRegistry;
	let capturedEvents: Array<{ type: string; data: Record<string, unknown> }> = [];

	beforeEach(() => {
		eventBus = createEventBus();
		hookManager = createHookManager();
		toolRegistry = new ToolRegistry();
		capturedEvents = [];

		// Subscribe to all events for testing
		eventBus.subscribe('*', (event) => {
			capturedEvents.push({ type: event.type, data: event.data as Record<string, unknown> });
		});
	});

	afterEach(() => {
		eventBus.close();
		hookManager.clear();
		vi.restoreAllMocks();
	});

	/**
	 * Creates a mock LLM provider client for the AgentLoop
	 */
	function createMockProviderClient(options: {
		respond?: string;
		toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
		shouldFail?: boolean;
		errorType?: string;
	}): LLMProviderClient {
		return {
			chat: async (request) => {
				if (options.shouldFail) {
					throw new Error(options.errorType || 'Unknown error');
				}

				const content: AgentMessage['content'] = options.toolCalls
					? options.toolCalls.map((tc) => ({
							type: 'tool_call' as const,
							id: `call_${Date.now()}_${Math.random().toString(36).substring(7)}`,
							name: tc.name,
							input: tc.args
						}))
					: options.respond || 'Hello! How can I help you?';

				return {
					model: request.model,
					message: {
						role: 'assistant' as const,
						content
					},
					usage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150
					},
					finishReason: options.toolCalls ? 'tool_calls' : 'stop'
				};
			}
		};
	}

	describe('run', () => {
		it('should complete a simple turn without tools', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Hello! How can I help you?'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				maxIterations: 10
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'executed',
				executionMs: 1
			}));

			const result = await agent.run([], 'Say hello');

			expect(result.finalOutput).toContain('Hello');
			expect(result.iterations).toBe(1);
			expect(result.error).toBeUndefined();
		});

		it('should execute a tool and continue', async () => {
			const mockClient = createMockProviderClient({
				toolCalls: [{ name: 'get_weather', args: { city: 'Tokyo' } }]
			});

			const weatherTool: Tool = {
				name: 'get_weather',
				description: 'Get weather for a city',
				parameters: {
					type: 'object',
					properties: {
						city: { type: 'string', description: 'City name' }
					},
					required: ['city']
				},
				execute: async (args) => {
					const city = args.city as string;
					return JSON.stringify({ weather: 'sunny', temp: 25, city });
				}
			};

			toolRegistry.register(weatherTool);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				tools: toolRegistry.getDefinitions(),
				maxIterations: 10
			} as any);

			agent.setToolExecutor(async (tool, args) => {
				const result = await toolRegistry.execute(tool.name, args);
				return result;
			});

			const result = await agent.run([], 'What is the weather in Tokyo?');

			// Should have executed the tool and continued
			expect(result.iterations).toBeGreaterThanOrEqual(1);
			expect(result.messages.length).toBeGreaterThan(2); // Initial + tool calls + tool results
		});

		it('should emit lifecycle events', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Test response'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				maxIterations: 10
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 1
			}));

			await agent.run([], 'Test message');

			// Check that events were emitted
			const eventTypes = capturedEvents.map((e) => e.type);
			expect(eventTypes).toContain('run:start');
			expect(eventTypes).toContain('run:end');
		});

		it('should track usage statistics', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Test response'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				maxIterations: 10
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 1
			}));

			const result = await agent.run([], 'Test message');

			expect(result.usage).toBeDefined();
			expect(result.usage?.inputTokens).toBeGreaterThan(0);
			expect(result.usage?.outputTokens).toBeGreaterThan(0);
			expect(result.usage?.totalTokens).toBeGreaterThan(0);
		});

		it('should throw when already running', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Slow response'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				maxIterations: 100
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 100 // Slow execution
			}));

			// Start first run (don't await)
			const run1 = agent.run([], 'Test 1');

			// Try to start second run - should throw
			await expect(agent.run([], 'Test 2')).rejects.toThrow('already running');

			// Wait for first run to complete
			await run1;
		});

		it('should handle provider errors', async () => {
			const mockClient = createMockProviderClient({
				shouldFail: true,
				errorType: 'timeout'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				maxIterations: 3 // Limit iterations
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 1
			}));

			const result = await agent.run([], 'Test');

			// Should have an error
			expect(result.error).toBeDefined();
			expect(result.error?.type).toBe('provider_error');
		});
	});

	describe('tool execution', () => {
		it('should execute registered tools', async () => {
			let executedArgs: Record<string, unknown> | undefined;

			const mockClient = createMockProviderClient({
				toolCalls: [{ name: 'test_tool', args: { query: 'test' } }]
			});

			const testTool: Tool = {
				name: 'test_tool',
				description: 'A test tool',
				parameters: {
					type: 'object',
					properties: {
						query: { type: 'string', description: 'Query string' }
					},
					required: ['query']
				},
				execute: async (args) => {
					executedArgs = args;
					return `Executed with: ${JSON.stringify(args)}`;
				}
			};

			toolRegistry.register(testTool);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				tools: toolRegistry.getDefinitions(),
				maxIterations: 10
			} as any);

			agent.setToolExecutor(async (tool, args) => {
				const result = await toolRegistry.execute(tool.name, args);
				return result;
			});

			await agent.run([], 'Use test tool');

			expect(executedArgs).toBeDefined();
			expect(executedArgs?.query).toBe('test');
		});

		it('should return error for non-existent tool', async () => {
			const mockClient = createMockProviderClient({
				toolCalls: [{ name: 'non_existent', args: {} }]
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				maxIterations: 10
			} as any);

			agent.setToolExecutor(async (tool, args) => ({
				toolName: tool.name,
				arguments: args,
				success: false,
				error: `Tool not found: ${tool.name}`,
				executionMs: 1
			}));

			const result = await agent.run([], 'Use non-existent tool');

			// Should complete but with errors in the messages
			expect(result.messages.length).toBeGreaterThan(0);
		});
	});

	describe('session management', () => {
		it('should maintain session state', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Session test response'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				maxIterations: 10
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 1
			}));

			const sessionStore = agent.getSessionStore();
			sessionStore.create('test-session', { userId: 'test-user' } as any);

			const result = await agent.run([], 'Test');

			expect(result.messages.length).toBeGreaterThan(0);
		});

		it('should get session store', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Test'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model'
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 1
			}));

			const sessionStore = agent.getSessionStore();
			expect(sessionStore).toBeDefined();
			expect(typeof sessionStore.get).toBe('function');
		});
	});

	describe('turn management', () => {
		it('should create and track turns', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Turn test response'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				maxIterations: 10
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 1
			}));

			const result = await agent.run([], 'Test turn');

			expect(result.turns).toBeDefined();
			expect(Array.isArray(result.turns)).toBe(true);
		});

		it('should respect max iterations limit', async () => {
			// Provider that always returns tool calls (to force iteration)
			const mockClient = createMockProviderClient({
				toolCalls: [{ name: 'endless_tool', args: {} }]
			});

			const endlessTool: Tool = {
				name: 'endless_tool',
				description: 'Never ending tool',
				parameters: { type: 'object', properties: {}, required: [] },
				execute: async () => 'continue'
			};

			toolRegistry.register(endlessTool);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				tools: toolRegistry.getDefinitions(),
				maxIterations: 5
			} as any);

			agent.setToolExecutor(async (tool) => {
				const result = await toolRegistry.execute(tool.name, {});
				return result;
			});

			const result = await agent.run([], 'Keep calling tools');

			// Should stop at max iterations
			expect(result.iterations).toBeLessThanOrEqual(5);
		});
	});

	describe('event bus integration', () => {
		it('should get event bus', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Test'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model'
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 1
			}));

			const bus = agent.getEventBus();
			expect(bus).toBeDefined();
			expect(typeof bus.emit).toBe('function');
		});

		it('should emit events during execution', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Event test'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				maxIterations: 10
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 1
			}));

			await agent.run([], 'Test');

			// Should have captured events
			expect(capturedEvents.length).toBeGreaterThan(0);
		});
	});

	describe('context building', () => {
		it('should get context builder', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Test'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				workspace: '/tmp/test'
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 1
			}));

			const contextBuilder = agent.getContextBuilder();
			expect(contextBuilder).toBeDefined();
			expect(typeof contextBuilder.buildMessages).toBe('function');
		});
	});

	describe('reset and abort', () => {
		it('should reset agent state', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Test'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model'
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 1
			}));

			await agent.run([], 'Test 1');

			agent.reset();

			const iteration = agent.getIteration();
			expect(iteration).toBe(0);
		});

		it('should abort running agent', async () => {
			const mockClient = createMockProviderClient({
				respond: 'Slow response'
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const agent = new AgentLoop({
				provider: mockClient,
				model: 'test-model',
				maxIterations: 100
			} as any);

			agent.setToolExecutor(async () => ({
				toolName: 'test',
				arguments: {},
				success: true,
				output: 'done',
				executionMs: 1000 // Very slow
			}));

			// Start run but abort before completion
			const runPromise = agent.run([], 'Slow test');

			// Abort after a short delay
			setTimeout(() => agent.abort(), 50);

			const result = await runPromise;

			// Should have fewer iterations than max due to abort
			expect(result.iterations).toBeLessThan(100);
		});
	});
});
