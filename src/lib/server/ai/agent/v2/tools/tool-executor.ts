/**
 * Tool Executor - Execution with hooks, caching, and rate limiting
 *
 * Executes tools with PreToolUse/PostToolUse hooks, caching, and rate limiting.
 */

import type { ToolDefinition, ToolCall, ToolExecutionResult } from '../core/types';
import type { IAgentContext } from '../core/context';
import { ToolRegistry, type ToolMetadata, isWriteTool } from './tool-registry';
import { ToolCache, createToolCacheKey } from './tool-cache';
import { SlidingWindowRateLimiter, createToolRateLimiter } from './rate-limiter';
import type { HookManager } from '../hooks/hook-manager';
import type { EventBus } from '../events/event-bus';

// ============================================================================
// Executor Types
// ============================================================================

/**
 * Tool executor configuration
 */
export interface ToolExecutorConfig {
	/** Tool registry */
	registry: ToolRegistry;
	/** Tool cache */
	cache: ToolCache;
	/** Rate limiter */
	rateLimiter: SlidingWindowRateLimiter;
	/** Hook manager (optional) */
	hookManager?: HookManager;
	/** Event bus (optional) */
	eventBus?: EventBus;
	/** Enable debug logging */
	debug?: boolean;
}

/**
 * Execution context
 */
export interface ExecutionContext {
	/** Agent context */
	context: IAgentContext;
	/** Current iteration */
	iteration: number;
	/** Whether to use cache */
	useCache?: boolean;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Tool Executor
// ============================================================================

/**
 * Tool Executor - Executes tools with hooks, caching, and rate limiting
 */
export class ToolExecutor {
	private registry: ToolRegistry;
	private cache: ToolCache;
	private rateLimiter: SlidingWindowRateLimiter;
	private hookManager?: HookManager;
	private eventBus?: EventBus;
	private debug: boolean;

	constructor(config: ToolExecutorConfig) {
		this.registry = config.registry;
		this.cache = config.cache;
		this.rateLimiter = config.rateLimiter;
		this.hookManager = config.hookManager;
		this.eventBus = config.eventBus;
		this.debug = config.debug ?? false;
	}

	/**
	 * Execute a tool call
	 */
	async execute(
		call: ToolCall,
		execContext: ExecutionContext
	): Promise<ToolExecutionResult> {
		const startTime = Date.now();

		// 1. Validate tool exists
		const tool = this.registry.get(call.name);
		if (!tool) {
			return this.createErrorResult(
				`Tool not found: ${call.name}`,
				startTime
			);
		}

		// 2. Get tool metadata
		const entry = this.registry.getEntry(call.name);
		const isWrite = entry?.metadata.isWriteOperation ?? isWriteTool(call.name);

		// 3. Check rate limit
		const rateLimitResult = this.rateLimiter.tryRequest(
			`${execContext.context.userId}:${call.name}`,
			1
		);

		if (!rateLimitResult.allowed) {
			return this.createErrorResult(
				rateLimitResult.reason || 'Rate limit exceeded',
				startTime
			);
		}

		// 4. Check cache for read operations
		const useCache = execContext.useCache !== false && !isWrite;

		if (useCache) {
			const cacheKey = createToolCacheKey(
				execContext.context.userId,
				call.name,
				call.parameters
			);

			const cached = this.cache.get(cacheKey);
			if (cached !== undefined) {
				execContext.context.incrementTelemetry('cacheHits');

				if (this.debug) {
					console.log(`[ToolExecutor] Cache hit: ${call.name}`);
				}

				return {
					success: true,
					result: cached,
					durationMs: Date.now() - startTime,
					cached: true
				};
			} else {
				execContext.context.incrementTelemetry('cacheMisses');
			}
		}

		// 5. Execute PreToolUse hooks
		if (this.hookManager) {
			const hookResult = await this.hookManager.executePreHooks(
				call,
				execContext.context,
				execContext.context.getState(),
				execContext.iteration
			);

			if (!hookResult.allowed) {
				return this.createErrorResult(
					hookResult.reason || 'Blocked by hook',
					startTime
				);
			}

			// Apply modifications
			if (hookResult.modifications) {
				call.parameters = hookResult.modifications;
			}
		}

		// 6. Validate parameters
		const validation = this.registry.validateCall(call);
		if (!validation.valid) {
			return this.createErrorResult(
				`Validation failed: ${validation.errors.join(', ')}`,
				startTime
			);
		}

		// 7. Execute the tool
		let result: ToolExecutionResult;

		try {
			const executeResult = await tool.execute(call.parameters);

			result = {
				success: true,
				result: executeResult,
				durationMs: Date.now() - startTime
			};

			// Update telemetry
			execContext.context.incrementTelemetry('successfulSteps');
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);

			result = {
				success: false,
				result: { error: errorMsg },
				error: errorMsg,
				durationMs: Date.now() - startTime
			};

			// Update telemetry
			execContext.context.incrementTelemetry('failedSteps');
			execContext.context.incrementTelemetry('errors');

			if (this.debug) {
				console.error(`[ToolExecutor] Tool failed: ${call.name}`, error);
			}
		}

		// 8. Execute PostToolUse hooks
		if (this.hookManager) {
			const hookResult = await this.hookManager.executePostHooks(
				call,
				result,
				execContext.context,
				execContext.context.getState(),
				execContext.iteration
			);

			if (!hookResult.continue) {
				return this.createErrorResult(
					'Execution blocked by post-hook',
					startTime
				);
			}

			// Apply modifications
			if (hookResult.modifiedResult) {
				result = hookResult.modifiedResult;
			}
		}

		// 9. Cache successful results for read operations
		if (result.success && useCache) {
			const cacheKey = createToolCacheKey(
				execContext.context.userId,
				call.name,
				call.parameters
			);

			this.cache.set(cacheKey, result.result);
		}

		// 10. Update registry usage stats
		this.registry.incrementUsage(call.name);

		// 11. Emit event if event bus is available
		if (this.eventBus) {
			execContext.context.emitter.emit(
				result.success ? 'tool.call_completed' : 'tool.call_failed',
				{
					call,
					result
				} as any
			);
		}

		return result;
	}

	/**
	 * Execute multiple tool calls in parallel
	 */
	async executeParallel(
		calls: ToolCall[],
		context: ExecutionContext
	): Promise<ToolExecutionResult[]> {
		return Promise.all(
			calls.map(call => this.execute(call, context))
		);
	}

	/**
	 * Execute multiple tool calls sequentially
	 */
	async executeSequential(
		calls: ToolCall[],
		context: ExecutionContext
	): Promise<ToolExecutionResult[]> {
		const results: ToolExecutionResult[] = [];

		for (const call of calls) {
			const result = await this.execute(call, context);
			results.push(result);

			// Stop on failure
			if (!result.success) {
				break;
			}
		}

		return results;
	}

	/**
	 * Get tool registry
	 */
	getRegistry(): ToolRegistry {
		return this.registry;
	}

	/**
	 * Get tool cache
	 */
	getCache(): ToolCache {
		return this.cache;
	}

	/**
	 * Get rate limiter
	 */
	getRateLimiter(): SlidingWindowRateLimiter {
		return this.rateLimiter;
	}

	/**
	 * Clear caches
	 */
	clearCache(): void {
		this.cache.clear();
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private createErrorResult(error: string, startTime: number): ToolExecutionResult {
		return {
			success: false,
			result: { error },
			error,
			durationMs: Date.now() - startTime
		};
	}
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a tool executor with default configuration
 */
export function createToolExecutor(options?: {
	registry?: ToolRegistry;
	cache?: ToolCache;
	rateLimiter?: SlidingWindowRateLimiter;
	hookManager?: HookManager;
	eventBus?: EventBus;
	debug?: boolean;
}): ToolExecutor {
	const registry = options?.registry ?? new ToolRegistry();
	const cache = options?.cache ?? new ToolCache();
	const rateLimiter = options?.rateLimiter ?? createToolRateLimiter();

	return new ToolExecutor({
		registry,
		cache,
		rateLimiter,
		hookManager: options?.hookManager,
		eventBus: options?.eventBus,
		debug: options?.debug ?? false
	});
}
