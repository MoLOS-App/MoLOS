import type { PageServerLoad } from './$types';
import { McpPromptRepository } from '$lib/repositories/ai/mcp';
import { getAllModules } from '$lib/config';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		return {
			user: null,
			prompts: [],
			availableModules: []
		};
	}

	const repo = new McpPromptRepository();

	// Parse query parameters
	const moduleId = url.searchParams.get('moduleId') ?? undefined;
	const enabled = url.searchParams.get('enabled') === 'true' ? true : url.searchParams.get('enabled') === 'false' ? false : undefined;
	const search = url.searchParams.get('search') ?? undefined;
	const page = parseInt(url.searchParams.get('page') ?? '1');
	const limit = parseInt(url.searchParams.get('limit') ?? '50');

	const prompts = await repo.listByUserId(locals.user.id, { moduleId, enabled, search }, { page, limit });

	// Get available external modules
	const allModules = getAllModules();
	const availableModules = allModules.filter((m) => m.isExternal);

	return {
		user: locals.user,
		prompts: prompts.items,
		total: prompts.total,
		page: prompts.page,
		limit: prompts.limit,
		hasMore: prompts.hasMore,
		availableModules: availableModules.map((m) => ({ id: m.id, name: m.name }))
	};
};
