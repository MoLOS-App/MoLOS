import type { PageServerLoad } from './$types';
import { ApiKeyRepository } from '$lib/repositories/ai/mcp';
import { McpLogRepository } from '$lib/repositories/ai/mcp';
import { McpResourceRepository } from '$lib/repositories/ai/mcp';
import { McpPromptRepository } from '$lib/repositories/ai/mcp';
import { MCPApiKeyStatus, MCPLogStatus } from '$lib/server/db/schema';
import { getAllModules } from '$lib/config';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		return {
			user: null,
			stats: null,
			recentLogs: [],
			keys: [],
			totalKeys: 0,
			resources: [],
			totalResources: 0,
			prompts: [],
			totalPrompts: 0,
			logs: [],
			totalLogs: 0,
			availableModules: [],
			apiKeysForFilter: []
		};
	}

	const apiKeyRepo = new ApiKeyRepository();
	const logRepo = new McpLogRepository();
	const resourceRepo = new McpResourceRepository();
	const promptRepo = new McpPromptRepository();

	// Parse query parameters for different tabs
	const tab = url.searchParams.get('tab') ?? 'dashboard';

	// Keys filters
	const keyStatus = (url.searchParams.get('keyStatus') as any) ?? undefined;
	const keySearch = url.searchParams.get('keySearch') ?? undefined;
	const keyPage = parseInt(url.searchParams.get('keyPage') ?? '1');
	const keyLimit = parseInt(url.searchParams.get('keyLimit') ?? '50');

	// Resources filters
	const resourceId = url.searchParams.get('resourceId') ?? undefined;
	const resourceEnabled =
		url.searchParams.get('resourceEnabled') === 'true'
			? true
			: url.searchParams.get('resourceEnabled') === 'false'
				? false
				: undefined;
	const resourceSearch = url.searchParams.get('resourceSearch') ?? undefined;
	const resourcePage = parseInt(url.searchParams.get('resourcePage') ?? '1');
	const resourceLimit = parseInt(url.searchParams.get('resourceLimit') ?? '50');

	// Prompts filters
	const promptId = url.searchParams.get('promptId') ?? undefined;
	const promptEnabled =
		url.searchParams.get('promptEnabled') === 'true'
			? true
			: url.searchParams.get('promptEnabled') === 'false'
				? false
				: undefined;
	const promptSearch = url.searchParams.get('promptSearch') ?? undefined;
	const promptPage = parseInt(url.searchParams.get('promptPage') ?? '1');
	const promptLimit = parseInt(url.searchParams.get('promptLimit') ?? '50');

	// Logs filters
	const logApiKey = url.searchParams.get('logApiKey') ?? undefined;
	const logMethod = url.searchParams.get('logMethod') ?? undefined;
	const logStatus =
		(url.searchParams.get('logStatus') as
			| (typeof MCPLogStatus)[keyof typeof MCPLogStatus]
			| undefined) ?? undefined;
	const logSearch = url.searchParams.get('logSearch') ?? undefined;
	const logPage = parseInt(url.searchParams.get('logPage') ?? '1');
	const logLimit = parseInt(url.searchParams.get('logLimit') ?? '50');

	// Fetch all data
	const apiKeys = await apiKeyRepo.listByUserId(
		locals.user.id,
		{ status: keyStatus, search: keySearch },
		{ page: keyPage, limit: keyLimit }
	);
	const resources = await resourceRepo.listByUserId(
		locals.user.id,
		{ moduleId: resourceId, enabled: resourceEnabled, search: resourceSearch },
		{ page: resourcePage, limit: resourceLimit }
	);
	const prompts = await promptRepo.listByUserId(
		locals.user.id,
		{ moduleId: promptId, enabled: promptEnabled, search: promptSearch },
		{ page: promptPage, limit: promptLimit }
	);
	const logs = await logRepo.listByUserId(
		locals.user.id,
		{ apiKeyId: logApiKey, method: logMethod, status: logStatus, search: logSearch },
		{ page: logPage, limit: logLimit }
	);

	// Stats
	const activeKeys =
		apiKeys.total > 0
			? (
					await apiKeyRepo.listByUserId(
						locals.user.id,
						{ status: MCPApiKeyStatus.ACTIVE },
						{ limit: 1 }
					)
				).total
			: 0;
	const stats = await logRepo.getStats(locals.user.id);

	// Get available modules
	const allModules = getAllModules();
	const availableModules = allModules.filter((m) => m.isExternal);

	// Get API keys for logs filtering
	const apiKeysForFilter = await apiKeyRepo.listByUserId(locals.user.id, {}, { limit: 100 });

	return {
		user: locals.user,
		tab,
		stats: {
			activeKeys,
			totalKeys: apiKeys.total,
			totalRequests: stats.totalRequests,
			successRate:
				stats.totalRequests > 0 ? Math.round((stats.successCount / stats.totalRequests) * 100) : 0,
			avgDuration: Math.round(stats.avgDuration),
			errorCount: stats.errorCount,
			successCount: stats.successCount
		},
		recentLogs: (await logRepo.listByUserId(locals.user.id, {}, { limit: 10 })).items,
		keys: apiKeys.items,
		totalKeys: apiKeys.total,
		keyPage: apiKeys.page,
		keyLimit: apiKeys.limit,
		keyHasMore: apiKeys.hasMore,
		resources: resources.items,
		totalResources: resources.total,
		resourcePage: resources.page,
		resourceLimit: resources.limit,
		resourceHasMore: resources.hasMore,
		prompts: prompts.items,
		totalPrompts: prompts.total,
		promptPage: prompts.page,
		promptLimit: prompts.limit,
		promptHasMore: prompts.hasMore,
		logs: logs.items,
		totalLogs: logs.total,
		logPage: logs.page,
		logLimit: logs.limit,
		logHasMore: logs.hasMore,
		availableModules: availableModules.map((m) => ({ id: m.id, name: m.name })),
		apiKeysForFilter: apiKeysForFilter.items
	};
};
