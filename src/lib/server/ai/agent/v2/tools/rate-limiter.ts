/**
 * Rate Limiter - Rate limiting for tool execution
 *
 * Implements token bucket and sliding window rate limiting.
 */

// ============================================================================
// Rate Limiter Types
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
	/** Maximum requests per window */
	maxRequests: number;
	/** Window duration in ms */
	windowMs: number;
	/** Maximum tokens per window (optional, for token-based limiting) */
	maxTokens?: number;
	/** Enable debug logging */
	debug?: boolean;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
	/** Whether the request is allowed */
	allowed: boolean;
	/** Remaining requests in current window */
	remaining: number;
	/** Time until window reset in ms */
	resetIn: number;
	/** Reason if blocked */
	reason?: string;
}

/**
 * Rate limit entry
 */
interface RateLimitEntry {
	/** Request timestamps */
	timestamps: number[];
	/** Token counts per request */
	tokenCounts: number[];
	/** Total tokens used */
	totalTokens: number;
}

// ============================================================================
// Sliding Window Rate Limiter
// ============================================================================

/**
 * Sliding Window Rate Limiter
 */
export class SlidingWindowRateLimiter {
	private entries: Map<string, RateLimitEntry> = new Map();
	private config: Required<Omit<RateLimitConfig, 'maxTokens'>> & { maxTokens?: number };
	private cleanupInterval: ReturnType<typeof setInterval>;

	constructor(config: RateLimitConfig) {
		this.config = {
			maxRequests: config.maxRequests,
			windowMs: config.windowMs,
			maxTokens: config.maxTokens,
			debug: config.debug ?? false
		};

		// Periodic cleanup of old entries
		this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
	}

	/**
	 * Check if a request is allowed
	 */
	check(key: string, tokens: number = 1): RateLimitResult {
		const now = Date.now();
		const windowStart = now - this.config.windowMs;

		let entry = this.entries.get(key);

		if (!entry) {
			entry = {
				timestamps: [],
				tokenCounts: [],
				totalTokens: 0
			};
			this.entries.set(key, entry);
		}

		// Remove expired timestamps
		entry.timestamps = entry.timestamps.filter(t => t > windowStart);
		entry.tokenCounts = entry.tokenCounts.slice(-entry.timestamps.length);

		// Recalculate total tokens
		entry.totalTokens = entry.tokenCounts.reduce((sum, t) => sum + t, 0);

		const requestCount = entry.timestamps.length;
		const tokenCount = entry.totalTokens;

		// Check request limit
		if (requestCount >= this.config.maxRequests) {
			const oldestInWindow = entry.timestamps[0];
			const resetIn = oldestInWindow ? oldestInWindow + this.config.windowMs - now : this.config.windowMs;

			if (this.config.debug) {
				console.log(`[RateLimiter] Blocked ${key}: ${requestCount}/${this.config.maxRequests} requests`);
			}

			return {
				allowed: false,
				remaining: 0,
				resetIn: Math.max(0, resetIn),
				reason: `Rate limit exceeded: ${requestCount}/${this.config.maxRequests} requests`
			};
		}

		// Check token limit
		if (this.config.maxTokens && tokenCount + tokens > this.config.maxTokens) {
			const oldestInWindow = entry.timestamps[0];
			const resetIn = oldestInWindow ? oldestInWindow + this.config.windowMs - now : this.config.windowMs;

			if (this.config.debug) {
				console.log(`[RateLimiter] Blocked ${key}: ${tokenCount + tokens}/${this.config.maxTokens} tokens`);
			}

			return {
				allowed: false,
				remaining: 0,
				resetIn: Math.max(0, resetIn),
				reason: `Token limit exceeded: ${tokenCount + tokens}/${this.config.maxTokens} tokens`
			};
		}

		// Request is allowed
		return {
			allowed: true,
			remaining: this.config.maxRequests - requestCount - 1,
			resetIn: this.config.windowMs
		};
	}

	/**
	 * Record a request (after checking)
	 */
	record(key: string, tokens: number = 1): void {
		const entry = this.entries.get(key);
		if (!entry) return;

		entry.timestamps.push(Date.now());
		entry.tokenCounts.push(tokens);
		entry.totalTokens += tokens;

		if (this.config.debug) {
			console.log(`[RateLimiter] Recorded ${key}: +${tokens} tokens`);
		}
	}

	/**
	 * Check and record in one operation
	 */
	tryRequest(key: string, tokens: number = 1): RateLimitResult {
		const result = this.check(key, tokens);

		if (result.allowed) {
			this.record(key, tokens);
		}

		return result;
	}

	/**
	 * Get current usage for a key
	 */
	getUsage(key: string): { requests: number; tokens: number; remaining: number } {
		const now = Date.now();
		const windowStart = now - this.config.windowMs;
		const entry = this.entries.get(key);

		if (!entry) {
			return {
				requests: 0,
				tokens: 0,
				remaining: this.config.maxRequests
			};
		}

		const validTimestamps = entry.timestamps.filter(t => t > windowStart);
		const requestCount = validTimestamps.length;

		// Calculate tokens for valid timestamps
		let tokens = 0;
		for (let i = entry.timestamps.length - 1; i >= 0; i--) {
			if (entry.timestamps[i] > windowStart) {
				tokens += entry.tokenCounts[i] || 0;
			}
		}

		return {
			requests: requestCount,
			tokens,
			remaining: Math.max(0, this.config.maxRequests - requestCount)
		};
	}

	/**
	 * Reset limits for a key
	 */
	reset(key: string): void {
		this.entries.delete(key);

		if (this.config.debug) {
			console.log(`[RateLimiter] Reset ${key}`);
		}
	}

	/**
	 * Reset all limits
	 */
	resetAll(): void {
		this.entries.clear();

		if (this.config.debug) {
			console.log(`[RateLimiter] Reset all`);
		}
	}

	/**
	 * Dispose of the rate limiter
	 */
	dispose(): void {
		clearInterval(this.cleanupInterval);
		this.entries.clear();
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private cleanup(): void {
		const now = Date.now();
		const windowStart = now - this.config.windowMs;

		for (const [key, entry] of this.entries) {
			// Remove expired timestamps
			const validCount = entry.timestamps.filter(t => t > windowStart).length;

			// If all timestamps are expired, remove the entry
			if (validCount === 0) {
				this.entries.delete(key);
			}
		}
	}
}

// ============================================================================
// Token Bucket Rate Limiter
// ============================================================================

/**
 * Token Bucket Rate Limiter
 */
export class TokenBucketRateLimiter {
	private buckets: Map<string, {
		tokens: number;
		lastRefill: number;
	}> = new Map();
	private config: {
		maxTokens: number;
		refillRate: number; // tokens per ms
		refillAmount: number;
		debug: boolean;
	};

	constructor(config: {
		/** Maximum tokens in bucket */
		maxTokens: number;
		/** Tokens to add per refill */
		refillAmount: number;
		/** Refill interval in ms */
		refillInterval: number;
		/** Enable debug logging */
		debug?: boolean;
	}) {
		this.config = {
			maxTokens: config.maxTokens,
			refillRate: config.refillAmount / config.refillInterval,
			refillAmount: config.refillAmount,
			debug: config.debug ?? false
		};
	}

	/**
	 * Check if tokens are available
	 */
	check(key: string, tokens: number = 1): RateLimitResult {
		this.refill(key);

		const bucket = this.buckets.get(key);
		if (!bucket) {
			return {
				allowed: tokens <= this.config.maxTokens,
				remaining: this.config.maxTokens - tokens,
				resetIn: 0
			};
		}

		if (bucket.tokens >= tokens) {
			return {
				allowed: true,
				remaining: Math.floor(bucket.tokens - tokens),
				resetIn: 0
			};
		}

		const needed = tokens - bucket.tokens;
		const timeToRefill = Math.ceil(needed / this.config.refillRate);

		return {
			allowed: false,
			remaining: Math.floor(bucket.tokens),
			resetIn: timeToRefill,
			reason: `Insufficient tokens: ${bucket.tokens}/${tokens} needed`
		};
	}

	/**
	 * Consume tokens
	 */
	consume(key: string, tokens: number = 1): RateLimitResult {
		const result = this.check(key, tokens);

		if (result.allowed) {
			const bucket = this.buckets.get(key)!;
			bucket.tokens -= tokens;

			if (this.config.debug) {
				console.log(`[TokenBucket] Consumed ${tokens} tokens from ${key}, remaining: ${bucket.tokens}`);
			}
		}

		return result;
	}

	/**
	 * Refill tokens for a key
	 */
	refill(key: string): void {
		const now = Date.now();
		let bucket = this.buckets.get(key);

		if (!bucket) {
			bucket = {
				tokens: this.config.maxTokens,
				lastRefill: now
			};
			this.buckets.set(key, bucket);
			return;
		}

		const elapsed = now - bucket.lastRefill;
		const tokensToAdd = Math.floor(elapsed * this.config.refillRate);

		if (tokensToAdd > 0) {
			bucket.tokens = Math.min(this.config.maxTokens, bucket.tokens + tokensToAdd);
			bucket.lastRefill = now;
		}
	}

	/**
	 * Get current token count
	 */
	getTokens(key: string): number {
		this.refill(key);
		const bucket = this.buckets.get(key);
		return bucket ? Math.floor(bucket.tokens) : this.config.maxTokens;
	}

	/**
	 * Reset a bucket
	 */
	reset(key: string): void {
		this.buckets.delete(key);
	}

	/**
	 * Reset all buckets
	 */
	resetAll(): void {
		this.buckets.clear();
	}
}

// ============================================================================
// Composite Rate Limiter
// ============================================================================

/**
 * Rate limiter that combines multiple limiters
 */
export class CompositeRateLimiter {
	private limiters: Array<{
		limiter: SlidingWindowRateLimiter | TokenBucketRateLimiter;
		keyFn: (baseKey: string) => string;
	}> = [];

	/**
	 * Add a rate limiter
	 */
	add(
		limiter: SlidingWindowRateLimiter | TokenBucketRateLimiter,
		keyFn: (baseKey: string) => string = (k) => k
	): this {
		this.limiters.push({ limiter, keyFn });
		return this;
	}

	/**
	 * Check all limiters
	 */
	check(key: string, tokens: number = 1): RateLimitResult {
		for (const { limiter, keyFn } of this.limiters) {
			const result = limiter.check(keyFn(key), tokens);

			if (!result.allowed) {
				return result;
			}
		}

		return {
			allowed: true,
			remaining: Number.MAX_SAFE_INTEGER,
			resetIn: 0
		};
	}

	/**
	 * Check and consume from all limiters
	 */
	tryRequest(key: string, tokens: number = 1): RateLimitResult {
		// First check all limiters
		for (const { limiter, keyFn } of this.limiters) {
			const result = limiter.check(keyFn(key), tokens);

			if (!result.allowed) {
				return result;
			}
		}

		// All passed, consume from all
		for (const { limiter, keyFn } of this.limiters) {
			if (limiter instanceof SlidingWindowRateLimiter) {
				limiter.record(keyFn(key), tokens);
			} else {
				limiter.consume(keyFn(key), tokens);
			}
		}

		return {
			allowed: true,
			remaining: Number.MAX_SAFE_INTEGER,
			resetIn: 0
		};
	}

	/**
	 * Reset all limiters
	 */
	resetAll(): void {
		for (const { limiter } of this.limiters) {
			limiter.resetAll();
		}
	}
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a sliding window rate limiter
 */
export function createRateLimiter(config: RateLimitConfig): SlidingWindowRateLimiter {
	return new SlidingWindowRateLimiter(config);
}

/**
 * Create a token bucket rate limiter
 */
export function createTokenBucket(config: {
	maxTokens: number;
	refillAmount: number;
	refillInterval: number;
	debug?: boolean;
}): TokenBucketRateLimiter {
	return new TokenBucketRateLimiter(config);
}

/**
 * Create a default rate limiter for tools
 */
export function createToolRateLimiter(): SlidingWindowRateLimiter {
	return createRateLimiter({
		maxRequests: 100,
		windowMs: 60000, // 1 minute
		debug: false
	});
}
