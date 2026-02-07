/**
 * Tool execution engine
 * Handles tool validation, caching, and execution
 */

import type { ToolCall, ToolExecutionResult } from '../core/agent-types';
import type { ToolDefinition } from '$lib/models/ai';
import {
	validateToolParams,
	createToolCacheKey,
	normalizeToolParams,
	isWriteTool,
	TtlCache
} from '../../agent-utils';

/**
 * Executes tools with validation and caching
 */
export class ToolExecutor {
	private toolCache: TtlCache<unknown>;
	private cacheTtlMs: number;

	constructor(cacheSize: number = 256, cacheTtlMs: number = 15000) {
		this.toolCache = new TtlCache<unknown>(cacheSize);
		this.cacheTtlMs = cacheTtlMs;
	}

	/**
	 * Execute a single tool call
	 */
	async executeTool(
		tool: ToolDefinition,
		call: ToolCall,
		userId: string,
		useCache: boolean = true
	): Promise<ToolExecutionResult> {
		const startTime = Date.now();

		// Validate parameters
		const validation = validateToolParams(tool, call.parameters);
		if (!validation.ok) {
			console.error(
				'[ToolExecutor] Parameter validation failed for tool:',
				tool.name,
				'missing:',
				validation.missing
			);
			return {
				success: false,
				result: { error: 'Missing required parameters', missing: validation.missing },
				durationMs: Date.now() - startTime
			};
		}

		// Normalize parameters
		const normalizedParams = normalizeToolParams(call.parameters);

		// Check cache for read tools
		if (useCache && !isWriteTool(tool.name)) {
			const cacheKey = createToolCacheKey(userId, tool.name, normalizedParams);
			const cached = this.toolCache.get(cacheKey);
			if (cached !== undefined) {
				return {
					success: true,
					result: cached,
					durationMs: Date.now() - startTime,
					cached: true
				};
			}
		}

		// Execute the tool
		try {
			const result = await tool.execute(normalizedParams);

			// Cache result for read tools
			if (useCache && !isWriteTool(tool.name)) {
				const cacheKey = createToolCacheKey(userId, tool.name, normalizedParams);
				this.toolCache.set(cacheKey, result, this.cacheTtlMs);
			}

			return {
				success: true,
				result,
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error(
				'[ToolExecutor] Tool execution failed for:',
				tool.name,
				'error:',
				errorMsg,
				'full error:',
				error
			);
			return {
				success: false,
				result: { error: 'Tool execution failed' },
				error: errorMsg || 'Unknown error',
				durationMs: Date.now() - startTime
			};
		}
	}

	/**
	 * Execute multiple tool calls in parallel
	 */
	async executeToolsParallel(
		calls: ToolCall[],
		tools: ToolDefinition[],
		userId: string,
		useCache: boolean = true
	): Promise<ToolExecutionResult[]> {
		const results = await Promise.all(
			calls.map(async (call) => {
				const tool = tools.find((t) => t.name === call.name);
				if (!tool) {
					return {
						success: false,
						result: { error: 'Tool not found' },
						durationMs: 0
					} as ToolExecutionResult;
				}
				return this.executeTool(tool, call, userId, useCache);
			})
		);

		return results;
	}

	/**
	 * Execute multiple tool calls sequentially (for dependencies)
	 */
	async executeToolsSequential(
		calls: ToolCall[],
		tools: ToolDefinition[],
		userId: string,
		useCache: boolean = true
	): Promise<ToolExecutionResult[]> {
		const results: ToolExecutionResult[] = [];

		for (const call of calls) {
			const tool = tools.find((t) => t.name === call.name);
			if (!tool) {
				results.push({
					success: false,
					result: { error: 'Tool not found' },
					durationMs: 0
				});
				continue;
			}

			const result = await this.executeTool(tool, call, userId, useCache);
			results.push(result);

			// Stop on failure
			if (!result.success) {
				break;
			}
		}

		return results;
	}

	/**
	 * Clear the tool cache
	 */
	clearCache(): void {
		this.toolCache.clear();
	}
}
