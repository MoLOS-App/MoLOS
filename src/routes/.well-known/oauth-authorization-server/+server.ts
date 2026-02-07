/**
 * OAuth 2.0 Authorization Server Metadata
 *
 * Returns OAuth 2.0 Authorization Server Metadata per RFC 8414.
 * GET /.well-known/oauth-authorization-server
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
 * GET handler - Return OAuth 2.0 Authorization Server Metadata
 */
export const GET: RequestHandler = async ({ request }) => {
	const baseUrl = getBaseUrl(request.url, request.headers);
	const availableScopes = getAvailableScopes();

	const metadata = {
		issuer: baseUrl,
		authorization_endpoint: `${baseUrl}/api/ai/mcp/oauth/authorize`,
		token_endpoint: `${baseUrl}/api/ai/mcp/oauth/token`,
		registration_endpoint: `${baseUrl}/api/ai/mcp/oauth/register`,
		revocation_endpoint: `${baseUrl}/api/ai/mcp/oauth/revoke`,
		scopes_supported: availableScopes,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
		code_challenge_methods_supported: ['S256'],
		service_documentation: `${baseUrl}/docs/mcp/oauth`,
		// Small logo under 10KB for ChatGPT MCP connector (logo-144.png is 8KB)
		logo_uri: `${baseUrl}/pwa-assets/logo-144.png`
	};

	return json(metadata);
};
