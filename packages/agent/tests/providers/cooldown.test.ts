/**
 * Tests for CooldownTracker class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	CooldownTracker,
	getStandardCooldown,
	getBillingCooldown,
	isRetriableReason,
	formatCooldownDuration,
	type FailoverReason
} from '../../src/providers/cooldown.js';

describe('CooldownTracker', () => {
	describe('getStandardCooldown', () => {
		it('should return 1 minute for 1 error', () => {
			expect(getStandardCooldown(1)).toBe(60_000);
		});

		it('should return 5 minutes for 2 errors', () => {
			expect(getStandardCooldown(2)).toBe(5 * 60_000);
		});

		it('should return 25 minutes for 3 errors', () => {
			expect(getStandardCooldown(3)).toBe(25 * 60_000);
		});

		it('should return 1 hour cap for 4+ errors', () => {
			expect(getStandardCooldown(4)).toBe(60 * 60_000);
			expect(getStandardCooldown(5)).toBe(60 * 60_000);
			expect(getStandardCooldown(10)).toBe(60 * 60_000);
		});

		it('should handle edge case of 0 errors', () => {
			expect(getStandardCooldown(0)).toBe(60_000);
		});

		it('should handle negative errors', () => {
			expect(getStandardCooldown(-1)).toBe(60_000);
		});
	});

	describe('getBillingCooldown', () => {
		it('should return 5 hours for 1 error', () => {
			expect(getBillingCooldown(1)).toBe(5 * 60 * 60_000);
		});

		it('should return 10 hours for 2 errors', () => {
			expect(getBillingCooldown(2)).toBe(10 * 60 * 60_000);
		});

		it('should return 20 hours for 3 errors', () => {
			expect(getBillingCooldown(3)).toBe(20 * 60 * 60_000);
		});

		it('should return 24 hour cap for 4+ errors', () => {
			expect(getBillingCooldown(4)).toBe(24 * 60 * 60_000);
			expect(getBillingCooldown(5)).toBe(24 * 60 * 60_000);
			expect(getBillingCooldown(11)).toBe(24 * 60 * 60_000);
		});

		it('should handle edge case of 0 errors', () => {
			expect(getBillingCooldown(0)).toBe(5 * 60 * 60_000);
		});
	});

	describe('isRetriableReason', () => {
		it('should return false for format errors', () => {
			expect(isRetriableReason('format')).toBe(false);
		});

		it('should return true for auth errors', () => {
			expect(isRetriableReason('auth')).toBe(true);
		});

		it('should return true for rate_limit errors', () => {
			expect(isRetriableReason('rate_limit')).toBe(true);
		});

		it('should return true for billing errors', () => {
			expect(isRetriableReason('billing')).toBe(true);
		});

		it('should return true for timeout errors', () => {
			expect(isRetriableReason('timeout')).toBe(true);
		});

		it('should return true for overloaded errors', () => {
			expect(isRetriableReason('overloaded')).toBe(true);
		});

		it('should return true for unknown errors', () => {
			expect(isRetriableReason('unknown')).toBe(true);
		});
	});

	describe('formatCooldownDuration', () => {
		it('should format 0ms as 0s', () => {
			expect(formatCooldownDuration(0)).toBe('0s');
		});

		it('should format seconds correctly', () => {
			expect(formatCooldownDuration(5000)).toBe('5s');
			expect(formatCooldownDuration(30000)).toBe('30s');
		});

		it('should format minutes correctly', () => {
			expect(formatCooldownDuration(60000)).toBe('1m');
			expect(formatCooldownDuration(90000)).toBe('1m 30s');
			expect(formatCooldownDuration(300000)).toBe('5m');
		});

		it('should format hours correctly', () => {
			expect(formatCooldownDuration(3600000)).toBe('1h');
			expect(formatCooldownDuration(5400000)).toBe('1h 30m');
			expect(formatCooldownDuration(7200000)).toBe('2h');
		});
	});

	describe('CooldownTracker instance', () => {
		let tracker: CooldownTracker;
		let mockNow: number;

		const createTracker = (nowFunc?: () => number) => {
			return new CooldownTracker({
				failureWindowMs: 24 * 60 * 60 * 1000,
				nowFunc: nowFunc ?? (() => mockNow)
			});
		};

		beforeEach(() => {
			mockNow = 1000000000000; // Fixed timestamp for testing
			tracker = createTracker();
		});

		describe('recordFailure', () => {
			it('should record failure and increase error count', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');

				expect(tracker.getErrorCount('openai', 'gpt-4')).toBe(1);
				expect(tracker.getFailureCount('openai', 'gpt-4', 'rate_limit')).toBe(1);
			});

			it('should record multiple failures with different reasons', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				tracker.recordFailure('openai', 'gpt-4', 'timeout');
				tracker.recordFailure('openai', 'gpt-4', 'auth');

				expect(tracker.getErrorCount('openai', 'gpt-4')).toBe(3);
				expect(tracker.getFailureCount('openai', 'gpt-4', 'rate_limit')).toBe(1);
				expect(tracker.getFailureCount('openai', 'gpt-4', 'timeout')).toBe(1);
				expect(tracker.getFailureCount('openai', 'gpt-4', 'auth')).toBe(1);
			});

			it('should return cooldown duration for new cooldowns', () => {
				const cooldown = tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				expect(cooldown).toBe(60_000); // 1 minute for first error
			});

			it('should not return cooldown if already in longer cooldown', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				// First cooldown is 1 minute

				mockNow += 30_000; // Advance 30 seconds

				// Second failure should give 5 minutes, but we're still within 1 minute
				// so it won't extend
				const cooldown = tracker.recordFailure('openai', 'gpt-4', 'timeout');
				// Since 5 minutes > 1 minute, it will extend
				expect(cooldown).toBe(5 * 60_000);
			});

			it('should handle billing errors with longer cooldowns', () => {
				const cooldown = tracker.recordFailure('openai', 'gpt-4', 'billing');
				expect(cooldown).toBe(5 * 60 * 60_000); // 5 hours for first billing error
			});
		});

		describe('recordSuccess', () => {
			it('should reset cooldown when recording success', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				expect(tracker.isInCooldown('openai', 'gpt-4')).toBe(true);

				tracker.recordSuccess('openai', 'gpt-4');

				expect(tracker.isInCooldown('openai', 'gpt-4')).toBe(false);
				expect(tracker.getErrorCount('openai', 'gpt-4')).toBe(0);
			});

			it('should not affect other providers', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				tracker.recordFailure('anthropic', 'claude-3', 'timeout');

				tracker.recordSuccess('openai', 'gpt-4');

				expect(tracker.isInCooldown('openai', 'gpt-4')).toBe(false);
				expect(tracker.isInCooldown('anthropic', 'claude-3')).toBe(true);
			});

			it('should handle success on non-existent entry', () => {
				// Should not throw
				tracker.recordSuccess('unknown', 'model');
			});
		});

		describe('isInCooldown', () => {
			it('should return false when not in cooldown', () => {
				expect(tracker.isInCooldown('openai', 'gpt-4')).toBe(false);
			});

			it('should return true when in cooldown', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				expect(tracker.isInCooldown('openai', 'gpt-4')).toBe(true);
			});

			it('should respect 24h failure window reset', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				expect(tracker.getErrorCount('openai', 'gpt-4')).toBe(1);

				// Advance time beyond the failure window (24 hours)
				mockNow += 24 * 60 * 60 * 1000 + 1;

				tracker.recordFailure('openai', 'gpt-4', 'timeout');

				// Error count should reset, so this is now the first error
				expect(tracker.getErrorCount('openai', 'gpt-4')).toBe(1);
			});
		});

		describe('getRemainingCooldown', () => {
			it('should return 0 when not in cooldown', () => {
				expect(tracker.getRemainingCooldown('openai', 'gpt-4')).toBe(0);
			});

			it('should return correct remaining time', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				// First error = 1 minute cooldown

				mockNow += 30_000; // Advance 30 seconds

				const remaining = tracker.getRemainingCooldown('openai', 'gpt-4');
				expect(remaining).toBe(30_000); // 30 seconds remaining
			});

			it('should return 0 after cooldown expires', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				// First error = 1 minute cooldown

				mockNow += 60_000; // Advance 1 minute

				expect(tracker.getRemainingCooldown('openai', 'gpt-4')).toBe(0);
			});
		});

		describe('shouldSkip', () => {
			it('should return false when not in cooldown', () => {
				expect(tracker.shouldSkip('openai', 'gpt-4')).toBe(false);
			});

			it('should return true when in cooldown', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				expect(tracker.shouldSkip('openai', 'gpt-4')).toBe(true);
			});
		});

		describe('clear', () => {
			it('should clear all entries', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				tracker.recordFailure('anthropic', 'claude-3', 'timeout');

				tracker.clear();

				expect(tracker.isInCooldown('openai', 'gpt-4')).toBe(false);
				expect(tracker.isInCooldown('anthropic', 'claude-3')).toBe(false);
			});
		});

		describe('getAllEntries', () => {
			it('should return deep copy of entries', () => {
				tracker.recordFailure('openai', 'gpt-4', 'rate_limit');

				const entries = tracker.getAllEntries();
				const key = 'openai/gpt-4';

				// Modify the returned entry
				entries.get(key)!.errorCount = 999;

				// Original should be unchanged
				expect(tracker.getErrorCount('openai', 'gpt-4')).toBe(1);
			});
		});

		describe('exponential backoff progression', () => {
			it('should apply correct backoff for consecutive errors', () => {
				// Error 1: 1 minute
				const c1 = tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				expect(c1).toBe(60_000);

				// Error 2: 5 minutes
				mockNow += 60_000;
				const c2 = tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				expect(c2).toBe(5 * 60_000);

				// Error 3: 25 minutes
				mockNow += 5 * 60_000;
				const c3 = tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				expect(c3).toBe(25 * 60_000);

				// Error 4: 1 hour (capped)
				mockNow += 25 * 60_000;
				const c4 = tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				expect(c4).toBe(60 * 60_000);

				// Error 5+: still 1 hour
				mockNow += 60 * 60_000;
				const c5 = tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
				expect(c5).toBe(60 * 60_000);
			});

			it('should apply correct billing backoff progression', () => {
				// Billing error 1: 5 hours
				const c1 = tracker.recordFailure('openai', 'gpt-4', 'billing');
				expect(c1).toBe(5 * 60 * 60_000);

				// Billing error 2: 10 hours
				mockNow += 5 * 60 * 60_000;
				const c2 = tracker.recordFailure('openai', 'gpt-4', 'billing');
				expect(c2).toBe(10 * 60 * 60_000);

				// Billing error 3: 20 hours
				mockNow += 10 * 60 * 60_000;
				const c3 = tracker.recordFailure('openai', 'gpt-4', 'billing');
				expect(c3).toBe(20 * 60 * 60_000);

				// Billing error 4+: 24 hours (capped)
				mockNow += 20 * 60 * 60_000;
				const c4 = tracker.recordFailure('openai', 'gpt-4', 'billing');
				expect(c4).toBe(24 * 60 * 60_000);
			});
		});
	});
});
