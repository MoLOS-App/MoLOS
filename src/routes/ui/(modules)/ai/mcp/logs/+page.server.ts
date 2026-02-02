import type { PageServerLoad } from './$types';
import { McpLogRepository } from '$lib/repositories/ai/mcp';
import { ApiKeyRepository } from '$lib/repositories/ai/mcp';
import { MCPLogStatus } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		return {
			user: null,
			logs: [],
			apiKeys: []
		};
	}

	const logRepo = new McpLogRepository();
	const apiKeyRepo = new ApiKeyRepository();

	// Parse query parameters
	const apiKeyId = url.searchParams.get('apiKeyId') ?? undefined;
	const method = url.searchParams.get('method') ?? undefined;
	const status = (url.searchParams.get('status') as MCPLogStatus | undefined) ?? undefined;
	const search = url.searchParams.get('search') ?? undefined;
	const page = parseInt(url.searchParams.get('page') ?? '1');
	const limit = parseInt(url.searchParams.get('limit') ?? '50');

	const logs = await logRepo.listByUserId(locals.user.id, { apiKeyId, method, status, search }, { page, limit });

	// Get API keys for filtering
	const apiKeysResult = await apiKeyRepo.listByUserId(locals.user.id, {}, { limit: 100 });

	return {
		user: locals.user,
		logs: logs.items,
		total: logs.total,
		page: logs.page,
		limit: logs.limit,
		hasMore: logs.hasMore,
		apiKeys: apiKeysResult.items,
		stats: await logRepo.getStats(locals.user.id)
	};
};
