/**
 * Tests for Lifecycle Hooks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	HookManager,
	createHookManager,
	LifecycleHooks,
	type AgentBeforeStartEvent,
	type AgentAfterEndEvent,
	type TurnBeforeStartEvent,
	type TurnAfterEndEvent,
	type ToolBeforeExecuteEvent,
	type ToolAfterExecuteEvent,
	type ToolOnErrorEvent,
	type ProviderBeforeCallEvent,
	type ProviderAfterCallEvent,
	type ProviderOnErrorEvent,
	type LifecycleHookRegistration,
	type AgentStats
} from '../../src/hooks/index.js';

describe('LifecycleHooks Constants', () => {
	describe('agent lifecycle hooks', () => {
		it('should have correct agent:before_start hook name', () => {
			expect(LifecycleHooks.agent.beforeStart).toBe('agent:before_start');
		});

		it('should have correct agent:after_end hook name', () => {
			expect(LifecycleHooks.agent.afterEnd).toBe('agent:after_end');
		});
	});

	describe('turn lifecycle hooks', () => {
		it('should have correct turn:before_start hook name', () => {
			expect(LifecycleHooks.turn.beforeStart).toBe('turn:before_start');
		});

		it('should have correct turn:after_end hook name', () => {
			expect(LifecycleHooks.turn.afterEnd).toBe('turn:after_end');
		});
	});

	describe('tool lifecycle hooks', () => {
		it('should have correct tool:before_execute hook name', () => {
			expect(LifecycleHooks.tool.beforeExecute).toBe('tool:before_execute');
		});

		it('should have correct tool:after_execute hook name', () => {
			expect(LifecycleHooks.tool.afterExecute).toBe('tool:after_execute');
		});

		it('should have correct tool:on_error hook name', () => {
			expect(LifecycleHooks.tool.onError).toBe('tool:on_error');
		});
	});

	describe('provider lifecycle hooks', () => {
		it('should have correct provider:before_call hook name', () => {
			expect(LifecycleHooks.provider.beforeCall).toBe('provider:before_call');
		});

		it('should have correct provider:after_call hook name', () => {
			expect(LifecycleHooks.provider.afterCall).toBe('provider:after_call');
		});

		it('should have correct provider:on_error hook name', () => {
			expect(LifecycleHooks.provider.onError).toBe('provider:on_error');
		});
	});
});

describe('LifecycleHookRegistration', () => {
	let hookManager: HookManager;

	beforeEach(() => {
		hookManager = createHookManager({ defaultTimeoutMs: 5000 });
	});

	afterEach(() => {
		hookManager.close();
	});

	describe('registerLifecycleHooks', () => {
		it('should register lifecycle hooks and return unsubscribe function', () => {
			const registration: LifecycleHookRegistration = {
				name: 'test-lifecycle-hook',
				hooks: {
					onBeforeAgentStart: vi.fn(),
					onAfterAgentEnd: vi.fn()
				}
			};

			const unsubscribe = hookManager.registerLifecycleHooks(registration);
			expect(typeof unsubscribe).toBe('function');

			// Verify hooks are registered
			expect(hookManager.hasLifecycleHooks(LifecycleHooks.agent.beforeStart)).toBe(true);
			expect(hookManager.hasLifecycleHooks(LifecycleHooks.agent.afterEnd)).toBe(true);

			unsubscribe();
		});

		it('should only register hooks for provided handler methods', () => {
			const registration: LifecycleHookRegistration = {
				name: 'partial-lifecycle-hook',
				hooks: {
					onBeforeAgentStart: vi.fn()
					// Only providing onBeforeAgentStart, not onAfterAgentEnd
				}
			};

			hookManager.registerLifecycleHooks(registration);

			expect(hookManager.hasLifecycleHooks(LifecycleHooks.agent.beforeStart)).toBe(true);
			expect(hookManager.hasLifecycleHooks(LifecycleHooks.agent.afterEnd)).toBe(false);
		});

		it('should unregister all lifecycle hooks on unsubscribe', () => {
			const registration: LifecycleHookRegistration = {
				name: 'test-lifecycle-hook',
				hooks: {
					onBeforeAgentStart: vi.fn(),
					onAfterAgentEnd: vi.fn(),
					onBeforeTurnStart: vi.fn(),
					onAfterTurnEnd: vi.fn()
				}
			};

			const unsubscribe = hookManager.registerLifecycleHooks(registration);
			unsubscribe();

			expect(hookManager.hasLifecycleHooks(LifecycleHooks.agent.beforeStart)).toBe(false);
			expect(hookManager.hasLifecycleHooks(LifecycleHooks.agent.afterEnd)).toBe(false);
			expect(hookManager.hasLifecycleHooks(LifecycleHooks.turn.beforeStart)).toBe(false);
			expect(hookManager.hasLifecycleHooks(LifecycleHooks.turn.afterEnd)).toBe(false);
		});

		it('should respect priority ordering', async () => {
			const callOrder: string[] = [];

			const lowPriority: LifecycleHookRegistration = {
				name: 'low-priority',
				priority: 10,
				hooks: {
					onBeforeAgentStart: () => {
						callOrder.push('low');
					}
				}
			};

			const highPriority: LifecycleHookRegistration = {
				name: 'high-priority',
				priority: 100,
				hooks: {
					onBeforeAgentStart: () => {
						callOrder.push('high');
					}
				}
			};

			const mediumPriority: LifecycleHookRegistration = {
				name: 'medium-priority',
				priority: 50,
				hooks: {
					onBeforeAgentStart: () => {
						callOrder.push('medium');
					}
				}
			};

			hookManager.registerLifecycleHooks(lowPriority);
			hookManager.registerLifecycleHooks(highPriority);
			hookManager.registerLifecycleHooks(mediumPriority);

			const event: AgentBeforeStartEvent = {
				kind: LifecycleHooks.agent.beforeStart,
				runId: 'test-run',
				timestamp: Date.now(),
				config: {},
				input: 'test input'
			};

			// Run the lifecycle hook with await
			await hookManager.runLifecycleHook(LifecycleHooks.agent.beforeStart, event);

			// All hooks should have been called (3 total calls)
			expect(callOrder.length).toBe(3);
			// Higher priority should be called first (100 > 50 > 10)
			expect(callOrder[0]).toBe('high');
			expect(callOrder[1]).toBe('medium');
			expect(callOrder[2]).toBe('low');
		});
	});

	describe('runLifecycleHook', () => {
		it('should run before agent start hook with correct event data', async () => {
			const beforeStartHandler = vi.fn();

			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onBeforeAgentStart: beforeStartHandler
				}
			};

			hookManager.registerLifecycleHooks(registration);

			const event: AgentBeforeStartEvent = {
				kind: LifecycleHooks.agent.beforeStart,
				runId: 'test-run-123',
				timestamp: Date.now(),
				config: {
					id: 'test-agent',
					model: 'gpt-4'
				},
				input: 'Hello agent'
			};

			const result = await hookManager.runLifecycleHook(LifecycleHooks.agent.beforeStart, event);

			expect(beforeStartHandler).toHaveBeenCalledWith(event);
			expect(result.event).toBe(event);
			expect(result.modified).toBe(false);
		});

		it('should run after agent end hook with correct event data', async () => {
			const afterEndHandler = vi.fn();

			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onAfterAgentEnd: afterEndHandler
				}
			};

			hookManager.registerLifecycleHooks(registration);

			const stats: AgentStats = {
				iterations: 5,
				turns: 3,
				toolCalls: 10,
				inputTokens: 1000,
				outputTokens: 2000,
				totalTokens: 3000,
				durationMs: 5000
			};

			const event: AgentAfterEndEvent = {
				kind: LifecycleHooks.agent.afterEnd,
				runId: 'test-run-123',
				timestamp: Date.now(),
				reason: 'completed',
				stats,
				finalOutput: 'Hello from agent',
				iterations: 5,
				turns: 3
			};

			await hookManager.runLifecycleHook(LifecycleHooks.agent.afterEnd, event);

			expect(afterEndHandler).toHaveBeenCalledWith(event);
		});

		it('should run before turn start hook', async () => {
			const beforeTurnHandler = vi.fn();

			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onBeforeTurnStart: beforeTurnHandler
				}
			};

			hookManager.registerLifecycleHooks(registration);

			const event: TurnBeforeStartEvent = {
				kind: LifecycleHooks.turn.beforeStart,
				runId: 'test-run-123',
				timestamp: Date.now(),
				turnId: 'turn-1',
				input: 'User message',
				iteration: 1
			};

			await hookManager.runLifecycleHook(LifecycleHooks.turn.beforeStart, event);

			expect(beforeTurnHandler).toHaveBeenCalledWith(event);
		});

		it('should run after turn end hook', async () => {
			const afterTurnHandler = vi.fn();

			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onAfterTurnEnd: afterTurnHandler
				}
			};

			hookManager.registerLifecycleHooks(registration);

			const event: TurnAfterEndEvent = {
				kind: LifecycleHooks.turn.afterEnd,
				runId: 'test-run-123',
				timestamp: Date.now(),
				turnId: 'turn-1',
				output: 'Agent response',
				toolCallCount: 2,
				durationMs: 1500,
				status: 'completed'
			};

			await hookManager.runLifecycleHook(LifecycleHooks.turn.afterEnd, event);

			expect(afterTurnHandler).toHaveBeenCalledWith(event);
		});

		it('should run before tool execute hook', async () => {
			const beforeToolHandler = vi.fn();

			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onBeforeToolExecute: beforeToolHandler
				}
			};

			hookManager.registerLifecycleHooks(registration);

			const event: ToolBeforeExecuteEvent = {
				kind: LifecycleHooks.tool.beforeExecute,
				runId: 'test-run-123',
				timestamp: Date.now(),
				toolName: 'test_tool',
				arguments: { arg1: 'value1' }
			};

			await hookManager.runLifecycleHook(LifecycleHooks.tool.beforeExecute, event);

			expect(beforeToolHandler).toHaveBeenCalledWith(event);
		});

		it('should run after tool execute hook', async () => {
			const afterToolHandler = vi.fn();

			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onAfterToolExecute: afterToolHandler
				}
			};

			hookManager.registerLifecycleHooks(registration);

			const event: ToolAfterExecuteEvent = {
				kind: LifecycleHooks.tool.afterExecute,
				runId: 'test-run-123',
				timestamp: Date.now(),
				toolName: 'test_tool',
				arguments: { arg1: 'value1' },
				result: {
					success: true,
					output: 'Tool result'
				},
				durationMs: 100
			};

			await hookManager.runLifecycleHook(LifecycleHooks.tool.afterExecute, event);

			expect(afterToolHandler).toHaveBeenCalledWith(event);
		});

		it('should run tool error hook', async () => {
			const toolErrorHandler = vi.fn();

			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onToolError: toolErrorHandler
				}
			};

			hookManager.registerLifecycleHooks(registration);

			const event: ToolOnErrorEvent = {
				kind: LifecycleHooks.tool.onError,
				runId: 'test-run-123',
				timestamp: Date.now(),
				toolName: 'test_tool',
				arguments: { arg1: 'value1' },
				error: 'Tool execution failed',
				errorType: 'execution_error'
			};

			await hookManager.runLifecycleHook(LifecycleHooks.tool.onError, event);

			expect(toolErrorHandler).toHaveBeenCalledWith(event);
		});

		it('should run before provider call hook', async () => {
			const beforeProviderHandler = vi.fn();

			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onBeforeProviderCall: beforeProviderHandler
				}
			};

			hookManager.registerLifecycleHooks(registration);

			const event: ProviderBeforeCallEvent = {
				kind: LifecycleHooks.provider.beforeCall,
				runId: 'test-run-123',
				timestamp: Date.now(),
				model: 'gpt-4',
				options: { temperature: 0.7 }
			};

			await hookManager.runLifecycleHook(LifecycleHooks.provider.beforeCall, event);

			expect(beforeProviderHandler).toHaveBeenCalledWith(event);
		});

		it('should run after provider call hook', async () => {
			const afterProviderHandler = vi.fn();

			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onAfterProviderCall: afterProviderHandler
				}
			};

			hookManager.registerLifecycleHooks(registration);

			const event: ProviderAfterCallEvent = {
				kind: LifecycleHooks.provider.afterCall,
				runId: 'test-run-123',
				timestamp: Date.now(),
				model: 'gpt-4',
				response: {
					finishReason: 'stop',
					usage: { inputTokens: 100, outputTokens: 200 }
				},
				durationMs: 500
			};

			await hookManager.runLifecycleHook(LifecycleHooks.provider.afterCall, event);

			expect(afterProviderHandler).toHaveBeenCalledWith(event);
		});

		it('should run provider error hook', async () => {
			const providerErrorHandler = vi.fn();

			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onProviderError: providerErrorHandler
				}
			};

			hookManager.registerLifecycleHooks(registration);

			const event: ProviderOnErrorEvent = {
				kind: LifecycleHooks.provider.onError,
				runId: 'test-run-123',
				timestamp: Date.now(),
				model: 'gpt-4',
				error: 'Provider timeout',
				errorType: 'timeout'
			};

			await hookManager.runLifecycleHook(LifecycleHooks.provider.onError, event);

			expect(providerErrorHandler).toHaveBeenCalledWith(event);
		});
	});

	describe('hasLifecycleHooks', () => {
		it('should return true when lifecycle hooks are registered', () => {
			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onBeforeAgentStart: vi.fn()
				}
			};

			hookManager.registerLifecycleHooks(registration);

			expect(hookManager.hasLifecycleHooks(LifecycleHooks.agent.beforeStart)).toBe(true);
		});

		it('should return false when no lifecycle hooks are registered', () => {
			expect(hookManager.hasLifecycleHooks(LifecycleHooks.agent.beforeStart)).toBe(false);
		});
	});

	describe('getRegisteredLifecycleHookNames', () => {
		it('should return all registered lifecycle hook names', () => {
			const registration1: LifecycleHookRegistration = {
				name: 'test-hook-1',
				hooks: {
					onBeforeAgentStart: vi.fn(),
					onAfterAgentEnd: vi.fn()
				}
			};

			const registration2: LifecycleHookRegistration = {
				name: 'test-hook-2',
				hooks: {
					onBeforeTurnStart: vi.fn(),
					onAfterTurnEnd: vi.fn()
				}
			};

			hookManager.registerLifecycleHooks(registration1);
			hookManager.registerLifecycleHooks(registration2);

			const names = hookManager.getRegisteredLifecycleHookNames();

			expect(names).toContain(LifecycleHooks.agent.beforeStart);
			expect(names).toContain(LifecycleHooks.agent.afterEnd);
			expect(names).toContain(LifecycleHooks.turn.beforeStart);
			expect(names).toContain(LifecycleHooks.turn.afterEnd);
		});
	});

	describe('error handling', () => {
		it('should continue running other hooks when one fails', async () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const callOrder: string[] = [];

			const failingHook: LifecycleHookRegistration = {
				name: 'failing-hook',
				hooks: {
					onBeforeAgentStart: () => {
						callOrder.push('failing');
						throw new Error('intentional failure');
					}
				}
			};

			const succeedingHook: LifecycleHookRegistration = {
				name: 'succeeding-hook',
				hooks: {
					onBeforeAgentStart: () => {
						callOrder.push('succeeding');
					}
				}
			};

			hookManager.registerLifecycleHooks(failingHook);
			hookManager.registerLifecycleHooks(succeedingHook);

			const event: AgentBeforeStartEvent = {
				kind: LifecycleHooks.agent.beforeStart,
				runId: 'test-run',
				timestamp: Date.now(),
				config: {},
				input: 'test'
			};

			// Should not throw
			await hookManager.runLifecycleHook(LifecycleHooks.agent.beforeStart, event);

			expect(callOrder).toContain('failing');
			expect(callOrder).toContain('succeeding');

			consoleSpy.mockRestore();
		});

		it('should handle errors gracefully and continue', async () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const callOrder: string[] = [];

			const failingHook: LifecycleHookRegistration = {
				name: 'failing-hook',
				hooks: {
					onBeforeAgentStart: () => {
						callOrder.push('failing');
						throw new Error('intentional failure');
					}
				}
			};

			const succeedingHook: LifecycleHookRegistration = {
				name: 'succeeding-hook',
				hooks: {
					onBeforeAgentStart: () => {
						callOrder.push('succeeding');
					}
				}
			};

			hookManager.registerLifecycleHooks(failingHook);
			hookManager.registerLifecycleHooks(succeedingHook);

			const event: AgentBeforeStartEvent = {
				kind: LifecycleHooks.agent.beforeStart,
				runId: 'test-run',
				timestamp: Date.now(),
				config: {},
				input: 'test'
			};

			// Should not throw
			await hookManager.runLifecycleHook(LifecycleHooks.agent.beforeStart, event);

			// Both hooks should have been called despite the error
			expect(callOrder).toContain('failing');
			expect(callOrder).toContain('succeeding');

			consoleSpy.mockRestore();
		});
	});

	describe('clear and close', () => {
		it('should clear all lifecycle hooks on clear()', () => {
			const registration: LifecycleHookRegistration = {
				name: 'test-hook',
				hooks: {
					onBeforeAgentStart: vi.fn(),
					onAfterAgentEnd: vi.fn()
				}
			};

			hookManager.registerLifecycleHooks(registration);
			hookManager.clear();

			expect(hookManager.hasLifecycleHooks(LifecycleHooks.agent.beforeStart)).toBe(false);
			expect(hookManager.hasLifecycleHooks(LifecycleHooks.agent.afterEnd)).toBe(false);
		});

		it('should close lifecycle hooks that implement close method', () => {
			const closeMock = vi.fn();

			const registration: LifecycleHookRegistration = {
				name: 'test-hook-with-close',
				hooks: {
					onBeforeAgentStart: vi.fn(),
					close: closeMock
				} as any
			};

			hookManager.registerLifecycleHooks(registration);
			hookManager.close();

			expect(closeMock).toHaveBeenCalled();
		});
	});
});

describe('Lifecycle Event Types', () => {
	it('should create valid AgentBeforeStartEvent', () => {
		const event: AgentBeforeStartEvent = {
			kind: LifecycleHooks.agent.beforeStart,
			runId: 'run-123',
			timestamp: Date.now(),
			config: {
				id: 'agent-1',
				model: 'gpt-4',
				maxIterations: 10
			},
			input: 'Hello'
		};

		expect(event.kind).toBe('agent:before_start');
		expect(event.runId).toBe('run-123');
		expect(event.config.id).toBe('agent-1');
	});

	it('should create valid AgentAfterEndEvent', () => {
		const stats: AgentStats = {
			iterations: 5,
			turns: 3,
			toolCalls: 10,
			inputTokens: 1000,
			outputTokens: 2000,
			totalTokens: 3000,
			durationMs: 5000
		};

		const event: AgentAfterEndEvent = {
			kind: LifecycleHooks.agent.afterEnd,
			runId: 'run-123',
			timestamp: Date.now(),
			reason: 'completed',
			stats,
			finalOutput: 'Done',
			iterations: 5,
			turns: 3
		};

		expect(event.kind).toBe('agent:after_end');
		expect(event.reason).toBe('completed');
		expect(event.stats.totalTokens).toBe(3000);
	});

	it('should create valid TurnBeforeStartEvent', () => {
		const event: TurnBeforeStartEvent = {
			kind: LifecycleHooks.turn.beforeStart,
			runId: 'run-123',
			timestamp: Date.now(),
			turnId: 'turn-1',
			input: 'User message',
			iteration: 1
		};

		expect(event.kind).toBe('turn:before_start');
		expect(event.turnId).toBe('turn-1');
	});

	it('should create valid TurnAfterEndEvent', () => {
		const event: TurnAfterEndEvent = {
			kind: LifecycleHooks.turn.afterEnd,
			runId: 'run-123',
			timestamp: Date.now(),
			turnId: 'turn-1',
			output: 'Agent response',
			toolCallCount: 2,
			durationMs: 1500,
			status: 'completed'
		};

		expect(event.kind).toBe('turn:after_end');
		expect(event.status).toBe('completed');
	});

	it('should create valid ToolBeforeExecuteEvent', () => {
		const event: ToolBeforeExecuteEvent = {
			kind: LifecycleHooks.tool.beforeExecute,
			runId: 'run-123',
			timestamp: Date.now(),
			toolName: 'test_tool',
			arguments: { param1: 'value1' }
		};

		expect(event.kind).toBe('tool:before_execute');
		expect(event.toolName).toBe('test_tool');
	});

	it('should create valid ToolAfterExecuteEvent', () => {
		const event: ToolAfterExecuteEvent = {
			kind: LifecycleHooks.tool.afterExecute,
			runId: 'run-123',
			timestamp: Date.now(),
			toolName: 'test_tool',
			arguments: { param1: 'value1' },
			result: {
				success: true,
				output: 'Result'
			},
			durationMs: 100
		};

		expect(event.kind).toBe('tool:after_execute');
		expect(event.result.success).toBe(true);
	});

	it('should create valid ToolOnErrorEvent', () => {
		const event: ToolOnErrorEvent = {
			kind: LifecycleHooks.tool.onError,
			runId: 'run-123',
			timestamp: Date.now(),
			toolName: 'test_tool',
			arguments: { param1: 'value1' },
			error: 'Tool failed',
			errorType: 'execution_error'
		};

		expect(event.kind).toBe('tool:on_error');
		expect(event.errorType).toBe('execution_error');
	});

	it('should create valid ProviderBeforeCallEvent', () => {
		const event: ProviderBeforeCallEvent = {
			kind: LifecycleHooks.provider.beforeCall,
			runId: 'run-123',
			timestamp: Date.now(),
			model: 'gpt-4',
			options: { temperature: 0.7 }
		};

		expect(event.kind).toBe('provider:before_call');
		expect(event.model).toBe('gpt-4');
	});

	it('should create valid ProviderAfterCallEvent', () => {
		const event: ProviderAfterCallEvent = {
			kind: LifecycleHooks.provider.afterCall,
			runId: 'run-123',
			timestamp: Date.now(),
			model: 'gpt-4',
			response: {
				finishReason: 'stop',
				usage: { inputTokens: 100, outputTokens: 200 }
			},
			durationMs: 500
		};

		expect(event.kind).toBe('provider:after_call');
		expect(
			(event.response.usage?.inputTokens ?? 0) + (event.response.usage?.outputTokens ?? 0)
		).toBe(300);
	});

	it('should create valid ProviderOnErrorEvent', () => {
		const event: ProviderOnErrorEvent = {
			kind: LifecycleHooks.provider.onError,
			runId: 'run-123',
			timestamp: Date.now(),
			model: 'gpt-4',
			error: 'Timeout',
			errorType: 'timeout'
		};

		expect(event.kind).toBe('provider:on_error');
		expect(event.errorType).toBe('timeout');
	});
});
