/**
 * Enhanced Tool Wrapper with hooks, caching, and events
 *
 * ## Purpose
 * Provides execution wrappers for tools that add cross-cutting concerns
 * like caching, hooks, and event emission without modifying tool logic.
 *
 * ## Tool Wrapper Pattern
 *
 * The wrapper pattern allows tools to be enriched with:
 *
 * 1. Result Caching (LRU cache with TTL)
 *    - Caches successful tool results for fast retrieval
 *    - Caches errors with shorter TTL to allow quick retry
 *    - Atomic get-and-touch to maintain LRU order
 *    - Configurable max size and TTL
 *
 * 2. Hook System
 *    - onToolCall: Called before tool execution
 *    - onToolResult: Called after tool execution (success or failure)
 *    - Enables logging, monitoring, and side effects
 *
 * 3. Event Emission
 *    - tool:call: Emitted when tool execution starts
 *    - tool:result: Emitted when tool execution completes
 *    - Enables integration with external monitoring systems
 *
 * ## Result Formatting for AI
 *
 * Tool results are formatted as strings for AI consumption:
 *
 * - Success: Returns output string directly
 * - Failure: Returns error message string
 * - Cached: Returns cached output (same format as fresh result)
 *
 * The ToolResult structure contains metadata (executionMs, success, etc.)
 * but only the string output is returned to the AI.
 *
 * ## Error Handling
 *
 * The wrapper provides consistent error handling:
 *
 * - Synchronous errors in execute() are caught and wrapped
 * - Error messages are extracted from Error objects
 * - Errors are cached with short TTL for rapid retry
 * - Validation errors from schema-converter are handled separately
 *
 * ## Caching Strategy
 *
 * - Cache key: toolName + sorted JSON of parameters
 * - LRU eviction when at capacity
 * - Separate TTL for success (default 60s) vs errors (default 10s)
 * - Atomic get-and-touch to prevent race conditions
 *
 * ## Example Usage
 *
 *   // Wrap a tool definition with caching and hooks
 *   const wrapped = wrapToolDefinition(toolDef, {
 *     enableCache: true,
 *     cacheTtlMs: 30000,
 *     hookManager: myHookManager,
 *     eventBus: myEventBus
 *   });
 *
 *   // Execute with automatic caching
 *   const result = await wrapped.execute({ query: 'test' });
 *
 * @module tools/tool-wrapper
 */

import type { ToolDefinition, ToolResult, ToolCall } from '../types/index.js';
import { TOOL } from '../constants.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Core tool interface
 */
export interface Tool {
	name: string;
	description: string;
	parameters: ToolDefinition['parameters'];
	execute(args: Record<string, unknown>, context?: unknown): Promise<string>;
}

export interface ToolWrapperOptions {
	hookManager?: HookManager;
	eventBus?: EventBus;
	enableCache?: boolean;
	cacheTtlMs?: number;
	maxCacheSize?: number;
}

/**
 * Hook manager interface for tool hooks
 */
export interface HookManager {
	executeHook(hookName: string, data: unknown, context?: unknown): Promise<void>;
}

/**
 * Event bus interface for tool events
 */
export interface EventBus {
	emit<T>(type: string, payload: T): void;
}

// ============================================================================
// Tool Result Cache
// ============================================================================

/**
 * LRU Cache for tool results with error support and atomic operations
 */
export class ToolResultCache {
	private cache: Map<string, CacheEntry>;
	private maxSize: number;
	private ttlMs: number;
	private errorTtlMs: number;

	constructor(options: { ttlMs?: number; maxSize?: number; errorTtlMs?: number } = {}) {
		this.cache = new Map();
		this.maxSize = options.maxSize ?? TOOL.CACHE_MAX_SIZE;
		this.ttlMs = options.ttlMs ?? TOOL.CACHE_TTL_MS;
		this.errorTtlMs = options.errorTtlMs ?? TOOL.CACHE_ERROR_TTL_MS;
	}

	/**
	 * Get cached result with atomic get-and-touch operation
	 */
	get(toolName: string, params: Record<string, unknown>): ToolResult | null {
		const key = this.makeKey(toolName, params);
		const entry = this.cache.get(key);

		if (!entry) {
			return null;
		}

		// Check if expired (use appropriate TTL based on error status)
		const ttl = entry.isError ? this.errorTtlMs : this.ttlMs;
		if (Date.now() - entry.timestamp > ttl) {
			this.cache.delete(key);
			return null;
		}

		// Atomic get-and-touch: delete then re-set to move to end (most recently used)
		// This ensures the entry is atomically moved to the end
		this.cache.delete(key);
		this.cache.set(key, entry);

		return entry.result;
	}

	/**
	 * Set cached result with eviction support
	 * @param toolName - Name of the tool
	 * @param params - Tool parameters
	 * @param result - The result to cache
	 * @param isError - Whether this result is an error (uses shorter TTL)
	 */
	set(
		toolName: string,
		params: Record<string, unknown>,
		result: ToolResult,
		isError = false
	): void {
		const key = this.makeKey(toolName, params);

		// Atomic eviction: check and evict oldest entry if at capacity
		// Only evict if the key doesn't already exist in the cache
		if (!this.cache.has(key)) {
			this.evictIfAtCapacity();
		}

		this.cache.set(key, {
			result,
			timestamp: Date.now(),
			isError
		});
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Invalidate entries for a specific tool
	 * @param toolName - Name of the tool
	 * @param params - Optional specific parameters to invalidate. If not provided, invalidates all entries for the tool.
	 */
	invalidate(toolName: string, params?: Record<string, unknown>): void {
		if (params) {
			// Invalidate specific entry
			const key = this.makeKey(toolName, params);
			this.cache.delete(key);
		} else {
			// Invalidate all entries for this tool
			const keys = Array.from(this.cache.keys());
			for (const key of keys) {
				if (key.startsWith(`${toolName}:`)) {
					this.cache.delete(key);
				}
			}
		}
	}

	/**
	 * Get cache statistics for monitoring
	 */
	getStats(): { size: number; maxSize: number; hitRate: number } {
		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			hitRate: 0 // Placeholder - would need tracking fields
		};
	}

	/**
	 * Evict oldest entry if at capacity
	 */
	private evictIfAtCapacity(): void {
		if (this.cache.size >= this.maxSize) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) {
				this.cache.delete(oldestKey);
			}
		}
	}

	/**
	 * Generate cache key from tool name and parameters
	 */
	private makeKey(toolName: string, params: Record<string, unknown>): string {
		return `${toolName}:${JSON.stringify(params, Object.keys(params).sort())}`;
	}
}

interface CacheEntry {
	result: ToolResult;
	timestamp: number;
	isError: boolean;
}

// ============================================================================
// Tool Wrapper Functions
// ============================================================================

/**
 * Convert a v2 ToolDefinition to a Tool interface
 */
export function wrapToolDefinition(def: ToolDefinition, options: ToolWrapperOptions = {}): Tool {
	const cache = options.enableCache
		? new ToolResultCache({
				ttlMs: options.cacheTtlMs,
				maxSize: options.maxCacheSize
			})
		: null;

	return {
		name: def.name,
		description: def.description,
		parameters: def.parameters,

		async execute(args: Record<string, unknown>, context?: unknown): Promise<string> {
			const startTime = Date.now();

			// Try cache first
			if (cache) {
				const cached = cache.get(def.name, args);
				if (cached) {
					return cached.output ?? JSON.stringify(cached);
				}
			}

			// Execute hooks before execution
			if (options.hookManager) {
				await options.hookManager.executeHook(
					'onToolCall',
					{
						tool: def.name,
						args
					},
					context
				);
			}

			// Emit event
			if (options.eventBus) {
				options.eventBus.emit('tool:call', {
					tool: def.name,
					args,
					timestamp: startTime
				});
			}

			let result: ToolResult;

			try {
				// Execute the tool logic
				const output = await executeToolDefinition(def, args, context);
				const executionMs = Date.now() - startTime;

				result = {
					toolName: def.name,
					arguments: args,
					success: true,
					output,
					executionMs
				};
			} catch (err) {
				const executionMs = Date.now() - startTime;
				const errorMessage = err instanceof Error ? err.message : String(err);

				result = {
					toolName: def.name,
					arguments: args,
					success: false,
					error: errorMessage,
					executionMs
				};
			}

			// Cache result (cache errors too, with shorter TTL)
			if (cache) {
				cache.set(def.name, args, result, !result.success);
			}

			// Execute hooks after execution
			if (options.hookManager) {
				await options.hookManager.executeHook(
					'onToolResult',
					{
						tool: def.name,
						result
					},
					context
				);
			}

			// Emit event
			if (options.eventBus) {
				options.eventBus.emit('tool:result', {
					tool: def.name,
					result,
					durationMs: Date.now() - startTime
				});
			}

			return result.output ?? (result.success ? '' : (result.error ?? 'Tool execution failed'));
		}
	};
}

/**
 * Convert array of ToolDefinitions to Tool[]
 */
export function convertTools(
	definitions: ToolDefinition[],
	options: ToolWrapperOptions = {}
): Tool[] {
	return definitions.map((def) => wrapToolDefinition(def, options));
}

/**
 * Wrap single tool with hooks, caching, events
 */
export function wrapToolWithHooks(tool: Tool, options: ToolWrapperOptions = {}): Tool {
	const cache = options.enableCache
		? new ToolResultCache({
				ttlMs: options.cacheTtlMs,
				maxSize: options.maxCacheSize
			})
		: null;

	return {
		name: tool.name,
		description: tool.description,
		parameters: tool.parameters,

		async execute(args: Record<string, unknown>, context?: unknown): Promise<string> {
			const startTime = Date.now();

			// Try cache first
			if (cache) {
				const cached = cache.get(tool.name, args);
				if (cached) {
					return cached.output ?? JSON.stringify(cached);
				}
			}

			// Execute hooks before execution
			if (options.hookManager) {
				await options.hookManager.executeHook(
					'onToolCall',
					{
						tool: tool.name,
						args
					},
					context
				);
			}

			// Emit event
			if (options.eventBus) {
				options.eventBus.emit('tool:call', {
					tool: tool.name,
					args,
					timestamp: startTime
				});
			}

			let result: ToolResult;

			try {
				const output = await tool.execute(args, context);
				const executionMs = Date.now() - startTime;

				result = {
					toolName: tool.name,
					arguments: args,
					success: true,
					output,
					executionMs
				};
			} catch (err) {
				const executionMs = Date.now() - startTime;
				const errorMessage = err instanceof Error ? err.message : String(err);

				result = {
					toolName: tool.name,
					arguments: args,
					success: false,
					error: errorMessage,
					executionMs
				};
			}

			// Cache result (cache errors too, with shorter TTL)
			if (cache) {
				cache.set(tool.name, args, result, !result.success);
			}

			// Execute hooks after execution
			if (options.hookManager) {
				await options.hookManager.executeHook(
					'onToolResult',
					{
						tool: tool.name,
						result
					},
					context
				);
			}

			// Emit event
			if (options.eventBus) {
				options.eventBus.emit('tool:result', {
					tool: tool.name,
					result,
					durationMs: Date.now() - startTime
				});
			}

			return result.output ?? (result.success ? '' : (result.error ?? 'Tool execution failed'));
		}
	};
}

/**
 * Helper to build cache key
 */
export function buildCacheKey(toolName: string, params: Record<string, unknown>): string {
	const sortedParams = Object.keys(params)
		.sort()
		.reduce<Record<string, unknown>>((acc, key) => {
			acc[key] = params[key];
			return acc;
		}, {});

	return `${toolName}:${JSON.stringify(sortedParams)}`;
}

/**
 * Execute tool definition logic
 */
async function executeToolDefinition(
	def: ToolDefinition,
	args: Record<string, unknown>,
	context?: unknown
): Promise<string> {
	// This is a placeholder - actual implementation would call
	// the underlying tool logic based on the definition type
	// For now, just return a string representation
	return JSON.stringify({
		tool: def.name,
		args,
		executed: true
	});
}
