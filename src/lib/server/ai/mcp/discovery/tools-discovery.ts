/**
 * MCP Tools Discovery Service
 *
 * Discovers and formats tools from the AiToolbox for MCP protocol.
 */

import { AiToolbox } from '../../toolbox';
import { toolDefinitionToMCPTool, filterToolsByModules } from '../mcp-utils';
import type { MCPTool, MCPContext } from '$lib/models/ai/mcp';
import { mcpCache, CACHE_KEYS } from '../cache/mcp-cache';
import { getAllModules } from '$lib/config';

/**
 * Get available tools for MCP protocol (with caching)
 *
 * Filters tools by the context's allowed modules.
 */
export async function getMcpTools(context: MCPContext): Promise<MCPTool[]> {
	console.log(
		'[MCP Tools] Getting tools for userId:',
		context.userId,
		'allowedModules:',
		context.allowedModules
	);

	// Try cache first
	const cached = mcpCache.get<MCPTool[]>(CACHE_KEYS.TOOLS_LIST, context);
	if (cached) {
		console.log('[MCP Tools] Returning cached tools, count:', cached.length);
		return cached;
	}

	// Cache miss - fetch from toolbox
	const toolbox = new AiToolbox();
	const tools = await toolbox.getTools(context.userId, context.allowedModules);
	console.log('[MCP Tools] Got tools from toolbox, count:', tools.length);

	const mcpTools = tools.map(toolDefinitionToMCPTool);
	console.log(
		'[MCP Tools] Tool names:',
		mcpTools.map((t) => t.name)
	);

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

	// Get all known module IDs for proper categorization
	const allModules = getAllModules();
	const moduleIds = new Set(allModules.map((m) => m.id));

	// Extract unique module IDs from tool names
	const foundModuleIds = new Set<string>();
	for (const tool of tools) {
		// Check if tool starts with a known module ID
		for (const moduleId of moduleIds) {
			if (tool.name.startsWith(`${moduleId}_`)) {
				foundModuleIds.add(moduleId);
				break;
			}
		}
	}

	return Array.from(foundModuleIds).sort();
}

/**
 * Get tool count by module (with caching)
 */
export async function getToolCountByModule(context: MCPContext): Promise<Record<string, number>> {
	// Try cache first
	const cached = mcpCache.get<Record<string, number>>(CACHE_KEYS.TOOL_COUNTS, context);
	if (cached) {
		return cached;
	}

	const tools = await getMcpTools(context);

	// Get all known module IDs for proper categorization
	const allModules = getAllModules();
	const moduleIds = new Set(allModules.map((m) => m.id));

	const counts: Record<string, number> = {};

	for (const tool of tools) {
		// Check if tool starts with a known module ID
		let moduleId = 'core';
		for (const mid of moduleIds) {
			if (tool.name.startsWith(`${mid}_`)) {
				moduleId = mid;
				break;
			}
		}
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
