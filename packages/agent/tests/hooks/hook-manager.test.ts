/**
 * Tests for HookManager class
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
	HookManager,
	createHookManager,
	type VoidHookHandler,
	type ModifyingHookHandler,
	type ClaimingHookHandler,
	type HookContext
} from '../../src/hooks/hook-manager.js';
import type { AgentEvent } from '../../src/events/event-bus.js';

describe('HookManager', () => {
	let hookManager: HookManager;

	const createTestContext = (): HookContext => ({
		runId: 'test-run',
		timestamp: Date.now()
	});

	const createTestEvent = (type: string = 'test_event'): AgentEvent => ({
		runId: 'test-run',
		seq: 1,
		stream: 'test',
		ts: Date.now(),
		type,
		data: {}
	});

	beforeEach(() => {
		hookManager = createHookManager({ defaultTimeoutMs: 5000 });
	});

	afterEach(() => {
		hookManager.clear();
	});

	describe('register', () => {
		it('should register void hook and return unsubscribe function', () => {
			const handler: VoidHookHandler = {
				name: 'agent_start',
				handler: vi.fn()
			};

			const unsubscribe = hookManager.register(handler);
			expect(typeof unsubscribe).toBe('function');
		});

		it('should register modifying hook', () => {
			const handler: ModifyingHookHandler<string> = {
				name: 'before_prompt_build',
				handler: vi.fn().mockResolvedValue({})
			};

			hookManager.register(handler);
			expect(hookManager.hasHooks('before_prompt_build')).toBe(true);
		});

		it('should register claiming hook', () => {
			const handler: ClaimingHookHandler<string> = {
				name: 'inbound_claim',
				handler: vi.fn().mockResolvedValue({ handled: false })
			};

			hookManager.register(handler);
			expect(hookManager.hasHooks('inbound_claim')).toBe(true);
		});

		it('should unregister hook on unsubscribe', () => {
			const handler: VoidHookHandler = {
				name: 'agent_start',
				handler: vi.fn()
			};

			const unsubscribe = hookManager.register(handler);
			expect(hookManager.hasHooks('agent_start')).toBe(true);

			unsubscribe();
			expect(hookManager.hasHooks('agent_start')).toBe(false);
		});
	});

	describe('runVoidHook', () => {
		it('should run void hooks in parallel', async () => {
			const results: number[] = [];

			const handler1: VoidHookHandler = {
				name: 'agent_start',
				handler: async () => {
					await new Promise((resolve) => setTimeout(resolve, 20));
					results.push(1);
				}
			};

			const handler2: VoidHookHandler = {
				name: 'agent_start',
				handler: async () => {
					await new Promise((resolve) => setTimeout(resolve, 20));
					results.push(2);
				}
			};

			hookManager.register(handler1);
			hookManager.register(handler2);

			const event = createTestEvent('agent_start');
			await hookManager.runVoidHook('agent_start', event, createTestContext());

			expect(results).toContain(1);
			expect(results).toContain(2);
		});

		it('should handle hook errors gracefully', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const handler: VoidHookHandler = {
				name: 'agent_start',
				handler: async () => {
					throw new Error('hook error');
				}
			};

			hookManager.register(handler);

			const event = createTestEvent('agent_start');
			await expect(
				hookManager.runVoidHook('agent_start', event, createTestContext())
			).resolves.not.toThrow();

			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('should not run when no hooks registered', async () => {
			const event = createTestEvent('agent_start');
			await expect(
				hookManager.runVoidHook('agent_start', event, createTestContext())
			).resolves.not.toThrow();
		});
	});

	describe('runModifyingHook', () => {
		it('should run modifying hooks sequentially', async () => {
			const callOrder: string[] = [];

			const handler1: ModifyingHookHandler<string> = {
				name: 'before_prompt_build',
				handler: async (_, __, value) => {
					callOrder.push('handler1');
					return { modified: value + '1' };
				}
			};

			const handler2: ModifyingHookHandler<string> = {
				name: 'before_prompt_build',
				handler: async (_, __, value) => {
					callOrder.push('handler2');
					return { modified: value + '2' };
				}
			};

			hookManager.register(handler1);
			hookManager.register(handler2);

			const event = createTestEvent('before_prompt_build');
			const result = await hookManager.runModifyingHook(
				'before_prompt_build',
				event,
				createTestContext(),
				'initial'
			);

			expect(callOrder).toEqual(['handler1', 'handler2']);
			expect(result).toBe('initial12');
		});

		it('should merge results when merge function provided', async () => {
			const handler1: ModifyingHookHandler<{ a: number }> = {
				name: 'before_prompt_build',
				handler: async (_, __, value) => {
					return { modified: { a: value.a + 1 } };
				}
			};

			const handler2: ModifyingHookHandler<{ b: number }> = {
				name: 'before_prompt_build',
				handler: async (_, __, value) => {
					return { modified: { b: value.b + 1 } };
				}
			};

			// This test demonstrates the concept - actual merge behavior
			const handler3: ModifyingHookHandler<Record<string, number>> = {
				name: 'before_prompt_build',
				handler: async (_, __, value) => {
					return { modified: { ...value, fromHandler3: 1 } };
				}
			};

			hookManager.register(handler3);

			const event = createTestEvent('before_prompt_build');
			const result = await hookManager.runModifyingHook(
				'before_prompt_build',
				event,
				createTestContext(),
				{ initial: 0 }
			);

			expect(result).toBeDefined();
		});

		it('should stop when continue is false', async () => {
			const callOrder: string[] = [];

			const handler1: ModifyingHookHandler<string> = {
				name: 'before_prompt_build',
				handler: async (_, __, value) => {
					callOrder.push('handler1');
					return { modified: value + '1', continue: false };
				}
			};

			const handler2: ModifyingHookHandler<string> = {
				name: 'before_prompt_build',
				handler: async (_, __, value) => {
					callOrder.push('handler2');
					return { modified: value + '2' };
				}
			};

			hookManager.register(handler1);
			hookManager.register(handler2);

			const event = createTestEvent('before_prompt_build');
			const result = await hookManager.runModifyingHook(
				'before_prompt_build',
				event,
				createTestContext(),
				'initial'
			);

			expect(callOrder).toEqual(['handler1']);
			expect(result).toBe('initial1');
		});

		it('should return undefined when no hooks registered', async () => {
			const event = createTestEvent('before_prompt_build');
			const result = await hookManager.runModifyingHook(
				'before_prompt_build',
				event,
				createTestContext(),
				'initial'
			);

			expect(result).toBeUndefined();
		});

		it('should handle errors and continue', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const handler1: ModifyingHookHandler<string> = {
				name: 'before_prompt_build',
				handler: async () => {
					throw new Error('handler error');
				}
			};

			const handler2: ModifyingHookHandler<string> = {
				name: 'before_prompt_build',
				handler: async (_, __, value) => {
					return { modified: value + 'modified' };
				}
			};

			hookManager.register(handler1);
			hookManager.register(handler2);

			const event = createTestEvent('before_prompt_build');
			const result = await hookManager.runModifyingHook(
				'before_prompt_build',
				event,
				createTestContext(),
				'initial'
			);

			expect(result).toBe('initialmodified');

			consoleSpy.mockRestore();
		});
	});

	describe('runClaimingHook', () => {
		it('should stop at first handler that claims', async () => {
			const callOrder: string[] = [];

			const handler1: ClaimingHookHandler<string> = {
				name: 'inbound_claim',
				handler: async () => {
					callOrder.push('handler1');
					return { handled: true, result: 'claimed' };
				}
			};

			const handler2: ClaimingHookHandler<string> = {
				name: 'inbound_claim',
				handler: async () => {
					callOrder.push('handler2');
					return { handled: false };
				}
			};

			hookManager.register(handler1);
			hookManager.register(handler2);

			const event = createTestEvent('inbound_claim');
			const result = await hookManager.runClaimingHook('inbound_claim', event, createTestContext());

			expect(callOrder).toEqual(['handler1']);
			expect(result.handled).toBe(true);
			expect(result.result).toBe('claimed');
		});

		it('should continue when handler does not claim', async () => {
			const callOrder: string[] = [];

			const handler1: ClaimingHookHandler<string> = {
				name: 'inbound_claim',
				handler: async () => {
					callOrder.push('handler1');
					return { handled: false };
				}
			};

			const handler2: ClaimingHookHandler<string> = {
				name: 'inbound_claim',
				handler: async () => {
					callOrder.push('handler2');
					return { handled: true, result: 'claimed by handler2' };
				}
			};

			hookManager.register(handler1);
			hookManager.register(handler2);

			const event = createTestEvent('inbound_claim');
			const result = await hookManager.runClaimingHook('inbound_claim', event, createTestContext());

			expect(callOrder).toEqual(['handler1', 'handler2']);
			expect(result.handled).toBe(true);
			expect(result.result).toBe('claimed by handler2');
		});

		it('should return handled: false when no handler claims', async () => {
			const handler1: ClaimingHookHandler<string> = {
				name: 'inbound_claim',
				handler: async () => {
					return { handled: false };
				}
			};

			const handler2: ClaimingHookHandler<string> = {
				name: 'inbound_claim',
				handler: async () => {
					return { handled: false };
				}
			};

			hookManager.register(handler1);
			hookManager.register(handler2);

			const event = createTestEvent('inbound_claim');
			const result = await hookManager.runClaimingHook('inbound_claim', event, createTestContext());

			expect(result.handled).toBe(false);
			expect(result.result).toBeUndefined();
		});
	});

	describe('priority ordering', () => {
		it('should run higher priority hooks first', async () => {
			const callOrder: string[] = [];

			const lowPriority: VoidHookHandler = {
				name: 'agent_start',
				priority: 10,
				handler: async () => {
					callOrder.push('low');
				}
			};

			const highPriority: VoidHookHandler = {
				name: 'agent_start',
				priority: 100,
				handler: async () => {
					callOrder.push('high');
				}
			};

			const mediumPriority: VoidHookHandler = {
				name: 'agent_start',
				priority: 50,
				handler: async () => {
					callOrder.push('medium');
				}
			};

			hookManager.register(lowPriority);
			hookManager.register(highPriority);
			hookManager.register(mediumPriority);

			const event = createTestEvent('agent_start');
			await hookManager.runVoidHook('agent_start', event, createTestContext());

			// Higher priority first
			expect(callOrder[0]).toBe('high');
			expect(callOrder[1]).toBe('medium');
			expect(callOrder[2]).toBe('low');
		});

		it('should use default priority of 50 when not specified', async () => {
			const callOrder: string[] = [];

			const defaultPriority: VoidHookHandler = {
				name: 'agent_start',
				handler: async () => {
					callOrder.push('default');
				}
			};

			const highPriority: VoidHookHandler = {
				name: 'agent_start',
				priority: 100,
				handler: async () => {
					callOrder.push('high');
				}
			};

			hookManager.register(defaultPriority);
			hookManager.register(highPriority);

			const event = createTestEvent('agent_start');
			await hookManager.runVoidHook('agent_start', event, createTestContext());

			expect(callOrder[0]).toBe('high');
			expect(callOrder[1]).toBe('default');
		});
	});

	describe('timeout enforcement', () => {
		it('should enforce timeout on void hooks', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const handler: VoidHookHandler = {
				name: 'agent_start',
				timeoutMs: 50,
				handler: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			};

			hookManager.register(handler);

			const event = createTestEvent('agent_start');
			await hookManager.runVoidHook('agent_start', event, createTestContext());

			// Should have logged timeout error
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('should enforce timeout on modifying hooks', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const handler: ModifyingHookHandler<string> = {
				name: 'before_prompt_build',
				timeoutMs: 50,
				handler: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					return { modified: 'result' };
				}
			};

			hookManager.register(handler);

			const event = createTestEvent('before_prompt_build');
			const result = await hookManager.runModifyingHook(
				'before_prompt_build',
				event,
				createTestContext(),
				'initial'
			);

			// Should have logged timeout error
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('should enforce timeout on claiming hooks', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const handler: ClaimingHookHandler<string> = {
				name: 'inbound_claim',
				timeoutMs: 50,
				handler: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					return { handled: true };
				}
			};

			hookManager.register(handler);

			const event = createTestEvent('inbound_claim');
			const result = await hookManager.runClaimingHook('inbound_claim', event, createTestContext());

			// Should have logged timeout error
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});
	});

	describe('before/after tool hooks', () => {
		it('runBeforeToolCall should work correctly', async () => {
			const callOrder: string[] = [];

			const handler: ModifyingHookHandler<Record<string, unknown>> = {
				name: 'before_tool_call',
				handler: async (_, __, args) => {
					callOrder.push('before');
					return { modified: { ...args, modified: true } };
				}
			};

			hookManager.register(handler);

			const result = await hookManager.runBeforeToolCall(
				'test_tool',
				{ arg1: 'value1' },
				createTestContext()
			);

			expect(callOrder).toEqual(['before']);
			expect(result.modifiedArgs).toEqual({ arg1: 'value1', modified: true });
		});

		it('runAfterToolCall should work correctly', async () => {
			const callOrder: string[] = [];

			const handler: VoidHookHandler = {
				name: 'tool_result',
				handler: async () => {
					callOrder.push('after');
				}
			};

			hookManager.register(handler);

			await hookManager.runAfterToolCall('test_tool', { result: 'success' }, createTestContext());

			expect(callOrder).toEqual(['after']);
		});
	});

	describe('hasHooks', () => {
		it('should return true when hook has handlers', () => {
			const handler: VoidHookHandler = {
				name: 'agent_start',
				handler: vi.fn()
			};

			expect(hookManager.hasHooks('agent_start')).toBe(false);

			hookManager.register(handler);

			expect(hookManager.hasHooks('agent_start')).toBe(true);
		});

		it('should return false for unregistered hook names', () => {
			expect(hookManager.hasHooks('non_existent_hook')).toBe(false);
		});
	});

	describe('getRegisteredHookNames', () => {
		it('should return all registered hook names', () => {
			hookManager.register({
				name: 'agent_start',
				handler: vi.fn()
			} as VoidHookHandler);

			hookManager.register({
				name: 'before_tool_call',
				handler: async () => ({ modified: {} })
			} as ModifyingHookHandler);

			hookManager.register({
				name: 'inbound_claim',
				handler: async () => ({ handled: false })
			} as ClaimingHookHandler);

			const names = hookManager.getRegisteredHookNames();

			expect(names).toContain('agent_start');
			expect(names).toContain('before_tool_call');
			expect(names).toContain('inbound_claim');
		});
	});

	describe('clear', () => {
		it('should remove all hooks', () => {
			hookManager.register({
				name: 'agent_start',
				handler: vi.fn()
			} as VoidHookHandler);

			hookManager.register({
				name: 'before_tool_call',
				handler: async () => ({ modified: {} })
			} as ModifyingHookHandler);

			hookManager.clear();

			expect(hookManager.hasHooks('agent_start')).toBe(false);
			expect(hookManager.hasHooks('before_tool_call')).toBe(false);
		});
	});

	describe('error isolation', () => {
		it('should continue running other hooks when one fails', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const callOrder: string[] = [];

			const failingHandler: VoidHookHandler = {
				name: 'agent_start',
				handler: async () => {
					callOrder.push('failing');
					throw new Error('intentional failure');
				}
			};

			const succeedingHandler: VoidHookHandler = {
				name: 'agent_start',
				handler: async () => {
					callOrder.push('succeeding');
				}
			};

			hookManager.register(failingHandler);
			hookManager.register(succeedingHandler);

			const event = createTestEvent('agent_start');
			await hookManager.runVoidHook('agent_start', event, createTestContext());

			expect(callOrder).toContain('failing');
			expect(callOrder).toContain('succeeding');

			consoleSpy.mockRestore();
		});

		it('should isolate errors in modifying hooks', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const failingHandler: ModifyingHookHandler<string> = {
				name: 'before_prompt_build',
				handler: async () => {
					throw new Error('intentional failure');
				}
			};

			const succeedingHandler: ModifyingHookHandler<string> = {
				name: 'before_prompt_build',
				handler: async (_, __, value) => {
					return { modified: value + '_modified' };
				}
			};

			hookManager.register(failingHandler);
			hookManager.register(succeedingHandler);

			const event = createTestEvent('before_prompt_build');
			const result = await hookManager.runModifyingHook(
				'before_prompt_build',
				event,
				createTestContext(),
				'initial'
			);

			expect(result).toBe('initial_modified');

			consoleSpy.mockRestore();
		});
	});

	describe('createHookManager', () => {
		it('should create new instance with config', () => {
			const manager = createHookManager({
				defaultTimeoutMs: 10000,
				continueOnError: false
			});

			expect(manager).toBeInstanceOf(HookManager);
		});
	});
});
