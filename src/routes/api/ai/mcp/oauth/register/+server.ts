/**
 * OAuth Client Registration Endpoint
 *
 * Handles dynamic OAuth 2.0 client registration per RFC 7591.
 *
 * POST /api/ai/mcp/oauth/register
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { oauthClientsStore } from '$lib/server/ai/mcp/oauth';
import { localsToUser } from '$lib/server/auth/auth-utils';

/**
 * POST handler - Register a new OAuth client
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = localsToUser(locals);
	if (!user) {
		return error(401, 'Authentication required');
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return error(400, 'Invalid request body');
	}

	// Validate required fields
	if (typeof body !== 'object' || body === null) {
		return error(400, 'Invalid request body');
	}

	const {
		redirect_uris,
		client_name,
		token_endpoint_auth_method = 'none',
		grant_types = ['authorization_code', 'refresh_token'],
		response_types = ['code'],
		scope,
		client_uri,
		logo_uri,
		contacts,
		tos_uri,
		policy_uri,
		software_id,
		software_version
	} = body as Record<string, unknown>;

	// Validate redirect_uris (required)
	if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
		return error(400, 'redirect_uris is required and must be a non-empty array');
	}

	// Validate redirect URIs are valid URLs
	const validRedirectUris: URL[] = [];
	for (const uri of redirect_uris) {
		try {
			const url = new URL(uri as string);
			// Only allow https and http (for localhost)
			if (url.protocol !== 'https:' && url.protocol !== 'http:') {
				return error(400, `Invalid redirect_uri protocol: ${url.protocol}`);
			}
			// For http, require localhost
			if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
				return error(400, 'HTTP redirect_uris only allowed for localhost');
			}
			validRedirectUris.push(url);
		} catch {
			return error(400, `Invalid redirect_uri: ${uri}`);
		}
	}

	// Validate token_endpoint_auth_method
	const validAuthMethods = ['none', 'client_secret_basic', 'client_secret_post'];
	if (!validAuthMethods.includes(token_endpoint_auth_method as string)) {
		return error(400, `Invalid token_endpoint_auth_method: ${token_endpoint_auth_method}`);
	}

	// Build client metadata
	const clientMetadata = {
		redirect_uris: validRedirectUris,
		token_endpoint_auth_method: token_endpoint_auth_method as string,
		grant_types: Array.isArray(grant_types) ? grant_types as string[] : ['authorization_code', 'refresh_token'],
		response_types: Array.isArray(response_types) ? response_types as string[] : ['code'],
		client_name: client_name ? String(client_name) : 'Unnamed Client',
		client_uri: client_uri ? new URL(client_uri as string) : undefined,
		logo_uri: logo_uri ? new URL(logo_uri as string) : undefined,
		scope: scope ? String(scope) : undefined,
		contacts: Array.isArray(contacts) ? contacts as string[] : undefined,
		tos_uri: tos_uri ? String(tos_uri) : undefined,
		policy_uri: policy_uri ? String(policy_uri) : undefined,
		software_id: software_id ? String(software_id) : undefined,
		software_version: software_version ? String(software_version) : undefined
	};

	try {
		const client = await oauthClientsStore.registerClient(user.id, clientMetadata);

		// Return client information
		return json(client, { status: 201 });
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Client registration failed';

		return json(
			{
				error: 'invalid_client_metadata',
				error_description: errorMessage
			},
			{ status: 400 }
		);
	}
};

/**
 * GET handler - List registered clients for the current user
 */
export const GET: RequestHandler = async ({ locals }) => {
	const user = localsToUser(locals);
	if (!user) {
		return error(401, 'Authentication required');
	}

	const clients = await oauthClientsStore.listClientsByUserId(user.id);

	return json({
		items: clients,
		total: clients.length
	});
};
