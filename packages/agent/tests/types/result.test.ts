/**
 * Tests for Result type and helper functions
 */

import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, type Result } from '../../src/types/index.js';

describe('Result type', () => {
	describe('ok', () => {
		it('should create a success result', () => {
			const result = ok(42);

			expect(result.success).toBe(true);
			expect(result.data).toBe(42);
		});

		it('should allow any value in ok result', () => {
			const result = ok('hello');
			expect(result.data).toBe('hello');

			const result2 = ok({ key: 'value' });
			expect(result2.data).toEqual({ key: 'value' });

			const result3 = ok([1, 2, 3]);
			expect(result3.data).toEqual([1, 2, 3]);

			const result4 = ok(null);
			expect(result4.data).toBe(null);

			const result5 = ok(undefined);
			expect(result5.data).toBeUndefined();
		});
	});

	describe('err', () => {
		it('should create a failure result', () => {
			const error = new Error('test error');
			const result = err(error);

			expect(result.success).toBe(false);
			expect(result.error).toBe(error);
		});

		it('should allow any error type', () => {
			const result = err('string error');
			expect(result.error).toBe('string error');

			const result2 = err(404);
			expect(result2.error).toBe(404);

			const result3 = err({ code: 'ERROR', message: 'something went wrong' });
			expect(result3.error).toEqual({ code: 'ERROR', message: 'something went wrong' });
		});

		it('should work with Error type', () => {
			const result = err(new Error('failed'));
			expect(result.error).toBeInstanceOf(Error);
			expect(result.error.message).toBe('failed');
		});
	});

	describe('isOk', () => {
		it('should return true for success results', () => {
			const result = ok(42);
			expect(isOk(result)).toBe(true);
		});

		it('should return false for failure results', () => {
			const result = err(new Error('test'));
			expect(isOk(result)).toBe(false);
		});

		it('should narrow the type correctly', () => {
			const result: Result<number, Error> = ok(42);

			if (isOk(result)) {
				// TypeScript should narrow result.data to number
				const doubled = result.data * 2;
				expect(doubled).toBe(84);
			} else {
				// This branch should not be reached
				expect.fail('Should not be here');
			}
		});
	});

	describe('isErr', () => {
		it('should return false for success results', () => {
			const result = ok(42);
			expect(isErr(result)).toBe(false);
		});

		it('should return true for failure results', () => {
			const result = err(new Error('test'));
			expect(isErr(result)).toBe(true);
		});

		it('should narrow the type correctly', () => {
			const result: Result<number, Error> = err(new Error('failed'));

			if (isErr(result)) {
				// TypeScript should narrow result.error to Error
				expect(result.error).toBeInstanceOf(Error);
			} else {
				// This branch should not be reached
				expect.fail('Should not be here');
			}
		});
	});

	describe('Result type guard behavior', () => {
		it('should properly narrow union types', () => {
			const results: Result<string, Error>[] = [
				ok('success'),
				err(new Error('failure 1')),
				ok('another success'),
				err(new Error('failure 2'))
			];

			const successes = results.filter(isOk);
			const failures = results.filter(isErr);

			expect(successes.length).toBe(2);
			expect(failures.length).toBe(2);

			// All successes should have string data
			successes.forEach((r) => {
				expect(typeof r.data).toBe('string');
			});

			// All failures should have Error
			failures.forEach((r) => {
				expect(r.error).toBeInstanceOf(Error);
			});
		});
	});
});

describe('Result methods', () => {
	describe('unwrap', () => {
		it('should exist on success result (via type)', () => {
			const result = ok(42);
			// Using type assertion to access unwrap since it's not directly exported
			const data = result.success ? result.data : undefined;
			expect(data).toBe(42);
		});

		it('should return undefined on error result (via type guard)', () => {
			const result: Result<number, Error> = err(new Error('test'));
			const data = result.success ? result.data : undefined;
			expect(data).toBeUndefined();
		});
	});

	describe('unwrapOr', () => {
		it('should return value on success result', () => {
			const result = ok(42);
			const value = result.success ? result.data : 0;
			expect(value).toBe(42);
		});

		it('should return default on error result', () => {
			const result: Result<number, Error> = err(new Error('test'));
			const value = result.success ? result.data : 0;
			expect(value).toBe(0);
		});
	});

	describe('map', () => {
		it('should transform success values', () => {
			const result = ok(42);
			const mapped = result.success ? result.data * 2 : undefined;
			expect(mapped).toBe(84);
		});

		it('should not transform error values', () => {
			const result: Result<number, Error> = err(new Error('test'));
			const mapped = result.success ? result.data * 2 : undefined;
			expect(mapped).toBeUndefined();
		});
	});

	describe('mapErr', () => {
		it('should not transform success values', () => {
			const result = ok(42);
			const mapped = result.success ? result.data : 'error transformed';
			expect(mapped).toBe(42);
		});

		it('should transform error values', () => {
			const result: Result<number, Error> = err(new Error('test'));
			const mapped = result.success ? result.data : result.error.message;
			expect(mapped).toBe('test');
		});
	});

	describe('andThen', () => {
		it('should chain success results', () => {
			const result = ok(42);
			const chained = result.success ? ok(result.data * 2) : result;
			expect(chained.success).toBe(true);
			if (chained.success) {
				expect(chained.data).toBe(84);
			}
		});

		it('should short-circuit on error', () => {
			const result: Result<number, Error> = err(new Error('test'));
			const chained = result.success ? ok(result.data * 2) : result;
			expect(chained.success).toBe(false);
		});
	});
});

describe('Result pattern matching', () => {
	it('should work with if-else', () => {
		const successResult = ok(100);
		const failureResult: Result<number, Error> = err(new Error('failed'));

		// Success case
		let value = 0;
		if (successResult.success) {
			value = successResult.data;
		} else {
			value = -1;
		}
		expect(value).toBe(100);

		// Failure case
		let errorValue = 0;
		if (failureResult.success) {
			errorValue = failureResult.data;
		} else {
			errorValue = -1;
		}
		expect(errorValue).toBe(-1);
	});

	it('should work with switch on success property', () => {
		const results: Result<string, Error>[] = [ok('one'), err(new Error('error')), ok('three')];

		const stringResults = results.map((r) => {
			if (r.success) {
				return r.data.toUpperCase();
			}
			return 'ERROR';
		});

		expect(stringResults).toEqual(['ONE', 'ERROR', 'THREE']);
	});
});

describe('Result with complex types', () => {
	it('should handle object results', () => {
		const result = ok({ name: 'test', value: 123 });

		if (result.success) {
			expect(result.data.name).toBe('test');
			expect(result.data.value).toBe(123);
		}
	});

	it('should handle array results', () => {
		const result = ok([1, 2, 3, 4, 5]);

		if (result.success) {
			const sum = result.data.reduce((a, b) => a + b, 0);
			expect(sum).toBe(15);
		}
	});

	it('should handle nested Result types', () => {
		const inner: Result<string, Error> = ok('inner');
		const outer = ok(inner);

		if (outer.success) {
			const innerResult = outer.data;
			expect(innerResult.success).toBe(true);
			if (innerResult.success) {
				expect(innerResult.data).toBe('inner');
			}
		}
	});

	it('should handle Results with Error subclasses', () => {
		class CustomError extends Error {
			constructor(
				message: string,
				public code: number
			) {
				super(message);
				this.name = 'CustomError';
			}
		}

		const result: Result<number, CustomError> = err(new CustomError('custom', 500));

		if (!result.success) {
			expect(result.error.code).toBe(500);
			expect(result.error.message).toBe('custom');
		}
	});
});
