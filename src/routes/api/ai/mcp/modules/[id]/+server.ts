/**
 * MCP Module Detail Endpoint
 *
 * Returns detailed information about a specific module including its tools.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getAllModules } from '$lib/config';
import { AiToolbox } from '$lib/server/ai/toolbox';

/**
 * GET /api/ai/mcp/modules/[id]
 *
 * Returns details for a specific module
 */
export const GET = async ({ params, locals }: RequestEvent) => {
	const moduleId = params.id;
	const userId = locals.user?.id || 'anonymous';

	// Get all modules
	const allModules = getAllModules();

	// Handle special case for 'core'
	if (moduleId === 'core') {
		const toolbox = new AiToolbox();
		const tools = await toolbox.getTools(userId, allModules.map((m) => m.id));

		// Get all module IDs for proper filtering
		const moduleIds = new Set(allModules.map((m) => m.id));

		// Filter for core tools (tools that don't start with a known module ID)
		const coreTools = tools.filter((t) => {
			for (const mid of moduleIds) {
				if (t.name.startsWith(`${mid}_`)) {
					return false;
				}
			}
			return true;
		});

		return json({
			id: 'core',
			name: 'Core',
			description: 'System-level tools and utilities',
			isExternal: false,
			tools: coreTools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters
			}))
		});
	}

	// Find the module
	const module = allModules.find((m) => m.id === moduleId);

	if (!module) {
		error(404, `Module not found: ${moduleId}`);
	}

	// Get all tools and filter for this module
	const toolbox = new AiToolbox();
	const activeModuleIds = allModules.map((m) => m.id);
	const allTools = await toolbox.getTools(userId, activeModuleIds);

	// Filter tools for this module
	const prefix = `${moduleId}_`;
	const moduleTools = allTools
		.filter((t) => t.name.startsWith(prefix))
		.map((tool) => ({
			name: tool.name.slice(prefix.length),
			fullName: tool.name,
			description: tool.description,
			parameters: tool.parameters
		}));

	return json({
		id: module.id,
		name: module.name,
		description: module.description,
		isExternal: module.isExternal,
		tools: moduleTools
	});
};
