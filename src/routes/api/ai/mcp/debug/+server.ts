/**
 * MCP Debug Endpoint
 *
 * For debugging MCP tool discovery
 */

import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import {
	authenticateRequest,
	extractAuthHeader
} from '$lib/server/ai/mcp/middleware/auth-middleware';
import { getMcpTools } from '$lib/server/ai/mcp/discovery/tools-discovery';
import { mcpCache } from '$lib/server/ai/mcp/cache/mcp-cache';

/**
 * GET /api/ai/mcp/debug
 *
 * Returns debug info about MCP tools for the current authentication
 */
export const GET = async ({ request }: RequestEvent) => {
	const authHeader = extractAuthHeader(request);

	if (!authHeader) {
		return json(
			{
				error: 'No authentication provided',
				hint: 'Use MOLOS_MCP_API_KEY header'
			},
			{ status: 401 }
		);
	}

	// Get session ID from URL
	const url = new URL(request.url);
	const sessionId = url.searchParams.get('sessionId') || `debug_${Date.now()}`;

	// Authenticate
	const authResult = await authenticateRequest(authHeader, sessionId);

	if (!authResult.authenticated || !authResult.context) {
		return json(
			{
				error: 'Authentication failed',
				details: authResult.error
			},
			{ status: 401 }
		);
	}

	const context = authResult.context;

	// Get tools
	const tools = await getMcpTools(context);

	// Get cache stats
	const cacheStats = mcpCache.getStats();

	return json({
		authentication: {
			userId: context.userId,
			authMethod: context.authMethod,
			allowedModules: context.allowedModules,
			apiKeyId: context.apiKeyId
		},
		tools: {
			count: tools.length,
			names: tools.map((t) => t.name)
		},
		cache: {
			size: cacheStats.size,
			keys: cacheStats.keys
		}
	});
};
