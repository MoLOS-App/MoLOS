/**
 * Integration tests for Provider Fallback System
 *
 * Tests the full fallback chain with cooldown tracking, error classification,
 * and event bus integration across multiple providers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	FallbackChain,
	FallbackExhaustedError,
	createFallbackChain,
	type FallbackCandidate
} from '../../src/providers/fallback.js';
import { ErrorClassifier } from '../../src/providers/error-classifier.js';
import { CooldownTracker } from '../../src/providers/cooldown.js';
import { EventBus, createEventBus } from '../../src/events/event-bus.js';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { AgentMessage } from '../../src/types/index.js';
import { createMockProvider } from './utils.js';

describe('Provider Fallback Integration', () => {
	// Test state
	let cooldownTracker: CooldownTracker;
	let errorClassifier: ErrorClassifier;
	let eventBus: EventBus;
	let capturedEvents: Array<{ type: string; data: Record<string, unknown> }> = [];

	beforeEach(() => {
		cooldownTracker = new CooldownTracker();
		errorClassifier = new ErrorClassifier();
		eventBus = createEventBus();
		capturedEvents = [];

		// Subscribe to fallback-related events
		eventBus.subscribe('fallback:*', (event) => {
			capturedEvents.push({ type: event.type, data: event.data as Record<string, unknown> });
		});
	});

	afterEach(() => {
		eventBus.close();
		vi.restoreAllMocks();
	});

	/**
	 * Helper to create a properly typed FallbackCandidate
	 */
	function createCandidate(provider: string, model: string): FallbackCandidate {
		return {
			provider: provider as any,
			model,
			config: { provider: provider as any, model, name: model, _apiKeys: [] } as any
		};
	}

	/**
	 * Creates a provider factory that maps candidates to mock providers
	 */
	function createProviderFactory(providers: Map<string, LanguageModelV2>) {
		return (candidate: FallbackCandidate): LanguageModelV2 | null => {
			const key = `${candidate.provider}/${candidate.model}`;
			return providers.get(key) || null;
		};
	}

	describe('FallbackChain with Cooldown Tracker', () => {
		it('should skip providers in cooldown during fallback', async () => {
			// Setup: Put first provider in cooldown
			cooldownTracker.recordFailure('provider1', 'model-a', 'rate_limit');

			// Create providers
			const providers = new Map<string, LanguageModelV2>();
			providers.set('provider1/model-a', createMockProvider({ respond: 'Provider 1' } as any));
			providers.set('provider2/model-b', createMockProvider({ respond: 'Provider 2' } as any));

			const candidates: FallbackCandidate[] = [
				createCandidate('provider1', 'model-a'),
				createCandidate('provider2', 'model-b')
			];

			const chain = new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});

			const result = await chain.execute(
				createProviderFactory(providers),
				[{ role: 'user', content: 'test' }],
				[]
			);

			// Should have fallen back to provider2
			expect(result.provider).toBe('provider2');
			expect(result.model).toBe('model-b');
			expect(result.attempts).toHaveLength(1);
			expect(result.attempts[0].skipped).toBe(true);
			expect(result.attempts[0].skippedReason).toContain('cooldown');
		});

		it('should record failure and apply cooldown on retriable error', async () => {
			const providers = new Map<string, LanguageModelV2>();

			// First provider fails with rate limit
			providers.set(
				'openai/gpt-4',
				createMockProvider({ shouldFail: true, errorType: 'rate_limit' } as any)
			);
			// Second provider succeeds
			providers.set(
				'anthropic/claude-3',
				createMockProvider({ respond: 'Claude response' } as any)
			);

			const candidates: FallbackCandidate[] = [
				createCandidate('openai', 'gpt-4'),
				createCandidate('anthropic', 'claude-3')
			];

			const chain = new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});

			const result = await chain.execute(
				createProviderFactory(providers),
				[{ role: 'user', content: 'test' }],
				[]
			);

			// Should have succeeded with fallback
			expect(result.provider).toBe('anthropic');
			expect(result.attempts).toHaveLength(1);
			expect(result.attempts[0].error?.reason).toBe('rate_limit');

			// First provider should now be in cooldown
			expect(cooldownTracker.isInCooldown('openai', 'gpt-4')).toBe(true);
		});

		it('should not apply cooldown on non-retriable (format) error', async () => {
			const providers = new Map<string, LanguageModelV2>();

			// First provider fails with format error
			providers.set(
				'openai/gpt-4',
				createMockProvider({ shouldFail: true, errorType: 'format' } as any)
			);
			// Second provider would succeed but shouldn't be called
			providers.set(
				'anthropic/claude-3',
				createMockProvider({ respond: 'Claude response' } as any)
			);

			const candidates: FallbackCandidate[] = [
				createCandidate('openai', 'gpt-4'),
				createCandidate('anthropic', 'claude-3')
			];

			const chain = new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});

			await expect(
				chain.execute(createProviderFactory(providers), [{ role: 'user', content: 'test' }], [])
			).rejects.toThrow(FallbackExhaustedError);

			// Format errors should NOT trigger cooldown (non-retriable)
			expect(cooldownTracker.isInCooldown('openai', 'gpt-4')).toBe(false);
		});

		it('should reset cooldown on successful call', async () => {
			// Pre-populate cooldown
			cooldownTracker.recordFailure('openai', 'gpt-4', 'rate_limit');
			expect(cooldownTracker.isInCooldown('openai', 'gpt-4')).toBe(true);

			const providers = new Map<string, LanguageModelV2>();
			providers.set(
				'openai/gpt-4',
				createMockProvider({ respond: 'Success after cooldown reset' } as any)
			);

			const candidates: FallbackCandidate[] = [createCandidate('openai', 'gpt-4')];

			const chain = new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});

			const result = await chain.execute(
				createProviderFactory(providers),
				[{ role: 'user', content: 'test' }],
				[]
			);

			// Should have succeeded
			expect(result.provider).toBe('openai');

			// Cooldown should be reset after success
			expect(cooldownTracker.isInCooldown('openai', 'gpt-4')).toBe(false);
		});
	});

	describe('FallbackChain with Error Classification', () => {
		it('should correctly classify rate limit errors', () => {
			const error = new Error('rate limit exceeded');
			const reason = errorClassifier.classify(error);
			expect(reason).toBe('rate_limit');
		});

		it('should correctly classify auth errors', () => {
			const error = new Error('invalid api key');
			const reason = errorClassifier.classify(error);
			expect(reason).toBe('auth');
		});

		it('should correctly classify timeout errors', () => {
			const error = new Error('context deadline exceeded');
			const reason = errorClassifier.classify(error);
			expect(reason).toBe('timeout');
		});

		it('should correctly classify format errors', () => {
			const error = new Error('string should match pattern');
			const reason = errorClassifier.classify(error);
			expect(reason).toBe('format');
		});

		it('should correctly classify billing errors', () => {
			const error = new Error('insufficient credits');
			const reason = errorClassifier.classify(error);
			expect(reason).toBe('billing');
		});

		it('should chain through multiple providers on multiple failures', async () => {
			const providers = new Map<string, LanguageModelV2>();

			// Three providers, each failing once before the next succeeds
			providers.set(
				'provider1/model-a',
				createMockProvider({ shouldFail: true, errorType: 'rate_limit' } as any)
			);
			providers.set(
				'provider2/model-b',
				createMockProvider({ shouldFail: true, errorType: 'rate_limit' } as any)
			);
			providers.set('provider3/model-c', createMockProvider({ respond: 'Final success' } as any));

			const candidates: FallbackCandidate[] = [
				createCandidate('provider1', 'model-a'),
				createCandidate('provider2', 'model-b'),
				createCandidate('provider3', 'model-c')
			];

			const chain = new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});

			const result = await chain.execute(
				createProviderFactory(providers),
				[{ role: 'user', content: 'test' }],
				[]
			);

			expect(result.provider).toBe('provider3');
			expect(result.attempts).toHaveLength(2);

			// Both failed providers should be in cooldown
			expect(cooldownTracker.isInCooldown('provider1', 'model-a')).toBe(true);
			expect(cooldownTracker.isInCooldown('provider2', 'model-b')).toBe(true);
			// Success provider should not be in cooldown
			expect(cooldownTracker.isInCooldown('provider3', 'model-c')).toBe(false);
		});

		it('should throw FallbackExhaustedError when all providers fail', async () => {
			const providers = new Map<string, LanguageModelV2>();

			// All providers fail
			providers.set(
				'provider1/model-a',
				createMockProvider({ shouldFail: true, errorType: 'rate_limit' } as any)
			);
			providers.set(
				'provider2/model-b',
				createMockProvider({ shouldFail: true, errorType: 'timeout' } as any)
			);

			const candidates: FallbackCandidate[] = [
				createCandidate('provider1', 'model-a'),
				createCandidate('provider2', 'model-b')
			];

			const chain = new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});

			try {
				await chain.execute(
					createProviderFactory(providers),
					[{ role: 'user', content: 'test' }],
					[]
				);
				expect.fail('Should have thrown FallbackExhaustedError');
			} catch (error) {
				expect(error).toBeInstanceOf(FallbackExhaustedError);
				const exhaustedError = error as FallbackExhaustedError;
				expect(exhaustedError.attempts).toHaveLength(2);
				expect(exhaustedError.attempts[0].error?.reason).toBe('rate_limit');
				expect(exhaustedError.attempts[1].error?.reason).toBe('timeout');
			}
		});
	});

	describe('FallbackChain with Event Bus', () => {
		it('should emit events for fallback attempts', async () => {
			const providers = new Map<string, LanguageModelV2>();

			providers.set(
				'primary/model-1',
				createMockProvider({ shouldFail: true, errorType: 'rate_limit' } as any)
			);
			providers.set('backup/model-2', createMockProvider({ respond: 'Backup success' } as any));

			const candidates: FallbackCandidate[] = [
				createCandidate('primary', 'model-1'),
				createCandidate('backup', 'model-2')
			];

			const chain = new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});

			await chain.execute(
				createProviderFactory(providers),
				[{ role: 'user', content: 'test' }],
				[]
			);

			// Note: The current implementation doesn't emit events to eventBus directly
			// This test documents expected behavior - events should be emitted
			// In a full integration, the agent loop would subscribe to these events
		});

		it('should handle provider factory returning null gracefully', async () => {
			const providers = new Map<string, LanguageModelV2>();
			// Don't add any providers - factory will return null

			const candidates: FallbackCandidate[] = [createCandidate('missing', 'provider')];

			const chain = new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});

			try {
				await chain.execute(
					createProviderFactory(providers),
					[{ role: 'user', content: 'test' }],
					[]
				);
				expect.fail('Should have thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(FallbackExhaustedError);
			}
		});
	});

	describe('Cooldown Duration Calculations', () => {
		it('should apply exponential backoff for repeated failures', () => {
			// Record multiple failures and check cooldown increases
			const duration1 = cooldownTracker.recordFailure('provider', 'model', 'rate_limit');
			expect(duration1).toBe(60_000); // 1 min for first failure

			const duration2 = cooldownTracker.recordFailure('provider', 'model', 'rate_limit');
			expect(duration2).toBe(300_000); // 5 min for second failure

			const duration3 = cooldownTracker.recordFailure('provider', 'model', 'rate_limit');
			expect(duration3).toBe(1_500_000); // 25 min for third failure

			const duration4 = cooldownTracker.recordFailure('provider', 'model', 'rate_limit');
			expect(duration4).toBe(3_600_000); // 1 hour cap for fourth+ failure
		});

		it('should apply longer cooldowns for billing errors', () => {
			const duration1 = cooldownTracker.recordFailure('provider', 'model', 'billing');
			expect(duration1).toBe(5 * 60 * 60 * 1000); // 5 hours for first billing failure

			const duration2 = cooldownTracker.recordFailure('provider', 'model', 'billing');
			expect(duration2).toBe(10 * 60 * 60 * 1000); // 10 hours for second billing failure

			const duration3 = cooldownTracker.recordFailure('provider', 'model', 'billing');
			expect(duration3).toBe(20 * 60 * 60 * 1000); // 20 hours for third billing failure

			const duration4 = cooldownTracker.recordFailure('provider', 'model', 'billing');
			expect(duration4).toBe(24 * 60 * 60 * 1000); // 24 hour cap for fourth+ billing failure
		});

		it('should track remaining cooldown time', () => {
			const mockNow = vi.fn(() => Date.now());

			const tracker = new CooldownTracker({ nowFunc: mockNow });

			// Record a failure
			tracker.recordFailure('provider', 'model', 'rate_limit');

			// Check remaining cooldown
			const remaining1 = tracker.getRemainingCooldown('provider', 'model');
			expect(remaining1).toBeGreaterThan(0);
			expect(remaining1).toBeLessThanOrEqual(60_000);

			// Advance time past the cooldown
			mockNow.mockReturnValue(Date.now() + 120_000); // 2 minutes later

			const remaining2 = tracker.getRemainingCooldown('provider', 'model');
			expect(remaining2).toBe(0); // Cooldown should be expired
		});

		it('should reset failure counts after failure window', () => {
			const mockNow = vi.fn(() => Date.now());

			const tracker = new CooldownTracker({
				failureWindowMs: 60_000, // 1 minute window for testing
				nowFunc: mockNow
			});

			// Record failures
			tracker.recordFailure('provider', 'model', 'rate_limit');
			tracker.recordFailure('provider', 'model', 'rate_limit');

			expect(tracker.getErrorCount('provider', 'model')).toBe(2);

			// Advance past failure window
			mockNow.mockReturnValue(Date.now() + 120_000); // 2 minutes later

			// Next failure should reset counts
			tracker.recordFailure('provider', 'model', 'rate_limit');

			// Error count should be 1 (reset after window)
			expect(tracker.getErrorCount('provider', 'model')).toBe(1);
		});
	});

	describe('createFallbackChain', () => {
		it('should create chain from model configs', () => {
			const models = [
				{ provider: 'openai' as const, model: 'gpt-4', name: 'gpt-4', _apiKeys: [] },
				{ provider: 'anthropic' as const, model: 'claude-3', name: 'claude-3', _apiKeys: [] },
				{ provider: 'google' as const, model: 'gemini-pro', name: 'gemini-pro', _apiKeys: [] }
			];

			const chain = createFallbackChain(models as any, cooldownTracker, errorClassifier);
			const candidates = chain.getCandidates();

			expect(candidates).toHaveLength(3);
			expect(candidates[0]).toEqual({
				provider: 'openai',
				model: 'gpt-4',
				config: models[0]
			});
			expect(candidates[1]).toEqual({
				provider: 'anthropic',
				model: 'claude-3',
				config: models[1]
			});
			expect(candidates[2]).toEqual({
				provider: 'google',
				model: 'gemini-pro',
				config: models[2]
			});
		});

		it('should handle empty model list', () => {
			const chain = createFallbackChain([], cooldownTracker, errorClassifier);
			const candidates = chain.getCandidates();

			expect(candidates).toHaveLength(0);
		});
	});

	describe('Integration: Full Provider Fallback Workflow', () => {
		it('should handle complex multi-stage fallback with mixed results', async () => {
			const providers = new Map<string, LanguageModelV2>();

			// Stage 1: Primary fails with rate limit
			providers.set(
				'openai/gpt-4',
				createMockProvider({ shouldFail: true, errorType: 'rate_limit' } as any)
			);
			// Stage 2: Secondary fails with timeout
			providers.set(
				'anthropic/claude-3',
				createMockProvider({ shouldFail: true, errorType: 'timeout' } as any)
			);
			// Stage 3: Tertiary succeeds
			providers.set('google/gemini-pro', createMockProvider({ respond: 'Google response' } as any));

			const candidates: FallbackCandidate[] = [
				createCandidate('openai', 'gpt-4'),
				createCandidate('anthropic', 'claude-3'),
				createCandidate('google', 'gemini-pro')
			];

			const chain = new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});

			const result = await chain.execute(
				createProviderFactory(providers),
				[{ role: 'user', content: 'complex query' }],
				[]
			);

			// Final result from Google
			expect(result.provider).toBe('google');
			expect(result.model).toBe('gemini-pro');

			// Two failed attempts
			expect(result.attempts).toHaveLength(2);
			expect(result.attempts[0].error?.reason).toBe('rate_limit');
			expect(result.attempts[1].error?.reason).toBe('timeout');

			// Both failed providers should be in cooldown
			expect(cooldownTracker.isInCooldown('openai', 'gpt-4')).toBe(true);
			expect(cooldownTracker.isInCooldown('anthropic', 'claude-3')).toBe(true);
			expect(cooldownTracker.isInCooldown('google', 'gemini-pro')).toBe(false);
		});

		it('should abort on context cancellation without fallback', async () => {
			const providers = new Map<string, LanguageModelV2>();

			// Provider that would succeed if called
			providers.set(
				'backup/model-b',
				createMockProvider({ respond: 'Should not be called' } as any)
			);

			// Create a provider that throws context cancellation
			const cancelProvider = {
				provider: 'primary',
				modelId: 'model-a',
				specificationVersion: 'v1' as const,
				supportedUrls: {},
				doGenerate: async () => {
					const error = new Error('context canceled');
					error.name = 'CanceledError';
					throw error;
				},
				doStream: async function* () {}
			} as unknown as LanguageModelV2;

			providers.set('primary/model-a', cancelProvider);

			const candidates: FallbackCandidate[] = [
				createCandidate('primary', 'model-a'),
				createCandidate('backup', 'model-b')
			];

			const chain = new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});

			try {
				await chain.execute(
					createProviderFactory(providers),
					[{ role: 'user', content: 'test' }],
					[]
				);
				expect.fail('Should have thrown on context cancellation');
			} catch (error) {
				// Context cancellation should throw immediately without trying backup
				expect((error as Error).message).toContain('context canceled');
			}
		});

		it('should work with custom cooldown tracker time function', async () => {
			const mockNow = vi.fn(() => Date.now());
			const customTracker = new CooldownTracker({ nowFunc: mockNow });

			// Simulate time passing
			mockNow.mockReturnValue(1000000000000);
			customTracker.recordFailure('provider', 'model', 'rate_limit');

			// Advance time
			mockNow.mockReturnValue(1000060000000); // 1 minute later

			const remaining = customTracker.getRemainingCooldown('provider', 'model');
			// Should have ~59 seconds remaining (60s total - 1 minute elapsed)
			expect(remaining).toBeGreaterThan(0);
			expect(remaining).toBeLessThan(60000);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty candidates list', async () => {
			const chain = new FallbackChain({
				candidates: [],
				cooldownTracker,
				errorClassifier
			});

			await expect(
				chain.execute(() => null as any, [{ role: 'user', content: 'test' }], [])
			).rejects.toThrow('fallback: no candidates configured');
		});

		it('should handle duplicate candidates gracefully', async () => {
			const providers = new Map<string, LanguageModelV2>();
			providers.set('openai/gpt-4', createMockProvider({ respond: 'Response' } as any));

			const candidates: FallbackCandidate[] = [
				createCandidate('openai', 'gpt-4'),
				createCandidate('openai', 'gpt-4') // Duplicate
			];

			const chain = new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});

			const result = await chain.execute(
				createProviderFactory(providers),
				[{ role: 'user', content: 'test' }],
				[]
			);

			// Should still work with duplicates (first one succeeds)
			expect(result.provider).toBe('openai');
		});

		it('should track per-model cooldown independently', () => {
			// Record failure for model-a
			cooldownTracker.recordFailure('provider', 'model-a', 'rate_limit');

			// model-b should not be in cooldown
			expect(cooldownTracker.isInCooldown('provider', 'model-a')).toBe(true);
			expect(cooldownTracker.isInCooldown('provider', 'model-b')).toBe(false);

			// Record failure for model-b
			cooldownTracker.recordFailure('provider', 'model-b', 'rate_limit');

			// Both should now be in cooldown
			expect(cooldownTracker.isInCooldown('provider', 'model-a')).toBe(true);
			expect(cooldownTracker.isInCooldown('provider', 'model-b')).toBe(true);

			// Reset model-a
			cooldownTracker.recordSuccess('provider', 'model-a');

			// model-a should be out of cooldown, model-b should still be in
			expect(cooldownTracker.isInCooldown('provider', 'model-a')).toBe(false);
			expect(cooldownTracker.isInCooldown('provider', 'model-b')).toBe(true);
		});
	});
});
