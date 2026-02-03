/**
 * MCP Tools Discovery Service
 *
 * Discovers and formats tools from the AiToolbox for MCP protocol.
 */

import { AiToolbox } from '../../toolbox';
import { toolDefinitionToMCPTool, filterToolsByModules } from '../mcp-utils';
import type { MCPTool, MCPContext } from '$lib/models/ai/mcp';
import { mcpCache, CACHE_KEYS } from '../cache/mcp-cache';

/**
 * Get available tools for MCP protocol (with caching)
 *
 * Filters tools by the context's allowed modules.
 */
export async function getMcpTools(context: MCPContext): Promise<MCPTool[]> {
	// Try cache first
	const cached = mcpCache.get<MCPTool[]>(CACHE_KEYS.TOOLS_LIST, context);
	if (cached) {
		return cached;
	}

	// Cache miss - fetch from toolbox
	const toolbox = new AiToolbox();
	const tools = await toolbox.getTools(context.userId, context.allowedModules);
	const mcpTools = tools.map(toolDefinitionToMCPTool);

	// Store in cache with shorter TTL (1 minute) for faster updates
	mcpCache.set(CACHE_KEYS.TOOLS_LIST, context, mcpTools, 60); // 1 minute

	return mcpTools;
}

/**
 * Get a specific tool by name
 */
export async function getMcpToolByName(
	context: MCPContext,
	toolName: string
): Promise<MCPTool | null> {
	const tools = await getMcpTools(context);
	return tools.find((t) => t.name === toolName) ?? null;
}

/**
 * List tools for MCP tools/list endpoint (with caching)
 */
export async function listMcpTools(context: MCPContext): Promise<{ tools: MCPTool[] }> {
	const tools = await getMcpTools(context);
	return { tools };
}

/**
 * Get available modules that provide tools (with caching)
 */
export async function getToolModules(context: MCPContext): Promise<string[]> {
	const tools = await getMcpTools(context);

	// Extract unique module IDs from tool names
	const moduleIds = new Set<string>();
	for (const tool of tools) {
		const parts = tool.name.split('_');
		if (parts.length >= 2) {
			moduleIds.add(parts.slice(0, -1).join('_'));
		}
	}

	return Array.from(moduleIds).sort();
}

/**
 * Get tool count by module (with caching)
 */
export async function getToolCountByModule(context: MCPContext): Promise<
	Record<string, number>
> {
	// Try cache first
	const cached = mcpCache.get<Record<string, number>>(CACHE_KEYS.TOOL_COUNTS, context);
	if (cached) {
		return cached;
	}

	const tools = await getMcpTools(context);

	const counts: Record<string, number> = {};

	for (const tool of tools) {
		const parts = tool.name.split('_');
		const moduleId = parts.length >= 2 ? parts.slice(0, -1).join('_') : 'core';
		counts[moduleId] = (counts[moduleId] ?? 0) + 1;
	}

	// Store in cache
	mcpCache.set(CACHE_KEYS.TOOL_COUNTS, context, counts, 300); // 5 minutes

	return counts;
}

/**
 * Invalidate tools cache for a user
 * Call this when tools are added/removed/updated
 */
export function invalidateToolsCache(context: MCPContext): void {
	mcpCache.invalidate(CACHE_KEYS.TOOLS_LIST, context);
	mcpCache.invalidate(CACHE_KEYS.TOOL_COUNTS, context);
}
