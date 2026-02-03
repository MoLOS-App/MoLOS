/**
 * MCP Timeout Handler
 *
 * Adds timeout handling for long-running operations.
 */

import { mcpSecurityConfig } from '../config/security';
import { createTimeoutError } from '../handlers/error-handler';

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
	default: number;
	tools: number;
	resources: number;
	database: number;
}

/**
 * Result of a timed operation
 */
interface TimedResult<T> {
	result: T;
	durationMs: number;
}

/**
 * Timeout error class
 */
export class TimeoutError extends Error {
	constructor(
		public operation: string,
		public timeout: number
	) {
		super(`Operation timed out: ${operation} (${timeout}ms)`);
		this.name = 'TimeoutError';
	}
}

/**
 * Timeout Handler class
 */
export class TimeoutHandler {
	private config: TimeoutConfig;

	constructor(config?: Partial<TimeoutConfig>) {
		this.config = {
			default: config?.default ?? mcpSecurityConfig.defaultTimeout,
			tools: config?.tools ?? mcpSecurityConfig.toolTimeout,
			resources: config?.resources ?? mcpSecurityConfig.resourceTimeout,
			database: config?.database ?? mcpSecurityConfig.databaseTimeout
		};
	}

	/**
	 * Execute a promise with timeout
	 */
	async withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
		// Create a timeout promise
		const timeoutPromise = new Promise<never>((_, reject) => {
			const timer = setTimeout(() => {
				reject(new TimeoutError(operation, timeoutMs));
			}, timeoutMs);

			// Clear timer if promise completes
			promise.finally(() => clearTimeout(timer));
		});

		// Race between the operation and timeout
		return Promise.race([promise, timeoutPromise]);
	}

	/**
	 * Execute with default timeout
	 */
	async withDefaultTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
		return this.withTimeout(promise, this.config.default, operation);
	}

	/**
	 * Execute with tool execution timeout
	 */
	async withToolTimeout<T>(promise: Promise<T>, toolName: string): Promise<T> {
		return this.withTimeout(promise, this.config.tools, `tools/call:${toolName}`);
	}

	/**
	 * Execute with resource read timeout
	 */
	async withResourceTimeout<T>(promise: Promise<T>, uri: string): Promise<T> {
		return this.withTimeout(promise, this.config.resources, `resources/read:${uri}`);
	}

	/**
	 * Execute with database query timeout
	 */
	async withDatabaseTimeout<T>(promise: Promise<T>, query: string): Promise<T> {
		return this.withTimeout(promise, this.config.database, `database:${query}`);
	}

	/**
	 * Time an operation (doesn't timeout, just measures duration)
	 */
	async time<T>(promise: Promise<T>, operation: string): Promise<TimedResult<T>> {
		const startTime = Date.now();
		const result = await promise;
		const durationMs = Date.now() - startTime;

		return { result, durationMs };
	}

	/**
	 * Get the timeout configuration
	 */
	getConfig(): TimeoutConfig {
		return { ...this.config };
	}
}

/**
 * Singleton timeout handler instance
 */
export const timeoutHandler = new TimeoutHandler();

/**
 * Helper function to run with timeout
 */
export async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	operation: string
): Promise<T> {
	return timeoutHandler.withTimeout(promise, timeoutMs, operation);
}

/**
 * Helper function to run with tool timeout
 */
export async function withToolTimeout<T>(promise: Promise<T>, toolName: string): Promise<T> {
	return timeoutHandler.withToolTimeout(promise, toolName);
}

/**
 * Helper function to run with resource timeout
 */
export async function withResourceTimeout<T>(promise: Promise<T>, uri: string): Promise<T> {
	return timeoutHandler.withResourceTimeout(promise, uri);
}

/**
 * Helper function to run with database timeout
 */
export async function withDatabaseTimeout<T>(promise: Promise<T>, query: string): Promise<T> {
	return timeoutHandler.withDatabaseTimeout(promise, query);
}
