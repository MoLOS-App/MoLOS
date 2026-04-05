/**
 * Error Recovery Module - Extracted error handling and recovery logic from AgentLoop
 *
 * This module provides standalone functions for error classification, retry handling,
 * and panic recovery. These were extracted from AgentLoop to improve modularity
 * and allow reuse across different agent implementations.
 *
 * ## Error Recovery Hierarchy
 * 1. **Retry** (up to 3 attempts with exponential backoff) - for transient errors
 * 2. **Compact** (up to 3 attempts) - context summarization for overflow
 * 3. **Truncate** - last resort tool result shortening
 * 4. **Abort** - permanent failure
 *
 * ## Panic Recovery Pattern
 * Wraps each turn execution to catch:
 * - panic signals from LLM providers
 * - unexpected tokens, array buffer errors
 * - deadlock and stack size errors
 * After 3 panics, aborts the run.
 */

import { AgentError as StructuredAgentError, ErrorCode } from '../errors/index.js';
import { AGENT } from '../constants.js';

// Re-export AgentError type for consumers
export type AgentError = StructuredAgentError;

/**
 * Provider error types for lifecycle hooks
 */
export type ProviderErrorType =
	| 'timeout'
	| 'auth'
	| 'rate_limit'
	| 'server_error'
	| 'context_overflow'
	| 'unknown';

/**
 * Recovery action types
 */
export type RecoveryAction = 'retry' | 'compact' | 'truncate' | 'abort';

/**
 * Error recovery context - holds mutable state needed for error recovery operations
 */
export interface ErrorRecoveryContext {
	/** Current count of overflow compaction attempts */
	overflowCompactionAttempts: number;
	/** Current panic count */
	panicCount: number;
	/** Last error that occurred */
	lastError: AgentError | null;
	/** Event emitter for logging recovery events */
	emitEvent?: (type: string, data: Record<string, unknown>, runId: string) => void;
}

/**
 * Result of error classification with recovery hints
 */
export interface ClassifiedError extends AgentError {
	/** Whether this error can be retried */
	retriable: boolean;
	/** Suggested recovery action */
	recovery: RecoveryAction;
}

// =============================================================================
// Error Factory
// =============================================================================

/**
 * Create an AgentError with proper structure from error type string.
 * Maps legacy type strings to structured AgentError.
 */
function createAgentError(
	type: AgentError['type'],
	message: string,
	cause?: unknown,
	options?: { retriable?: boolean; recovery?: RecoveryAction }
): ClassifiedError {
	// Map the old type strings to ErrorCode values and FailoverReason
	let code: (typeof ErrorCode)[keyof typeof ErrorCode];
	let reason: 'timeout' | 'context_overflow' | 'auth' | 'rate_limit' | 'server_error' | 'unknown';

	switch (type) {
		case 'timeout':
			code = ErrorCode.TIMEOUT;
			reason = 'timeout';
			break;
		case 'context_overflow':
		case 'context_limit':
			code = ErrorCode.CONTEXT_OVERFLOW;
			reason = 'context_overflow';
			break;
		case 'provider_error':
			code = ErrorCode.PROVIDER_ERROR;
			reason = 'server_error';
			break;
		case 'tool_error':
			code = ErrorCode.TOOL_ERROR;
			reason = 'unknown';
			break;
		case 'auth_error':
			code = ErrorCode.AUTH_ERROR;
			reason = 'auth';
			break;
		case 'rate_limit':
			code = ErrorCode.RATE_LIMIT;
			reason = 'rate_limit';
			break;
		default:
			code = ErrorCode.UNKNOWN;
			reason = 'unknown';
	}

	const error = new StructuredAgentError({
		code,
		reason: reason as import('../errors/codes.js').FailoverReason,
		message,
		context: {
			originalError: cause
		},
		originalError: cause
	});

	// Attach retriable and recovery from options
	Object.defineProperties(error, {
		retriable: {
			value: options?.retriable ?? error.retriable,
			writable: true,
			enumerable: true,
			configurable: true
		},
		recovery: {
			value: options?.recovery ?? error.recovery,
			writable: true,
			enumerable: true,
			configurable: true
		}
	});

	return error as ClassifiedError;
}

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Basic error type classification based on error message patterns.
 * Returns an AgentError with appropriate type.
 */
export function classifyError(err: unknown): AgentError {
	if (err instanceof Error) {
		const message = err.message.toLowerCase();
		if (message.includes('timeout')) return createAgentError('timeout', err.message, err);
		if (message.includes('context') && message.includes('overflow'))
			return createAgentError('context_overflow', err.message, err);
		if (message.includes('provider') || message.includes('api'))
			return createAgentError('provider_error', err.message, err);
		if (message.includes('tool')) return createAgentError('tool_error', err.message, err);
		return createAgentError('unknown', err.message, err);
	}
	return createAgentError('unknown', String(err), err);
}

/**
 * Determines if an error can be retried based on its type.
 * Explicit retriable flag on the error takes precedence.
 */
export function isRetryableError(err: unknown): boolean {
	const error = err instanceof StructuredAgentError ? err : classifyError(err);
	// Explicit retriable flag takes precedence
	if (error.retriable !== undefined) {
		return error.retriable;
	}
	switch (error.type) {
		case 'timeout':
		case 'provider_error':
		case 'rate_limit':
			return true;
		case 'auth_error':
		case 'tool_error':
		case 'context_overflow':
		case 'context_limit':
			return false;
		default:
			return false;
	}
}

/**
 * Enhanced error classification with detailed recovery hints.
 * Inspired by Inspo's error categorization patterns.
 */
export function classifyErrorWithRecovery(err: unknown): AgentError {
	// If it's already an AgentError, return as-is
	if (err instanceof StructuredAgentError) {
		return err;
	}

	if (err instanceof Error) {
		const message = err.message.toLowerCase();
		const fullMessage = err.message;

		// Timeout errors
		if (message.includes('timeout')) {
			return createAgentError('timeout', fullMessage, err, { retriable: true, recovery: 'retry' });
		}

		// Context overflow - retriable via compaction
		if (
			(message.includes('context') && message.includes('overflow')) ||
			(message.includes('token') && message.includes('limit'))
		) {
			return createAgentError('context_overflow', fullMessage, err, {
				retriable: false,
				recovery: 'compact'
			});
		}

		// Rate limiting
		if (message.includes('rate') && (message.includes('limit') || message.includes('quota'))) {
			return createAgentError('rate_limit', fullMessage, err, {
				retriable: true,
				recovery: 'retry'
			});
		}

		// Auth errors - may benefit from key rotation if multiple auth profiles exist
		if (
			message.includes('auth') ||
			message.includes('unauthorized') ||
			(message.includes('invalid') && message.includes('api')) ||
			(message.includes('api') && (message.includes('key') || message.includes('token')))
		) {
			return createAgentError('auth_error', fullMessage, err, {
				retriable: false,
				recovery: 'abort'
			});
		}

		// Provider/API errors
		if (message.includes('provider') || message.includes('api') || message.includes('model')) {
			return createAgentError('provider_error', fullMessage, err, {
				retriable: true,
				recovery: 'retry'
			});
		}

		// Tool errors
		if (message.includes('tool')) {
			return createAgentError('tool_error', fullMessage, err, {
				retriable: false,
				recovery: 'abort'
			});
		}

		// Panic signals from LLM providers (rare but critical)
		if (message.includes('panic') || message.includes('crash')) {
			return createAgentError('unknown', fullMessage, err, { retriable: false, recovery: 'abort' });
		}

		return createAgentError('unknown', fullMessage, err, { retriable: false, recovery: 'abort' });
	}
	return createAgentError('unknown', String(err), err, { retriable: false, recovery: 'abort' });
}

// =============================================================================
// Error Recovery Handling
// =============================================================================

/**
 * Handle retriable error with exhaustion detection.
 * Decides whether to continue retry, compact, truncate, or abort.
 * Inspired by Inspo's retry exhaustion handling.
 */
export function handleRetriableError(
	error: AgentError,
	attempt: number,
	context: ErrorRecoveryContext
): RecoveryAction {
	// If we've exceeded max retries, decide on fallback strategy
	if (attempt >= AGENT.MAX_RETRIES) {
		context.lastError = error;

		switch (error.type) {
			case 'context_overflow':
			case 'context_limit':
				// Context overflows can often be resolved via compaction
				if (context.overflowCompactionAttempts < AGENT.MAX_OVERFLOW_COMPACTION_ATTEMPTS) {
					return 'compact';
				}
				// After compaction exhaustion, try truncation as last resort
				return 'truncate';

			case 'timeout':
			case 'rate_limit':
				// Transient errors - abort after exhausting retries
				return 'abort';

			case 'provider_error':
				// Provider errors might be resolved by waiting
				return 'abort';

			case 'auth_error':
				// Auth errors after trying all keys should abort
				return 'abort';

			default:
				return 'abort';
		}
	}

	// Still have retries left - continue
	return 'retry';
}

/**
 * Check if context overflow compaction should be attempted
 */
export function shouldCompact(error: AgentError, context: ErrorRecoveryContext): boolean {
	return (
		error.type === 'context_overflow' &&
		context.overflowCompactionAttempts < AGENT.MAX_OVERFLOW_COMPACTION_ATTEMPTS
	);
}

// =============================================================================
// Panic Recovery
// =============================================================================

/**
 * Panic recovery wrapper similar to Go's deferred recover pattern.
 * Catches unexpected panics and allows the agent to continue safely.
 */
export async function runWithPanicRecovery<T>(
	fn: () => Promise<T>,
	context: ErrorRecoveryContext
): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		// Check if this is a panic signal
		const isPanic =
			error instanceof Error &&
			(error.message.includes('panic') ||
				error.message.includes('unexpected token') ||
				error.message.includes('array buffer') ||
				error.message.includes('deadlock') ||
				error.message.includes('stack size') ||
				(error.cause && (error.cause as Error)?.message?.includes('panic')));

		if (isPanic) {
			context.panicCount++;
			context.emitEvent?.(
				'run:panic',
				{
					error: classifyError(error),
					panicCount: context.panicCount
				},
				''
			);

			// After multiple panics, abort
			if (context.panicCount >= AGENT.PANIC_THRESHOLD) {
				throw error;
			}

			// Clear state and re-throw to trigger recovery
			throw error;
		}

		// Not a panic, re-throw
		throw error;
	}
}

// =============================================================================
// Provider Error Type Mapping
// =============================================================================

/**
 * Map agent error type to provider error type for lifecycle hooks.
 */
export function mapErrorToProviderErrorType(error: AgentError): ProviderErrorType {
	switch (error.type) {
		case 'timeout':
			return 'timeout';
		case 'auth_error':
			return 'auth';
		case 'rate_limit':
			return 'rate_limit';
		case 'provider_error':
			return 'server_error';
		case 'context_overflow':
			return 'context_overflow';
		default:
			return 'unknown';
	}
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new error recovery context with default values.
 */
export function createErrorRecoveryContext(
	emitEvent?: (type: string, data: Record<string, unknown>, runId: string) => void
): ErrorRecoveryContext {
	return {
		overflowCompactionAttempts: 0,
		panicCount: 0,
		lastError: null,
		emitEvent
	};
}
