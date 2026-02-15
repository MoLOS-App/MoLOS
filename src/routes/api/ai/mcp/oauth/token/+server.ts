/**
 * OAuth Token Endpoint
 *
 * Handles OAuth 2.0 token requests:
 * - Authorization code exchange
 * - Refresh token exchange
 * - Client credentials (optional)
 *
 * POST /api/ai/mcp/oauth/token
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { oauthClientsStore } from '$lib/server/ai/mcp/oauth';
import { mcpOAuthProvider } from '$lib/server/ai/mcp/oauth';

/**
 * POST handler - Exchange authorization code or refresh token for access token
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

	const grantType = params.grant_type;

	// Validate grant type
	if (!grantType || !['authorization_code', 'refresh_token'].includes(grantType)) {
		return error(400, 'Invalid or unsupported grant_type');
	}

	// Get client credentials
	const clientId = params.client_id;
	const clientSecret = params.client_secret;

	if (!clientId) {
		return error(400, 'Missing client_id');
	}

	// Verify client
	const client = clientSecret
		? await oauthClientsStore.getClientWithSecret(clientId, clientSecret)
		: await oauthClientsStore.getClient(clientId);

	if (!client) {
		return error(401, 'Invalid client credentials');
	}

	try {
		let tokens;

		if (grantType === 'authorization_code') {
			// Authorization code flow
			const code = params.code;
			const redirectUri = params.redirect_uri;
			const codeVerifier = params.code_verifier;

			if (!code) {
				return error(400, 'Missing code parameter');
			}

			tokens = await mcpOAuthProvider.exchangeAuthorizationCode(
				client,
				code,
				codeVerifier,
				redirectUri
			);
		} else {
			// Refresh token flow
			const refreshToken = params.refresh_token;
			const scope = params.scope;

			if (!refreshToken) {
				return error(400, 'Missing refresh_token parameter');
			}

			const scopes = scope ? scope.split(' ') : undefined;
			tokens = await mcpOAuthProvider.exchangeRefreshToken(client, refreshToken, scopes);
		}

		return json(tokens);
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Token request failed';

		return json(
			{
				error: 'invalid_grant',
				error_description: errorMessage
			},
			{ status: 400 }
		);
	}
};
