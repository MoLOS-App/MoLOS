/**
 * Error Context - Additional context for error debugging
 *
 * Provides structured metadata about where and why an error occurred,
 * useful for debugging, logging, and error analysis.
 */

/**
 * Context information for errors.
 * Includes provider, model, and other metadata useful for debugging.
 */
export interface ErrorContext {
	/** Provider that generated the error (e.g., 'openai', 'anthropic') */
	provider?: string;
	/** Model that was being used when error occurred */
	model?: string;
	/** User/profile ID associated with the request */
	profileId?: string;
	/** HTTP status code if available */
	status?: number;
	/** Request ID for tracing */
	requestId?: string;
	/** Session ID for tracing */
	sessionId?: string;
	/** Turn ID for tracing */
	turnId?: string;
	/** Timestamp when error occurred (Unix ms) */
	timestamp?: number;
	/** Retry count at time of error */
	retryCount?: number;
	/** Original error object if wrapped */
	originalError?: unknown;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Creates a partial ErrorContext with common fields.
 */
export function createErrorContext(partial: Partial<ErrorContext> = {}): ErrorContext {
	return {
		provider: partial.provider,
		model: partial.model,
		profileId: partial.profileId,
		status: partial.status,
		requestId: partial.requestId,
		sessionId: partial.sessionId,
		turnId: partial.turnId,
		timestamp: partial.timestamp ?? Date.now(),
		retryCount: partial.retryCount,
		originalError: partial.originalError,
		metadata: partial.metadata
	};
}

/**
 * Extracts context from an Error object if it has context attached.
 */
export function extractErrorContext(error: Error): Partial<ErrorContext> {
	const context: Partial<ErrorContext> = {};

	// Check for common context properties
	const contextKeys: (keyof ErrorContext)[] = [
		'provider',
		'model',
		'profileId',
		'status',
		'requestId',
		'sessionId',
		'turnId',
		'timestamp',
		'retryCount'
	];

	for (const key of contextKeys) {
		if (key in error) {
			const value = (error as unknown as Record<string, unknown>)[key];
			if (value !== undefined) {
				(context as Record<string, unknown>)[key] = value;
			}
		}
	}

	return context;
}

/**
 * Provider error context - specific to LLM provider errors.
 */
export interface ProviderErrorContext extends ErrorContext {
	/** Provider-specific error code */
	providerCode?: string;
	/** Provider-specific error type */
	providerType?: string;
	/** Whether this is a streaming error */
	isStreaming?: boolean;
	/** Number of tokens in the request (if known) */
	requestTokenCount?: number;
}

/**
 * Tool error context - specific to tool execution errors.
 */
export interface ToolErrorContext extends ErrorContext {
	/** Name of the tool that failed */
	toolName?: string;
	/** Arguments passed to the tool */
	toolArgs?: Record<string, unknown>;
	/** Tool execution duration in ms */
	executionMs?: number;
}

/**
 * Validation error context - specific to bad request errors.
 */
export interface ValidationErrorContext extends ErrorContext {
	/** Field that failed validation */
	field?: string;
	/** Validation rule that failed */
	rule?: string;
	/** Value that was provided */
	providedValue?: unknown;
}
