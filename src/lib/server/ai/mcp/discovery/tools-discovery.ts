/**
 * MCP Tools Discovery Service
 *
 * Discovers and formats tools from the AiToolbox for MCP protocol.
 */

import { AiToolbox } from '../../toolbox';
import { toolDefinitionToMCPTool, filterToolsByModules } from '../mcp-utils';
import type { MCPTool, MCPContext } from '$lib/models/ai/mcp';

/**
 * Get available tools for MCP protocol
 *
 * Filters tools by the context's allowed modules.
 */
export async function getMcpTools(context: MCPContext): Promise<MCPTool[]> {
	const toolbox = new AiToolbox();

	// Get tools from AiToolbox (with user's active modules)
	const tools = await toolbox.getTools(context.userId, context.allowedModules);

	// Convert to MCP format
	const mcpTools = tools.map(toolDefinitionToMCPTool);

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
 * List tools for MCP tools/list endpoint
 */
export async function listMcpTools(context: MCPContext): Promise<{ tools: MCPTool[] }> {
	const tools = await getMcpTools(context);
	return { tools };
}

/**
 * Get available modules that provide tools
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
 * Get tool count by module
 */
export async function getToolCountByModule(context: MCPContext): Promise<
Record<string, number>
> {
	const tools = await getMcpTools(context);

	const counts: Record<string, number> = {};

	for (const tool of tools) {
		const parts = tool.name.split('_');
		const moduleId = parts.length >= 2 ? parts.slice(0, -1).join('_') : 'core';
		counts[moduleId] = (counts[moduleId] ?? 0) + 1;
	}

	return counts;
}
