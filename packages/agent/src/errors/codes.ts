/**
 * Error Code Enum - Structured error codes for agent failures
 *
 * These codes provide programmatic identification of error types
 * for proper error handling and failover decisions.
 *
 * ## Code Categories
 * - `TIMEOUT` - Request timed out
 * - `CONTEXT_OVERFLOW` - Context window exceeded
 * - `PROVIDER_ERROR` - Generic provider failure
 * - `AUTH_ERROR` - Authentication/authorization failure
 * - `RATE_LIMIT` - Rate limit exceeded
 * - `BAD_REQUEST` - Malformed request
 * - `UNKNOWN` - Unclassified error
 */

/**
 * Error codes for agent failures
 */
export const ErrorCode = {
	/** Request timed out */
	TIMEOUT: 'TIMEOUT',
	/** Context window exceeded - request too large */
	CONTEXT_OVERFLOW: 'CONTEXT_OVERFLOW',
	/** Generic provider error (5xx, etc.) */
	PROVIDER_ERROR: 'PROVIDER_ERROR',
	/** Authentication/authorization failure (401, 403) */
	AUTH_ERROR: 'AUTH_ERROR',
	/** Rate limit exceeded (429) */
	RATE_LIMIT: 'RATE_LIMIT',
	/** Bad request - malformed or invalid (400) */
	BAD_REQUEST: 'BAD_REQUEST',
	/** Model not found or not available */
	MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
	/** Billing/payment issue (402) */
	BILLING_ERROR: 'BILLING_ERROR',
	/** Network connectivity issue */
	NETWORK_ERROR: 'NETWORK_ERROR',
	/** Tool execution failed */
	TOOL_ERROR: 'TOOL_ERROR',
	/** Hook execution failed */
	HOOK_ERROR: 'HOOK_ERROR',
	/** Panic/crash signal from provider */
	PANIC_ERROR: 'PANIC_ERROR',
	/** Unclassified error - fallback */
	UNKNOWN: 'UNKNOWN'
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Failover reasons for provider switching decisions.
 * These are broader categories used for failover logic.
 */
export const FailoverReason = {
	/** Billing/payment required (402) */
	billing: 'billing',
	/** Rate limit exceeded (429) */
	rate_limit: 'rate_limit',
	/** Provider overloaded (503) */
	overloaded: 'overloaded',
	/** Authentication failure (401, 403) */
	auth: 'auth',
	/** Request timed out (408) */
	timeout: 'timeout',
	/** Context window exceeded */
	context_overflow: 'context_overflow',
	/** Model not found or unavailable */
	model_not_found: 'model_not_found',
	/** Network connectivity issue */
	network_error: 'network_error',
	/** Provider/server error (5xx) */
	server_error: 'server_error',
	/** Unclassified error */
	unknown: 'unknown'
} as const;

export type FailoverReason = (typeof FailoverReason)[keyof typeof FailoverReason];

/**
 * HTTP status codes mapped to error codes.
 * Used for classifying errors based on HTTP responses.
 */
export const HTTP_STATUS_TO_CODE: Record<number, ErrorCode> = {
	400: ErrorCode.BAD_REQUEST,
	401: ErrorCode.AUTH_ERROR,
	402: ErrorCode.BILLING_ERROR,
	403: ErrorCode.AUTH_ERROR,
	408: ErrorCode.TIMEOUT,
	429: ErrorCode.RATE_LIMIT,
	500: ErrorCode.PROVIDER_ERROR,
	502: ErrorCode.PROVIDER_ERROR,
	503: ErrorCode.PROVIDER_ERROR,
	504: ErrorCode.TIMEOUT
};

/**
 * HTTP status codes mapped to failover reasons.
 */
export const HTTP_STATUS_TO_REASON: Record<number, FailoverReason> = {
	400: 'unknown', // Bad request - may be format issue
	401: 'auth',
	402: 'billing',
	403: 'auth',
	408: 'timeout',
	429: 'rate_limit',
	500: 'server_error',
	502: 'server_error',
	503: 'overloaded',
	504: 'timeout'
};

/**
 * Maps ErrorCode to retriability.
 * Non-retriable errors should abort immediately.
 */
export const CODE_RETRIABLE: Record<ErrorCode, boolean> = {
	[ErrorCode.TIMEOUT]: true,
	[ErrorCode.CONTEXT_OVERFLOW]: false, // Compact or abort
	[ErrorCode.PROVIDER_ERROR]: true,
	[ErrorCode.AUTH_ERROR]: false, // Rotate auth or abort
	[ErrorCode.RATE_LIMIT]: true,
	[ErrorCode.BAD_REQUEST]: false, // Never retry bad requests
	[ErrorCode.MODEL_NOT_FOUND]: false,
	[ErrorCode.BILLING_ERROR]: false,
	[ErrorCode.NETWORK_ERROR]: true,
	[ErrorCode.TOOL_ERROR]: false,
	[ErrorCode.HOOK_ERROR]: false,
	[ErrorCode.PANIC_ERROR]: false,
	[ErrorCode.UNKNOWN]: true
};

/**
 * Maps FailoverReason to retriability.
 */
export const REASON_RETRIABLE: Record<FailoverReason, boolean> = {
	billing: false,
	rate_limit: true,
	overloaded: true,
	auth: false,
	timeout: true,
	context_overflow: false,
	model_not_found: false,
	network_error: true,
	server_error: true,
	unknown: true
};

/**
 * Maps ErrorCode to suggested recovery action.
 */
export const CODE_RECOVERY: Record<ErrorCode, RecoveryAction> = {
	[ErrorCode.TIMEOUT]: 'retry',
	[ErrorCode.CONTEXT_OVERFLOW]: 'compact',
	[ErrorCode.PROVIDER_ERROR]: 'retry',
	[ErrorCode.AUTH_ERROR]: 'rotate_auth',
	[ErrorCode.RATE_LIMIT]: 'retry',
	[ErrorCode.BAD_REQUEST]: 'abort',
	[ErrorCode.MODEL_NOT_FOUND]: 'abort',
	[ErrorCode.BILLING_ERROR]: 'abort',
	[ErrorCode.NETWORK_ERROR]: 'retry',
	[ErrorCode.TOOL_ERROR]: 'abort',
	[ErrorCode.HOOK_ERROR]: 'abort',
	[ErrorCode.PANIC_ERROR]: 'abort',
	[ErrorCode.UNKNOWN]: 'abort'
};

/**
 * Recovery actions suggested for errors.
 */
export type RecoveryAction = 'retry' | 'compact' | 'truncate' | 'rotate_auth' | 'abort';

/**
 * Get ErrorCode from HTTP status code.
 */
export function getErrorCodeFromStatus(status: number): ErrorCode {
	return HTTP_STATUS_TO_CODE[status] ?? ErrorCode.UNKNOWN;
}

/**
 * Get FailoverReason from HTTP status code.
 */
export function getFailoverReasonFromStatus(status: number): FailoverReason {
	return HTTP_STATUS_TO_REASON[status] ?? 'unknown';
}

/**
 * Check if an error code represents a retriable error.
 */
export function isRetriableCode(code: ErrorCode): boolean {
	return CODE_RETRIABLE[code] ?? true;
}

/**
 * Check if a failover reason represents a retriable error.
 */
export function isRetriableReason(reason: FailoverReason): boolean {
	return REASON_RETRIABLE[reason] ?? true;
}

/**
 * Get suggested recovery action for an error code.
 */
export function getRecoveryAction(code: ErrorCode): RecoveryAction {
	return CODE_RECOVERY[code] ?? 'abort';
}
