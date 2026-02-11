/**
 * MCP Cache Layer
 *
 * In-memory caching with TTL support for MCP operations.
 */

import type { MCPContext } from '$lib/models/ai/mcp';

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
	value: T;
	expiresAt: number;
	createdAt: number;
}

/**
 * Cache key parts
 */
interface CacheKeyParts {
	userId: string;
	allowedModules: string[];
}

/**
 * MCP Cache configuration
 */
interface CacheConfig {
	defaultTTL: number; // Default TTL in seconds
	toolsTTL: number;
	resourcesTTL: number;
	promptsTTL: number;
	apiKeyTTL: number;
}

/**
 * Default cache configuration (TTL in seconds)
 */
const DEFAULT_CONFIG: CacheConfig = {
	defaultTTL: 300, // 5 minutes
	toolsTTL: 300, // 5 minutes
	resourcesTTL: 300, // 5 minutes
	promptsTTL: 300, // 5 minutes
	apiKeyTTL: 60 // 1 minute
};

/**
 * In-memory cache implementation with TTL support
 */
export class MCPCache {
	private cache = new Map<string, CacheEntry<unknown>>();
	private config: CacheConfig;

	constructor(config: Partial<CacheConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };

		// Start cleanup interval (every 30 seconds)
		setInterval(() => this.cleanup(), 30000);
	}

	/**
	 * Generate a cache key from parts
	 */
	private generateKey(prefix: string, parts: CacheKeyParts): string {
		const modulesHash = parts.allowedModules.sort().join(',');
		return `${prefix}:${parts.userId}:${modulesHash}`;
	}

	/**
	 * Generate a cache key for API key validation
	 */
	private generateApiKeyKey(apiKeyHash: string): string {
		return `apikey:${apiKeyHash}`;
	}

	/**
	 * Get a value from cache
	 */
	get<T>(prefix: string, context: MCPContext): T | null {
		const key = this.generateKey(prefix, {
			userId: context.userId,
			allowedModules: context.allowedModules
		});

		const entry = this.cache.get(key);

		if (!entry) {
			return null;
		}

		// Check if expired
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return null;
		}

		return entry.value as T;
	}

	/**
	 * Get API key validation from cache
	 */
	getApiKeyValidation(apiKeyHash: string): unknown | null {
		const key = this.generateApiKeyKey(apiKeyHash);
		const entry = this.cache.get(key);

		if (!entry) {
			return null;
		}

		// Check if expired
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return null;
		}

		return entry.value;
	}

	/**
	 * Set a value in cache with TTL
	 */
	set<T>(prefix: string, context: MCPContext, value: T, ttlSeconds?: number): void {
		const key = this.generateKey(prefix, {
			userId: context.userId,
			allowedModules: context.allowedModules
		});

		const ttl = ttlSeconds ?? this.config.defaultTTL;
		const now = Date.now();

		this.cache.set(key, {
			value,
			expiresAt: now + ttl * 1000,
			createdAt: now
		});
	}

	/**
	 * Set API key validation in cache
	 */
	setApiKeyValidation(apiKeyHash: string, value: unknown): void {
		const key = this.generateApiKeyKey(apiKeyHash);
		const now = Date.now();

		this.cache.set(key, {
			value,
			expiresAt: now + this.config.apiKeyTTL * 1000,
			createdAt: now
		});
	}

	/**
	 * Invalidate cache entries matching a pattern
	 */
	invalidate(pattern: string, context?: MCPContext): number {
		let count = 0;

		if (context) {
			// Invalidate specific user entries
			const userKeyPrefix = `${pattern}:${context.userId}:`;
			for (const key of this.cache.keys()) {
				if (key.startsWith(userKeyPrefix)) {
					this.cache.delete(key);
					count++;
				}
			}
		} else {
			// Invalidate all entries matching pattern
			for (const key of this.cache.keys()) {
				if (key.startsWith(pattern)) {
					this.cache.delete(key);
					count++;
				}
			}
		}

		return count;
	}

	/**
	 * Invalidate API key cache
	 */
	invalidateApiKey(apiKeyHash: string): void {
		const key = this.generateApiKeyKey(apiKeyHash);
		this.cache.delete(key);
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Cleanup expired entries
	 */
	private cleanup(): void {
		const now = Date.now();
		let cleaned = 0;

		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			console.debug(`[MCP Cache] Cleaned up ${cleaned} expired entries`);
		}
	}

	/**
	 * Get cache statistics
	 */
	getStats(): {
		size: number;
		keys: string[];
	} {
		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys())
		};
	}
}

/**
 * Singleton cache instance
 */
export const mcpCache = new MCPCache();

/**
 * Cache key prefixes
 */
export const CACHE_KEYS = {
	TOOLS_LIST: 'tools:list',
	RESOURCES_LIST: 'resources:list',
	PROMPTS_LIST: 'prompts:list',
	TOOL_COUNTS: 'tools:counts',
	RESOURCE_COUNTS: 'resources:counts',
	PROMPT_COUNTS: 'prompts:counts'
} as const;
