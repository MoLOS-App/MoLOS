import type { PageServerLoad } from './$types';
import { ApiKeyRepository } from '$lib/repositories/ai/mcp';
import { McpLogRepository } from '$lib/repositories/ai/mcp';
import { getAllModules } from '$lib/config';
import { AiToolbox } from '$lib/server/ai/toolbox';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const apiKeyRepo = new ApiKeyRepository();
	const logRepo = new McpLogRepository();

	// Get API key
	const apiKey = await apiKeyRepo.getByUserIdAndId(locals.user.id, params.keyId);

	if (!apiKey) {
		throw error(404, 'API key not found');
	}

	// Get recent usage logs
	const recentLogs = await logRepo.listByApiKey(apiKey.id, 10);

	// Get stats
	const stats = await logRepo.getStats(locals.user.id, apiKey.id);

	// Get all modules with their tools and submodules
	const allModules = getAllModules();
	const toolbox = new AiToolbox();
	const activeModuleIds = allModules.map((m) => m.id);
	const tools = await toolbox.getTools(locals.user.id, activeModuleIds);

	// Get all module IDs for proper prefix detection
	const moduleIds = new Set(allModules.map((m) => m.id));

	// Group tools by module and submodule
	const moduleSubmoduleTools = new Map<string, Map<string, any[]>>();

	for (const tool of tools) {
		// Check if tool name starts with a known module ID (format: "ModuleID_toolName")
		let isModuleTool = false;
		for (const moduleId of moduleIds) {
			const prefix = `${moduleId}_`;
			if (tool.name.startsWith(prefix)) {
				const toolName = tool.name.slice(prefix.length);
				// Get submodule from tool metadata (added in module ai-tools.ts files)
				const submodule = tool.metadata?.submodule || 'main';

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
	}

	// Build modules data
	const modules = allModules.map((module) => {
		const submodules = moduleSubmoduleTools.get(module.id);

		return {
			id: module.id,
			name: module.name,
			description: module.description,
			isExternal: module.isExternal,
			submodules: submodules || new Map()
		};
	});

	// Add core tools if any exist
	if (moduleSubmoduleTools.has('core')) {
		modules.unshift({
			id: 'core',
			name: 'Core',
			description: 'System-level tools and utilities',
			isExternal: false,
			submodules: moduleSubmoduleTools.get('core') || new Map()
		});
	}

	console.log('[ApiKeyDetail Server] Returning modules count:', modules.length);
	console.log(
		'[ApiKeyDetail Server] Module IDs:',
		modules.map((m) => m.id)
	);

	return {
		apiKey,
		recentLogs,
		stats,
		modules
	};
};
