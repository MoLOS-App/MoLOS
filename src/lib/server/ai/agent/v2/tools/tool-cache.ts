/**
 * Tool Cache - TTL caching for tool results
 *
 * Caches tool execution results with time-to-live support.
 * Read operations are cached; write operations are not.
 */

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache entry
 */
interface CacheEntry<T> {
	/** Cached value */
	value: T;
	/** Creation timestamp */
	createdAt: number;
	/** Expiration timestamp */
	expiresAt: number;
	/** Hit count */
	hits: number;
	/** Cache key */
	key: string;
}

/**
 * Tool cache configuration
 */
export interface ToolCacheConfig {
	/** Maximum cache size in entries */
	maxSize: number;
	/** Default time-to-live in ms */
	defaultTtl: number;
	/** Enable debug logging */
	debug: boolean;
}

/**
 * Default tool cache configuration
 */
export const DEFAULT_TOOL_CACHE_CONFIG: ToolCacheConfig = {
	maxSize: 500,
	defaultTtl: 15000, // 15 seconds
	debug: false
};

/**
 * Cache statistics
 */
export interface CacheStats {
	/** Total entries */
	entries: number;
	/** Total hits */
	hits: number;
	/** Total misses */
	misses: number;
	/** Hit rate */
	hitRate: number;
	/** Total evictions */
	evictions: number;
}

// ============================================================================
// Tool Cache
// ============================================================================

/**
 * LRU Cache with TTL support for tool results
 */
export class ToolCache<T = unknown> {
	private cache: Map<string, CacheEntry<T>> = new Map();
	private accessOrder: string[] = [];
	private config: Required<ToolCacheConfig>;
	private stats = {
		hits: 0,
		misses: 0,
		evictions: 0
	};

	constructor(config: Partial<ToolCacheConfig> = {}) {
		this.config = {
			maxSize: config.maxSize ?? DEFAULT_TOOL_CACHE_CONFIG.maxSize,
			defaultTtl: config.defaultTtl ?? DEFAULT_TOOL_CACHE_CONFIG.defaultTtl,
			debug: config.debug ?? DEFAULT_TOOL_CACHE_CONFIG.debug
		};
	}

	/**
	 * Get a cached value
	 */
	get(key: string): T | undefined {
		const entry = this.cache.get(key);

		if (!entry) {
			this.stats.misses++;
			return undefined;
		}

		// Check expiration
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			this.removeFromAccessOrder(key);
			this.stats.misses++;

			if (this.config.debug) {
				console.log(`[ToolCache] Entry expired: ${key}`);
			}

			return undefined;
		}

		// Cache hit
		entry.hits++;
		this.stats.hits++;

		// Update access order (move to end = most recently used)
		this.removeFromAccessOrder(key);
		this.accessOrder.push(key);

		if (this.config.debug) {
			console.log(`[ToolCache] Hit: ${key} (hits: ${entry.hits})`);
		}

		return entry.value;
	}

	/**
	 * Set a cached value
	 */
	set(key: string, value: T, ttlMs?: number): void {
		// Enforce max size (evict LRU)
		while (this.cache.size >= this.config.maxSize) {
			this.evictLRU();
		}

		const now = Date.now();
		const ttl = ttlMs ?? this.config.defaultTtl;

		const entry: CacheEntry<T> = {
			value,
			createdAt: now,
			expiresAt: now + ttl,
			hits: 0,
			key
		};

		// Remove old entry if exists
		if (this.cache.has(key)) {
			this.removeFromAccessOrder(key);
		}

		this.cache.set(key, entry);
		this.accessOrder.push(key);

		if (this.config.debug) {
			console.log(`[ToolCache] Set: ${key} (ttl: ${ttl}ms, size: ${this.cache.size})`);
		}
	}

	/**
	 * Check if key exists and is not expired
	 */
	has(key: string): boolean {
		const entry = this.cache.get(key);

		if (!entry) return false;

		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			this.removeFromAccessOrder(key);
			return false;
		}

		return true;
	}

	/**
	 * Delete a cached value
	 */
	delete(key: string): boolean {
		const result = this.cache.delete(key);
		if (result) {
			this.removeFromAccessOrder(key);
		}
		return result;
	}

	/**
	 * Clear all cached values
	 */
	clear(): void {
		this.cache.clear();
		this.accessOrder = [];
		this.stats = { hits: 0, misses: 0, evictions: 0 };

		if (this.config.debug) {
			console.log(`[ToolCache] Cleared`);
		}
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats {
		const total = this.stats.hits + this.stats.misses;

		return {
			entries: this.cache.size,
			hits: this.stats.hits,
			misses: this.stats.misses,
			hitRate: total > 0 ? this.stats.hits / total : 0,
			evictions: this.stats.evictions
		};
	}

	/**
	 * Prune expired entries
	 */
	prune(): number {
		const now = Date.now();
		let pruned = 0;

		for (const [key, entry] of this.cache) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
				this.removeFromAccessOrder(key);
				pruned++;
			}
		}

		if (this.config.debug && pruned > 0) {
			console.log(`[ToolCache] Pruned ${pruned} expired entries`);
		}

		return pruned;
	}

	/**
	 * Get all keys
	 */
	keys(): string[] {
		return Array.from(this.cache.keys());
	}

	/**
	 * Get cache size
	 */
	get size(): number {
		return this.cache.size;
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private evictLRU(): void {
		if (this.accessOrder.length === 0) return;

		// Find first non-expired entry to evict
		for (let i = 0; i < this.accessOrder.length; i++) {
			const key = this.accessOrder[i];
			const entry = this.cache.get(key);

			if (entry) {
				this.cache.delete(key);
				this.accessOrder.splice(i, 1);
				this.stats.evictions++;

				if (this.config.debug) {
					console.log(`[ToolCache] Evicted LRU: ${key}`);
				}

				return;
			}
		}

		// If all entries are invalid, clear access order
		this.accessOrder = [];
	}

	private removeFromAccessOrder(key: string): void {
		const index = this.accessOrder.indexOf(key);
		if (index !== -1) {
			this.accessOrder.splice(index, 1);
		}
	}
}

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Generate a cache key for a tool call
 */
export function createToolCacheKey(
	userId: string,
	toolName: string,
	parameters: Record<string, unknown>
): string {
	// Sort parameters for consistent keys
	const sortedParams = sortObject(parameters);
	const paramsStr = JSON.stringify(sortedParams);

	// Simple hash (for production, use a proper hash function)
	const hash = simpleHash(`${userId}:${toolName}:${paramsStr}`);

	return `tool:${toolName}:${hash}`;
}

/**
 * Sort object keys recursively for consistent serialization
 */
function sortObject(obj: unknown): unknown {
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(sortObject);
	}

	const sorted: Record<string, unknown> = {};
	const keys = Object.keys(obj).sort();

	for (const key of keys) {
		sorted[key] = sortObject((obj as Record<string, unknown>)[key]);
	}

	return sorted;
}

/**
 * Simple string hash
 */
function simpleHash(str: string): string {
	let hash = 0;

	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}

	return Math.abs(hash).toString(36);
}

/**
 * Create a tool cache
 */
export function createToolCache<T = unknown>(config?: Partial<ToolCacheConfig>): ToolCache<T> {
	return new ToolCache<T>(config);
}
