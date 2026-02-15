/**
 * Module Retry Configuration
 *
 * This file contains the default configuration for module retry logic.
 * You can customize these values or override them via environment variables.
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';

/** Retry configuration interface */
export interface ModuleRetryConfig {
	/** Maximum number of retry attempts before giving up */
	maxRetries: number;
	/** Initial delay between retries in milliseconds */
	retryDelay: number;
	/** Grace period in milliseconds before considering permanent failure */
	gracePeriod: number;
	/** Whether to use exponential backoff (2^attempt * delay) or fixed delay */
	useExponentialBackoff: boolean;
}

/**
 * Default retry configuration
 *
 * These values can be overridden by:
 * 1. Creating a `module-retry.config.json` file in the project root
 * 2. Setting environment variables (MOLOS_RETRY_MAX_RETRIES, etc.)
 */
export const DEFAULT_RETRY_CONFIG: ModuleRetryConfig = {
	/**
	 * Maximum retry attempts
	 * @default 3
	 * @env MOLOS_RETRY_MAX_RETRIES
	 */
	maxRetries: parseInt(process.env.MOLOS_RETRY_MAX_RETRIES || '3', 10),

	/**
	 * Initial retry delay in milliseconds
	 * With exponential backoff: 5s, 10s, 20s, 40s, etc.
	 * With fixed delay: always 5s
	 * @default 5000 (5 seconds)
	 * @env MOLOS_RETRY_DELAY
	 */
	retryDelay: parseInt(process.env.MOLOS_RETRY_DELAY || '5000', 10),

	/**
	 * Grace period in milliseconds
	 * Module won't be retried if last retry was within this period
	 * Prevents rapid retry loops
	 * @default 300000 (5 minutes)
	 * @env MOLOS_RETRY_GRACE_PERIOD
	 */
	gracePeriod: parseInt(process.env.MOLOS_RETRY_GRACE_PERIOD || '300000', 10),

	/**
	 * Use exponential backoff
	 * true: delay doubles with each attempt (5s, 10s, 20s, 40s)
	 * false: fixed delay between attempts (5s, 5s, 5s, 5s)
	 * @default true
	 * @env MOLOS_RETRY_EXPONENTIAL_BACKOFF
	 */
	useExponentialBackoff: process.env.MOLOS_RETRY_EXPONENTIAL_BACKOFF !== 'false'
};

/**
 * Load retry configuration from file if it exists
 * Falls back to defaults + environment variables
 */
export function loadRetryConfig(): ModuleRetryConfig {
	const configPath = path.resolve(process.cwd(), 'module-retry.config.json');

	let config = { ...DEFAULT_RETRY_CONFIG };

	if (existsSync(configPath)) {
		try {
			const fileContent = readFileSync(configPath, 'utf-8');
			const fileConfig = JSON.parse(fileContent);
			config = { ...config, ...fileConfig };
		} catch (error) {
			console.warn('[RetryConfig] Failed to load config file, using defaults:', error);
		}
	}

	return config;
}

/**
 * Calculate delay for a given retry attempt
 */
export function calculateRetryDelay(attemptNumber: number, config: ModuleRetryConfig): number {
	if (!config.useExponentialBackoff) {
		return config.retryDelay;
	}
	// Exponential backoff: delay * 2^(attempt-1)
	return config.retryDelay * Math.pow(2, attemptNumber - 1);
}

/**
 * Check if a module should be retried based on retry count and timing
 */
export function shouldRetryModule(
	retryCount: number,
	lastRetryAt: number | null,
	config: ModuleRetryConfig
): boolean {
	// Don't retry if max retries exceeded
	if (retryCount >= config.maxRetries) {
		return false;
	}

	// Don't retry if within grace period (unless it's the first retry)
	if (lastRetryAt && retryCount > 0) {
		const timeSinceLastRetry = Date.now() - lastRetryAt;
		if (timeSinceLastRetry < config.gracePeriod) {
			return false;
		}
	}

	return true;
}
