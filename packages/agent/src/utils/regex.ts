/**
 * Safe Regex Utilities - ReDoS Prevention
 *
 * Provides validation for user-provided regex patterns to prevent
 * Regular Expression Denial of Service (ReDoS) attacks.
 *
 * @module utils/regex
 */

import { ok, err, type Result } from '../types/index.js';
import { REGEX } from '../constants.js';

/**
 * Error thrown when a regex pattern is invalid or potentially dangerous
 */
export class RegexError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RegexError';
	}
}

/**
 * Validates and creates a RegExp from a user-provided pattern with ReDoS protection.
 *
 * ReDoS (Regular Expression Denial of Service) occurs when certain patterns cause
 * the regex engine to take exponential time to match. This function validates patterns
 * against known dangerous patterns before compilation.
 *
 * Dangerous patterns include:
 * - Nested quantifiers: (a+)+, (a*)*, ([a-z]+)+ - cause exponential backtracking
 * - Consecutive quantifiers: a++, a**, a*+, a+* - can cause exponential behavior
 * - High-minimum backreferences: (.)\1{9,} - same char repeated 10+ times
 * - Nested backreferences: ((a+)+)+ or ((\w+)+)+ - extremely dangerous
 *
 * @param pattern - The regex pattern string to validate
 * @param maxLength - Maximum allowed pattern length (default 200)
 * @param flags - RegExp flags to apply (default 'gi')
 * @returns Result containing either a valid RegExp or a RegexError
 *
 * @example
 * ```typescript
 * const result = safeRegex('hello.*world');
 * if (result.success) {
 *   console.log('Valid regex:', result.data);
 * } else {
 *   console.error('Invalid pattern:', result.error.message);
 * }
 * ```
 *
 * @example ReDoS-prone patterns that will be rejected:
 * ```typescript
 * safeRegex('(.)\\1{9,}');  // High-minimum backreference
 * safeRegex('(a+)+');      // Nested quantifier
 * safeRegex('(a*)*');      // Double repetition
 * ```
 */
export function safeRegex(
	pattern: string,
	maxLength: number = REGEX.MAX_PATTERN_LENGTH,
	flags: string = 'gi'
): Result<RegExp, RegexError> {
	// 1. Length check to prevent memory exhaustion
	if (pattern.length > maxLength) {
		return err(new RegexError(`Pattern too long: max ${maxLength} characters`));
	}

	// 2. Check for catastrophic backreference patterns like (.)\1{9,}
	//    This pattern can cause catastrophic backtracking when matched against
	//    strings that partially match (e.g., many repetitions of one char)
	//    We check if pattern contains \1{9,} or similar high-min backreference
	if (/\\1\{9,/.test(pattern)) {
		return err(
			new RegexError('Pattern may cause catastrophic backtracking (high-minimum backreference)')
		);
	}

	// 3. Check for nested quantifier patterns like (a+)+
	//    Pattern: (  followed by content ending with quantifier, then ) followed by quantifier
	//    This catches most common ReDoS patterns: (a+)+, (a*)+, (a+)*, (\d+)+
	const nestedQuantPattern = /\(([^\)]+[+*?])\)[+*?]/;
	if (nestedQuantPattern.test(pattern)) {
		return err(new RegexError('Pattern may cause exponential backtracking (nested quantifier)'));
	}

	// 4. Check for consecutive quantifiers (like ++, **, *+, +*)
	//    These can cause issues in some regex engines
	for (let i = 0; i < pattern.length - 1; i++) {
		const char = pattern[i];
		const nextChar = pattern[i + 1];
		if ((char === '+' || char === '*') && (nextChar === '+' || nextChar === '*')) {
			return err(
				new RegexError('Pattern may cause exponential backtracking (consecutive quantifiers)')
			);
		}
	}

	// 5. Check for backreference with high minimum repetition
	//    Pattern like (.)\1{10} or (a)\1{9}
	if (/\\1\{\d+,?\}/.test(pattern)) {
		// Extract the minimum count - parseInt needs a string, match[1] could be undefined
		const backrefMatch = pattern.match(/\\1\{(\d+)/);
		const minCountStr = backrefMatch?.[1];
		if (minCountStr !== undefined && parseInt(minCountStr, 10) >= 9) {
			return err(
				new RegexError('Pattern may cause catastrophic backtracking (high-minimum backreference)')
			);
		}
	}

	// 6. Compile and validate the regex
	try {
		const regex = new RegExp(pattern, flags);
		return ok(regex);
	} catch (e) {
		return err(new RegexError(`Invalid regex: ${e instanceof Error ? e.message : String(e)}`));
	}
}

/**
 * Validates a regex pattern without compiling it.
 * Useful for quick validation before using safeRegex.
 *
 * @param pattern - The regex pattern to validate
 * @param maxLength - Maximum allowed pattern length (default 200)
 * @returns true if the pattern appears safe, false otherwise
 */
export function isSafePattern(
	pattern: string,
	maxLength: number = REGEX.MAX_PATTERN_LENGTH
): boolean {
	// Quick length check
	if (pattern.length > maxLength) {
		return false;
	}

	// Check for high-minimum backreference
	if (/\\1\{9,/.test(pattern)) {
		return false;
	}

	// Check for nested quantifier pattern (x+)+ or (x*)*
	const nestedQuantPattern = /\(([^\)]+[+*?])\)[+*?]/;
	if (nestedQuantPattern.test(pattern)) {
		return false;
	}

	// Check for backreference with high minimum
	if (/\\1\{\d+,?\}/.test(pattern)) {
		const backrefMatch = pattern.match(/\\1\{(\d+)/);
		const minCountStr = backrefMatch?.[1];
		if (minCountStr !== undefined && parseInt(minCountStr, 10) >= 9) {
			return false;
		}
	}

	// Check for consecutive quantifiers
	for (let i = 0; i < pattern.length - 1; i++) {
		const char = pattern[i];
		const nextChar = pattern[i + 1];
		if ((char === '+' || char === '*') && (nextChar === '+' || nextChar === '*')) {
			return false;
		}
	}

	return true;
}
