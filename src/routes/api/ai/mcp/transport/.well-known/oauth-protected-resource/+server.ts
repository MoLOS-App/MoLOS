/**
 * OAuth 2.0 Protected Resource Metadata for MCP Transport
 *
 * Returns OAuth 2.0 Protected Resource Metadata per RFC 9707.
 * GET /api/ai/mcp/transport/.well-known/oauth-protected-resource
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Get the base URL from the request
 */
function getBaseUrl(requestUrl: string): string {
	const url = new URL(requestUrl);
	return `${url.protocol}//${url.host}`;
}

/**
 * GET handler - Return OAuth 2.0 Protected Resource Metadata
 */
export const GET: RequestHandler = async ({ request }) => {
	const baseUrl = getBaseUrl(request.url);

	const metadata = {
		resource: `${baseUrl}/api/ai/mcp/transport`,
		authorization_servers: [baseUrl],
		scopes_supported: ['mcp:all', 'mcp:analytics', 'mcp:tasks', 'mcp:notes'],
		bearer_methods_supported: ['header'],
		resource_documentation: `${baseUrl}/docs/mcp`
	};

	return json(metadata);
};
