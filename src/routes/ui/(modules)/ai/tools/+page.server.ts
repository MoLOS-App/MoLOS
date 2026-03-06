import type { PageServerLoad } from './$types';
import { AiToolbox } from '$lib/server/ai/toolbox';
import { getAllModules } from '$lib/config';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.id || 'anonymous';
	const toolbox = new AiToolbox();

	// Get all modules (including package modules)
	const allModules = getAllModules();

	// Get tools for all active package modules
	const activeModuleIds = allModules.filter((m) => m.isPackageModule).map((m) => m.id);
	const tools = await toolbox.getTools(userId, activeModuleIds);

	// Group tools by module ID
	const toolsByModule: Record<string, Array<{ name: string; description: string }>> = {};
	const coreTools: Array<{ name: string; description: string }> = [];

	// Get the list of actual module IDs from package modules
	const packageModuleIds = new Set(allModules.filter((m) => m.isPackageModule).map((m) => m.id));

	for (const tool of tools) {
		// Check if this tool belongs to a module (has moduleId prefix)
		let isModuleTool = false;
		let matchedModuleId: string | null = null;

		for (const moduleId of packageModuleIds) {
			if (tool.name.startsWith(`${moduleId}_`)) {
				isModuleTool = true;
				matchedModuleId = moduleId;
				break;
			}
		}

		if (isModuleTool && matchedModuleId) {
			// This is a module tool - extract the tool name
			const toolName = tool.name.slice(matchedModuleId.length + 1);
			if (!toolsByModule[matchedModuleId]) {
				toolsByModule[matchedModuleId] = [];
			}
			toolsByModule[matchedModuleId].push({
				name: toolName,
				description: tool.description
			});
		} else {
			// This is a core tool
			coreTools.push({
				name: tool.name,
				description: tool.description
			});
		}
	}

	return {
		user: locals.user || null,
		coreTools,
		toolsByModule,
		modules: allModules
			.filter((m) => m.isPackageModule)
			.map((m) => ({
				id: m.id,
				name: m.name,
				description: m.description
			}))
	};
};
