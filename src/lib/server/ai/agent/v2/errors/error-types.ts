/**
 * Error Types - Error definitions for the agent
 *
 * Defines custom error types with codes and recovery strategies.
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error codes enum
 */
export enum ErrorCode {
	// LLM Errors
	LLM_REQUEST_FAILED = 'llm_request_failed',
	LLM_TIMEOUT = 'llm_timeout',
	LLM_RATE_LIMITED = 'llm_rate_limited',
	LLM_AUTH_FAILED = 'llm_auth_failed',
	LLM_MODEL_NOT_FOUND = 'llm_model_not_found',
	LLM_CONTEXT_TOO_LONG = 'llm_context_too_long',
	LLM_PROVIDER_UNAVAILABLE = 'llm_provider_unavailable',

	// Tool Errors
	TOOL_NOT_FOUND = 'tool_not_found',
	TOOL_VALIDATION_FAILED = 'tool_validation_failed',
	TOOL_EXECUTION_FAILED = 'tool_execution_failed',
	TOOL_RATE_LIMITED = 'tool_rate_limited',
	TOOL_TIMEOUT = 'tool_timeout',

	// Execution Errors
	EXECUTION_TIMEOUT = 'execution_timeout',
	EXECUTION_MAX_ITERATIONS = 'execution_max_iterations',
	EXECUTION_ABORTED = 'execution_aborted',
	EXECUTION_FAILED = 'execution_failed',

	// Session Errors
	SESSION_NOT_FOUND = 'session_not_found',
	SESSION_EXPIRED = 'session_expired',
	SESSION_INVALID = 'session_invalid',

	// Configuration Errors
	CONFIG_INVALID = 'config_invalid',
	CONFIG_MISSING_API_KEY = 'config_missing_api_key',

	// Hook Errors
	HOOK_BLOCKED = 'hook_blocked',
	HOOK_TIMEOUT = 'hook_timeout',
	HOOK_ERROR = 'hook_error',

	// General Errors
	UNKNOWN = 'unknown_error',
	INTERNAL = 'internal_error'
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Agent error base class
 */
export class AgentError extends Error {
	constructor(
		message: string,
		public readonly code: ErrorCode,
		public readonly recoverable: boolean = false,
		public readonly context?: Record<string, unknown>
	) {
		super(message);
		this.name = 'AgentError';
	}

	/**
	 * Create from plain error
	 */
	static fromError(error: unknown, code: ErrorCode = ErrorCode.UNKNOWN): AgentError {
		if (error instanceof AgentError) {
			return error;
		}

		const message = error instanceof Error ? error.message : String(error);
		return new AgentError(message, code, false);
	}
}

/**
 * LLM Error
 */
export class LlmError extends AgentError {
	constructor(
		message: string,
		code: ErrorCode,
		public readonly provider?: string,
		public readonly statusCode?: number,
		recoverable: boolean = false,
		context?: Record<string, unknown>
	) {
		super(message, code, recoverable, { ...context, provider, statusCode });
		this.name = 'LlmError';
	}
}

/**
 * Tool Error
 */
export class ToolError extends AgentError {
	constructor(
		message: string,
		code: ErrorCode,
		public readonly toolName?: string,
		recoverable: boolean = false,
		context?: Record<string, unknown>
	) {
		super(message, code, recoverable, { ...context, toolName });
		this.name = 'ToolError';
	}
}

/**
 * Execution Error
 */
export class ExecutionError extends AgentError {
	constructor(
		message: string,
		code: ErrorCode,
		public readonly iteration?: number,
		recoverable: boolean = false,
		context?: Record<string, unknown>
	) {
		super(message, code, recoverable, { ...context, iteration });
		this.name = 'ExecutionError';
	}
}

/**
 * Configuration Error
 */
export class ConfigError extends AgentError {
	constructor(message: string, code: ErrorCode, context?: Record<string, unknown>) {
		super(message, code, false, context);
		this.name = 'ConfigError';
	}
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Check if error is recoverable
 */
export function isRecoverable(error: unknown): boolean {
	if (error instanceof AgentError) {
		return error.recoverable;
	}
	return false;
}

/**
 * Get error code
 */
export function getErrorCode(error: unknown): ErrorCode {
	if (error instanceof AgentError) {
		return error.code;
	}
	return ErrorCode.UNKNOWN;
}

/**
 * Get error message
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

/**
 * Check if error is LLM rate limit
 */
export function isRateLimitError(error: unknown): boolean {
	const code = getErrorCode(error);
	return code === ErrorCode.LLM_RATE_LIMITED || code === ErrorCode.TOOL_RATE_LIMITED;
}

/**
 * Check if error is timeout
 */
export function isTimeoutError(error: unknown): boolean {
	const code = getErrorCode(error);
	return code === ErrorCode.LLM_TIMEOUT || code === ErrorCode.TOOL_TIMEOUT || code === ErrorCode.EXECUTION_TIMEOUT;
}

/**
 * Check if error is authentication failure
 */
export function isAuthError(error: unknown): boolean {
	const code = getErrorCode(error);
	return code === ErrorCode.LLM_AUTH_FAILED || code === ErrorCode.CONFIG_MISSING_API_KEY;
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: unknown): string {
	if (error instanceof AgentError) {
		switch (error.code) {
			case ErrorCode.LLM_AUTH_FAILED:
			case ErrorCode.CONFIG_MISSING_API_KEY:
				return 'Invalid API key. Please check your AI settings.';
			case ErrorCode.LLM_RATE_LIMITED:
				return 'Rate limit exceeded. Please try again in a moment.';
			case ErrorCode.LLM_TIMEOUT:
				return 'The AI service is taking too long. Please try again.';
			case ErrorCode.LLM_PROVIDER_UNAVAILABLE:
				return 'The AI service is currently unavailable. Please try again later.';
			case ErrorCode.TOOL_NOT_FOUND:
				return `Tool not found: ${(error as ToolError).toolName}`;
			case ErrorCode.EXECUTION_MAX_ITERATIONS:
				return 'Maximum iterations reached. The task may be too complex.';
			case ErrorCode.EXECUTION_TIMEOUT:
				return 'Execution timed out. The task may be too complex.';
			default:
				return error.message;
		}
	}

	if (error instanceof Error) {
		return error.message;
	}

	return 'An unexpected error occurred.';
}

/**
 * Create error from HTTP response
 */
export function createErrorFromResponse(
	status: number,
	message: string,
	provider?: string
): LlmError {
	let code: ErrorCode;
	let recoverable = false;

	switch (status) {
		case 401:
			code = ErrorCode.LLM_AUTH_FAILED;
			break;
		case 429:
			code = ErrorCode.LLM_RATE_LIMITED;
			recoverable = true;
			break;
		case 404:
			code = ErrorCode.LLM_MODEL_NOT_FOUND;
			break;
		case 503:
			code = ErrorCode.LLM_PROVIDER_UNAVAILABLE;
			recoverable = true;
			break;
		case 400:
			code = ErrorCode.LLM_CONTEXT_TOO_LONG;
			break;
		default:
			code = ErrorCode.LLM_REQUEST_FAILED;
			recoverable = status >= 500;
	}

	return new LlmError(message, code, provider, status, recoverable);
}
