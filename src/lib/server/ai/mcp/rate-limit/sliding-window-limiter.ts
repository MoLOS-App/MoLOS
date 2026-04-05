/**
 * Sliding Window Rate Limiter
 *
 * Implements the sliding window log algorithm for accurate rate limiting.
 */

import { mcpSecurityConfig } from '../config/security';

/**
 * Rate limit check result
 */
export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
	retryAfter?: number;
}

/**
 * Sliding window rate limiter
 *
 * More accurate than fixed window as it counts requests within a sliding time window.
 */
export class SlidingWindowRateLimiter {
	private requests: Map<string, number[]> = new Map();
	private windowMs: number;
	private maxRequests: number;

	constructor(windowMs: number, maxRequests: number) {
		this.windowMs = windowMs;
		this.maxRequests = maxRequests;

		// Start cleanup interval (every minute)
		setInterval(() => this.cleanup(), 60000);
	}

	/**
	 * Check if a request should be rate limited
	 */
	check(identifier: string): RateLimitResult {
		const now = Date.now();
		const windowStart = now - this.windowMs;

		// Get existing timestamps
		let timestamps = this.requests.get(identifier) ?? [];

		// Remove old timestamps outside the window
		timestamps = timestamps.filter((ts) => ts > windowStart);

		// Check if limit exceeded
		if (timestamps.length >= this.maxRequests) {
			// Find when the oldest request in window expires
			const oldestInWindow = timestamps[0];
			const retryAfter = Math.ceil((oldestInWindow - windowStart) / 1000);

			return {
				allowed: false,
				remaining: 0,
				resetAt: oldestInWindow + this.windowMs,
				retryAfter
			};
		}

		// Add current timestamp
		timestamps.push(now);
		this.requests.set(identifier, timestamps);

		return {
			allowed: true,
			remaining: this.maxRequests - timestamps.length,
			resetAt: now + this.windowMs
		};
	}

	/**
	 * Reset rate limit for a specific identifier
	 */
	reset(identifier: string): void {
		this.requests.delete(identifier);
	}

	/**
	 * Clear all rate limit data
	 */
	clear(): void {
		this.requests.clear();
	}

	/**
	 * Get remaining requests for an identifier
	 */
	getRemaining(identifier: string): number {
		const now = Date.now();
		const windowStart = now - this.windowMs;

		const timestamps = this.requests.get(identifier) ?? [];
		const validTimestamps = timestamps.filter((ts) => ts > windowStart);

		return Math.max(0, this.maxRequests - validTimestamps.length);
	}

	/**
	 * Get retry-after time for a rate-limited identifier
	 */
	getRetryAfter(identifier: string): number | null {
		const now = Date.now();
		const windowStart = now - this.windowMs;

		const timestamps = this.requests.get(identifier);
		if (!timestamps || timestamps.length === 0) {
			return null;
		}

		const validTimestamps = timestamps.filter((ts) => ts > windowStart);

		if (validTimestamps.length < this.maxRequests) {
			return null;
		}

		const oldestInWindow = validTimestamps[0];
		return Math.ceil((oldestInWindow - windowStart) / 1000);
	}

	/**
	 * Cleanup old entries to prevent memory leaks
	 */
	private cleanup(): void {
		const now = Date.now();
		const windowStart = now - this.windowMs;
		let cleaned = 0;

		for (const [key, timestamps] of this.requests.entries()) {
			// Remove old timestamps
			const validTimestamps = timestamps.filter((ts) => ts > windowStart);

			if (validTimestamps.length === 0) {
				// No valid timestamps, remove the entry
				this.requests.delete(key);
				cleaned++;
			} else if (validTimestamps.length < timestamps.length) {
				// Some timestamps were removed, update
				this.requests.set(key, validTimestamps);
			}
		}

		if (cleaned > 0) {
			console.debug(`[Rate Limiter] Cleaned up ${cleaned} idle entries`);
		}
	}

	/**
	 * Get rate limiter statistics
	 */
	getStats(): {
		totalEntries: number;
		totalRequests: number;
	} {
		let totalRequests = 0;
		for (const timestamps of this.requests.values()) {
			totalRequests += timestamps.length;
		}

		return {
			totalEntries: this.requests.size,
			totalRequests
		};
	}
}

/**
 * Rate limiters for different MCP operations
 */
export const mcpRateLimiters = {
	/**
	 * Default rate limiter for all requests
	 */
	default: new SlidingWindowRateLimiter(
		mcpSecurityConfig.rateLimit.windowMs,
		mcpSecurityConfig.rateLimit.defaultMaxRequests
	),

	/**
	 * Rate limiter for tool execution (more restrictive)
	 */
	tools: new SlidingWindowRateLimiter(
		mcpSecurityConfig.rateLimit.windowMs,
		mcpSecurityConfig.rateLimit.tools.maxRequests
	),

	/**
	 * Rate limiter for resource access (more permissive)
	 */
	resources: new SlidingWindowRateLimiter(
		mcpSecurityConfig.rateLimit.windowMs,
		mcpSecurityConfig.rateLimit.resources.maxRequests
	)
} as const;
