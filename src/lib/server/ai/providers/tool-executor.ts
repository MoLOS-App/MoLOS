/**
 * Tool Executor for @molos/agent AgentLoop
 *
 * Implements the tool executor callback that AgentLoop calls
 * when it needs to execute a tool.
 */

import type { ToolDefinition, ToolResult } from '@molos/agent';
import { AiToolbox } from '$lib/server/ai/toolbox';

export interface ToolExecutorDeps {
	toolbox: AiToolbox;
	userId: string;
	activeModuleIds: string[];
	mentionedModuleIds: string[];
}

export function createToolExecutor(deps: ToolExecutorDeps) {
	const { toolbox, userId, activeModuleIds, mentionedModuleIds } = deps;

	// Cache tools for performance
	let cachedTools: any[] = [];
	let cacheTime = 0;
	const CACHE_TTL_MS = 10000; // 10 seconds

	return async function toolExecutor(
		toolName: string,
		args: Record<string, unknown>
	): Promise<ToolResult> {
		const startMs = Date.now();

		// Refresh tools cache if needed
		const now = Date.now();
		if (now - cacheTime > CACHE_TTL_MS) {
			cachedTools = await toolbox.getTools(userId, activeModuleIds, mentionedModuleIds);
			cacheTime = now;
		}

		// Find the tool
		const tool = cachedTools.find((t) => t.name === toolName);

		if (!tool) {
			return {
				toolName,
				arguments: args,
				success: false,
				error: `Tool not found: ${toolName}`,
				executionMs: Date.now() - startMs
			};
		}

		if (!tool.execute) {
			return {
				toolName,
				arguments: args,
				success: false,
				error: `Tool has no execute function: ${toolName}`,
				executionMs: Date.now() - startMs
			};
		}

		try {
			// Execute the tool
			const result = await tool.execute(args);

			return {
				toolName,
				arguments: args,
				success: true,
				output: typeof result === 'string' ? result : JSON.stringify(result),
				executionMs: Date.now() - startMs
			};
		} catch (error) {
			return {
				toolName,
				arguments: args,
				success: false,
				error: error instanceof Error ? error.message : String(error),
				executionMs: Date.now() - startMs
			};
		}
	};
}
