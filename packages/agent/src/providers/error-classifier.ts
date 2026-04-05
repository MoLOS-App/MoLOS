/**
 * Error Classifier - Categorizes Provider Errors for Intelligent Failover
 *
 * ## Purpose
 * Analyzes errors from LLM providers and categorizes them into actionable types.
 * This determines whether a request should be retried with the same provider,
 * failed over to another provider, or aborted immediately.
 *
 * ## Error Classification Hierarchy
 *
 * ```
 * Error occurs
 *     │
 *     ▼
 * Extract error message & HTTP status
 *     │
 *     ▼
 * ┌────────────────────────────────────────────────────────────┐
 * │ 1. Context Cancellation?  → 'unknown' (never retry user abort)│
 * └────────────────────────────────────────────────────────────┘
 *                             │
 *                             ▼
 * ┌────────────────────────────────────────────────────────────┐
 * │ 2. HTTP Status Code Match?                                  │
 * │    - 401, 403 → 'auth'                                      │
 * │    - 402     → 'billing'                                    │
 * │    - 408     → 'timeout'                                    │
 * │    - 429     → 'rate_limit'                                 │
 * │    - 400     → 'format'                                     │
 * │    - 5xx     → 'timeout' (transient)                        │
 * └────────────────────────────────────────────────────────────┘
 *                             │
 *                             ▼
 * ┌────────────────────────────────────────────────────────────┐
 * │ 3. Message Pattern Matching (Priority Order)                │
 * │    Rate Limit patterns (429, quota exceeded, etc.)          │
 * │    → 'rate_limit'                                           │
 * │                                                              │
 * │    Overloaded patterns (overloaded_error)                   │
 * │    → 'rate_limit' (treated same as rate limit)              │
 * │                                                              │
 * │    Billing patterns (payment required, insufficient credits) │
 * │    → 'billing'                                              │
 * │                                                              │
 * │    Timeout patterns (deadline exceeded, timed out)          │
 * │    → 'timeout'                                              │
 * │                                                              │
 * │    Auth patterns (invalid api key, unauthorized, etc.)       │
 * │    → 'auth'                                                 │
 * │                                                              │
 * │    Format patterns (string should match pattern, tool_use.id)│
 * │    → 'format' (non-retriable!)                              │
 * │                                                              │
 * │    No match → 'unknown'                                      │
 * └────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Retry vs Fallback Decision Matrix
 *
 * | Reason       | Retry Same Provider? | Fallback to Next? | Action            |
 * |--------------|---------------------|-------------------|-------------------|
 * | `auth`       | No (key likely bad) | Yes               | Switch provider   |
 * | `rate_limit` | After cooldown      | Yes               | Switch provider   |
 * | `billing`    | After long cooldown | Yes               | Switch provider   |
 * | `timeout`    | After cooldown      | Yes               | Switch provider   |
 * | `format`     | **Never**           | **Never**         | Abort & debug     |
 * | `overloaded` | After cooldown      | Yes               | Switch provider   |
 * | `unknown`    | After cooldown      | Yes               | Switch provider   |
 *
 * ## Why Format Errors Are Non-Retriable
 * Format errors (HTTP 400, "string should match pattern", "tool_use.id invalid")
 * indicate the **request itself is malformed**. Changing providers won't help because:
 * - The same validation will fail on any provider
 * - The request needs to be fixed (reduce size, fix tool schema, etc.)
 *
 * Common causes:
 * - Tool definitions too verbose for context
 * - Request exceeds provider's max header size (HTTP 431)
 * - Malformed tool_call ID format
 * - Invalid message sequence
 *
 * ## HTTP 431 (Request Header Fields Too Large)
 * This specific error is treated as a **format error** (non-retriable) because:
 * - Indicates request structure exceeds server limits
 * - Would fail identically on any provider
 * - Fix requires reducing request size, not provider switching
 *
 * ## Error Context for Debugging
 * `FailoverError` preserves:
 * - Original error message and stack
 * - Classified reason
 * - Provider and model that failed
 * - HTTP status code (if available)
 * - Timestamp
 *
 * ## AI Context Optimization Tips
 * 1. **Preserve Error Chain**: `FallbackExhaustedError.attempts` has all failures
 * 2. **Use `classifyError()`**: Wraps error with classification metadata
 * 3. **Pattern Customization**: Create custom classifiers via `createErrorClassifier()`
 * 4. **Status Code First**: HTTP status is most reliable classifier
 * 5. **Format = Debug Signal**: Format errors indicate context size issues
 *
 * ## Pattern Matching Details
 * - **Substring patterns**: Case-insensitive contains match
 * - **Regex patterns**: Case-insensitive with 'i' flag
 * - **Priority matters**: First match wins (rate_limit before overloaded)
 *
 * @example
 * const classifier = new ErrorClassifier();
 *
 * const reason = classifier.classify(networkError);
 * if (!isRetriableReason(reason)) {
 *   console.log('Non-retriable error - abort');
 * } else {
 *   console.log('Retriable - try fallback');
 * }
 *
 * @example
 * // Custom patterns for internal provider
 * const custom = createErrorClassifier({
 *   rate_limit: [/internal_rate_limit/i, /throttled/i]
 * });
 */

// =============================================================================
// Types
// =============================================================================

export type FailoverReason =
	| 'auth' // 401, 403, invalid api key
	| 'rate_limit' // 429, too many requests
	| 'billing' // 402, payment required
	| 'timeout' // 408, deadline exceeded
	| 'format' // 400, string should match pattern
	| 'overloaded' // overloaded_error
	| 'unknown'; // everything else

// =============================================================================
// Pattern Types
// =============================================================================

interface ErrorPattern {
	readonly substring?: string;
	readonly regex?: RegExp;
}

function createSubstringPattern(substr: string): ErrorPattern {
	return { substring: substr.toLowerCase() };
}

function createRegexPattern(pattern: string): ErrorPattern {
	return { regex: new RegExp(pattern, 'i') };
}

// =============================================================================
// Default Error Patterns
// =============================================================================

const RATE_LIMIT_PATTERNS: ErrorPattern[] = [
	createRegexPattern(`rate[_ ]limit`),
	createSubstringPattern('too many requests'),
	createSubstringPattern('429'),
	createSubstringPattern('exceeded your current quota'),
	createRegexPattern(`exceeded.*quota`),
	createRegexPattern(`resource has been exhausted`),
	createRegexPattern(`resource.*exhausted`),
	createSubstringPattern('resource_exhausted'),
	createSubstringPattern('quota exceeded'),
	createSubstringPattern('usage limit')
];

const OVERLOADED_PATTERNS: ErrorPattern[] = [
	createRegexPattern(`overloaded_error`),
	createRegexPattern(`"type"\\s*:\\s*"overloaded_error"`),
	createSubstringPattern('overloaded')
];

const TIMEOUT_PATTERNS: ErrorPattern[] = [
	createSubstringPattern('timeout'),
	createSubstringPattern('timed out'),
	createRegexPattern(`deadline exceeded`),
	createSubstringPattern('context deadline exceeded')
];

const BILLING_PATTERNS: ErrorPattern[] = [
	createRegexPattern(`\\b402\\b`),
	createSubstringPattern('payment required'),
	createSubstringPattern('insufficient credits'),
	createSubstringPattern('credit balance'),
	createSubstringPattern('plans & billing'),
	createSubstringPattern('insufficient balance')
];

const AUTH_PATTERNS: ErrorPattern[] = [
	createRegexPattern(`invalid[_ ]?api[_ ]?key`),
	createSubstringPattern('incorrect api key'),
	createSubstringPattern('invalid token'),
	createSubstringPattern('authentication'),
	createSubstringPattern('re-authenticate'),
	createSubstringPattern('oauth token refresh failed'),
	createSubstringPattern('unauthorized'),
	createSubstringPattern('forbidden'),
	createSubstringPattern('access denied'),
	createSubstringPattern('expired'),
	createSubstringPattern('token has expired'),
	createRegexPattern(`\\b401\\b`),
	createRegexPattern(`\\b403\\b`),
	createSubstringPattern('no credentials found'),
	createSubstringPattern('no api key found')
];

/**
 * Patterns that indicate PERMANENT auth failures (invalid API key).
 * When these match, the API key should be deactivated.
 */
const PERMANENT_AUTH_PATTERNS: ErrorPattern[] = [
	createRegexPattern(`invalid[_ ]?api[_ ]?key`),
	createSubstringPattern('incorrect api key'),
	createSubstringPattern('invalid token'),
	createSubstringPattern('no credentials found'),
	createSubstringPattern('no api key found'),
	createSubstringPattern('api key not found'),
	createSubstringPattern('authentication failed')
];

/**
 * Patterns that indicate TRANSIENT auth failures (rate-limited or temporary).
 * When these match, the profile should go into cooldown but may recover.
 */
const TRANSIENT_AUTH_PATTERNS: ErrorPattern[] = [
	createSubstringPattern('rate limit'),
	createSubstringPattern('too many requests'),
	createSubstringPattern('throttl'),
	createSubstringPattern('quota exceeded'),
	createSubstringPattern('usage limit')
];

const FORMAT_PATTERNS: ErrorPattern[] = [
	createSubstringPattern('string should match pattern'),
	createRegexPattern(`tool_use\\.id`),
	createSubstringPattern('tool_use_id'),
	createSubstringPattern('messages.1.content.1.tool_use.id'),
	createSubstringPattern('invalid request format')
];

// Transient HTTP status codes that indicate server-side issues (treated as timeout)
const TRANSIENT_STATUS_CODES: Set<number> = new Set([500, 502, 503, 521, 522, 523, 524, 529]);

// HTTP status code patterns for extraction
const HTTP_STATUS_PATTERNS: RegExp[] = [
	/status[:\s]+(\d{3})/i,
	/http[/\s]+\d*\.?\d*\s+(\d{3})/i,
	/\b([3-5]\d{2})\b/
];

// =============================================================================
// Error Classifier
// =============================================================================

export interface ErrorClassifierConfig {
	rateLimitPatterns?: RegExp[];
	authPatterns?: RegExp[];
	billingPatterns?: RegExp[];
	timeoutPatterns?: RegExp[];
	formatPatterns?: RegExp[];
	overloadedPatterns?: RegExp[];
}

/**
 * Classifies errors from LLM providers into FailoverReason categories.
 *
 * Priority order for classification:
 * 1. Rate Limit - rate_limit, too many requests, 429, exceeded quota
 * 2. Overloaded - overloaded_error (treated as rate_limit)
 * 3. Billing - 402, payment required, insufficient credits
 * 4. Timeout - timeout, deadline exceeded
 * 5. Auth - 401, 403, invalid api key, unauthorized
 * 6. Format - string should match pattern, tool_use.id
 */
export class ErrorClassifier {
	private readonly rateLimitPatterns: ErrorPattern[];
	private readonly overloadedPatterns: ErrorPattern[];
	private readonly timeoutPatterns: ErrorPattern[];
	private readonly billingPatterns: ErrorPattern[];
	private readonly authPatterns: ErrorPattern[];
	private readonly formatPatterns: ErrorPattern[];

	constructor(config?: ErrorClassifierConfig) {
		// Use custom patterns if provided, otherwise use defaults
		this.rateLimitPatterns = config?.rateLimitPatterns
			? config.rateLimitPatterns.map((r) => ({ regex: r }))
			: RATE_LIMIT_PATTERNS;

		this.overloadedPatterns = config?.overloadedPatterns
			? config.overloadedPatterns.map((r) => ({ regex: r }))
			: OVERLOADED_PATTERNS;

		this.timeoutPatterns = config?.timeoutPatterns
			? config.timeoutPatterns.map((r) => ({ regex: r }))
			: TIMEOUT_PATTERNS;

		this.billingPatterns = config?.billingPatterns
			? config.billingPatterns.map((r) => ({ regex: r }))
			: BILLING_PATTERNS;

		this.authPatterns = config?.authPatterns
			? config.authPatterns.map((r) => ({ regex: r }))
			: AUTH_PATTERNS;

		this.formatPatterns = config?.formatPatterns
			? config.formatPatterns.map((r) => ({ regex: r }))
			: FORMAT_PATTERNS;
	}

	/**
	 * Classify an error into a FailoverReason.
	 * Returns 'unknown' if the error cannot be classified.
	 */
	classify(error: unknown): FailoverReason {
		if (error == null) {
			return 'unknown';
		}

		// Handle context cancellation specially - never failover for user abort
		if (this.isContextCanceled(error)) {
			return 'unknown';
		}

		// Handle context deadline exceeded - treat as timeout, always failover
		if (this.isContextDeadlineExceeded(error)) {
			return 'timeout';
		}

		const message = this.extractMessage(error).toLowerCase();

		// Try HTTP status code extraction first
		const status = this.extractHttpStatus(message);
		if (status > 0) {
			const reason = this.classifyByStatus(status);
			if (reason !== 'unknown') {
				return reason;
			}
		}

		// Message pattern matching (priority order matters)
		return this.classifyByMessage(message);
	}

	/**
	 * Classify by HTTP status code.
	 */
	classifyStatus(status: number): FailoverReason {
		return this.classifyByStatus(status);
	}

	/**
	 * Check if a failover reason is retriable.
	 * Non-retriable reasons should not trigger fallback.
	 */
	isRetriable(reason: FailoverReason): boolean {
		// Format errors are non-retriable (bad request structure)
		return reason !== 'format';
	}

	/**
	 * Check if an auth error is permanent (invalid API key) vs transient (rate-limited auth).
	 *
	 * Permanent auth errors indicate the API key itself is invalid and should not be retried.
	 * Transient auth errors indicate the API key is valid but temporarily unavailable.
	 *
	 * @param error The error to check
	 * @returns 'permanent' if the key is invalid, 'transient' if it's temporarily unavailable
	 */
	classifyAuthError(error: unknown): 'permanent' | 'transient' {
		const message = this.extractMessage(error).toLowerCase();

		// Check for permanent auth error patterns first
		if (this.matchesAny(message, PERMANENT_AUTH_PATTERNS)) {
			return 'permanent';
		}

		// Check for transient auth error patterns
		if (this.matchesAny(message, TRANSIENT_AUTH_PATTERNS)) {
			return 'transient';
		}

		// Default to permanent for unknown auth errors (safer approach)
		return 'permanent';
	}

	/**
	 * Extract error message string from an error object.
	 */
	extractMessage(error: unknown): string {
		if (error == null) {
			return '';
		}

		if (error instanceof Error) {
			return error.message;
		}

		if (typeof error === 'string') {
			return error;
		}

		// Try to extract from object
		if (typeof error === 'object') {
			const e = error as Record<string, unknown>;
			if (typeof e.message === 'string') {
				return e.message;
			}
			if (typeof e.error === 'string') {
				return e.error;
			}
			if (typeof e.reason === 'string') {
				return e.reason;
			}
		}

		return String(error);
	}

	/**
	 * Classify error by HTTP status code.
	 */
	private classifyByStatus(status: number): FailoverReason {
		switch (status) {
			case 401:
			case 403:
				return 'auth';
			case 402:
				return 'billing';
			case 408:
				return 'timeout';
			case 429:
				return 'rate_limit';
			case 400:
				return 'format';
			default:
				if (TRANSIENT_STATUS_CODES.has(status)) {
					return 'timeout';
				}
				return 'unknown';
		}
	}

	/**
	 * Classify error by message pattern matching.
	 */
	private classifyByMessage(message: string): FailoverReason {
		if (this.matchesAny(message, this.rateLimitPatterns)) {
			return 'rate_limit';
		}
		if (this.matchesAny(message, this.overloadedPatterns)) {
			// Overloaded treated as rate_limit
			return 'rate_limit';
		}
		if (this.matchesAny(message, this.billingPatterns)) {
			return 'billing';
		}
		if (this.matchesAny(message, this.timeoutPatterns)) {
			return 'timeout';
		}
		if (this.matchesAny(message, this.authPatterns)) {
			return 'auth';
		}
		if (this.matchesAny(message, this.formatPatterns)) {
			return 'format';
		}
		return 'unknown';
	}

	/**
	 * Extract HTTP status code from error message.
	 */
	private extractHttpStatus(message: string): number {
		for (const pattern of HTTP_STATUS_PATTERNS) {
			const match = message.match(pattern);
			if (match && match[1]) {
				const parsed = parseInt(match[1], 10);
				if (!isNaN(parsed) && parsed >= 100 && parsed < 600) {
					return parsed;
				}
			}
		}
		return 0;
	}

	/**
	 * Check if message matches any pattern.
	 */
	private matchesAny(message: string, patterns: ErrorPattern[]): boolean {
		for (const pattern of patterns) {
			if (pattern.regex) {
				if (pattern.regex.test(message)) {
					return true;
				}
			} else if (pattern.substring) {
				if (message.includes(pattern.substring)) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Check if error is context.Canceled.
	 */
	private isContextCanceled(error: unknown): boolean {
		if (error instanceof Error) {
			return error.name === 'CanceledError' || error.message === 'context canceled';
		}
		return false;
	}

	/**
	 * Check if error is context.DeadlineExceeded.
	 */
	private isContextDeadlineExceeded(error: unknown): boolean {
		if (error instanceof Error) {
			return (
				error.name === 'DeadlineExceededError' || error.message === 'context deadline exceeded'
			);
		}
		return false;
	}
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Default patterns organized by FailoverReason.
 * Useful for creating custom classifiers with partial overrides.
 */
export const DEFAULT_PATTERNS: Record<FailoverReason, RegExp[]> = {
	auth: AUTH_PATTERNS.filter((p) => p.regex).map((p) => p.regex!),
	billing: BILLING_PATTERNS.filter((p) => p.regex).map((p) => p.regex!),
	format: FORMAT_PATTERNS.filter((p) => p.regex).map((p) => p.regex!),
	overloaded: OVERLOADED_PATTERNS.filter((p) => p.regex).map((p) => p.regex!),
	rate_limit: RATE_LIMIT_PATTERNS.filter((p) => p.regex).map((p) => p.regex!),
	timeout: TIMEOUT_PATTERNS.filter((p) => p.regex).map((p) => p.regex!),
	unknown: []
};

/**
 * Create a new ErrorClassifier with optional custom patterns.
 */
export function createErrorClassifier(
	customPatterns?: Partial<Record<FailoverReason, RegExp[]>>
): ErrorClassifier {
	const config: ErrorClassifierConfig = {};

	if (customPatterns) {
		if (customPatterns.rate_limit) config.rateLimitPatterns = customPatterns.rate_limit;
		if (customPatterns.auth) config.authPatterns = customPatterns.auth;
		if (customPatterns.billing) config.billingPatterns = customPatterns.billing;
		if (customPatterns.timeout) config.timeoutPatterns = customPatterns.timeout;
		if (customPatterns.format) config.formatPatterns = customPatterns.format;
		if (customPatterns.overloaded) config.overloadedPatterns = customPatterns.overloaded;
	}

	return new ErrorClassifier(config);
}

// =============================================================================
// Error Wrapping
// =============================================================================

export interface ClassifiedError {
	reason: FailoverReason;
	message: string;
	original: unknown;
	retriable: boolean;
}

/**
 * Wrap an error with classification metadata.
 * Useful for preserving error context through fallback chains.
 */
export function classifyError(error: unknown, classifier?: ErrorClassifier): ClassifiedError {
	const actualClassifier = classifier ?? new ErrorClassifier();
	const reason = actualClassifier.classify(error);
	const message = actualClassifier.extractMessage(error);

	return {
		reason,
		message,
		original: error,
		retriable: actualClassifier.isRetriable(reason)
	};
}

/**
 * Create a FailoverError with classification.
 * Provides a standardized error format for provider failures.
 *
 * This class extends Error for backward compatibility but is designed to work
 * with the new AgentError class from src/errors/index.ts.
 */
export class FailoverError extends Error {
	readonly reason: FailoverReason;
	readonly provider: string;
	readonly model: string;
	readonly status?: number;
	readonly original: unknown;

	constructor(
		reason: FailoverReason,
		provider: string,
		model: string,
		wrapped: unknown,
		status?: number
	) {
		const message = `failover(${reason}): provider=${provider} model=${model} status=${status ?? 'N/A'}: ${wrapped instanceof Error ? wrapped.message : String(wrapped)}`;
		super(message);

		this.name = 'FailoverError';
		this.reason = reason;
		this.provider = provider;
		this.model = model;
		this.status = status;
		this.original = wrapped;

		// Maintains proper stack trace for V8 engines
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, FailoverError);
		}
	}

	/**
	 * Check if this error should trigger fallback to next candidate.
	 * Non-retriable errors (format) should abort immediately.
	 */
	isRetriable(): boolean {
		return this.reason !== 'format';
	}

	/**
	 * Unwrap the original error.
	 */
	unwrap(): unknown {
		return this.original;
	}

	/**
	 * Convert to a structured AgentError for unified error handling.
	 * This enables interoperability between the legacy FailoverError
	 * and the new AgentError class.
	 *
	 * Note: This is a temporary bridge function. As code migrates to use
	 * AgentError directly, this conversion won't be necessary.
	 */
	toAgentError(): import('../errors/index.js').AgentError {
		// Import dynamically to avoid circular dependencies
		const { AgentError, ErrorCode } = require('../errors/index.js');

		// Map FailoverReason to ErrorCode
		let code: (typeof ErrorCode)[keyof typeof ErrorCode];
		switch (this.reason) {
			case 'auth':
				code = ErrorCode.AUTH_ERROR;
				break;
			case 'billing':
				code = ErrorCode.BILLING_ERROR;
				break;
			case 'timeout':
				code = ErrorCode.TIMEOUT;
				break;
			case 'rate_limit':
				code = ErrorCode.RATE_LIMIT;
				break;
			case 'format':
				code = ErrorCode.BAD_REQUEST;
				break;
			case 'overloaded':
				code = ErrorCode.PROVIDER_ERROR;
				break;
			default:
				code = ErrorCode.UNKNOWN;
		}

		return new AgentError({
			code,
			reason: this.reason as import('../errors/codes.js').FailoverReason,
			message: this.message,
			context: {
				provider: this.provider,
				model: this.model,
				status: this.status,
				originalError: this.original
			},
			originalError: this.original
		});
	}
}

/**
 * Create a FailoverError from an existing error with context.
 * Convenience function for creating provider-related errors.
 */
export function createFailoverError(
	reason: FailoverReason,
	provider: string,
	model: string,
	wrapped: unknown,
	status?: number
): FailoverError {
	return new FailoverError(reason, provider, model, wrapped, status);
}

// Create singleton default classifier for convenience
const defaultClassifier = new ErrorClassifier();

/**
 * Classify an error using the default classifier.
 * Convenience function for simple error classification.
 */
export function classify(error: unknown): FailoverReason {
	return defaultClassifier.classify(error);
}

/**
 * Check if a reason is retriable.
 * Convenience function for simple retriability checks.
 */
export function isRetriable(reason: FailoverReason): boolean {
	return defaultClassifier.isRetriable(reason);
}
