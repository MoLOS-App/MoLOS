/**
 * OAuth 2.0 Protected Resource Metadata for MCP Transport
 *
 * Returns OAuth 2.0 Protected Resource Metadata per RFC 9707.
 * GET /api/ai/mcp/transport/.well-known/oauth-protected-resource
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAvailableScopes } from '$lib/server/ai/mcp/oauth/scope-mapper';

/**
 * Get the base URL from the request
 * Handles ngrok and other proxies that terminate SSL
 */
function getBaseUrl(requestUrl: string, headers: Headers): string {
	const url = new URL(requestUrl);

	// Check for X-Forwarded-Proto header (set by ngrok, Cloudflare, etc.)
	const forwardedProto = headers.get('x-forwarded-proto');
	if (forwardedProto) {
		return `${forwardedProto}://${url.host}`;
	}

	// Check for X-Forwarded-SSL header
	const forwardedSsl = headers.get('x-forwarded-ssl');
	if (forwardedSsl === 'on') {
		return `https://${url.host}`;
	}

	// Fallback to the request protocol
	return `${url.protocol}//${url.host}`;
}

/**
 * GET handler - Return OAuth 2.0 Protected Resource Metadata
 */
export const GET: RequestHandler = async ({ request }) => {
	const baseUrl = getBaseUrl(request.url, request.headers);
	const availableScopes = getAvailableScopes();

	const metadata = {
		resource: `${baseUrl}/api/ai/mcp/transport`,
		authorization_servers: [baseUrl],
		scopes_supported: availableScopes,
		bearer_methods_supported: ['header'],
		resource_documentation: `${baseUrl}/docs/mcp`,
		// Small logo under 10KB for ChatGPT MCP connector (logo-144.png is 8KB)
		logo_uri: `${baseUrl}/pwa-assets/logo-144.png`
	};

	return json(metadata);
};
