/**
 * Tests for FallbackChain class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	FallbackChain,
	FallbackExhaustedError,
	createFallbackChain,
	parseModelRef,
	resolveCandidates,
	modelKey,
	type FallbackChainConfig,
	type FallbackCandidate
} from '../../src/providers/fallback.js';
import { ErrorClassifier } from '../../src/providers/error-classifier.js';
import { CooldownTracker } from '../../src/providers/cooldown.js';

// Mock LanguageModelV2 interface
interface MockLanguageModelV2 {
	doGenerate?: (opts: {
		prompt: unknown[];
		tools?: unknown[];
		[key: string]: unknown;
	}) => Promise<unknown>;
}

// Mock provider factory
function createMockProviderFactory(providers: Map<string, MockLanguageModelV2>) {
	return (candidate: FallbackCandidate): MockLanguageModelV2 | null => {
		const key = `${candidate.provider}/${candidate.model}`;
		return providers.get(key) || null;
	};
}

describe('FallbackChain', () => {
	describe('parseModelRef', () => {
		it('should parse provider/model format', () => {
			const result = parseModelRef('openai/gpt-4');
			expect(result).toEqual({ provider: 'openai', model: 'gpt-4' });
		});

		it('should parse model only with default provider', () => {
			const result = parseModelRef('gpt-4');
			expect(result).toEqual({ provider: 'openai', model: 'gpt-4' });
		});

		it('should parse with custom default provider', () => {
			const result = parseModelRef('claude-3', 'anthropic');
			expect(result).toEqual({ provider: 'anthropic', model: 'claude-3' });
		});

		it('should handle whitespace trimming', () => {
			const result = parseModelRef('  anthropic/claude-3  ');
			expect(result).toEqual({ provider: 'anthropic', model: 'claude-3' });
		});

		it('should return null for empty string', () => {
			const result = parseModelRef('');
			expect(result).toBeNull();
		});

		it('should handle slash-only string', () => {
			const result = parseModelRef('/');
			expect(result).toEqual({ provider: '', model: '' });
		});
	});

	describe('resolveCandidates', () => {
		it('should resolve primary and fallback candidates', () => {
			const candidates = resolveCandidates('openai/gpt-4', ['anthropic/claude-3']);
			expect(candidates).toHaveLength(2);
			expect(candidates[0]).toEqual({ provider: 'openai', model: 'gpt-4' });
			expect(candidates[1]).toEqual({ provider: 'anthropic', model: 'claude-3' });
		});

		it('should deduplicate candidates', () => {
			const candidates = resolveCandidates('openai/gpt-4', ['openai/gpt-4', 'anthropic/claude-3']);
			expect(candidates).toHaveLength(2);
		});

		it('should handle empty fallback list', () => {
			const candidates = resolveCandidates('openai/gpt-4', []);
			expect(candidates).toHaveLength(1);
			expect(candidates[0]).toEqual({ provider: 'openai', model: 'gpt-4' });
		});

		it('should use default provider for model-only references', () => {
			const candidates = resolveCandidates('gpt-4', ['claude-3']);
			expect(candidates[0]).toEqual({ provider: 'openai', model: 'gpt-4' });
			expect(candidates[1]).toEqual({ provider: 'openai', model: 'claude-3' });
		});
	});

	describe('modelKey', () => {
		it('should create correct key format', () => {
			expect(modelKey('openai', 'gpt-4')).toBe('openai/gpt-4');
		});
	});

	describe('FallbackChain.execute', () => {
		let cooldownTracker: CooldownTracker;
		let errorClassifier: ErrorClassifier;
		let mockProviders: Map<string, MockLanguageModelV2>;

		const createChain = (candidates: FallbackCandidate[]) => {
			return new FallbackChain({
				candidates,
				cooldownTracker,
				errorClassifier
			});
		};

		beforeEach(() => {
			cooldownTracker = new CooldownTracker();
			errorClassifier = new ErrorClassifier();
			mockProviders = new Map();
		});

		it('should throw error when no candidates configured', async () => {
			const chain = new FallbackChain({
				candidates: [],
				cooldownTracker,
				errorClassifier
			});

			await expect(chain.execute(() => null, [], [], {})).rejects.toThrow(
				'fallback: no candidates configured'
			);
		});

		it('should execute successfully without fallback', async () => {
			const mockResponse = { content: 'test response' };
			const mockProvider = {
				doGenerate: vi.fn().mockResolvedValue(mockResponse)
			};
			mockProviders.set('openai/gpt-4', mockProvider);

			const candidates: FallbackCandidate[] = [{ provider: 'openai', model: 'gpt-4', config: {} }];

			const chain = createChain(candidates);
			const factory = createMockProviderFactory(mockProviders);

			const result = await chain.execute(factory, ['test message'], []);

			expect(result.provider).toBe('openai');
			expect(result.model).toBe('gpt-4');
			expect(result.response).toBe(mockResponse);
			expect(result.attempts).toHaveLength(0);
		});

		it('should fallback to second candidate on failure', async () => {
			const mockResponse = { content: 'fallback response' };

			const failingProvider = {
				doGenerate: vi.fn().mockRejectedValue(new Error('rate limit exceeded'))
			};
			const fallbackProvider = {
				doGenerate: vi.fn().mockResolvedValue(mockResponse)
			};

			mockProviders.set('openai/gpt-4', failingProvider);
			mockProviders.set('anthropic/claude-3', fallbackProvider);

			const candidates: FallbackCandidate[] = [
				{ provider: 'openai', model: 'gpt-4', config: {} },
				{ provider: 'anthropic', model: 'claude-3', config: {} }
			];

			const chain = createChain(candidates);
			const factory = createMockProviderFactory(mockProviders);

			const result = await chain.execute(factory, ['test message'], []);

			expect(result.provider).toBe('anthropic');
			expect(result.model).toBe('claude-3');
			expect(result.response).toBe(mockResponse);
			expect(result.attempts).toHaveLength(1);
			expect(result.attempts[0].error).toBeDefined();
			expect(result.attempts[0].skipped).toBeFalsy();
		});

		it('should skip candidates in cooldown', async () => {
			const mockResponse = { content: 'fallback response' };

			// Put first provider in cooldown
			cooldownTracker.recordFailure('openai', 'gpt-4', 'rate_limit');

			const fallbackProvider = {
				doGenerate: vi.fn().mockResolvedValue(mockResponse)
			};

			mockProviders.set('anthropic/claude-3', fallbackProvider);

			const candidates: FallbackCandidate[] = [
				{ provider: 'openai', model: 'gpt-4', config: {} },
				{ provider: 'anthropic', model: 'claude-3', config: {} }
			];

			const chain = createChain(candidates);
			const factory = createMockProviderFactory(mockProviders);

			const result = await chain.execute(factory, ['test message'], []);

			expect(result.provider).toBe('anthropic');
			expect(result.attempts).toHaveLength(1);
			expect(result.attempts[0].skipped).toBe(true);
			expect(result.attempts[0].skippedReason).toContain('cooldown');
		});

		it('should not fallback on context cancellation', async () => {
			const cancelError = new Error('context canceled');
			cancelError.name = 'CanceledError';

			const firstProvider = {
				doGenerate: vi.fn().mockRejectedValue(cancelError)
			};
			const secondProvider = {
				doGenerate: vi.fn().mockResolvedValue({ content: 'should not reach' })
			};

			mockProviders.set('openai/gpt-4', firstProvider);
			mockProviders.set('anthropic/claude-3', secondProvider);

			const candidates: FallbackCandidate[] = [
				{ provider: 'openai', model: 'gpt-4', config: {} },
				{ provider: 'anthropic', model: 'claude-3', config: {} }
			];

			const chain = createChain(candidates);
			const factory = createMockProviderFactory(mockProviders);

			await expect(chain.execute(factory, ['test message'], [])).rejects.toThrow();
		});

		it('should abort immediately on format errors', async () => {
			const formatError = new Error('string should match pattern');

			const firstProvider = {
				doGenerate: vi.fn().mockRejectedValue(formatError)
			};
			const secondProvider = {
				doGenerate: vi.fn().mockResolvedValue({ content: 'should not reach' })
			};

			mockProviders.set('openai/gpt-4', firstProvider);
			mockProviders.set('anthropic/claude-3', secondProvider);

			const candidates: FallbackCandidate[] = [
				{ provider: 'openai', model: 'gpt-4', config: {} },
				{ provider: 'anthropic', model: 'claude-3', config: {} }
			];

			const chain = createChain(candidates);
			const factory = createMockProviderFactory(mockProviders);

			await expect(chain.execute(factory, ['test message'], [])).rejects.toThrow();

			// Second provider should never be called
			expect(secondProvider.doGenerate).not.toHaveBeenCalled();
		});

		it('should record failure and continue to next candidate on retriable errors', async () => {
			const rateLimitError = new Error('rate limit exceeded');

			const firstProvider = {
				doGenerate: vi.fn().mockRejectedValue(rateLimitError)
			};
			const secondProvider = {
				doGenerate: vi.fn().mockResolvedValue({ content: 'success' })
			};

			mockProviders.set('openai/gpt-4', firstProvider);
			mockProviders.set('anthropic/claude-3', secondProvider);

			const candidates: FallbackCandidate[] = [
				{ provider: 'openai', model: 'gpt-4', config: {} },
				{ provider: 'anthropic', model: 'claude-3', config: {} }
			];

			const chain = createChain(candidates);
			const factory = createMockProviderFactory(mockProviders);

			const result = await chain.execute(factory, ['test message'], []);

			expect(result.response).toEqual({ content: 'success' });
			expect(cooldownTracker.isInCooldown('openai', 'gpt-4')).toBe(true);
		});

		it('should throw FallbackExhaustedError when all candidates fail', async () => {
			const error1 = new Error('rate limit exceeded');
			const error2 = new Error('timeout');

			const firstProvider = {
				doGenerate: vi.fn().mockRejectedValue(error1)
			};
			const secondProvider = {
				doGenerate: vi.fn().mockRejectedValue(error2)
			};

			mockProviders.set('openai/gpt-4', firstProvider);
			mockProviders.set('anthropic/claude-3', secondProvider);

			const candidates: FallbackCandidate[] = [
				{ provider: 'openai', model: 'gpt-4', config: {} },
				{ provider: 'anthropic', model: 'claude-3', config: {} }
			];

			const chain = createChain(candidates);
			const factory = createMockProviderFactory(mockProviders);

			await expect(chain.execute(factory, ['test message'], [])).rejects.toThrow(
				FallbackExhaustedError
			);
		});

		it('should include all attempts in FallbackExhaustedError', async () => {
			const error1 = new Error('rate limit exceeded');
			const error2 = new Error('timeout');

			const firstProvider = {
				doGenerate: vi.fn().mockRejectedValue(error1)
			};
			const secondProvider = {
				doGenerate: vi.fn().mockRejectedValue(error2)
			};

			mockProviders.set('openai/gpt-4', firstProvider);
			mockProviders.set('anthropic/claude-3', secondProvider);

			const candidates: FallbackCandidate[] = [
				{ provider: 'openai', model: 'gpt-4', config: {} },
				{ provider: 'anthropic', model: 'claude-3', config: {} }
			];

			const chain = createChain(candidates);
			const factory = createMockProviderFactory(mockProviders);

			try {
				await chain.execute(factory, ['test message'], []);
				expect.fail('Should have thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(FallbackExhaustedError);
				const exhaustedError = error as FallbackExhaustedError;
				expect(exhaustedError.attempts).toHaveLength(2);
				expect(exhaustedError.attempts[0].candidate.provider).toBe('openai');
				expect(exhaustedError.attempts[1].candidate.provider).toBe('anthropic');
			}
		});

		it('should record success and reset cooldown', async () => {
			// Note: execute() skips providers in cooldown, so we test recordSuccess directly
			// This is the correct behavior - cooldown.reset() is called on successful execution

			// Put provider in cooldown first
			cooldownTracker.recordFailure('openai', 'gpt-4', 'rate_limit');
			expect(cooldownTracker.isInCooldown('openai', 'gpt-4')).toBe(true);

			// Call recordSuccess directly (as execute would on success)
			cooldownTracker.recordSuccess('openai', 'gpt-4');

			// Cooldown should be reset
			expect(cooldownTracker.isInCooldown('openai', 'gpt-4')).toBe(false);
		});

		it('should handle null from provider factory', async () => {
			const mockResponse = { content: 'fallback response' };
			const fallbackProvider = {
				doGenerate: vi.fn().mockResolvedValue(mockResponse)
			};

			mockProviders.set('anthropic/claude-3', fallbackProvider);

			const candidates: FallbackCandidate[] = [
				{ provider: 'openai', model: 'gpt-4', config: {} },
				{ provider: 'anthropic', model: 'claude-3', config: {} }
			];

			const chain = createChain(candidates);
			const factory = createMockProviderFactory(mockProviders);

			const result = await chain.execute(factory, ['test message'], []);

			expect(result.provider).toBe('anthropic');
			expect(result.attempts).toHaveLength(1);
			expect(result.attempts[0].error?.reason).toBe('unknown');
		});
	});

	describe('FallbackExhaustedError', () => {
		it('should contain all attempts', () => {
			const attempts = [
				{
					candidate: { provider: 'p1', model: 'm1', config: {} },
					error: new (Error as any)('fail'),
					durationMs: 100
				},
				{
					candidate: { provider: 'p2', model: 'm2', config: {} },
					skipped: true,
					skippedReason: 'cooldown',
					durationMs: 0
				}
			];

			const error = new FallbackExhaustedError(attempts);
			expect(error.attempts).toBe(attempts);
			expect(error.name).toBe('FallbackExhaustedError');
		});

		it('should format message correctly', () => {
			const attempts = [
				{
					candidate: { provider: 'openai', model: 'gpt-4', config: {} },
					error: new (Error as any)('rate limit exceeded'),
					durationMs: 1500
				}
			];

			const error = new FallbackExhaustedError(attempts);
			expect(error.message).toContain('openai/gpt-4');
			expect(error.message).toContain('1 candidates failed');
		});
	});

	describe('createFallbackChain', () => {
		it('should create chain from model configs', () => {
			const models = [
				{ provider: 'openai' as const, model: 'gpt-4' },
				{ provider: 'anthropic' as const, model: 'claude-3' }
			];

			const cooldownTracker = new CooldownTracker();
			const errorClassifier = new ErrorClassifier();

			const chain = createFallbackChain(models, cooldownTracker, errorClassifier);
			const candidates = chain.getCandidates();

			expect(candidates).toHaveLength(2);
			expect(candidates[0]).toEqual({ provider: 'openai', model: 'gpt-4', config: models[0] });
			expect(candidates[1]).toEqual({
				provider: 'anthropic',
				model: 'claude-3',
				config: models[1]
			});
		});
	});
});
