/**
 * Tool Policy Tests
 *
 * Tests for the tool policy system including:
 * - PolicyResult and ToolPolicy interface
 * - ToolPolicyPipeline chaining
 * - DenyListPolicy
 * - AllowListPolicy
 * - RateLimitPolicy
 * - SessionOwnerPolicy
 * - ToolPolicyRegistry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	type PolicyResult,
	type ToolExecutionContext,
	type ToolPolicy,
	ToolPolicyPipeline,
	DenyListPolicy,
	AllowListPolicy,
	RateLimitPolicy,
	SessionOwnerPolicy,
	ToolPolicyRegistry,
	globalPolicyRegistry,
	createDenyListPolicy,
	createAllowListPolicy,
	createRateLimitPolicy
} from '../../src/tools/policy.js';

// ============================================================================
// Test Utilities
// ============================================================================

function expectAllowed(result: PolicyResult): void {
	expect(result.allowed).toBe(true);
	expect(result.code).toBeUndefined();
}

function expectDenied(result: PolicyResult, code: 'DENIED' | 'NOT_FOUND' | 'RATE_LIMITED'): void {
	expect(result.allowed).toBe(false);
	expect(result.code).toBe(code);
	expect(result.reason).toBeDefined();
}

const defaultContext: ToolExecutionContext = {
	sessionKey: 'test-session',
	userId: 'user-123',
	channel: 'test-channel',
	chatId: 'chat-456'
};

// ============================================================================
// PolicyResult Tests
// ============================================================================

describe('PolicyResult', () => {
	it('should allow with minimal result', () => {
		const result: PolicyResult = { allowed: true };
		expect(result.allowed).toBe(true);
	});

	it('should deny with reason and code', () => {
		const result: PolicyResult = {
			allowed: false,
			reason: 'Test deny reason',
			code: 'DENIED'
		};
		expect(result.allowed).toBe(false);
		expect(result.reason).toBe('Test deny reason');
		expect(result.code).toBe('DENIED');
	});
});

// ============================================================================
// ToolPolicyPipeline Tests
// ============================================================================

describe('ToolPolicyPipeline', () => {
	describe('empty pipeline', () => {
		it('should allow all tools when pipeline is empty', () => {
			const pipeline = new ToolPolicyPipeline();
			const result = pipeline.canExecute('any_tool', {}, defaultContext);
			expectAllowed(result);
		});
	});

	describe('single policy', () => {
		it('should pass through policy result when allowed', () => {
			const pipeline = new ToolPolicyPipeline([
				{
					canExecute: () => ({ allowed: true })
				}
			]);
			const result = pipeline.canExecute('test', {}, defaultContext);
			expectAllowed(result);
		});

		it('should return denial when policy denies', () => {
			const pipeline = new ToolPolicyPipeline([
				{
					canExecute: () => ({
						allowed: false,
						reason: 'Denied by test policy',
						code: 'DENIED'
					})
				}
			]);
			const result = pipeline.canExecute('test', {}, defaultContext);
			expectDenied(result, 'DENIED');
			expect(result.reason).toBe('Denied by test policy');
		});
	});

	describe('multiple policies', () => {
		it('should allow when all policies pass', () => {
			const pipeline = new ToolPolicyPipeline([
				{ canExecute: () => ({ allowed: true }) },
				{ canExecute: () => ({ allowed: true }) },
				{ canExecute: () => ({ allowed: true }) }
			]);
			const result = pipeline.canExecute('test', {}, defaultContext);
			expectAllowed(result);
		});

		it('should deny on first policy that denies', () => {
			const pipeline = new ToolPolicyPipeline([
				{ canExecute: () => ({ allowed: true }) },
				{
					canExecute: () => ({
						allowed: false,
						reason: 'Second policy denies',
						code: 'DENIED'
					})
				},
				{ canExecute: () => ({ allowed: true }) } // Should not be reached
			]);
			const result = pipeline.canExecute('test', {}, defaultContext);
			expectDenied(result, 'DENIED');
			expect(result.reason).toBe('Second policy denies');
		});
	});

	describe('pipeline management', () => {
		it('should add policy via addPolicy()', () => {
			const pipeline = new ToolPolicyPipeline();
			pipeline.addPolicy({ canExecute: () => ({ allowed: true }) });
			expect(pipeline.size).toBe(1);
		});

		it('should prepend policy via prependPolicy()', () => {
			const policy1 = { canExecute: () => ({ allowed: true }) };
			const policy2 = { canExecute: () => ({ allowed: true }) };
			const pipeline = new ToolPolicyPipeline([policy1]);
			pipeline.prependPolicy(policy2);
			expect(pipeline.size).toBe(2);
		});

		it('should remove policy via removePolicy()', () => {
			const policy = { canExecute: () => ({ allowed: true }) };
			const pipeline = new ToolPolicyPipeline([policy]);
			expect(pipeline.size).toBe(1);
			const removed = pipeline.removePolicy(policy);
			expect(removed).toBe(true);
			expect(pipeline.size).toBe(0);
		});

		it('should clear all policies via clear()', () => {
			const pipeline = new ToolPolicyPipeline([
				{ canExecute: () => ({ allowed: true }) },
				{ canExecute: () => ({ allowed: true }) }
			]);
			expect(pipeline.size).toBe(2);
			pipeline.clear();
			expect(pipeline.size).toBe(0);
		});
	});
});

// ============================================================================
// DenyListPolicy Tests
// ============================================================================

describe('DenyListPolicy', () => {
	describe('constructor', () => {
		it('should create with empty set by default', () => {
			const policy = new DenyListPolicy();
			expect(policy.isDenied('any_tool')).toBe(false);
		});

		it('should create with initial tools', () => {
			const policy = new DenyListPolicy(new Set(['tool_a', 'tool_b']));
			expect(policy.isDenied('tool_a')).toBe(true);
			expect(policy.isDenied('tool_b')).toBe(true);
			expect(policy.isDenied('tool_c')).toBe(false);
		});
	});

	describe('deny() and allow()', () => {
		it('should add tool to deny list via deny()', () => {
			const policy = new DenyListPolicy();
			policy.deny('bad_tool');
			expect(policy.isDenied('bad_tool')).toBe(true);
		});

		it('should remove tool from deny list via allow()', () => {
			const policy = new DenyListPolicy(new Set(['bad_tool']));
			policy.allow('bad_tool');
			expect(policy.isDenied('bad_tool')).toBe(false);
		});
	});

	describe('canExecute()', () => {
		it('should allow tools not on deny list', () => {
			const policy = new DenyListPolicy(new Set(['blocked']));
			const result = policy.canExecute('allowed_tool', {}, defaultContext);
			expectAllowed(result);
		});

		it('should deny tools on deny list', () => {
			const policy = new DenyListPolicy(new Set(['blocked']));
			const result = policy.canExecute('blocked', {}, defaultContext);
			expectDenied(result, 'DENIED');
			expect(result.reason).toContain('blocked');
		});

		it('should ignore arguments when checking', () => {
			const policy = new DenyListPolicy(new Set(['blocked']));
			const result = policy.canExecute('blocked', { dangerous: true }, defaultContext);
			expectDenied(result, 'DENIED');
		});
	});

	describe('clear()', () => {
		it('should clear all denied tools', () => {
			const policy = new DenyListPolicy(new Set(['a', 'b', 'c']));
			policy.clear();
			expect(policy.isDenied('a')).toBe(false);
			expect(policy.isDenied('b')).toBe(false);
			expect(policy.isDenied('c')).toBe(false);
		});
	});
});

// ============================================================================
// AllowListPolicy Tests
// ============================================================================

describe('AllowListPolicy', () => {
	describe('constructor', () => {
		it('should create with empty set (allow all) by default', () => {
			const policy = new AllowListPolicy();
			const result = policy.canExecute('any_tool', {}, defaultContext);
			expectAllowed(result);
		});

		it('should create with initial tools', () => {
			const policy = new AllowListPolicy(new Set(['tool_a', 'tool_b']));
			expect(policy.isAllowed('tool_a')).toBe(true);
			expect(policy.isAllowed('tool_b')).toBe(true);
			expect(policy.isAllowed('tool_c')).toBe(false);
		});
	});

	describe('allow() and deny()', () => {
		it('should add tool to allow list via allow()', () => {
			const policy = new AllowListPolicy();
			policy.allow('allowed_tool');
			expect(policy.isAllowed('allowed_tool')).toBe(true);
		});

		it('should remove tool from allow list via deny()', () => {
			const policy = new AllowListPolicy(new Set(['tool']));
			policy.deny('tool');
			expect(policy.isAllowed('tool')).toBe(false);
		});
	});

	describe('canExecute()', () => {
		it('should allow all tools when allow list is empty', () => {
			const policy = new AllowListPolicy();
			const result = policy.canExecute('any_tool', {}, defaultContext);
			expectAllowed(result);
		});

		it('should allow tools on allow list', () => {
			const policy = new AllowListPolicy(new Set(['allowed']));
			const result = policy.canExecute('allowed', {}, defaultContext);
			expectAllowed(result);
		});

		it('should deny tools not on allow list', () => {
			const policy = new AllowListPolicy(new Set(['only_this']));
			const result = policy.canExecute('not_allowed', {}, defaultContext);
			expectDenied(result, 'DENIED');
			expect(result.reason).toContain('not_allowed');
		});
	});

	describe('clear()', () => {
		it('should clear allow list (allow all)', () => {
			const policy = new AllowListPolicy(new Set(['a', 'b']));
			policy.clear();
			// After clearing, allow list is empty which means "allow all"
			const result = policy.canExecute('any_tool', {}, defaultContext);
			expectAllowed(result);
		});
	});
});

// ============================================================================
// RateLimitPolicy Tests
// ============================================================================

describe('RateLimitPolicy', () => {
	describe('constructor', () => {
		it('should use default values', () => {
			const policy = new RateLimitPolicy();
			expect(policy['maxPerMinute']).toBe(60);
			expect(policy['windowMs']).toBe(60_000);
		});

		it('should accept custom values', () => {
			const policy = new RateLimitPolicy(10, 30_000);
			expect(policy['maxPerMinute']).toBe(10);
			expect(policy['windowMs']).toBe(30_000);
		});
	});

	describe('canExecute()', () => {
		it('should allow first call', () => {
			const policy = new RateLimitPolicy(2, 60_000);
			const result = policy.canExecute('tool', {}, defaultContext);
			expectAllowed(result);
		});

		it('should allow calls within limit', () => {
			const policy = new RateLimitPolicy(3, 60_000);
			policy.canExecute('tool', {}, defaultContext);
			policy.canExecute('tool', {}, defaultContext);
			const result = policy.canExecute('tool', {}, defaultContext);
			expectAllowed(result);
		});

		it('should deny calls over limit', () => {
			const policy = new RateLimitPolicy(2, 60_000);
			policy.canExecute('tool', {}, defaultContext);
			policy.canExecute('tool', {}, defaultContext);
			const result = policy.canExecute('tool', {}, defaultContext);
			expectDenied(result, 'RATE_LIMITED');
			expect(result.reason).toContain('Rate limit exceeded');
		});

		it('should track per-tool limits independently', () => {
			const policy = new RateLimitPolicy(1, 60_000);
			policy.canExecute('tool_a', {}, defaultContext);
			const result = policy.canExecute('tool_b', {}, defaultContext);
			expectAllowed(result);
		});

		it('should reset window after time expires', async () => {
			const policy = new RateLimitPolicy(1, 50); // 50ms window
			policy.canExecute('tool', {}, defaultContext);
			const result = policy.canExecute('tool', {}, defaultContext);
			expectDenied(result, 'RATE_LIMITED');

			// Wait for window to expire
			await new Promise((resolve) => setTimeout(resolve, 60));

			const result2 = policy.canExecute('tool', {}, defaultContext);
			expectAllowed(result2);
		});
	});

	describe('getCount()', () => {
		it('should return current count without incrementing', () => {
			const policy = new RateLimitPolicy(5, 60_000);
			policy.canExecute('tool', {}, defaultContext);
			policy.canExecute('tool', {}, defaultContext);
			expect(policy.getCount('tool')).toBe(2);
		});

		it('should return 0 for expired window', async () => {
			const policy = new RateLimitPolicy(5, 50);
			policy.canExecute('tool', {}, defaultContext);
			await new Promise((resolve) => setTimeout(resolve, 60));
			expect(policy.getCount('tool')).toBe(0);
		});
	});

	describe('isRateLimited()', () => {
		it('should return true when at limit', () => {
			const policy = new RateLimitPolicy(1, 60_000);
			policy.canExecute('tool', {}, defaultContext);
			expect(policy.isRateLimited('tool')).toBe(true);
		});

		it('should return false when under limit', () => {
			const policy = new RateLimitPolicy(5, 60_000);
			policy.canExecute('tool', {}, defaultContext);
			expect(policy.isRateLimited('tool')).toBe(false);
		});
	});

	describe('reset() and resetAll()', () => {
		it('should reset single tool via reset()', () => {
			const policy = new RateLimitPolicy(1, 60_000);
			policy.canExecute('tool_a', {}, defaultContext);
			policy.canExecute('tool_b', {}, defaultContext);
			policy.reset('tool_a');
			expect(policy.getCount('tool_a')).toBe(0);
			expect(policy.getCount('tool_b')).toBe(1);
		});

		it('should reset all tools via resetAll()', () => {
			const policy = new RateLimitPolicy(1, 60_000);
			policy.canExecute('tool_a', {}, defaultContext);
			policy.canExecute('tool_b', {}, defaultContext);
			policy.resetAll();
			expect(policy.getCount('tool_a')).toBe(0);
			expect(policy.getCount('tool_b')).toBe(0);
		});
	});
});

// ============================================================================
// SessionOwnerPolicy Tests
// ============================================================================

describe('SessionOwnerPolicy', () => {
	describe('constructor', () => {
		it('should default sudo as privileged', () => {
			const policy = new SessionOwnerPolicy();
			const elevatedContext = { ...defaultContext, elevated: true };
			const result = policy.canExecute('sudo', {}, elevatedContext);
			expectAllowed(result);
		});

		it('should accept custom privileged tools', () => {
			const policy = new SessionOwnerPolicy(new Set(['admin_tool']));
			const elevatedContext = { ...defaultContext, elevated: true };
			const result = policy.canExecute('admin_tool', {}, elevatedContext);
			expectAllowed(result);
		});
	});

	describe('canExecute()', () => {
		it('should allow non-privileged tools for any session', () => {
			const policy = new SessionOwnerPolicy();
			const result = policy.canExecute('regular_tool', {}, defaultContext);
			expectAllowed(result);
		});

		it('should allow privileged tools for elevated sessions', () => {
			const policy = new SessionOwnerPolicy();
			const elevatedContext = { ...defaultContext, elevated: true };
			const result = policy.canExecute('sudo', {}, elevatedContext);
			expectAllowed(result);
		});

		it('should deny privileged tools for non-elevated sessions', () => {
			const policy = new SessionOwnerPolicy();
			const result = policy.canExecute('sudo', {}, defaultContext);
			expectDenied(result, 'DENIED');
			expect(result.reason).toContain('elevated');
		});

		it('should block additional tools for non-elevated sessions', () => {
			const policy = new SessionOwnerPolicy(new Set(), new Set(['dangerous']));
			const result = policy.canExecute('dangerous', {}, defaultContext);
			expectDenied(result, 'DENIED');
		});

		it('should allow blocked tools for elevated sessions', () => {
			const policy = new SessionOwnerPolicy(new Set(), new Set(['dangerous']));
			const elevatedContext = { ...defaultContext, elevated: true };
			const result = policy.canExecute('dangerous', {}, elevatedContext);
			expectAllowed(result);
		});
	});

	describe('addPrivilegedTool() and removePrivilegedTool()', () => {
		it('should add privileged tool', () => {
			const policy = new SessionOwnerPolicy();
			policy.addPrivilegedTool('new_admin');
			const elevatedContext = { ...defaultContext, elevated: true };
			const result = policy.canExecute('new_admin', {}, elevatedContext);
			expectAllowed(result);
		});

		it('should remove privileged tool', () => {
			const policy = new SessionOwnerPolicy(new Set(['sudo']));
			policy.removePrivilegedTool('sudo');
			const elevatedContext = { ...defaultContext, elevated: true };
			const result = policy.canExecute('sudo', {}, elevatedContext);
			expectAllowed(result); // No longer privileged
			const nonElevatedResult = policy.canExecute('sudo', {}, defaultContext);
			expectAllowed(nonElevatedResult); // No longer privileged so allowed
		});
	});

	describe('blockForNonElevated()', () => {
		it('should block tool for non-elevated sessions', () => {
			const policy = new SessionOwnerPolicy();
			policy.blockForNonElevated('block_this');
			const result = policy.canExecute('block_this', {}, defaultContext);
			expectDenied(result, 'DENIED');
		});
	});
});

// ============================================================================
// ToolPolicyRegistry Tests
// ============================================================================

describe('ToolPolicyRegistry', () => {
	let registry: ToolPolicyRegistry;

	beforeEach(() => {
		registry = new ToolPolicyRegistry();
	});

	afterEach(() => {
		registry.clearAllSessions();
		registry.clearGlobalPolicies();
	});

	describe('global policies', () => {
		it('should add and remove global policies', () => {
			const policy = { canExecute: () => ({ allowed: true }) };
			registry.addGlobalPolicy(policy);
			expect(registry.getGlobalPolicies()).toContain(policy);

			const removed = registry.removeGlobalPolicy(policy);
			expect(removed).toBe(true);
			expect(registry.getGlobalPolicies()).not.toContain(policy);
		});

		it('should clear all global policies', () => {
			registry.addGlobalPolicy({ canExecute: () => ({ allowed: true }) });
			registry.addGlobalPolicy({ canExecute: () => ({ allowed: true }) });
			registry.clearGlobalPolicies();
			expect(registry.getGlobalPolicies().length).toBe(0);
		});

		it('should apply global policies to all sessions', () => {
			registry.addGlobalPolicy({
				canExecute: () => ({ allowed: false, reason: 'Global deny', code: 'DENIED' as const })
			});

			const sessionPipeline = registry.getSessionPipeline('session-1');
			const result = sessionPipeline.canExecute('any_tool', {}, defaultContext);
			expectDenied(result, 'DENIED');
		});
	});

	describe('session pipelines', () => {
		it('should create pipeline on first access', () => {
			expect(registry.hasSessionPipeline('new-session')).toBe(false);
			const pipeline = registry.getSessionPipeline('new-session');
			expect(registry.hasSessionPipeline('new-session')).toBe(true);
			expect(pipeline.size).toBe(0);
		});

		it('should reuse same pipeline for same session', () => {
			const pipeline1 = registry.getSessionPipeline('session-1');
			const pipeline2 = registry.getSessionPipeline('session-1');
			expect(pipeline1).toBe(pipeline2);
		});

		it('should clear session pipeline', () => {
			registry.getSessionPipeline('session-1');
			registry.clearSession('session-1');
			expect(registry.hasSessionPipeline('session-1')).toBe(false);
		});

		it('should clear all session pipelines', () => {
			registry.getSessionPipeline('session-1');
			registry.getSessionPipeline('session-2');
			registry.clearAllSessions();
			expect(registry.sessionCount).toBe(0);
		});

		it('should include global policies in session pipeline', () => {
			registry.addGlobalPolicy({ canExecute: () => ({ allowed: true }) });
			const pipeline = registry.getSessionPipeline('session-1');
			expect(pipeline.size).toBe(1);
		});
	});

	describe('check()', () => {
		it('should check global policies only when no session', () => {
			registry.addGlobalPolicy({
				canExecute: () => ({ allowed: false, reason: 'Global', code: 'DENIED' as const })
			});
			const result = registry.check('tool', {}, defaultContext);
			expectDenied(result, 'DENIED');
		});

		it('should use session pipeline when session provided', () => {
			registry.addGlobalPolicy({
				canExecute: () => ({ allowed: true })
			});
			const sessionPipeline = registry.getSessionPipeline('session-1');
			sessionPipeline.addPolicy({
				canExecute: () => ({ allowed: false, reason: 'Session', code: 'DENIED' as const })
			});

			// Without session - global only
			const globalResult = registry.check('tool', {}, defaultContext);
			expectAllowed(globalResult);

			// With session - session policy overrides
			const sessionResult = registry.check('tool', {}, defaultContext, 'session-1');
			expectDenied(sessionResult, 'DENIED');
		});
	});

	describe('checkGlobal()', () => {
		it('should only check global policies', () => {
			registry.addGlobalPolicy({
				canExecute: () => ({ allowed: false, reason: 'Global', code: 'DENIED' as const })
			});
			registry.getSessionPipeline('session-1');

			const result = registry.checkGlobal('tool', {}, defaultContext);
			expectDenied(result, 'DENIED');
		});
	});
});

// ============================================================================
// Global Registry Tests
// ============================================================================

describe('globalPolicyRegistry', () => {
	afterEach(() => {
		globalPolicyRegistry.clearAllSessions();
		globalPolicyRegistry.clearGlobalPolicies();
	});

	it('should be instance of ToolPolicyRegistry', () => {
		expect(globalPolicyRegistry).toBeInstanceOf(ToolPolicyRegistry);
	});

	it('should maintain state between tests', () => {
		globalPolicyRegistry.addGlobalPolicy({
			canExecute: () => ({ allowed: true })
		});
		expect(globalPolicyRegistry.getGlobalPolicies().length).toBe(1);

		globalPolicyRegistry.clearGlobalPolicies();
		expect(globalPolicyRegistry.getGlobalPolicies().length).toBe(0);
	});
});

// ============================================================================
// Convenience Functions Tests
// ============================================================================

describe('convenience functions', () => {
	describe('createDenyListPolicy()', () => {
		it('should create deny list policy with tools', () => {
			const policy = createDenyListPolicy('a', 'b', 'c');
			expect(policy.isDenied('a')).toBe(true);
			expect(policy.isDenied('b')).toBe(true);
			expect(policy.isDenied('c')).toBe(true);
		});

		it('should create empty deny list', () => {
			const policy = createDenyListPolicy();
			expect(policy.isDenied('anything')).toBe(false);
		});
	});

	describe('createAllowListPolicy()', () => {
		it('should create allow list policy with tools', () => {
			const policy = createAllowListPolicy('a', 'b', 'c');
			expect(policy.isAllowed('a')).toBe(true);
			expect(policy.isAllowed('b')).toBe(true);
			expect(policy.isAllowed('c')).toBe(true);
			expect(policy.isAllowed('d')).toBe(false);
		});

		it('should create empty allow list (allow all)', () => {
			const policy = createAllowListPolicy();
			const result = policy.canExecute('anything', {}, defaultContext);
			expectAllowed(result);
		});
	});

	describe('createRateLimitPolicy()', () => {
		it('should create rate limit policy with custom max', () => {
			const policy = createRateLimitPolicy(10);
			expect(policy.isRateLimited('tool')).toBe(false);
			for (let i = 0; i < 10; i++) {
				policy.canExecute('tool', {}, defaultContext);
			}
			expect(policy.isRateLimited('tool')).toBe(true);
		});

		it('should create rate limit policy with custom window', async () => {
			const policy = createRateLimitPolicy(1, 50);
			policy.canExecute('tool', {}, defaultContext);
			expect(policy.isRateLimited('tool')).toBe(true);
			await new Promise((resolve) => setTimeout(resolve, 60));
			expect(policy.isRateLimited('tool')).toBe(false);
		});
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('policy integration', () => {
	it('should chain deny list then allow list', () => {
		const pipeline = new ToolPolicyPipeline([
			new DenyListPolicy(new Set(['blocked'])),
			new AllowListPolicy(new Set(['allowed']))
		]);

		// Deny list blocks first
		const blockedResult = pipeline.canExecute('blocked', {}, defaultContext);
		expectDenied(blockedResult, 'DENIED');

		// Allow list allows
		const allowedResult = pipeline.canExecute('allowed', {}, defaultContext);
		expectAllowed(allowedResult);

		// With restrictions active (hasRestrictions=true), empty allow list denies others
		const otherResult = pipeline.canExecute('other', {}, defaultContext);
		expectDenied(otherResult, 'DENIED');
	});

	it('should chain allow list then deny list', () => {
		const pipeline = new ToolPolicyPipeline([
			new AllowListPolicy(new Set(['allowed'])),
			new DenyListPolicy(new Set(['blocked']))
		]);

		// Allow list blocks first (not on allow list)
		const notOnAllowResult = pipeline.canExecute('other', {}, defaultContext);
		expectDenied(notOnAllowResult, 'DENIED');

		// Blocked by deny list
		const blockedResult = pipeline.canExecute('blocked', {}, defaultContext);
		expectDenied(blockedResult, 'DENIED');

		// Only allowed tool passes
		const allowedResult = pipeline.canExecute('allowed', {}, defaultContext);
		expectAllowed(allowedResult);
	});

	it('should combine rate limit with deny list', () => {
		const rateLimit = new RateLimitPolicy(2, 60_000);
		const denyList = new DenyListPolicy(new Set(['abusive']));

		const pipeline = new ToolPolicyPipeline([denyList, rateLimit]);

		// Deny list blocks first
		const abusiveResult = pipeline.canExecute('abusive', {}, defaultContext);
		expectDenied(abusiveResult, 'DENIED');

		// Rate limit applies to other tools
		pipeline.canExecute('tool', {}, defaultContext);
		pipeline.canExecute('tool', {}, defaultContext);
		const rateLimitedResult = pipeline.canExecute('tool', {}, defaultContext);
		expectDenied(rateLimitedResult, 'RATE_LIMITED');
	});

	it('should enforce session ownership after rate limiting', () => {
		const rateLimit = new RateLimitPolicy(10, 60_000);
		const sessionOwner = new SessionOwnerPolicy();

		const pipeline = new ToolPolicyPipeline([rateLimit, sessionOwner]);

		// Non-elevated session can use regular tools
		const regularResult = pipeline.canExecute('regular', {}, defaultContext);
		expectAllowed(regularResult);

		// Non-elevated session cannot use sudo
		const sudoResult = pipeline.canExecute('sudo', {}, defaultContext);
		expectDenied(sudoResult, 'DENIED');

		// Elevated session can use sudo
		const elevatedContext = { ...defaultContext, elevated: true };
		const elevatedSudoResult = pipeline.canExecute('sudo', {}, elevatedContext);
		expectAllowed(elevatedSudoResult);
	});
});
