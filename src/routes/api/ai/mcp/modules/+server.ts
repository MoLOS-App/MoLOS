/**
 * MCP Modules Endpoint
 *
 * Lists all active modules and provides module-specific information.
 */

import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getAllModules } from '$lib/config';
import { AiToolbox } from '$lib/server/ai/toolbox';
import { mcpCache } from '$lib/server/ai/mcp/cache/mcp-cache';

/**
 * GET /api/ai/mcp/modules
 *
 * Returns all active modules with their tools
 */
export const GET = async ({ locals }: RequestEvent) => {
	const userId = locals.user?.id || 'anonymous';

	// Get all modules
	const allModules = getAllModules();

	// Get all tools for this user
	const toolbox = new AiToolbox();
	const activeModuleIds = allModules.map((m) => m.id);
	const tools = await toolbox.getTools(userId, activeModuleIds);

	// Get all module IDs for proper prefix detection
	const moduleIds = new Set(allModules.map((m) => m.id));

	// Group tools by module
	const moduleTools = new Map<string, any[]>();
	for (const tool of tools) {
		// Check if tool name starts with a known module ID (external modules have `{moduleId}_{toolName}`)
		let isModuleTool = false;
		for (const moduleId of moduleIds) {
			const prefix = `${moduleId}_`;
			if (tool.name.startsWith(prefix)) {
				const toolName = tool.name.slice(prefix.length);
				if (!moduleTools.has(moduleId)) {
					moduleTools.set(moduleId, []);
				}
				moduleTools.get(moduleId)!.push({
					name: toolName,
					fullName: tool.name,
					description: tool.description,
					parameters: tool.parameters
				});
				isModuleTool = true;
				break;
			}
		}

		// If not a module tool, it's a core tool
		if (!isModuleTool) {
			if (!moduleTools.has('core')) {
				moduleTools.set('core', []);
			}
			moduleTools.get('core')!.push({
				name: tool.name,
				fullName: tool.name,
				description: tool.description,
				parameters: tool.parameters
			});
		}
	}

	// Build response
	const modules = allModules.map((module) => ({
		id: module.id,
		name: module.name,
		description: module.description,
		isExternal: module.isExternal,
		tools: moduleTools.get(module.id) || []
	}));

	// Add core tools if any exist
	if (moduleTools.has('core')) {
		modules.unshift({
			id: 'core',
			name: 'Core',
			description: 'System-level tools and utilities',
			isExternal: false,
			tools: moduleTools.get('core') || []
		});
	}

	return json({
		modules,
		total: modules.length
	});
};

/**
 * DELETE /api/ai/mcp/modules
 *
 * Clear all MCP and toolbox caches (for debugging)
 */
export const DELETE = async () => {
	// Clear MCP cache
	mcpCache.clear();

	// Clear toolbox cache
	const { clearToolboxCache } = await import('$lib/server/ai/toolbox');
	clearToolboxCache();

	return json({
		success: true,
		message: 'All caches cleared'
	});
};
