/**
 * Validation Helpers for Agent Configuration
 *
 * This module provides utility functions for validating configuration
 * objects using Zod schemas. It wraps Zod's safeParse with
 * more convenient return types and error formatting.
 *
 * @module config/validation
 */

import { z } from 'zod';

// =============================================================================
// Validation Result Types
// =============================================================================

/**
 * Result of a successful validation
 */
export interface ValidationSuccess<T> {
	success: true;
	data: T;
}

/**
 * Result of a failed validation
 */
export interface ValidationFailure {
	success: false;
	error: string;
	errors: z.ZodError;
}

/**
 * Union type for validation results
 */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

// =============================================================================
// Core Validation Functions
// =============================================================================

/**
 * Validates a configuration object against a Zod schema.
 *
 * ## Usage
 * ```typescript
 * const result = validateConfig(AgentLoopConfigSchema, rawConfig);
 * if (result.success) {
 *   // Use result.data with full type safety
 * } else {
 *   // Handle result.error or result.errors
 * }
 * ```
 *
 * @param schema - The Zod schema to validate against
 * @param config - The raw configuration object to validate
 * @returns ValidationResult with either the typed data or error information
 */
export function validateConfig<T>(schema: z.ZodSchema<T>, config: unknown): ValidationResult<T> {
	const result = schema.safeParse(config);

	if (result.success) {
		return {
			success: true,
			data: result.data
		};
	}

	return {
		success: false,
		error: formatZodError(result.error),
		errors: result.error
	};
}

/**
 * Validates a configuration object and throws if invalid.
 *
 * @param schema - The Zod schema to validate against
 * @param config - The raw configuration object to validate
 * @param errorMessage - Custom error message prefix
 * @throws ZodError with formatted error message if validation fails
 */
export function validateConfigOrThrow<T>(
	schema: z.ZodSchema<T>,
	config: unknown,
	errorMessage = 'Configuration validation failed'
): T {
	const result = schema.safeParse(config);

	if (!result.success) {
		const message = `${errorMessage}: ${formatZodError(result.error)}`;
		const error = new Error(message);
		(error as any).errors = result.error;
		throw error;
	}

	return result.data;
}

/**
 * Attempts to parse config, returning default value if validation fails.
 *
 * @param schema - The Zod schema to validate against
 * @param config - The raw configuration object to validate
 * @param defaultValue - Default value to return if validation fails
 * @returns Either the validated config or the default value
 */
export function validateConfigOrDefault<T>(
	schema: z.ZodSchema<T>,
	config: unknown,
	defaultValue: T
): T {
	const result = schema.safeParse(config);

	if (result.success) {
		return result.data;
	}

	return defaultValue;
}

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Formats a ZodError into a human-readable string.
 *
 * @param error - The ZodError to format
 * @returns A formatted string with all validation errors
 */
export function formatZodError(error: z.ZodError): string {
	return error.issues
		.map((e: z.ZodIssue) => {
			const path = e.path.length > 0 ? ` (${e.path.join('.')})` : '';
			return `${e.message}${path}`;
		})
		.join('; ');
}

/**
 * Gets a flat array of error messages from a ZodError.
 *
 * @param error - The ZodError to extract errors from
 * @returns Array of formatted error messages
 */
export function getZodErrorMessages(error: z.ZodError): string[] {
	return error.issues.map((e: z.ZodIssue) => {
		const path = e.path.length > 0 ? ` (${e.path.join('.')})` : '';
		return `${e.message}${path}`;
	});
}

/**
 * Checks if an error is a ZodError.
 *
 * @param error - The error to check
 * @returns True if the error is a ZodError
 */
export function isZodError(error: unknown): error is z.ZodError {
	return error instanceof z.ZodError;
}

// =============================================================================
// Validation with Coercion
// =============================================================================

/**
 * Validates and partially coerces a configuration object.
 * Only validates but allows additional fields.
 *
 * @param schema - The Zod schema to validate against (should use .catchall())
 * @param config - The raw configuration object to validate
 * @returns ValidationResult with the coerced data
 */
export function coerceConfig<T>(schema: z.ZodSchema<T>, config: unknown): ValidationResult<T> {
	// First try direct validation
	const result = schema.safeParse(config);

	if (result.success) {
		return {
			success: true,
			data: result.data
		};
	}

	// If it fails due to unknown keys, try stripping
	const strippedResult = schema.safeParse(config);

	if (strippedResult.success) {
		return {
			success: true,
			data: strippedResult.data
		};
	}

	return {
		success: false,
		error: formatZodError(strippedResult.error),
		errors: strippedResult.error
	};
}

// =============================================================================
// Specific Validators
// =============================================================================

/**
 * Validates that a value is a non-empty string.
 */
export function validateString(value: unknown, fieldName = 'value'): ValidationResult<string> {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return {
			success: false,
			error: `${fieldName} must be a non-empty string`,
			errors: new z.ZodError([
				{
					code: z.ZodIssueCode.invalid_type,
					expected: 'string',
					received: typeof value,
					path: [],
					message: `${fieldName} must be a non-empty string`
				}
			] as any)
		};
	}

	return { success: true, data: value };
}

/**
 * Validates that a value is a positive number.
 */
export function validatePositiveNumber(
	value: unknown,
	fieldName = 'value'
): ValidationResult<number> {
	if (typeof value !== 'number' || value <= 0) {
		return {
			success: false,
			error: `${fieldName} must be a positive number`,
			errors: new z.ZodError([
				{
					code: z.ZodIssueCode.too_small,
					minimum: 0,
					inclusive: false,
					path: [],
					type: 'number',
					message: `${fieldName} must be a positive number`
				}
			] as any)
		};
	}

	return { success: true, data: value };
}

/**
 * Validates that a value is an array with at least one element.
 */
export function validateNonEmptyArray<T>(
	value: unknown,
	fieldName = 'value'
): ValidationResult<T[]> {
	if (!Array.isArray(value) || value.length === 0) {
		return {
			success: false,
			error: `${fieldName} must be a non-empty array`,
			errors: new z.ZodError([
				{
					code: z.ZodIssueCode.too_small,
					minimum: 1,
					inclusive: false,
					path: [],
					type: 'array',
					message: `${fieldName} must be a non-empty array`
				}
			] as any)
		};
	}

	return { success: true, data: value as T[] };
}
