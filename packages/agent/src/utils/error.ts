/**
 * Error Handling Utilities - Consistent error handling with Result type
 *
 * ## Purpose
 * Provides utility functions for consistent error handling across the agent package.
 * Wraps operations that may throw into Result types for explicit error handling.
 *
 * ## Key Functions
 *
 * ### toResult / toResultAsync
 * Wrap sync or async functions to return Result instead of throwing:
 * ```typescript
 * // Instead of throwing:
 * function parse(input: string): SomeType {
 *   if (!isValid(input)) throw new Error('Invalid input');
 *   return doParse(input);
 * }
 *
 * // Use toResult:
 * function parse(input: string): Result<SomeType, AgentError> {
 *   return toResult(() => {
 *     if (!isValid(input)) throw new AgentError.badRequest('Invalid input');
 *     return doParse(input);
 *   });
 * }
 * ```
 *
 * ### Error Factory Functions
 * Create common errors with consistent formatting:
 * ```typescript
 * invalidInput('Missing required field', { field: 'email' })
 * toolNotFound('get_weather')
 * contextOverflow('Message history exceeds context window')
 * ```
 *
 * ## Usage with AgentError
 * These utilities work seamlessly with the AgentError class from ../errors/index.ts:
 * - AgentError.timeout() - for timeout errors
 * - AgentError.contextOverflow() - for context overflow
 * - AgentError.rateLimit() - for rate limits
 * - AgentError.auth() - for auth errors
 * - AgentError.provider() - for provider errors
 * - AgentError.tool() - for tool errors
 * - AgentError.badRequest() - for bad requests
 */

import { err, ok, isOk, isErr, type Result } from '../types/validation.js';
import { AgentError, ErrorCode, FailoverReason } from '../errors/index.js';

// Re-export Result utilities for convenience
export { ok, err, isOk, isErr } from '../types/validation.js';
export type { Result } from '../types/validation.js';

/**
 * Wrap a synchronous function to return Result instead of throwing.
 *
 * Catches any thrown error and wraps it in an AgentError if it isn't already one.
 * Unknown errors are wrapped with ErrorCode.UNKNOWN.
 *
 * @param fn - The synchronous function to wrap
 * @returns Result containing the function's return value or an AgentError
 *
 * @example
 * ```typescript
 * const result = toResult(() => JSON.parse(userInput));
 * if (!result.ok) {
 *   console.error('Parse failed:', result.error.message);
 * }
 * ```
 */
export function toResult<T>(fn: () => T): Result<T, AgentError> {
	try {
		return ok(fn());
	} catch (e) {
		return err(errorToAgentError(e));
	}
}

/**
 * Wrap an asynchronous function to return Result instead of throwing.
 *
 * Catches any thrown error and wraps it in an AgentError if it isn't already one.
 * Unknown errors are wrapped with ErrorCode.UNKNOWN.
 *
 * @param fn - The asynchronous function to wrap
 * @returns Promise resolving to Result containing the function's return value or an AgentError
 *
 * @example
 * ```typescript
 * const result = await toResultAsync(() => fetchUserData(userId));
 * if (!result.ok) {
 *   console.error('Fetch failed:', result.error.message);
 * }
 * ```
 */
export async function toResultAsync<T>(fn: () => Promise<T>): Promise<Result<T, AgentError>> {
	try {
		const value = await fn();
		return ok(value);
	} catch (e) {
		return err(errorToAgentError(e));
	}
}

/**
 * Map over the success value of a Result.
 *
 * If the Result is an error, it's returned unchanged.
 * If successful, the function is applied to the value.
 *
 * @param result - The Result to transform
 * @param fn - Function to apply to the success value
 * @returns New Result with transformed value or original error
 *
 * @example
 * ```typescript
 * const result = mapResult(ok(5), n => n * 2); // ok(10)
 * const error = mapResult(err(e), n => n * 2); // err(e)
 * ```
 */
export function mapResult<T, U>(
	result: Result<T, AgentError>,
	fn: (value: T) => U
): Result<U, AgentError> {
	// Use isErr for explicit type narrowing
	if (isErr(result)) {
		return result as Result<U, AgentError>;
	}
	try {
		return ok(fn(result.value));
	} catch (e) {
		return err(errorToAgentError(e));
	}
}

/**
 * Map over the error value of a Result.
 *
 * If the Result is successful, it's returned unchanged.
 * If an error, the function is applied to transform the error.
 *
 * @param result - The Result to transform
 * @param fn - Function to apply to the error
 * @returns New Result with transformed error or original value
 *
 * @example
 * ```typescript
 * const result = mapErr(ok(5), e => new CustomError(e.message)); // ok(5)
 * const error = mapErr(err(e), e => new CustomError(e.message)); // err(CustomError)
 * ```
 */
export function mapErr<T>(
	result: Result<T, AgentError>,
	fn: (error: AgentError) => AgentError
): Result<T, AgentError> {
	// Use isOk for explicit type narrowing
	if (isOk(result)) {
		return result as Result<T, AgentError>;
	}
	try {
		return err(fn(result.error));
	} catch (e) {
		return err(errorToAgentError(e));
	}
}

/**
 * FlatMap (chain) a Result with an async function.
 *
 * If the Result is an error, it's returned unchanged.
 * If successful, the function is applied to the value and its Result is returned.
 *
 * @param result - The Result to chain
 * @param fn - Function that returns a Result
 * @returns Promise resolving to the chained Result
 *
 * @example
 * ```typescript
 * const result = await flatMapAsync(
 *   ok(userId),
 *   id => toResultAsync(() => fetchUser(id))
 * );
 * ```
 */
export async function flatMapAsync<T, U>(
	result: Result<T, AgentError>,
	fn: (value: T) => Promise<Result<U, AgentError>>
): Promise<Result<U, AgentError>> {
	// Use isErr for explicit type narrowing
	if (isErr(result)) {
		return result as Result<U, AgentError>;
	}
	return fn(result.value);
}

/**
 * FlatMap (chain) a Result with a synchronous function.
 *
 * If the Result is an error, it's returned unchanged.
 * If successful, the function is applied to the value and its Result is returned.
 *
 * @param result - The Result to chain
 * @param fn - Function that returns a Result
 * @returns The chained Result
 *
 * @example
 * ```typescript
 * const result = flatMap(
 *   ok(userId),
 *   id => validateUser(id)
 * );
 * ```
 */
export function flatMap<T, U>(
	result: Result<T, AgentError>,
	fn: (value: T) => Result<U, AgentError>
): Result<U, AgentError> {
	// Use isErr for explicit type narrowing
	if (isErr(result)) {
		return result as Result<U, AgentError>;
	}
	try {
		return fn(result.value);
	} catch (e) {
		return err(errorToAgentError(e));
	}
}

/**
 * Convert any error to an AgentError.
 *
 * If the error is already an AgentError, it's returned unchanged.
 * Otherwise, wraps the error with ErrorCode.UNKNOWN.
 *
 * @param error - The error to convert
 * @returns An AgentError instance
 */
export function errorToAgentError(error: unknown): AgentError {
	if (error instanceof AgentError) {
		return error;
	}
	const message = error instanceof Error ? error.message : String(error);
	const originalError = error instanceof Error ? error : undefined;
	return new AgentError({
		code: ErrorCode.UNKNOWN,
		reason: FailoverReason.unknown,
		message,
		originalError
	});
}

// =============================================================================
// Error Factory Functions
// =============================================================================

/**
 * Create a bad request (invalid input) error.
 *
 * @param message - Human-readable error message
 * @param context - Additional context for debugging
 * @returns AgentError with BAD_REQUEST code
 *
 * @example
 * ```typescript
 * return err(invalidInput('Email is required', { field: 'email' }));
 * ```
 */
export function invalidInput(message: string, context?: Record<string, unknown>): AgentError {
	return new AgentError({
		code: ErrorCode.BAD_REQUEST,
		reason: FailoverReason.unknown,
		message,
		context: { metadata: context }
	});
}

/**
 * Create a tool not found error.
 *
 * @param toolName - Name of the tool that was not found
 * @returns AgentError with TOOL_ERROR code
 *
 * @example
 * ```typescript
 * return err(toolNotFound('get_weather'));
 * ```
 */
export function toolNotFound(toolName: string): AgentError {
	return new AgentError({
		code: ErrorCode.TOOL_ERROR,
		reason: FailoverReason.unknown,
		message: `Tool not found: ${toolName}`,
		context: { metadata: { toolName } }
	});
}

/**
 * Create a context overflow error.
 *
 * @param message - Human-readable error message
 * @param context - Additional context for debugging
 * @returns AgentError with CONTEXT_OVERFLOW code
 *
 * @example
 * ```typescript
 * return err(contextOverflow('Message history exceeds context window'));
 * ```
 */
export function contextOverflow(message: string, context?: Record<string, unknown>): AgentError {
	return new AgentError({
		code: ErrorCode.CONTEXT_OVERFLOW,
		reason: FailoverReason.context_overflow,
		message,
		context: { metadata: context }
	});
}

/**
 * Create a timeout error.
 *
 * @param message - Human-readable error message
 * @param context - Additional context for debugging
 * @returns AgentError with TIMEOUT code
 *
 * @example
 * ```typescript
 * return err(timeout('Provider request timed out after 30s'));
 * ```
 */
export function timeout(message: string, context?: Record<string, unknown>): AgentError {
	return new AgentError({
		code: ErrorCode.TIMEOUT,
		reason: FailoverReason.timeout,
		message,
		context: { metadata: context }
	});
}

/**
 * Create an authentication error.
 *
 * @param message - Human-readable error message
 * @param context - Additional context for debugging
 * @returns AgentError with AUTH_ERROR code
 *
 * @example
 * ```typescript
 * return err(authError('Invalid API key'));
 * ```
 */
export function authError(message: string, context?: Record<string, unknown>): AgentError {
	return new AgentError({
		code: ErrorCode.AUTH_ERROR,
		reason: FailoverReason.auth,
		message,
		context: { metadata: context }
	});
}

/**
 * Create a rate limit error.
 *
 * @param message - Human-readable error message
 * @param context - Additional context for debugging
 * @returns AgentError with RATE_LIMIT code
 *
 * @example
 * ```typescript
 * return err(rateLimit('Rate limit exceeded, retry after 60s'));
 * ```
 */
export function rateLimit(message: string, context?: Record<string, unknown>): AgentError {
	return new AgentError({
		code: ErrorCode.RATE_LIMIT,
		reason: FailoverReason.rate_limit,
		message,
		context: { metadata: context }
	});
}

/**
 * Create a provider error.
 *
 * @param message - Human-readable error message
 * @param context - Additional context for debugging
 * @returns AgentError with PROVIDER_ERROR code
 *
 * @example
 * ```typescript
 * return err(providerError('OpenAI API error: 500'));
 * ```
 */
export function providerError(message: string, context?: Record<string, unknown>): AgentError {
	return new AgentError({
		code: ErrorCode.PROVIDER_ERROR,
		reason: FailoverReason.server_error,
		message,
		context: { metadata: context }
	});
}

/**
 * Create a tool error.
 *
 * @param toolName - Name of the tool that failed
 * @param message - Human-readable error message
 * @param context - Additional context for debugging
 * @returns AgentError with TOOL_ERROR code
 *
 * @example
 * ```typescript
 * return err(toolError('get_weather', 'Failed to fetch weather data'));
 * ```
 */
export function toolError(
	toolName: string,
	message: string,
	context?: Record<string, unknown>
): AgentError {
	return new AgentError({
		code: ErrorCode.TOOL_ERROR,
		reason: FailoverReason.unknown,
		message: `Tool '${toolName}' failed: ${message}`,
		context: { metadata: { toolName, ...context } }
	});
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Assert that a value is not null or undefined, returning a Result.
 *
 * @param value - The value to check
 * @param error - The error to return if value is null/undefined
 * @returns ok(value) if not null/undefined, err(error) otherwise
 *
 * @example
 * ```typescript
 * const user = await toResultAsync(() => db.users.findById(id));
 * const name = await flatMapAsync(user, u =>
 *   fromOptional(u.name, invalidInput('User has no name'))
 * );
 * ```
 */
export function fromOptional<T>(
	value: T | null | undefined,
	error: AgentError
): Result<T, AgentError> {
	if (value === null || value === undefined) {
		return err(error);
	}
	return ok(value);
}

/**
 * Assert that a condition is true, returning a Result.
 *
 * @param condition - The condition to check
 * @param error - The error to return if condition is false
 * @returns ok(undefined) if condition is true, err(error) otherwise
 *
 * @example
 * ```typescript
 * const result = assert(user.isAdmin, authError('Not authorized'));
 * ```
 */
export function assert(condition: boolean, error: AgentError): Result<void, AgentError> {
	if (condition) {
		return ok(undefined);
	}
	return err(error);
}

/**
 * Unwrap a Result, throwing the error if it's an error Result.
 *
 * @param result - The Result to unwrap
 * @returns The value if successful
 * @throws The error if the Result is an error
 *
 * @example
 * ```typescript
 * const value = unwrapErr(ok(5)); // returns 5
 * unwrapErr(err(new Error('oops'))); // throws Error('oops')
 * ```
 */
export function unwrapErr<T>(result: Result<T, AgentError>): T {
	// Use isErr for explicit type narrowing
	if (isErr(result)) {
		throw result.error;
	}
	return result.value;
}
