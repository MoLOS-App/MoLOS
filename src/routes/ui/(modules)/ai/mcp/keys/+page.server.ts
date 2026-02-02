import type { PageServerLoad } from './$types';
import { ApiKeyRepository } from '$lib/repositories/ai/mcp';
import { getAllModules } from '$lib/config';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		return {
			user: null,
			keys: [],
			availableModules: []
		};
	}

	const repo = new ApiKeyRepository();

	// Parse query parameters
	const status = (url.searchParams.get('status') as any) ?? undefined;
	const search = url.searchParams.get('search') ?? undefined;
	const page = parseInt(url.searchParams.get('page') ?? '1');
	const limit = parseInt(url.searchParams.get('limit') ?? '50');

	const keys = await repo.listByUserId(locals.user.id, { status, search }, { page, limit });

	// Get available external modules for scoping
	const allModules = getAllModules();
	const availableModules = allModules.filter((m) => m.isExternal);

	return {
		user: locals.user,
		keys: keys.items,
		total: keys.total,
		page: keys.page,
		limit: keys.limit,
		hasMore: keys.hasMore,
		availableModules: availableModules.map((m) => ({ id: m.id, name: m.name }))
	};
};
