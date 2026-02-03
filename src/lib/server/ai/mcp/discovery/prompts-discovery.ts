/**
 * MCP Prompts Discovery Service
 *
 * Discovers and formats prompts for MCP protocol.
 */

import { McpPromptRepository } from '$lib/repositories/ai/mcp';
import type { MCPProtocolPrompt, PromptMessage, MCPContext } from '$lib/models/ai/mcp';
import { mcpCache, CACHE_KEYS } from '../cache/mcp-cache';

/**
 * Get available prompts for MCP protocol (with caching)
 *
 * Returns prompts that match the context's allowed modules.
 */
export async function getMcpPrompts(context: MCPContext): Promise<MCPProtocolPrompt[]> {
	// Try cache first
	const cached = mcpCache.get<MCPProtocolPrompt[]>(CACHE_KEYS.PROMPTS_LIST, context);
	if (cached) {
		return cached;
	}

	// Cache miss - fetch from database
	const repo = new McpPromptRepository();
	const prompts = await repo.listEnabledForMcp(context.userId, context.allowedModules);

	// Store in cache
	mcpCache.set(CACHE_KEYS.PROMPTS_LIST, context, prompts, 300); // 5 minutes

	return prompts;
}

/**
 * List prompts for MCP prompts/list endpoint
 */
export async function listMcpPrompts(context: MCPContext): Promise<{
	prompts: MCPProtocolPrompt[];
}> {
	const prompts = await getMcpPrompts(context);
	return { prompts };
}

/**
 * Get a prompt by name with arguments
 */
export async function getMcpPrompt(
	context: MCPContext,
	name: string,
	arguments_: Record<string, unknown> = {}
): Promise<{
	description?: string;
	messages: PromptMessage[];
}> {
	const repo = new McpPromptRepository();

	// Find the prompt
	const prompt = await repo.getByName(context.userId, name);

	if (!prompt) {
		throw new Error(`Prompt not found: ${name}`);
	}

	// Check if enabled
	if (!prompt.enabled) {
		throw new Error('Prompt is disabled');
	}

	// Check module scope
	if (prompt.moduleId && context.allowedModules.length > 0) {
		if (!context.allowedModules.includes(prompt.moduleId)) {
			throw new Error('Module not allowed for this API key');
		}
	}

	// Validate required arguments
	const requiredArgs = prompt.arguments.filter((a) => a.required);
	for (const arg of requiredArgs) {
		if (!(arg.name in arguments_)) {
			throw new Error(`Missing required argument: ${arg.name}`);
		}
	}

	// In a full implementation, we would:
	// 1. Use the prompt template to generate messages
	// 2. Fill in the arguments
	// For now, return a simple placeholder response
	const messages: PromptMessage[] = [
		{
			role: 'user',
			content: {
				type: 'text',
				text: `Prompt: ${prompt.description}\nArguments: ${JSON.stringify(arguments_, null, 2)}`
			}
		}
	];

	return {
		description: prompt.description,
		messages
	};
}

/**
 * Get prompts by module
 */
export async function getPromptsByModule(
	context: MCPContext,
	moduleId: string
): Promise<MCPProtocolPrompt[]> {
	const allPrompts = await getMcpPrompts(context);
	return allPrompts.filter((p) => {
		// Include prompts without module or matching module
		// (We'd need to add moduleId to MCPProtocolPrompt type to filter properly)
		return true;
	});
}

/**
 * Get prompt count by module (with caching)
 */
export async function getPromptCountByModule(context: MCPContext): Promise<
	Record<string, number>
> {
	// Try cache first
	const cached = mcpCache.get<Record<string, number>>(CACHE_KEYS.PROMPT_COUNTS, context);
	if (cached) {
		return cached;
	}

	const repo = new McpPromptRepository();

	// Get all prompts (not just MCP format) to count by module
	const promptsPaginated = await repo.listByUserId(context.userId, { enabled: true });

	const counts: Record<string, number> = {};

	for (const prompt of promptsPaginated.items) {
		const moduleId = prompt.moduleId ?? 'global';
		counts[moduleId] = (counts[moduleId] ?? 0) + 1;
	}

	// Store in cache
	mcpCache.set(CACHE_KEYS.PROMPT_COUNTS, context, counts, 300); // 5 minutes

	return counts;
}

/**
 * Invalidate prompts cache for a user
 * Call this when prompts are added/removed/updated
 */
export function invalidatePromptsCache(context: MCPContext): void {
	mcpCache.invalidate(CACHE_KEYS.PROMPTS_LIST, context);
	mcpCache.invalidate(CACHE_KEYS.PROMPT_COUNTS, context);
}
