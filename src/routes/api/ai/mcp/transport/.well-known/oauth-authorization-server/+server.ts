/**
 * OAuth 2.0 Authorization Server Metadata for MCP Transport
 *
 * Returns OAuth 2.0 Authorization Server Metadata per RFC 8414.
 * This is a convenience endpoint for MCP clients discovering OAuth relative to the transport endpoint.
 *
 * GET /api/ai/mcp/transport/.well-known/oauth-authorization-server
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
 * GET handler - Return OAuth 2.0 Authorization Server Metadata
 */
export const GET: RequestHandler = async ({ request }) => {
	const baseUrl = getBaseUrl(request.url);

	const metadata = {
		issuer: baseUrl,
		authorization_endpoint: `${baseUrl}/api/ai/mcp/oauth/authorize`,
		token_endpoint: `${baseUrl}/api/ai/mcp/oauth/token`,
		registration_endpoint: `${baseUrl}/api/ai/mcp/oauth/register`,
		revocation_endpoint: `${baseUrl}/api/ai/mcp/oauth/revoke`,
		scopes_supported: ['mcp:all', 'mcp:analytics', 'mcp:tasks', 'mcp:notes'],
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
		code_challenge_methods_supported: ['S256'],
		service_documentation: `${baseUrl}/docs/mcp/oauth`
	};

	return json(metadata);
};
