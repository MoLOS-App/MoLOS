/**
 * Tool Wrapper - Convert v2 tools to AI SDK format
 *
 * Wraps v2 ToolDefinition objects with hooks support and converts
 * them to AI SDK tool() format.
 */

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import type { ToolDefinition, ToolExecutionResult } from '../types';
import { convertTypeBoxToZod } from './schema-converter';
import type { HookManager } from '../../v2/hooks/hook-manager';
import type { EventBus } from '../../v2/events/event-bus';

/**
 * Options for wrapping tools
 */
export interface ToolWrapperOptions {
	/** Hook manager for pre/post execution */
	hookManager?: HookManager;
	/** Event bus for emitting events */
	eventBus?: EventBus;
	/** Enable caching */
	enableCache?: boolean;
	/** Cache TTL in milliseconds */
	cacheTtlMs?: number;
}

/**
 * Simple in-memory cache for tool results
 */
class ToolResultCache {
	private cache: Map<string, { result: unknown; expires: number }> = new Map();
	private maxSize: number;

	constructor(maxSize = 100) {
		this.maxSize = maxSize;
	}

	private generateKey(toolName: string, params: Record<string, unknown>): string {
		return `${toolName}:${JSON.stringify(params)}`;
	}

	get(toolName: string, params: Record<string, unknown>): unknown | null {
		const key = this.generateKey(toolName, params);
		const cached = this.cache.get(key);

		if (cached && cached.expires > Date.now()) {
			return cached.result;
		}

		this.cache.delete(key);
		return null;
	}

	set(toolName: string, params: Record<string, unknown>, result: unknown, ttlMs: number): void {
		// Evict oldest entries if at capacity
		if (this.cache.size >= this.maxSize) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) {
				this.cache.delete(oldestKey);
			}
		}

		const key = this.generateKey(toolName, params);
		this.cache.set(key, {
			result,
			expires: Date.now() + ttlMs,
		});
	}

	clear(): void {
		this.cache.clear();
	}
}

// Global tool cache instance
const toolCache = new ToolResultCache();

/**
 * Wrap a v2 ToolDefinition with hook support and convert to AI SDK tool
 */
export function wrapToolWithHooks(
	toolDef: ToolDefinition,
	options: ToolWrapperOptions = {}
): unknown {
	const { hookManager, eventBus, enableCache = false, cacheTtlMs = 60000 } = options;

	// Convert parameters schema to Zod
	const zodSchema = toolDef.parameters
		? convertTypeBoxToZod(toolDef.parameters)
		: z.object({});

	return tool({
		description: toolDef.description,
		inputSchema: zodSchema,
		execute: async (input: Record<string, unknown>) => {
			const startTime = Date.now();
			const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

			// Check cache first
			if (enableCache) {
				const cached = toolCache.get(toolDef.name, input);
				if (cached !== null) {
					eventBus?.emitSync({
						type: 'tool_complete',
						timestamp: Date.now(),
						data: {
							toolName: toolDef.name,
							toolCallId,
							cached: true,
							durationMs: 0,
						},
					} as any);

					return {
						...cached,
						_cached: true,
					};
				}
			}

			// Emit tool start event
			eventBus?.emitSync({
				type: 'tool_start',
				timestamp: Date.now(),
				data: {
					toolName: toolDef.name,
					toolCallId,
					parameters: input,
				},
			} as any);

			let result: ToolExecutionResult;

			try {
				// Execute the tool
				if (toolDef.execute) {
					const rawResult = await toolDef.execute(input);
					result = {
						success: true,
						result: rawResult,
						durationMs: Date.now() - startTime,
					};
				} else {
					result = {
						success: false,
						result: null,
						error: 'Tool has no execute function',
						durationMs: Date.now() - startTime,
					};
				}

				// Cache successful results
				if (enableCache && result.success) {
					toolCache.set(toolDef.name, input, result.result, cacheTtlMs);
					result.cached = false;
				}
			} catch (error) {
				result = {
					success: false,
					result: null,
					error: error instanceof Error ? error.message : String(error),
					durationMs: Date.now() - startTime,
				};
			}

			// Emit tool complete event
			eventBus?.emitSync({
				type: 'tool_complete',
				timestamp: Date.now(),
				data: {
					toolName: toolDef.name,
					toolCallId,
					result: result.result,
					error: result.error,
					durationMs: result.durationMs,
					cached: result.cached,
				},
			} as any);

			return result;
		},
	});
}

/**
 * Convert an array of v2 ToolDefinitions to AI SDK ToolSet
 */
export function convertToolsToAiSdk(
	tools: ToolDefinition[],
	options: ToolWrapperOptions = {}
): ToolSet {
	const aiSdkTools: ToolSet = {};

	for (const toolDef of tools) {
		aiSdkTools[toolDef.name] = wrapToolWithHooks(toolDef, options) as any;
	}

	return aiSdkTools;
}

/**
 * Clear the tool cache
 */
export function clearToolCache(): void {
	toolCache.clear();
}
