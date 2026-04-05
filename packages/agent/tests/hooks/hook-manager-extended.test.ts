/**
 * Tests for HookManager Extended Features (LLM Interceptors & Tool Approvers)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	HookManager,
	createHookManager,
	type LLMInterceptor,
	type ToolApprover,
	type HookContext,
	type LLMHookRequest,
	type ToolApprovalRequest
} from '../../src/hooks/hook-manager.js';

describe('HookManager Extended Features', () => {
	let hookManager: HookManager;

	const createTestContext = (): HookContext => ({
		runId: 'test-run',
		timestamp: Date.now(),
		sessionKey: 'test-session',
		userId: 'test-user'
	});

	beforeEach(() => {
		hookManager = createHookManager({
			defaultTimeoutMs: 5000,
			interceptorTimeoutMs: 5000,
			approvalTimeoutMs: 5000
		});
	});

	afterEach(() => {
		hookManager.close();
	});

	describe('mount (LLM Interceptors)', () => {
		it('should call LLM interceptor before LLM', async () => {
			let called = false;
			const interceptor: LLMInterceptor = {
				BeforeLLM: async (req) => {
					called = true;
					return { decision: { action: 'continue' } };
				}
			};

			hookManager.mount({ name: 'test', hook: interceptor });

			const req: LLMHookRequest = { model: 'test-model', messages: [] };
			const result = await hookManager.beforeLLM(req, createTestContext());

			expect(called).toBe(true);
			expect(result.req.model).toBe('test-model');
			expect(result.decision.action).toBe('continue');
		});

		it('should allow modification of request in BeforeLLM', async () => {
			const interceptor: LLMInterceptor = {
				BeforeLLM: async (req) => {
					return {
						modified: { ...req, model: 'modified-model' },
						decision: { action: 'modify' }
					};
				}
			};

			hookManager.mount({ name: 'test', hook: interceptor });

			const req: LLMHookRequest = { model: 'original-model', messages: [] };
			const result = await hookManager.beforeLLM(req, createTestContext());

			expect(result.req.model).toBe('modified-model');
			expect(result.decision.action).toBe('modify');
		});

		it('should call AfterLLM after LLM response', async () => {
			let called = false;
			const interceptor: LLMInterceptor = {
				AfterLLM: async (resp) => {
					called = true;
					return { modified: resp, decision: { action: 'continue' } };
				}
			};

			hookManager.mount({ name: 'test', hook: interceptor });

			const resp = {
				model: 'test-model',
				response: {
					model: 'test-model',
					message: { role: 'assistant' as const, content: 'Hi' },
					usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
					finishReason: 'stop' as const
				}
			};

			await hookManager.afterLLM(resp, createTestContext());

			expect(called).toBe(true);
		});

		it('should allow modification of response in AfterLLM', async () => {
			const interceptor: LLMInterceptor = {
				AfterLLM: async (resp) => {
					return {
						modified: { ...resp, model: 'modified-model' },
						decision: { action: 'modify' }
					};
				}
			};

			hookManager.mount({ name: 'test', hook: interceptor });

			const resp = {
				model: 'original-model',
				response: {
					model: 'original-model',
					message: { role: 'assistant' as const, content: 'Hi' },
					usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
					finishReason: 'stop' as const
				}
			};

			const result = await hookManager.afterLLM(resp, createTestContext());

			expect(result.resp.model).toBe('modified-model');
			expect(result.decision.action).toBe('modify');
		});

		it('should run interceptors in priority order', async () => {
			const callOrder: string[] = [];

			const lowPriority: LLMInterceptor = {
				BeforeLLM: async (req) => {
					callOrder.push('low');
					return { modified: req, decision: { action: 'continue' } };
				}
			};

			const highPriority: LLMInterceptor = {
				BeforeLLM: async (req) => {
					callOrder.push('high');
					return { modified: req, decision: { action: 'continue' } };
				}
			};

			hookManager.mount({ name: 'low', hook: lowPriority, priority: 10 });
			hookManager.mount({ name: 'high', hook: highPriority, priority: 100 });

			const req: LLMHookRequest = { model: 'test', messages: [] };
			await hookManager.beforeLLM(req, createTestContext());

			expect(callOrder[0]).toBe('high');
			expect(callOrder[1]).toBe('low');
		});

		it('should return unsubscribe function from mount', () => {
			const interceptor: LLMInterceptor = {
				BeforeLLM: async (req) => {
					return { modified: req, decision: { action: 'continue' } };
				}
			};

			const unsubscribe = hookManager.mount({ name: 'test', hook: interceptor });
			expect(typeof unsubscribe).toBe('function');

			unsubscribe();
		});

		it('should handle hard_abort to stop processing immediately', async () => {
			let secondCalled = false;

			const abortInterceptor: LLMInterceptor = {
				BeforeLLM: async (req) => {
					return { modified: req, decision: { action: 'hard_abort', reason: 'Emergency stop' } };
				}
			};

			const continueInterceptor: LLMInterceptor = {
				BeforeLLM: async (req) => {
					secondCalled = true;
					return { modified: req, decision: { action: 'continue' } };
				}
			};

			hookManager.mount({ name: 'abort', hook: abortInterceptor, priority: 100 });
			hookManager.mount({ name: 'continue', hook: continueInterceptor, priority: 50 });

			const req: LLMHookRequest = { model: 'test', messages: [] };
			const result = await hookManager.beforeLLM(req, createTestContext());

			expect(secondCalled).toBe(false);
			expect(result.decision.action).toBe('hard_abort');
			expect(result.decision.reason).toBe('Emergency stop');
		});
	});

	describe('approveTool', () => {
		it('should call tool approver when mounted', async () => {
			let called = false;
			const approver: ToolApprover = {
				ApproveTool: async () => {
					called = true;
					return { approved: true };
				}
			};

			hookManager.mount({ name: 'test', hook: approver });

			const req: ToolApprovalRequest = { tool: 'test_tool', arguments: {} };
			const result = await hookManager.approveTool(req, createTestContext());

			expect(called).toBe(true);
			expect(result.approved).toBe(true);
		});

		it('should deny tool when approver rejects', async () => {
			const approver: ToolApprover = {
				ApproveTool: async () => {
					return { approved: false, reason: 'Denied by approver' };
				}
			};

			hookManager.mount({ name: 'deny-all', hook: approver });

			const req: ToolApprovalRequest = { tool: 'dangerous_tool', arguments: {} };
			const result = await hookManager.approveTool(req, createTestContext());

			expect(result.approved).toBe(false);
			expect(result.reason).toBe('Denied by approver');
		});

		it('should return approved if no denials', async () => {
			const approver: ToolApprover = {
				ApproveTool: async () => {
					return { approved: true };
				}
			};

			hookManager.mount({ name: 'approver', hook: approver });

			const req: ToolApprovalRequest = { tool: 'safe_tool', arguments: {} };
			const result = await hookManager.approveTool(req, createTestContext());

			expect(result.approved).toBe(true);
		});

		it('should run approvers in priority order and return on first denial', async () => {
			const callOrder: string[] = [];

			const lowPriority: ToolApprover = {
				ApproveTool: async () => {
					callOrder.push('low');
					return { approved: false, reason: 'Low priority denied' };
				}
			};

			const highPriority: ToolApprover = {
				ApproveTool: async () => {
					callOrder.push('high');
					return { approved: false, reason: 'High priority denied' };
				}
			};

			hookManager.mount({ name: 'low', hook: lowPriority, priority: 10 });
			hookManager.mount({ name: 'high', hook: highPriority, priority: 100 });

			const req: ToolApprovalRequest = { tool: 'test', arguments: {} };
			const result = await hookManager.approveTool(req, createTestContext());

			// High priority denies first, so only it is called (early return on denial)
			expect(callOrder[0]).toBe('high');
			expect(callOrder[1]).toBeUndefined();
			expect(result.approved).toBe(false);
			expect(result.reason).toBe('High priority denied');
		});

		it('should return first denial reason', async () => {
			const approver1: ToolApprover = {
				ApproveTool: async () => {
					return { approved: true };
				}
			};

			const approver2: ToolApprover = {
				ApproveTool: async () => {
					return { approved: false, reason: 'Denied by second approver' };
				}
			};

			hookManager.mount({ name: 'first', hook: approver1, priority: 100 });
			hookManager.mount({ name: 'second', hook: approver2, priority: 50 });

			const req: ToolApprovalRequest = { tool: 'test', arguments: {} };
			const result = await hookManager.approveTool(req, createTestContext());

			// First approver approves, so it continues to second which denies
			expect(result.approved).toBe(false);
			expect(result.reason).toBe('Denied by second approver');
		});

		it('should default reason to approver name when not provided', async () => {
			const approver: ToolApprover = {
				ApproveTool: async () => {
					return { approved: false };
				}
			};

			hookManager.mount({ name: 'unnamed-approver', hook: approver });

			const req: ToolApprovalRequest = { tool: 'test', arguments: {} };
			const result = await hookManager.approveTool(req, createTestContext());

			expect(result.approved).toBe(false);
			expect(result.reason).toBe("Denied by approver 'unnamed-approver'");
		});
	});

	describe('combined LLM and tool hooks', () => {
		it('should handle both BeforeLLM and ApproveTool', async () => {
			let llmCalled = false;
			let toolCalled = false;

			const interceptor: LLMInterceptor = {
				BeforeLLM: async (req) => {
					llmCalled = true;
					return { modified: req, decision: { action: 'continue' } };
				}
			};

			const approver: ToolApprover = {
				ApproveTool: async () => {
					toolCalled = true;
					return { approved: true };
				}
			};

			hookManager.mount({ name: 'llm-hook', hook: interceptor });
			hookManager.mount({ name: 'tool-hook', hook: approver });

			const req: LLMHookRequest = { model: 'test', messages: [] };
			await hookManager.beforeLLM(req, createTestContext());
			await hookManager.approveTool({ tool: 'test', arguments: {} }, createTestContext());

			expect(llmCalled).toBe(true);
			expect(toolCalled).toBe(true);
		});
	});

	describe('error handling in extended hooks', () => {
		it('should continue on BeforeLLM error when continueOnError is true', async () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const failingInterceptor: LLMInterceptor = {
				BeforeLLM: async () => {
					throw new Error('LLM interceptor failed');
				}
			};

			const succeedingInterceptor: LLMInterceptor = {
				BeforeLLM: async () => {
					return { decision: { action: 'continue' } };
				}
			};

			hookManager.mount({ name: 'failing', hook: failingInterceptor });
			hookManager.mount({ name: 'succeeding', hook: succeedingInterceptor });

			const req: LLMHookRequest = { model: 'test', messages: [] };
			const result = await hookManager.beforeLLM(req, createTestContext());

			// Should still return a result (default continue) despite timeout
			expect(result.decision.action).toBe('continue');
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('should continue on ApproveTool error when continueOnError is true', async () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const failingApprover: ToolApprover = {
				ApproveTool: async () => {
					throw new Error('Approver failed');
				}
			};

			const succeedingApprover: ToolApprover = {
				ApproveTool: async () => {
					return { approved: true };
				}
			};

			hookManager.mount({ name: 'failing', hook: failingApprover });
			hookManager.mount({ name: 'succeeding', hook: succeedingApprover });

			const req: ToolApprovalRequest = { tool: 'test', arguments: {} };
			const result = await hookManager.approveTool(req, createTestContext());

			expect(result.approved).toBe(true);
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('should handle timeout in BeforeLLM', async () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const slowInterceptor: LLMInterceptor = {
				BeforeLLM: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					return { decision: { action: 'continue' } };
				}
			};

			// Create manager with very short timeout
			const shortTimeoutManager = createHookManager({
				interceptorTimeoutMs: 10
			});

			shortTimeoutManager.mount({ name: 'slow', hook: slowInterceptor });

			const req: LLMHookRequest = { model: 'test', messages: [] };
			const result = await shortTimeoutManager.beforeLLM(req, createTestContext());

			// Should still return a result (default continue) despite timeout
			expect(result.decision.action).toBe('continue');
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
			shortTimeoutManager.close();
		});
	});

	describe('close', () => {
		it('should clear all extended hooks on close', async () => {
			const interceptor: LLMInterceptor = {
				BeforeLLM: async (req) => {
					return { modified: req, decision: { action: 'continue' } };
				}
			};

			hookManager.mount({ name: 'test', hook: interceptor });
			hookManager.close();

			// After close, beforeLLM should still work but not call the interceptor
			const req: LLMHookRequest = { model: 'test', messages: [] };
			const result = await hookManager.beforeLLM(req, createTestContext());

			// Should use default values
			expect(result.req.model).toBe('test');
			expect(result.decision.action).toBe('continue');
		});
	});
});
