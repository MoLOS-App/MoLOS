/**
 * MCP Transport Endpoint (HTTP-only mode)
 *
 * Simplified endpoint for MCP JSON-RPC 2.0 communication via HTTP POST.
 * Supports mcp-remote and other HTTP-based MCP clients.
 *
 * API: POST /api/ai/mcp/transport
 * Headers: MOLOS_MCP_API_KEY: mcp_live_*
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractApiKeyFromRequest, authenticateRequest } from '$lib/server/ai/mcp/middleware/auth-middleware';
import { handleMcpRequest, parseMcpRequest } from '$lib/server/ai/mcp/handlers';
import { defaultRateLimiter, parseApiKeyFromHeader } from '$lib/server/ai/mcp/mcp-utils';

/**
 * POST handler - Process JSON-RPC requests
 *
 * Handles all MCP methods (initialize, tools/list, tools/call, etc.)
 * Returns responses directly in HTTP body (no SSE needed for basic operation)
 */
export const POST: RequestHandler = async ({ request }) => {
	// Extract API key from headers
	const apiKeyHeader = extractApiKeyFromRequest(request);

	if (!apiKeyHeader) {
		return error(401, 'Missing API key. Provide MOLOS_MCP_API_KEY header.');
	}

	// Authenticate
	const authResult = await authenticateRequest(apiKeyHeader, getSessionId(request.url));

	if (!authResult.authenticated || !authResult.context) {
		return error(401, authResult.error?.message ?? 'Authentication failed');
	}

	const context = authResult.context;

	// Check rate limit
	if (!defaultRateLimiter.check(context.apiKeyId ?? context.userId)) {
		return error(429, 'Rate limit exceeded');
	}

	// Parse request body
	let requestBody: string;
	try {
		requestBody = await request.text();
	} catch {
		return error(400, 'Invalid request body');
	}

	if (!requestBody) {
		return error(400, 'Empty request body');
	}

	// Parse the request
	const mcpRequest = parseMcpRequest(requestBody);

	if (!mcpRequest) {
		return error(400, 'Invalid JSON-RPC request');
	}

	// Handle the request
	const response = await handleMcpRequest(context, mcpRequest);

	// Return the JSON-RPC response directly
	return new Response(JSON.stringify(response), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
};

/**
 * Generate session ID from request URL string
 */
function getSessionId(urlString: string): string {
	const url = new URL(urlString);
	const sessionId = url.searchParams.get('sessionId');
	if (sessionId) {
		return sessionId;
	}
	return `mcp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

// GET, DELETE, and SSE endpoints are not needed for HTTP-only mode
// mcp-remote's http-first mode only uses POST
