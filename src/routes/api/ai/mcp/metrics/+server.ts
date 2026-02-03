/**
 * MCP Metrics Endpoint
 *
 * Exposes MCP operational metrics.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mcpMetrics } from '$lib/server/ai/mcp/observability/metrics';
import { logQueue } from '$lib/server/ai/mcp/logging/log-queue';
import { mcpCache } from '$lib/server/ai/mcp/cache/mcp-cache';
import { mcpRateLimiters } from '$lib/server/ai/mcp/rate-limit/sliding-window-limiter';

/**
 * GET /api/ai/mcp/metrics
 *
 * Returns MCP operational metrics
 */
export const GET: RequestHandler = async () => {
	const summary = mcpMetrics.getSummary();
	const logStats = logQueue.getStats();
	const cacheStats = mcpCache.getStats();
	const rateLimitStats = {
		default: mcpRateLimiters.default.getStats(),
		tools: mcpRateLimiters.tools.getStats(),
		resources: mcpRateLimiters.resources.getStats()
	};

	return json({
		timestamp: new Date().toISOString(),
		metrics: summary,
		logQueue: logStats,
		cache: cacheStats,
		rateLimit: rateLimitStats
	});
};
