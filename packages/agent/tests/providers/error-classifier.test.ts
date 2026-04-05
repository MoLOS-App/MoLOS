/**
 * Tests for ErrorClassifier class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	ErrorClassifier,
	classifyError,
	classify,
	isRetriable,
	FailoverError,
	createErrorClassifier,
	DEFAULT_PATTERNS,
	type FailoverReason
} from '../../src/providers/error-classifier.js';

describe('ErrorClassifier', () => {
	describe('classify', () => {
		let classifier: ErrorClassifier;

		beforeEach(() => {
			classifier = new ErrorClassifier();
		});

		describe('HTTP status code classification', () => {
			it('should classify 401 as auth', () => {
				const error = new Error('status: 401 Unauthorized');
				expect(classifier.classify(error)).toBe('auth');
			});

			it('should classify 403 as auth', () => {
				const error = new Error('HTTP 403 Forbidden');
				expect(classifier.classify(error)).toBe('auth');
			});

			it('should classify 402 as billing', () => {
				const error = new Error('status: 402 Payment Required');
				expect(classifier.classify(error)).toBe('billing');
			});

			it('should classify 408 as timeout', () => {
				const error = new Error('Request timeout: 408');
				expect(classifier.classify(error)).toBe('timeout');
			});

			it('should classify 429 as rate_limit', () => {
				const error = new Error('status code: 429 Too Many Requests');
				expect(classifier.classify(error)).toBe('rate_limit');
			});

			it('should classify 400 as format', () => {
				const error = new Error('HTTP 400 Bad Request');
				expect(classifier.classify(error)).toBe('format');
			});

			it('should classify transient server errors as timeout', () => {
				const errors = [500, 502, 503, 521, 522, 523, 524, 529];
				for (const status of errors) {
					const error = new Error(`Server error: ${status}`);
					expect(classifier.classify(error)).toBe('timeout');
				}
			});

			it('should classify unknown status codes as unknown', () => {
				const error = new Error('status: 999 Unknown Error');
				expect(classifier.classify(error)).toBe('unknown');
			});
		});

		describe('error message pattern classification', () => {
			it('should classify rate limit patterns', () => {
				const patterns = [
					'rate limit exceeded',
					'too many requests',
					'quota exceeded',
					'resource has been exhausted',
					'usage limit reached'
				];
				for (const msg of patterns) {
					expect(classifier.classify(new Error(msg))).toBe('rate_limit');
				}
			});

			it('should classify overloaded patterns', () => {
				const patterns = ['overloaded_error', 'service is overloaded', 'server overloaded'];
				for (const msg of patterns) {
					expect(classifier.classify(new Error(msg))).toBe('rate_limit');
				}
			});

			it('should classify billing patterns', () => {
				const patterns = [
					'payment required',
					'insufficient credits',
					'credit balance low',
					'insufficient balance'
				];
				for (const msg of patterns) {
					expect(classifier.classify(new Error(msg))).toBe('billing');
				}
			});

			it('should classify timeout patterns', () => {
				const patterns = [
					'request timeout',
					'operation timed out',
					'deadline exceeded',
					'context deadline exceeded'
				];
				for (const msg of patterns) {
					expect(classifier.classify(new Error(msg))).toBe('timeout');
				}
			});

			it('should classify auth patterns', () => {
				const patterns = [
					'invalid api key',
					'incorrect API key',
					'invalid token',
					'authentication failed',
					'unauthorized access',
					'access denied',
					'token has expired'
				];
				for (const msg of patterns) {
					expect(classifier.classify(new Error(msg))).toBe('auth');
				}
			});

			it('should classify format patterns', () => {
				const patterns = [
					'string should match pattern',
					'invalid tool_use.id format',
					'messages.1.content.1.tool_use.id is invalid',
					'invalid request format'
				];
				for (const msg of patterns) {
					expect(classifier.classify(new Error(msg))).toBe('format');
				}
			});
		});

		describe('context cancellation handling', () => {
			it('should return unknown for context canceled', () => {
				const error = new Error('context canceled');
				error.name = 'CanceledError';
				expect(classifier.classify(error)).toBe('unknown');
			});

			it('should return timeout for context deadline exceeded', () => {
				const error = new Error('context deadline exceeded');
				error.name = 'DeadlineExceededError';
				expect(classifier.classify(error)).toBe('timeout');
			});
		});

		describe('null/undefined handling', () => {
			it('should return unknown for null', () => {
				expect(classifier.classify(null)).toBe('unknown');
			});

			it('should return unknown for undefined', () => {
				expect(classifier.classify(undefined)).toBe('unknown');
			});
		});

		describe('object error handling', () => {
			it('should extract message from error object with message field', () => {
				const error = { message: 'rate limit exceeded', code: 429 };
				expect(classifier.classify(error)).toBe('rate_limit');
			});

			it('should extract message from error object with error field', () => {
				const error = { error: 'invalid api key', code: 401 };
				expect(classifier.classify(error)).toBe('auth');
			});

			it('should extract message from error object with reason field', () => {
				const error = { reason: 'timeout error' };
				expect(classifier.classify(error)).toBe('timeout');
			});

			it('should handle plain string errors', () => {
				expect(classifier.classify('rate limit exceeded')).toBe('rate_limit');
			});

			it('should handle number errors', () => {
				expect(classifier.classify(429)).toBe('rate_limit');
			});
		});

		describe('priority order', () => {
			it('should prioritize rate_limit over billing in message matching', () => {
				// Message contains both rate limit and billing patterns
				const error = new Error('rate limit exceeded: insufficient credits');
				expect(classifier.classify(error)).toBe('rate_limit');
			});

			it('should prioritize overloaded (as rate_limit) over billing', () => {
				const error = new Error('service overloaded: payment required');
				expect(classifier.classify(error)).toBe('rate_limit');
			});
		});
	});

	describe('isRetriable', () => {
		let classifier: ErrorClassifier;

		beforeEach(() => {
			classifier = new ErrorClassifier();
		});

		it('should return false for format errors', () => {
			expect(classifier.isRetriable('format')).toBe(false);
		});

		it('should return true for auth errors', () => {
			expect(classifier.isRetriable('auth')).toBe(true);
		});

		it('should return true for rate_limit errors', () => {
			expect(classifier.isRetriable('rate_limit')).toBe(true);
		});

		it('should return true for billing errors', () => {
			expect(classifier.isRetriable('billing')).toBe(true);
		});

		it('should return true for timeout errors', () => {
			expect(classifier.isRetriable('timeout')).toBe(true);
		});

		it('should return true for overloaded errors', () => {
			expect(classifier.isRetriable('overloaded')).toBe(true);
		});

		it('should return true for unknown errors', () => {
			expect(classifier.isRetriable('unknown')).toBe(true);
		});
	});

	describe('extractMessage', () => {
		let classifier: ErrorClassifier;

		beforeEach(() => {
			classifier = new ErrorClassifier();
		});

		it('should extract message from Error object', () => {
			const error = new Error('test error message');
			expect(classifier.extractMessage(error)).toBe('test error message');
		});

		it('should return empty string for null', () => {
			expect(classifier.extractMessage(null)).toBe('');
		});

		it('should return empty string for undefined', () => {
			expect(classifier.extractMessage(undefined)).toBe('');
		});

		it('should return string as-is', () => {
			expect(classifier.extractMessage('plain string error')).toBe('plain string error');
		});

		it('should extract message field from object', () => {
			const error = { message: 'object error message', code: 500 };
			expect(classifier.extractMessage(error)).toBe('object error message');
		});

		it('should extract error field from object if no message', () => {
			const error = { error: 'error field message' };
			expect(classifier.extractMessage(error)).toBe('error field message');
		});

		it('should extract reason field from object if no message or error', () => {
			const error = { reason: 'reason field message' };
			expect(classifier.extractMessage(error)).toBe('reason field message');
		});

		it('should fall back to String() for unknown types', () => {
			expect(classifier.extractMessage(12345)).toBe('12345');
		});
	});

	describe('classifyStatus', () => {
		let classifier: ErrorClassifier;

		beforeEach(() => {
			classifier = new ErrorClassifier();
		});

		it('should classify status 401 as auth', () => {
			expect(classifier.classifyStatus(401)).toBe('auth');
		});

		it('should classify status 403 as auth', () => {
			expect(classifier.classifyStatus(403)).toBe('auth');
		});

		it('should classify status 402 as billing', () => {
			expect(classifier.classifyStatus(402)).toBe('billing');
		});

		it('should classify status 408 as timeout', () => {
			expect(classifier.classifyStatus(408)).toBe('timeout');
		});

		it('should classify status 429 as rate_limit', () => {
			expect(classifier.classifyStatus(429)).toBe('rate_limit');
		});

		it('should classify status 400 as format', () => {
			expect(classifier.classifyStatus(400)).toBe('format');
		});

		it('should classify transient statuses as timeout', () => {
			expect(classifier.classifyStatus(500)).toBe('timeout');
			expect(classifier.classifyStatus(502)).toBe('timeout');
			expect(classifier.classifyStatus(503)).toBe('timeout');
		});
	});

	describe('custom patterns', () => {
		it('should use custom rate limit patterns when provided', () => {
			const customPatterns = [/custom_rate_limit_pattern/];
			const classifier = new ErrorClassifier({ rateLimitPatterns: customPatterns });

			const error = new Error('custom_rate_limit_pattern detected');
			expect(classifier.classify(error)).toBe('rate_limit');
		});

		it('should use custom auth patterns when provided', () => {
			const customPatterns = [/custom_auth_pattern/];
			const classifier = new ErrorClassifier({ authPatterns: customPatterns });

			const error = new Error('custom_auth_pattern detected');
			expect(classifier.classify(error)).toBe('auth');
		});

		it('should use custom billing patterns when provided', () => {
			const customPatterns = [/custom_billing_pattern/];
			const classifier = new ErrorClassifier({ billingPatterns: customPatterns });

			const error = new Error('custom_billing_pattern detected');
			expect(classifier.classify(error)).toBe('billing');
		});

		it('should use custom timeout patterns when provided', () => {
			const customPatterns = [/custom_timeout_pattern/];
			const classifier = new ErrorClassifier({ timeoutPatterns: customPatterns });

			const error = new Error('custom_timeout_pattern detected');
			expect(classifier.classify(error)).toBe('timeout');
		});

		it('should use custom format patterns when provided', () => {
			const customPatterns = [/custom_format_pattern/];
			const classifier = new ErrorClassifier({ formatPatterns: customPatterns });

			const error = new Error('custom_format_pattern detected');
			expect(classifier.classify(error)).toBe('format');
		});

		it('should use custom overloaded patterns when provided', () => {
			const customPatterns = [/custom_overloaded_pattern/];
			const classifier = new ErrorClassifier({ overloadedPatterns: customPatterns });

			const error = new Error('custom_overloaded_pattern detected');
			expect(classifier.classify(error)).toBe('rate_limit');
		});
	});

	describe('createErrorClassifier', () => {
		it('should create classifier with default patterns', () => {
			const classifier = createErrorClassifier();
			expect(classifier.classify(new Error('rate limit exceeded'))).toBe('rate_limit');
		});

		it('should create classifier with custom patterns', () => {
			const classifier = createErrorClassifier({
				rate_limit: [/my_custom_rate_pattern/]
			});
			expect(classifier.classify(new Error('my_custom_rate_pattern'))).toBe('rate_limit');
		});
	});

	describe('classifyError helper', () => {
		it('should wrap error with classification metadata', () => {
			const error = new Error('rate limit exceeded');
			const classified = classifyError(error);

			expect(classified.reason).toBe('rate_limit');
			expect(classified.message).toBe('rate limit exceeded');
			expect(classified.original).toBe(error);
			expect(classified.retriable).toBe(true);
		});

		it('should mark format errors as non-retriable', () => {
			const error = new Error('string should match pattern');
			const classified = classifyError(error);

			expect(classified.reason).toBe('format');
			expect(classified.retriable).toBe(false);
		});

		it('should use provided classifier', () => {
			const customClassifier = new ErrorClassifier({
				billingPatterns: [/my_billing/]
			});
			const error = new Error('my_billing issue');
			const classified = classifyError(error, customClassifier);

			expect(classified.reason).toBe('billing');
		});
	});

	describe('FailoverError', () => {
		it('should create error with all metadata', () => {
			const originalError = new Error('rate limit exceeded');
			const failoverError = new FailoverError('rate_limit', 'openai', 'gpt-4', originalError, 429);

			expect(failoverError.reason).toBe('rate_limit');
			expect(failoverError.provider).toBe('openai');
			expect(failoverError.model).toBe('gpt-4');
			expect(failoverError.status).toBe(429);
			expect(failoverError.original).toBe(originalError);
			expect(failoverError.isRetriable()).toBe(true);
		});

		it('should format message correctly', () => {
			const originalError = new Error('quota exceeded');
			const failoverError = new FailoverError(
				'rate_limit',
				'anthropic',
				'claude-3',
				originalError,
				429
			);

			expect(failoverError.message).toContain('failover(rate_limit)');
			expect(failoverError.message).toContain('provider=anthropic');
			expect(failoverError.message).toContain('model=claude-3');
			expect(failoverError.message).toContain('429');
		});

		it('should mark format errors as non-retriable', () => {
			const originalError = new Error('invalid format');
			const failoverError = new FailoverError('format', 'openai', 'gpt-4', originalError, 400);

			expect(failoverError.isRetriable()).toBe(false);
		});

		it('should unwrap original error', () => {
			const originalError = new Error('original');
			const failoverError = new FailoverError('auth', 'p', 'm', originalError);

			expect(failoverError.unwrap()).toBe(originalError);
		});
	});

	describe('convenience functions', () => {
		it('classify should use default classifier', () => {
			expect(classify(new Error('rate limit exceeded'))).toBe('rate_limit');
			expect(classify(new Error('invalid api key'))).toBe('auth');
		});

		it('isRetriable should use default classifier', () => {
			expect(isRetriable('format')).toBe(false);
			expect(isRetriable('rate_limit')).toBe(true);
		});
	});

	describe('DEFAULT_PATTERNS', () => {
		it('should have regex patterns for most reasons', () => {
			// Note: format category uses substring patterns, not regex
			// So we only check that auth, billing, rate_limit, timeout, overloaded have regex patterns
			expect(DEFAULT_PATTERNS.auth.length).toBeGreaterThan(0);
			expect(DEFAULT_PATTERNS.billing.length).toBeGreaterThan(0);
			expect(DEFAULT_PATTERNS.rate_limit.length).toBeGreaterThan(0);
			expect(DEFAULT_PATTERNS.timeout.length).toBeGreaterThan(0);
			expect(DEFAULT_PATTERNS.overloaded.length).toBeGreaterThan(0);
			expect(DEFAULT_PATTERNS.unknown).toEqual([]);
		});
	});
});
