/**
 * Validation Types - Result type for error handling and validation
 *
 * ## Purpose
 * Provides a type-safe Result type for handling success/failure outcomes
 * without relying on exceptions or unsafe type casts.
 *
 * ## Result Type
 *
 * The Result type represents either a successful value or an error:
 * - `{ ok: true, value: T }` - Success with a value of type T
 * - `{ ok: false, error: E }` - Failure with an error of type E
 *
 * ## Benefits
 *
 * 1. **Explicit error handling** - No silent failures or unhandled exceptions
 * 2. **Type-safe** - TypeScript narrows the type in each branch
 * 3. **No more `as any`** - Avoid unsafe casts for error handling
 * 4. **Composable** - Easy to chain and transform with map/flatMap
 *
 * ## Usage Pattern
 *
 * ```typescript
 * // Instead of: function parse(s: string): someType { ... }
 * // Use:
 * function parse(s: string): Result<someType, ParseError> {
 *   try {
 *     return ok(JSON.parse(s));
 *   } catch (e) {
 *     return err(new ParseError(e));
 *   }
 * }
 *
 * // Consumer code:
 * const result = parse(input);
 * if (result.ok) {
 *   console.log(result.value); // TypeScript knows value exists
 * } else {
 *   console.error(result.error); // TypeScript knows error exists
 * }
 * ```
 *
 * ## Alternative to try/catch
 *
 * ```typescript
 * // Verbose try/catch
 * let value: SomeType;
 * try {
 *   value = riskyOperation();
 * } catch (e) {
 *   handleError(e);
 *   return;
 * }
 *
 * // Clean Result pattern
 * const result = safeOperation();
 * if (!result.ok) {
 *   handleError(result.error);
 *   return;
 * }
 * const value = result.value;
 * ```
 */

/**
 * Result type for handling success/failure outcomes
 *
 * @typeParam T - The success value type
 * @typeParam E - The error type (defaults to Error)
 *
 * @example
 * ```typescript
 * // Success case
 * const success: Result<number, Error> = { ok: true, value: 42 };
 *
 * // Failure case
 * const failure: Result<number, Error> = { ok: false, error: new Error('oops') };
 * ```
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Type guard to check if a Result is successful
 *
 * @param result - The Result to check
 * @returns True if the result is successful
 *
 * @example
 * ```typescript
 * const result = doSomething();
 * if (isOk(result)) {
 *   console.log(result.value); // TypeScript knows this is safe
 * }
 * ```
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
	return result.ok === true;
}

/**
 * Type guard to check if a Result is an error
 *
 * @param result - The Result to check
 * @returns True if the result is an error
 *
 * @example
 * ```typescript
 * const result = doSomething();
 * if (isErr(result)) {
 *   console.error(result.error); // TypeScript knows this is safe
 * }
 * ```
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
	return result.ok === false;
}

/**
 * Create a successful Result
 *
 * @param value - The success value
 * @returns A successful Result containing the value
 *
 * @example
 * ```typescript
 * return ok({ user: 'Alice', age: 30 });
 * ```
 */
export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

/**
 * Create an error Result
 *
 * @param error - The error value
 * @returns An error Result containing the error
 *
 * @example
 * ```typescript
 * return err(new ValidationError('Invalid input'));
 * ```
 */
export function err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

/**
 * Map over the success value of a Result
 *
 * @param result - The Result to transform
 * @param fn - Function to apply to the success value
 * @returns A new Result with the transformed value
 *
 * @example
 * ```typescript
 * const result = ok(5);
 * const doubled = map(result, n => n * 2); // ok(10)
 * ```
 */
export function map<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
	if (result.ok) {
		return ok(fn(result.value));
	}
	return result;
}

/**
 * FlatMap (chain) Results together
 *
 * @param result - The Result to chain
 * @param fn - Function that returns a Result
 * @returns The Result from fn if successful, otherwise the error
 *
 * @example
 * ```typescript
 * const result = ok(5);
 * const chained = flatMap(result, n => n > 0 ? ok(n * 2) : err('negative'));
 * ```
 */
export function flatMap<T, E, U>(
	result: Result<T, E>,
	fn: (value: T) => Result<U, E>
): Result<U, E> {
	if (result.ok) {
		return fn(result.value);
	}
	return result;
}

/**
 * Get the value from a Result, or a default if error
 *
 * @param result - The Result
 * @param defaultValue - Value to return if error
 * @returns The success value or default
 *
 * @example
 * ```typescript
 * const result = ok(5);
 * unwrapOr(result, 0); // 5
 *
 * const error = err('oops');
 * unwrapOr(error, 0); // 0
 * ```
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
	if (result.ok) {
		return result.value;
	}
	return defaultValue;
}

/**
 * Get the value from a Result, or throw if error
 *
 * @param result - The Result
 * @returns The success value
 * @throws The error if Result is an error
 *
 * @example
 * ```typescript
 * const result = ok(5);
 * unwrap(result); // 5
 *
 * const error = err(new Error('oops'));
 * unwrap(error); // throws Error('oops')
 * ```
 */
export function unwrap<T, E>(result: Result<T, E>): T {
	if (result.ok) {
		return result.value;
	}
	throw result.error;
}

/**
 * Convert a Result to an optional
 *
 * @param result - The Result to convert
 * @returns The value if success, undefined if error
 *
 * @example
 * ```typescript
 * const result = ok(5);
 * toOptional(result); // 5
 *
 * const error = err(new Error('oops'));
 * toOptional(error); // undefined
 * ```
 */
export function toOptional<T, E>(result: Result<T, E>): T | undefined {
	if (result.ok) {
		return result.value;
	}
	return undefined;
}
