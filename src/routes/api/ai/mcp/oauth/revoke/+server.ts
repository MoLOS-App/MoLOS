/**
 * OAuth Token Revocation Endpoint
 *
 * Handles OAuth 2.0 token revocation per RFC 7009.
 *
 * POST /api/ai/mcp/oauth/revoke
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { oauthClientsStore } from '$lib/server/ai/mcp/oauth';
import { mcpOAuthProvider } from '$lib/server/ai/mcp/oauth';

/**
 * POST handler - Revoke an access or refresh token
 */
export const POST: RequestHandler = async ({ request }) => {
	// Parse request body
	const bodyText = await request.text();
	let params: Record<string, string>;

	try {
		params = Object.fromEntries(new URLSearchParams(bodyText));
	} catch {
		return error(400, 'Invalid request body');
	}

	const token = params.token;
	const tokenTypeHint = params.token_type_hint;

	if (!token) {
		return error(400, 'Missing token parameter');
	}

	// Get client credentials (for token endpoint auth)
	const clientId = params.client_id;
	const clientSecret = params.client_secret;

	// If client credentials provided, verify them
	let client;
	if (clientId && clientSecret) {
		client = await oauthClientsStore.getClientWithSecret(clientId, clientSecret);
		if (!client) {
			// Per RFC 7009, don't return error for invalid client
			// to avoid token enumeration attacks
			return new Response(null, { status: 200 });
		}
	} else if (clientId) {
		client = await oauthClientsStore.getClient(clientId);
	}

	try {
		const revocationRequest = {
			token,
			token_type_hint: tokenTypeHint
		};

		// If we have client info, use it for validation
		if (client) {
			await mcpOAuthProvider.revokeToken(client, revocationRequest);
		} else {
			// Revocation without client authentication
			// We'll revoke if the token is valid, but don't return errors
			const { oauthTokenService } = await import('$lib/server/ai/mcp/oauth');
			await oauthTokenService.revokeToken(token).catch(() => {
				// Ignore errors per RFC 7009
			});
		}

		// Per RFC 7009, always return 200 even if token was invalid
		return new Response(null, { status: 200 });
	} catch {
		// Per RFC 7009, don't return errors to avoid token enumeration
		return new Response(null, { status: 200 });
	}
};
