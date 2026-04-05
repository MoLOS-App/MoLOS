/**
 * Agent Error Classes - Structured error handling for the MoLOS Agent
 *
 * This module provides structured error classes with error codes, failover reasons,
 * and context for proper error handling and debugging.
 */

// Import from codes module
import {
	ErrorCode,
	FailoverReason,
	isRetriableCode,
	getRecoveryAction,
	type RecoveryAction,
	HTTP_STATUS_TO_CODE,
	isRetriableReason,
	getErrorCodeFromStatus,
	getFailoverReasonFromStatus
} from './codes.js';
import { type ErrorContext, createErrorContext } from './context.js';

// Re-export codes and context
export {
	ErrorCode,
	FailoverReason,
	HTTP_STATUS_TO_CODE,
	isRetriableCode,
	isRetriableReason,
	getRecoveryAction,
	getErrorCodeFromStatus,
	getFailoverReasonFromStatus
} from './codes.js';
export type { RecoveryAction } from './codes.js';
export { type ErrorContext, createErrorContext } from './context.js';

// Re-export legacy types for backward compatibility
export type { FailoverReason as LegacyFailoverReason } from '../providers/error-classifier.js';

/**
 * Type alias for error code for convenience
 */
export type AgentErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Type alias for failover reason for convenience
 */
export type AgentFailoverReason = (typeof FailoverReason)[keyof typeof FailoverReason];

/**
 * Options for creating an AgentError.
 */
export interface AgentErrorOptions {
	/** Structured error code */
	code: AgentErrorCode;
	/** Failover reason category */
	reason: AgentFailoverReason;
	/** Human-readable error message */
	message: string;
	/** Additional context for debugging */
	context?: ErrorContext;
	/** Original error that was wrapped (if any) */
	originalError?: unknown;
}

/**
 * Structured error class for agent failures.
 *
 * Provides:
 * - Error codes for programmatic error identification
 * - Failover reasons for routing decisions
 * - Error context for debugging
 * - JSON serialization for logging
 */
export class AgentError extends Error {
	/** Structured error code */
	readonly code: AgentErrorCode;

	/** Failover reason category */
	readonly reason: AgentFailoverReason;

	/** Error context for debugging */
	readonly context: ErrorContext;

	/** Original error that was wrapped (if any) */
	readonly originalError: unknown;

	constructor(options: AgentErrorOptions);
	constructor(
		code: AgentErrorCode,
		reason: AgentFailoverReason,
		message: string,
		context?: ErrorContext
	);
	constructor(
		optionsOrCode: AgentErrorOptions | AgentErrorCode,
		reasonOrMessage?: AgentFailoverReason | ErrorContext,
		messageOrContext?: string | ErrorContext,
		contextArg?: ErrorContext
	) {
		let code: AgentErrorCode;
		let reason: AgentFailoverReason;
		let message: string;
		let originalError: unknown;
		let context: ErrorContext | undefined;

		if (typeof optionsOrCode === 'object' && 'code' in optionsOrCode) {
			// Object pattern: AgentError({ code, reason, message, context })
			code = optionsOrCode.code;
			reason = optionsOrCode.reason;
			message = optionsOrCode.message;
			context = optionsOrCode.context;
			originalError = optionsOrCode.originalError;
		} else {
			// Positional pattern: AgentError(code, reason, message, context)
			code = optionsOrCode;
			reason = reasonOrMessage as AgentFailoverReason;
			message = typeof messageOrContext === 'string' ? messageOrContext : '';
			context = typeof messageOrContext === 'object' ? messageOrContext : contextArg;
			originalError = undefined;
		}

		super(message);
		this.name = 'AgentError';
		this.code = code;
		this.reason = reason;
		this.context = context ?? {};
		this.originalError = originalError;

		// Maintains proper stack trace for V8 engines
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, AgentError);
		}
	}

	/**
	 * Whether this error can be retried.
	 */
	get retriable(): boolean {
		return isRetriableCode(this.code);
	}

	/**
	 * Suggested recovery action for this error.
	 */
	get recovery(): RecoveryAction {
		return getRecoveryAction(this.code);
	}

	/**
	 * Legacy type property for backward compatibility.
	 * Maps ErrorCode to the old type strings used by agent-loop.
	 * @deprecated Use code property instead
	 */
	get type(): string {
		switch (this.code) {
			case ErrorCode.TIMEOUT:
				return 'timeout';
			case ErrorCode.CONTEXT_OVERFLOW:
				return 'context_overflow';
			case ErrorCode.PROVIDER_ERROR:
				return 'provider_error';
			case ErrorCode.AUTH_ERROR:
				return 'auth_error';
			case ErrorCode.RATE_LIMIT:
				return 'rate_limit';
			case ErrorCode.TOOL_ERROR:
				return 'tool_error';
			case ErrorCode.NETWORK_ERROR:
				return 'provider_error'; // Map to provider_error for compatibility
			case ErrorCode.PANIC_ERROR:
				return 'unknown';
			case ErrorCode.MODEL_NOT_FOUND:
				return 'unknown';
			case ErrorCode.BILLING_ERROR:
				return 'unknown';
			case ErrorCode.HOOK_ERROR:
				return 'tool_error';
			case ErrorCode.BAD_REQUEST:
			case ErrorCode.UNKNOWN:
			default:
				return 'unknown';
		}
	}

	/**
	 * HTTP status code if available from context.
	 */
	get status(): number | undefined {
		return this.context.status;
	}

	/**
	 * Provider name if available from context.
	 */
	get provider(): string | undefined {
		return this.context.provider;
	}

	/**
	 * Model name if available from context.
	 */
	get model(): string | undefined {
		return this.context.model;
	}

	/**
	 * Whether this error should trigger failover to next provider.
	 * Non-retriable errors (format, auth) should not trigger failover.
	 */
	get shouldFailover(): boolean {
		return this.retriable;
	}

	/**
	 * Whether this error represents a context overflow.
	 */
	get isContextOverflow(): boolean {
		return this.code === ErrorCode.CONTEXT_OVERFLOW;
	}

	/**
	 * Whether this error represents a rate limit.
	 */
	get isRateLimit(): boolean {
		return this.code === ErrorCode.RATE_LIMIT;
	}

	/**
	 * Whether this error represents an auth failure.
	 */
	get isAuthError(): boolean {
		return this.code === ErrorCode.AUTH_ERROR;
	}

	/**
	 * Whether this error represents a timeout.
	 */
	get isTimeout(): boolean {
		return this.code === ErrorCode.TIMEOUT;
	}

	/**
	 * Serialize error to JSON for logging.
	 */
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			code: this.code,
			reason: this.reason,
			message: this.message,
			retriable: this.retriable,
			recovery: this.recovery,
			context: this.context,
			stack: this.stack,
			originalError:
				this.originalError instanceof Error
					? { name: this.originalError.name, message: this.originalError.message }
					: this.originalError
		};
	}

	/**
	 * Create a string representation of the error.
	 */
	override toString(): string {
		return `[${this.code}] ${this.reason}: ${this.message}`;
	}

	/**
	 * Create from a generic error with classification.
	 */
	static from(error: unknown, options?: Partial<AgentErrorOptions>): AgentError {
		if (error instanceof AgentError) {
			return error;
		}

		const message = error instanceof Error ? error.message : String(error);
		const originalError = error instanceof Error ? error : new Error(message);

		return new AgentError({
			code: options?.code ?? ErrorCode.UNKNOWN,
			reason: options?.reason ?? 'unknown',
			message: options?.message ?? message,
			context: options?.context,
			originalError
		});
	}

	/**
	 * Create a timeout error.
	 */
	static timeout(message: string, context?: ErrorContext): AgentError {
		return new AgentError(ErrorCode.TIMEOUT, 'timeout', message, createErrorContext(context));
	}

	/**
	 * Create a context overflow error.
	 */
	static contextOverflow(message: string, context?: ErrorContext): AgentError {
		return new AgentError(
			ErrorCode.CONTEXT_OVERFLOW,
			'context_overflow',
			message,
			createErrorContext(context)
		);
	}

	/**
	 * Create a rate limit error.
	 */
	static rateLimit(message: string, context?: ErrorContext): AgentError {
		return new AgentError(ErrorCode.RATE_LIMIT, 'rate_limit', message, createErrorContext(context));
	}

	/**
	 * Create an auth error.
	 */
	static auth(message: string, context?: ErrorContext): AgentError {
		return new AgentError(ErrorCode.AUTH_ERROR, 'auth', message, createErrorContext(context));
	}

	/**
	 * Create a provider error.
	 */
	static provider(message: string, context?: ErrorContext): AgentError {
		return new AgentError(
			ErrorCode.PROVIDER_ERROR,
			'server_error',
			message,
			createErrorContext(context)
		);
	}

	/**
	 * Create a tool error.
	 */
	static tool(message: string, context?: ErrorContext): AgentError {
		return new AgentError(ErrorCode.TOOL_ERROR, 'unknown', message, createErrorContext(context));
	}

	/**
	 * Create a bad request error.
	 */
	static badRequest(message: string, context?: ErrorContext): AgentError {
		return new AgentError(ErrorCode.BAD_REQUEST, 'unknown', message, createErrorContext(context));
	}

	/**
	 * Create a billing error.
	 */
	static billing(message: string, context?: ErrorContext): AgentError {
		return new AgentError(ErrorCode.BILLING_ERROR, 'billing', message, createErrorContext(context));
	}
}

/**
 * Provider-specific error with additional provider context.
 */
export class ProviderError extends AgentError {
	constructor(options: AgentErrorOptions & { provider: string; model?: string }) {
		super({
			...options,
			context: createErrorContext({
				...options.context,
				provider: options.provider,
				model: options.model
			})
		});
		this.name = 'ProviderError';
	}

	override get provider(): string {
		return this.context.provider ?? 'unknown';
	}

	override get model(): string | undefined {
		return this.context.model;
	}
}

/**
 * Tool execution error.
 */
export class ToolError extends AgentError {
	readonly toolName: string;

	constructor(toolName: string, message: string, context?: ErrorContext) {
		super(
			ErrorCode.TOOL_ERROR,
			'unknown',
			`Tool '${toolName}' failed: ${message}`,
			createErrorContext({ ...context, metadata: { ...context?.metadata, toolName } })
		);
		this.name = 'ToolError';
		this.toolName = toolName;
	}

	override toString(): string {
		return `[${this.code}] ${this.reason}: Tool '${this.toolName}' failed: ${this.message}`;
	}
}

/**
 * Validation error for bad requests.
 */
export class ValidationError extends AgentError {
	readonly field?: string;
	readonly providedValue?: unknown;

	constructor(message: string, field?: string, providedValue?: unknown, context?: ErrorContext) {
		super(
			ErrorCode.BAD_REQUEST,
			'unknown',
			message,
			createErrorContext({
				...context,
				metadata: {
					...context?.metadata,
					validationField: field,
					validationValue: providedValue
				}
			})
		);
		this.name = 'ValidationError';
		this.field = field;
		this.providedValue = providedValue;
	}
}

/**
 * Panic error - indicates provider crash or unexpected failure.
 */
export class PanicError extends AgentError {
	constructor(message: string, context?: ErrorContext) {
		super(ErrorCode.PANIC_ERROR, 'unknown', `PANIC: ${message}`, createErrorContext(context));
		this.name = 'PanicError';
	}
}

/**
 * FallbackExhaustedError - All fallback providers have been exhausted.
 */
export class FallbackExhaustedError extends AgentError {
	readonly attempts: AgentError[];

	constructor(attempts: AgentError[], message?: string) {
		super(
			ErrorCode.PROVIDER_ERROR,
			'unknown',
			message ?? `All fallback providers exhausted after ${attempts.length} attempts`,
			{
				metadata: { attempts: attempts.map((a) => a.toJSON()) }
			}
		);
		this.name = 'FallbackExhaustedError';
		this.attempts = attempts;
	}

	/**
	 * Get the last error that occurred.
	 */
	get lastError(): AgentError | undefined {
		return this.attempts[this.attempts.length - 1];
	}
}
