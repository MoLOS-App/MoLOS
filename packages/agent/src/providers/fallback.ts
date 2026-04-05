/**
 * Fallback Chain - Progressive Failover Orchestration
 *
 * ## Purpose
 * Orchestrates intelligent fallback across multiple AI provider/model candidates
 * when errors occur. Implements a progressive degradation strategy that tries
 * increasingly simple approaches before giving up.
 *
 * ## Progressive Fallback Strategy
 *
 * ```
 * Request → Try Candidate 1
 *              │
 *              ├─[Success]──► Return response (record success, reset cooldown)
 *              │
 *              └─[Error]──► Classify error
 *                               │
 *                               ├─[Format Error]──► ABORT (non-retriable)
 *                               │
 *                               ├─[Context Cancel]──► ABORT (user aborted)
 *                               │
 *                               ├─[Retriable]──► Record failure, cooldown
 *                               │                   │
 *                               │                   ▼
 *                               │              Try Candidate 2
 *                               │                   │
 *                               │                   └─► ... (continue until success or exhausted)
 *                               │
 *                               └─[Exhausted]──► Throw FallbackExhaustedError
 * ```
 *
 * ## Error Handling Priority
 * 1. **Context Cancellation** (user abort): Abort immediately, do not retry
 * 2. **Format Errors** (400): Non-retriable, abort immediately
 * 3. **Auth Errors** (401/403): Retriable but unlikely to recover
 * 4. **Rate Limit** (429): Retriable with cooldown
 * 5. **Billing Errors** (402): Long cooldown (5h+)
 * 6. **Timeout**: Retriable with standard cooldown
 * 7. **Overloaded**: Treated as rate limit
 * 8. **Unknown**: Retriable with standard cooldown
 *
 * ## Error 431 (Header Too Large) Handling
 * Error 431 is classified as a **format error** (non-retriable) because it indicates
 * the request itself is malformed (headers exceed server limits). This typically means:
 * - Tool definitions are too verbose
 * - Context window is full
 * - Session metadata is too large
 *
 * Unlike other errors, 431 should NOT trigger fallback because:
 * - The same error will occur with any provider
 * - The fix requires reducing request size, not changing providers
 *
 * ## Cooldown Integration
 * The fallback chain integrates with `CooldownTracker` to:
 * - **Skip cooldowned candidates**: Log as skipped, move to next
 * - **Record failures**: Increment error count, apply exponential backoff
 * - **Record successes**: Reset error counts for the provider
 *
 * ## Streaming Fallback Behavior
 * Once a stream starts yielding chunks successfully, the chain commits to that provider.
 * Fallback only applies if the provider fails to *start* streaming. This prevents
 * chunked responses from being mixed between providers.
 *
 * ## AI Context Optimization Tips
 * 1. **Order Matters**: Put most capable/fastest providers first
 * 2. **Leverage Cooldowns**: Don't waste context on known-failing providers
 * 3. **Error Context**: `FallbackExhaustedError.attempts` contains full error chain
 * 4. **Streaming**: Use `executeStream()` for real-time response streaming
 * 5. **Single Provider**: Use `executeSingle()` when fallback isn't needed
 *
 * ## Example Flow
 * ```typescript
 * const chain = new FallbackChain({
 *   candidates: [
 *     { provider: 'openai', model: 'gpt-4o', config: modelConfig1 },
 *     { provider: 'anthropic', model: 'claude-sonnet-4', config: modelConfig2 },
 *     { provider: 'openai', model: 'gpt-3.5-turbo', config: modelConfig3 }
 *   ],
 *   cooldownTracker,
 *   errorClassifier
 * });
 *
 * try {
 *   const result = await chain.execute(providerFactory, messages, tools);
 *   console.log(`Used: ${result.provider}/${result.model}`);
 * } catch (error) {
 *   if (error instanceof FallbackExhaustedError) {
 *     console.log('All candidates failed:', error.attempts);
 *   }
 * }
 * ```
 */

import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { ModelConfig } from './factory.js';
import type { CooldownTracker, FailoverReason } from './cooldown.js';
import { ErrorClassifier, FailoverError } from './error-classifier.js';
import { isRetriableReason } from './cooldown.js';

// =============================================================================
// Types
// =============================================================================

export interface FallbackCandidate {
	provider: string;
	model: string;
	config: ModelConfig;
}

export interface FallbackAttempt {
	candidate: FallbackCandidate;
	error?: FailoverError;
	durationMs: number;
	skipped?: boolean;
	skippedReason?: string;
}

export interface FallbackResult {
	response: unknown; // LLM response (provider-specific type)
	provider: string;
	model: string;
	attempts: FallbackAttempt[];
}

/**
 * Result of a streaming fallback execution.
 */
export interface FallbackStreamResult {
	/** The stream yielding text deltas and finish events */
	stream: ReadableStream<unknown>;
	provider: string;
	model: string;
	attempts: FallbackAttempt[];
}

export interface FallbackChainConfig {
	candidates: FallbackCandidate[];
	cooldownTracker: CooldownTracker;
	errorClassifier: ErrorClassifier;
	/**
	 * Maximum number of retries before giving up.
	 * Default: candidates.length
	 */
	maxRetries?: number;
}

export interface ProviderRunResult {
	response: unknown;
	error?: FailoverError;
}

/**
 * Function type for executing a provider call.
 */
export type ProviderRunFunction = (
	provider: string,
	model: string,
	candidate: FallbackCandidate,
	options?: Record<string, unknown>
) => Promise<ProviderRunResult>;

// =============================================================================
// Fallback Chain
// =============================================================================

/**
 * Orchestrates fallback across multiple model candidates.
 *
 * Behavior:
 * - Candidates in cooldown are skipped (logged as skipped attempt)
 * - Non-retriable errors (format) abort immediately
 * - Retriable errors trigger fallback to next candidate
 * - Success marks provider as good (resets cooldown)
 * - If all fail, returns aggregate error with all attempts
 */
export class FallbackChain {
	private readonly candidates: FallbackCandidate[];
	private readonly cooldownTracker: CooldownTracker;
	private readonly errorClassifier: ErrorClassifier;
	private readonly maxRetries: number;

	constructor(config: FallbackChainConfig) {
		this.candidates = config.candidates;
		this.cooldownTracker = config.cooldownTracker;
		this.errorClassifier = config.errorClassifier;
		this.maxRetries = config.maxRetries ?? config.candidates.length;
	}

	/**
	 * Execute the fallback chain with tool support.
	 */
	async execute(
		providerFactory: (candidate: FallbackCandidate) => LanguageModelV2 | null,
		messages: unknown[],
		tools: unknown[],
		options?: Record<string, unknown>
	): Promise<FallbackResult> {
		if (this.candidates.length === 0) {
			throw new Error('fallback: no candidates configured');
		}

		const attempts: FallbackAttempt[] = [];

		for (const candidate of this.candidates) {
			// Check cooldown before attempting
			if (this.cooldownTracker.shouldSkip(candidate.provider, candidate.model)) {
				const remaining = this.cooldownTracker.getRemainingCooldown(
					candidate.provider,
					candidate.model
				);

				attempts.push({
					candidate,
					skipped: true,
					skippedReason: `in cooldown (${formatDuration(remaining)} remaining)`,
					durationMs: 0
				});
				continue;
			}

			// Create provider instance for this candidate
			const provider = providerFactory(candidate);
			if (!provider) {
				attempts.push({
					candidate,
					error: new FailoverError(
						'unknown',
						candidate.provider,
						candidate.model,
						'failed to create provider instance',
						undefined
					),
					durationMs: 0
				});
				continue;
			}

			const startTime = Date.now();

			try {
				// Execute the provider call
				const response = await this.executeProviderCall(
					provider,
					candidate,
					messages,
					tools,
					options
				);

				// Success - record and return
				this.cooldownTracker.recordSuccess(candidate.provider, candidate.model);

				return {
					response,
					provider: candidate.provider,
					model: candidate.model,
					attempts
				};
			} catch (error) {
				const durationMs = Date.now() - startTime;

				// Classify the error
				const reason = this.errorClassifier.classify(error);

				// Check if context canceled (user abort) - abort immediately
				if (this.isContextCanceled(error)) {
					const failError = new FailoverError(
						reason,
						candidate.provider,
						candidate.model,
						error,
						undefined
					);

					attempts.push({
						candidate,
						error: failError,
						durationMs
					});

					throw failError;
				}

				// Create failover error
				const failoverError = new FailoverError(
					reason,
					candidate.provider,
					candidate.model,
					error,
					undefined
				);

				attempts.push({
					candidate,
					error: failoverError,
					durationMs
				});

				// Check if retriable
				if (!isRetriableReason(reason)) {
					// Non-retriable error (format) - abort immediately
					throw failoverError;
				}

				// Record failure and continue to next candidate
				this.cooldownTracker.recordFailure(candidate.provider, candidate.model, reason);
			}
		}

		// All candidates were skipped (all in cooldown) or exhausted
		throw new FallbackExhaustedError(attempts);
	}

	/**
	 * Execute a simple single-provider call without fallback.
	 */
	async executeSingle(
		provider: LanguageModelV2,
		messages: unknown[],
		tools: unknown[],
		options?: Record<string, unknown>
	): Promise<unknown> {
		return this.executeProviderCall(provider, null, messages, tools, options);
	}

	/**
	 * Execute streaming fallback across multiple model candidates.
	 *
	 * Behavior:
	 * - Candidates in cooldown are skipped (logged as skipped attempt)
	 * - Non-retriable errors (format) abort immediately
	 * - Retriable errors trigger fallback to next candidate
	 * - Success marks provider as good (resets cooldown)
	 * - If all fail, returns aggregate error with all attempts
	 *
	 * Note: Once a stream starts yielding chunks successfully, we commit to that
	 * provider. Fallback only applies if the provider fails to *start* streaming.
	 */
	async executeStream(
		providerFactory: (candidate: FallbackCandidate) => LanguageModelV2 | null,
		messages: unknown[],
		tools: unknown[],
		options?: Record<string, unknown>
	): Promise<FallbackStreamResult> {
		if (this.candidates.length === 0) {
			throw new Error('fallback: no candidates configured');
		}

		const attempts: FallbackAttempt[] = [];

		for (const candidate of this.candidates) {
			// Check cooldown before attempting
			if (this.cooldownTracker.shouldSkip(candidate.provider, candidate.model)) {
				const remaining = this.cooldownTracker.getRemainingCooldown(
					candidate.provider,
					candidate.model
				);

				attempts.push({
					candidate,
					skipped: true,
					skippedReason: `in cooldown (${formatDuration(remaining)} remaining)`,
					durationMs: 0
				});
				continue;
			}

			// Create provider instance for this candidate
			const provider = providerFactory(candidate);
			if (!provider) {
				attempts.push({
					candidate,
					error: new FailoverError(
						'unknown',
						candidate.provider,
						candidate.model,
						'failed to create provider instance',
						undefined
					),
					durationMs: 0
				});
				continue;
			}

			const startTime = Date.now();

			try {
				// Get the stream from the provider
				const streamResult = await provider.doStream({
					prompt: messages as any,
					tools: tools as any
				});

				// Success - record and return
				this.cooldownTracker.recordSuccess(candidate.provider, candidate.model);

				return {
					stream: streamResult.stream,
					provider: candidate.provider,
					model: candidate.model,
					attempts
				};
			} catch (error) {
				const durationMs = Date.now() - startTime;

				// Classify the error
				const reason = this.errorClassifier.classify(error);

				// Check if context canceled (user abort) - abort immediately
				if (this.isContextCanceled(error)) {
					const failError = new FailoverError(
						reason,
						candidate.provider,
						candidate.model,
						error,
						undefined
					);

					attempts.push({
						candidate,
						error: failError,
						durationMs
					});

					throw failError;
				}

				// Create failover error
				const failoverError = new FailoverError(
					reason,
					candidate.provider,
					candidate.model,
					error,
					undefined
				);

				attempts.push({
					candidate,
					error: failoverError,
					durationMs
				});

				// Check if retriable
				if (!isRetriableReason(reason)) {
					// Non-retriable error (format) - abort immediately
					throw failoverError;
				}

				// Record failure and continue to next candidate
				this.cooldownTracker.recordFailure(candidate.provider, candidate.model, reason);
			}
		}

		// All candidates were skipped (all in cooldown) or exhausted
		throw new FallbackExhaustedError(attempts);
	}

	/**
	 * Execute the provider call with typed inputs/outputs.
	 */
	private async executeProviderCall(
		provider: LanguageModelV2,
		candidate: FallbackCandidate | null,
		messages: unknown[],
		tools: unknown[],
		options?: Record<string, unknown>
	): Promise<unknown> {
		// Use the model from candidate or default
		const model = candidate?.model ?? 'default';

		// Call the provider's generate method
		const response = await (
			provider as LanguageModelV2 & {
				doGenerate?: (opts: {
					prompt: unknown[];
					tools?: unknown[];
					[key: string]: unknown;
				}) => Promise<unknown>;
			}
		).doGenerate?.({
			prompt: messages,
			tools,
			...options
		});

		return response;
	}

	/**
	 * Check if error is context cancellation.
	 */
	private isContextCanceled(error: unknown): boolean {
		if (error instanceof Error) {
			return error.name === 'CanceledError' || error.message === 'context canceled';
		}
		return false;
	}

	/**
	 * Get candidates in order.
	 */
	getCandidates(): FallbackCandidate[] {
		return [...this.candidates];
	}
}

// =============================================================================
// Fallback Chain Builder
// =============================================================================

/**
 * Create a fallback chain from model configs.
 */
export function createFallbackChain(
	models: ModelConfig[],
	cooldownTracker: CooldownTracker,
	errorClassifier: ErrorClassifier
): FallbackChain {
	const candidates = models.map((config) => ({
		provider: config.provider,
		model: config.model,
		config
	}));

	return new FallbackChain({
		candidates,
		cooldownTracker,
		errorClassifier
	});
}

// =============================================================================
// Fallback Exhaustive Error
// =============================================================================

/**
 * Error thrown when all fallback candidates have been exhausted.
 */
export class FallbackExhaustedError extends Error {
	readonly attempts: FallbackAttempt[];

	constructor(attempts: FallbackAttempt[]) {
		const message = formatFallbackExhaustedMessage(attempts);
		super(message);

		this.name = 'FallbackExhaustedError';
		this.attempts = attempts;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, FallbackExhaustedError);
		}
	}
}

/**
 * Format a fallback exhausted error message.
 */
function formatFallbackExhaustedMessage(attempts: FallbackAttempt[]): string {
	const lines: string[] = [`fallback: all ${attempts.length} candidates failed:`];

	attempts.forEach((attempt, index) => {
		const num = index + 1;
		if (attempt.skipped) {
			lines.push(
				`  [${num}] ${attempt.candidate.provider}/${attempt.candidate.model}: skipped (${attempt.skippedReason})`
			);
		} else if (attempt.error) {
			const reason = attempt.error.reason;
			const duration = formatDuration(attempt.durationMs);
			lines.push(
				`  [${num}] ${attempt.candidate.provider}/${attempt.candidate.model}: ${attempt.error.message} (reason=${reason}, ${duration})`
			);
		}
	});

	return lines.join('\n');
}

/**
 * Format duration in milliseconds to human-readable string.
 */
function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
	return `${(ms / 3_600_000).toFixed(1)}h`;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse a model reference string into provider and model.
 * Format: "provider/model" or just "model" (defaults to openai).
 */
export function parseModelRef(
	ref: string,
	defaultProvider: string = 'openai'
): { provider: string; model: string } | null {
	const trimmed = ref.trim();

	if (trimmed === '') {
		return null;
	}

	const slashIndex = trimmed.indexOf('/');

	if (slashIndex === -1) {
		return {
			provider: defaultProvider,
			model: trimmed
		};
	}

	return {
		provider: trimmed.substring(0, slashIndex),
		model: trimmed.substring(slashIndex + 1)
	};
}

/**
 * Resolve candidates from a primary model and fallback list.
 * Handles deduplication and proper ordering.
 */
export function resolveCandidates(
	primary: string,
	fallbacks: string[],
	defaultProvider: string = 'openai'
): Array<{ provider: string; model: string }> {
	const seen = new Set<string>();
	const candidates: Array<{ provider: string; model: string }> = [];

	const addCandidate = (ref: string) => {
		const parsed = parseModelRef(ref.trim(), defaultProvider);
		if (!parsed) return;

		const key = `${parsed.provider}/${parsed.model}`;
		if (seen.has(key)) return;

		seen.add(key);
		candidates.push(parsed);
	};

	// Primary first
	addCandidate(primary);

	// Then fallbacks
	for (const fb of fallbacks) {
		addCandidate(fb);
	}

	return candidates;
}

/**
 * Create a model key for cooldown tracking.
 */
export function modelKey(provider: string, model: string): string {
	return `${provider}/${model}`;
}
