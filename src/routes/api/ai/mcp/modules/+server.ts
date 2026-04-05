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

	// Group tools by module and submodule
	const moduleSubmoduleTools = new Map<string, Map<string, any[]>>();

	for (const tool of tools) {
		// Check if tool name starts with a known module ID (external modules have `{moduleId}_{toolName}`)
		let isModuleTool = false;
		for (const moduleId of moduleIds) {
			const prefix = `${moduleId}_`;
			if (tool.name.startsWith(prefix)) {
				const toolName = tool.name.slice(prefix.length);
				const submodule = tool.metadata?.submodule || 'main'; // Get submodule from tool metadata

				if (!moduleSubmoduleTools.has(moduleId)) {
					moduleSubmoduleTools.set(moduleId, new Map());
				}

				if (!moduleSubmoduleTools.get(moduleId)!.has(submodule)) {
					moduleSubmoduleTools.get(moduleId)!.set(submodule, []);
				}

				moduleSubmoduleTools.get(moduleId)!.get(submodule)!.push({
					name: toolName,
					fullName: tool.name,
					description: tool.description,
					parameters: tool.parameters,
					submodule
				});
				isModuleTool = true;
				break;
			}
		}

		// If not a module tool, it's a core tool
		if (!isModuleTool) {
			const submodule = tool.metadata?.submodule || 'main';

			if (!moduleSubmoduleTools.has('core')) {
				moduleSubmoduleTools.set('core', new Map());
			}

			if (!moduleSubmoduleTools.get('core')!.has(submodule)) {
				moduleSubmoduleTools.get('core')!.set(submodule, []);
			}

			moduleSubmoduleTools.get('core')!.get(submodule)!.push({
				name: tool.name,
				fullName: tool.name,
				description: tool.description,
				parameters: tool.parameters,
				submodule
			});
		}
	}

	// Build response with submodule hierarchy

	// Build response with submodule hierarchy
	const modules = allModules.map((module) => {
		const submodulesMap = moduleSubmoduleTools.get(module.id);
		return {
			id: module.id,
			name: module.name,
			description: module.description,
			isExternal: module.isExternal,
			submodules: submodulesMap
				? Object.fromEntries(Array.from(submodulesMap.entries()).map(([k, v]) => [k, v]))
				: {}
		};
	});

	// Add core tools if any exist
	if (moduleSubmoduleTools.has('core')) {
		const coreSubmodulesMap = moduleSubmoduleTools.get('core')!;
		modules.unshift({
			id: 'core',
			name: 'Core',
			description: 'System-level tools and utilities',
			isExternal: false,
			submodules: Object.fromEntries(
				Array.from(coreSubmodulesMap.entries()).map(([k, v]) => [k, v])
			)
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
