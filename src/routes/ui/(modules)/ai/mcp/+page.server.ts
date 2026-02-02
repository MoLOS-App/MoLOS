import type { PageServerLoad } from './$types';
import { ApiKeyRepository } from '$lib/repositories/ai/mcp';
import { McpLogRepository } from '$lib/repositories/ai/mcp';
import { MCPApiKeyStatus } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return {
			user: null,
			stats: null,
			recentLogs: []
		};
	}

	const apiKeyRepo = new ApiKeyRepository();
	const logRepo = new McpLogRepository();

	// Get API key stats
	const apiKeys = await apiKeyRepo.listByUserId(locals.user.id, {}, { limit: 100 });
	const activeKeys = apiKeys.items.filter((k) => k.status === MCPApiKeyStatus.ACTIVE).length;

	// Get MCP logs stats
	const stats = await logRepo.getStats(locals.user.id);

	// Get recent logs
	const recentLogs = await logRepo.listByUserId(locals.user.id, {}, { limit: 10 });

	// Get available modules
	const availableModules = getAvailableExternalModules();

	return {
		user: locals.user,
		stats: {
			activeKeys,
			totalKeys: apiKeys.total,
			totalRequests: stats.totalRequests,
			successRate: stats.totalRequests > 0
				? Math.round((stats.successCount / stats.totalRequests) * 100)
				: 0,
			avgDuration: Math.round(stats.avgDuration)
		},
		recentLogs: recentLogs.items,
		availableModules
	};
};

function getAvailableExternalModules(): string[] {
	// Import at runtime to avoid SSR issues
	const { getAllModules } = require('$lib/config');
	const modules = getAllModules();
	return modules.filter((m: any) => m.isExternal).map((m: any) => ({ id: m.id, name: m.name }));
}
