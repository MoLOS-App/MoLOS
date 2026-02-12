/**
 * LLM Response Cache
 *
 * Caches LLM responses to reduce API calls and costs.
 * Uses content hashing for cache keys.
 */

import type { AgentMessage, ToolDefinition } from '../core/types';
import type { LlmResponse } from '../core/types';

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache entry
 */
export interface CacheEntry {
	/** Cached response */
	response: LlmResponse;
	/** Creation timestamp */
	createdAt: number;
	/** Expiration timestamp */
	expiresAt: number;
	/** Hit count */
	hits: number;
	/** Cache key */
	key: string;
	/** Model used */
	model: string;
	/** Token count */
	tokenCount: number;
}

/**
 * Cache configuration
 */
export interface ResponseCacheConfig {
	/** Maximum cache size in entries */
	maxSize: number;
	/** Time to live in ms */
	ttlMs: number;
	/** Enable debug logging */
	debug: boolean;
	/** Hash algorithm */
	hashAlgorithm?: 'sha256' | 'md5';
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: ResponseCacheConfig = {
	maxSize: 1000,
	ttlMs: 3600000, // 1 hour
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
	/** Total tokens saved */
	tokensSaved: number;
	/** Estimated cost saved */
	costSaved: number;
}

// ============================================================================
// Response Cache
// ============================================================================

/**
 * LLM Response Cache
 */
export class ResponseCache {
	private cache: Map<string, CacheEntry> = new Map();
	private config: ResponseCacheConfig;
	private stats = {
		hits: 0,
		misses: 0,
		tokensSaved: 0,
		costSaved: 0
	};

	constructor(config: Partial<ResponseCacheConfig> = {}) {
		this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
	}

	/**
	 * Get a cached response
	 */
	get(
		messages: AgentMessage[],
		tools: ToolDefinition[] | undefined,
		model: string,
		options?: Record<string, unknown>
	): LlmResponse | null {
		const key = this.generateKey(messages, tools, model, options);
		const entry = this.cache.get(key);

		if (!entry) {
			this.stats.misses++;
			return null;
		}

		// Check expiration
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			this.stats.misses++;

			if (this.config.debug) {
				console.log(`[ResponseCache] Entry expired: ${key.substring(0, 20)}...`);
			}

			return null;
		}

		// Cache hit
		entry.hits++;
		this.stats.hits++;
		this.stats.tokensSaved += entry.tokenCount;

		if (this.config.debug) {
			console.log(`[ResponseCache] Cache hit: ${key.substring(0, 20)}... (hits: ${entry.hits})`);
		}

		return entry.response;
	}

	/**
	 * Set a cached response
	 */
	set(
		messages: AgentMessage[],
		tools: ToolDefinition[] | undefined,
		model: string,
		response: LlmResponse,
		options?: Record<string, unknown>
	): void {
		const key = this.generateKey(messages, tools, model, options);
		const tokenCount = this.estimateTokens(response);

		// Enforce max size
		if (this.cache.size >= this.config.maxSize) {
			this.evictOldest();
		}

		const entry: CacheEntry = {
			response,
			createdAt: Date.now(),
			expiresAt: Date.now() + this.config.ttlMs,
			hits: 0,
			key,
			model,
			tokenCount
		};

		this.cache.set(key, entry);

		if (this.config.debug) {
			console.log(`[ResponseCache] Cached response: ${key.substring(0, 20)}... (size: ${this.cache.size})`);
		}
	}

	/**
	 * Check if cache has an entry
	 */
	has(
		messages: AgentMessage[],
		tools: ToolDefinition[] | undefined,
		model: string,
		options?: Record<string, unknown>
	): boolean {
		const key = this.generateKey(messages, tools, model, options);
		const entry = this.cache.get(key);

		if (!entry) return false;

		// Check expiration
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return false;
		}

		return true;
	}

	/**
	 * Delete a cached entry
	 */
	delete(
		messages: AgentMessage[],
		tools: ToolDefinition[] | undefined,
		model: string,
		options?: Record<string, unknown>
	): boolean {
		const key = this.generateKey(messages, tools, model, options);
		return this.cache.delete(key);
	}

	/**
	 * Clear the cache
	 */
	clear(): void {
		this.cache.clear();
		this.stats = {
			hits: 0,
			misses: 0,
			tokensSaved: 0,
			costSaved: 0
		};
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
			tokensSaved: this.stats.tokensSaved,
			costSaved: this.stats.costSaved
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
				pruned++;
			}
		}

		if (this.config.debug && pruned > 0) {
			console.log(`[ResponseCache] Pruned ${pruned} expired entries`);
		}

		return pruned;
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private generateKey(
		messages: AgentMessage[],
		tools: ToolDefinition[] | undefined,
		model: string,
		options?: Record<string, unknown>
	): string {
		// Create a deterministic string representation
		const data = {
			messages: messages.map(m => ({
				role: m.role,
				content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
				toolCalls: m.toolCalls
			})),
			tools: tools?.map(t => ({
				name: t.name,
				description: t.description,
				parameters: t.parameters
			})),
			model,
			options
		};

		const str = JSON.stringify(data, Object.keys(data).sort());

		// Simple hash (in production, use crypto.subtle or a proper hash library)
		return this.simpleHash(str);
	}

	private simpleHash(str: string): string {
		let hash = 0;

		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}

		// Convert to hex string and add prefix
		return `cache_${Math.abs(hash).toString(16)}`;
	}

	private estimateTokens(response: LlmResponse): number {
		let tokens = 0;

		// Content tokens
		tokens += Math.ceil(response.content.length / 4);

		// Tool calls
		if (response.toolCalls) {
			for (const tc of response.toolCalls) {
				tokens += Math.ceil(tc.name.length / 4);
				tokens += Math.ceil(JSON.stringify(tc.parameters).length / 4);
			}
		}

		// Thinking
		if (response.thinking) {
			tokens += Math.ceil(response.thinking.length / 4);
		}

		// Use actual usage if available
		if (response.usage) {
			tokens = response.usage.completionTokens;
		}

		return tokens;
	}

	private evictOldest(): void {
		// Find and remove the oldest entry with fewest hits
		let oldest: CacheEntry | null = null;
		let oldestKey: string | null = null;

		for (const [key, entry] of this.cache) {
			if (!oldest || entry.createdAt < oldest.createdAt) {
				oldest = entry;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.cache.delete(oldestKey);

			if (this.config.debug) {
				console.log(`[ResponseCache] Evicted oldest entry: ${oldestKey.substring(0, 20)}...`);
			}
		}
	}
}

/**
 * Create a response cache
 */
export function createResponseCache(config?: Partial<ResponseCacheConfig>): ResponseCache {
	return new ResponseCache(config);
}
