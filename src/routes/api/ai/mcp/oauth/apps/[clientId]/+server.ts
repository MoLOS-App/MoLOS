/**
 * OAuth App Management Endpoint
 *
 * Handles updating and deleting OAuth applications.
 *
 * PATCH /api/ai/mcp/oauth/apps/[clientId] - Update OAuth app
 * DELETE /api/ai/mcp/oauth/apps/[clientId] - Delete OAuth app
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { oauthClientsStore } from '$lib/server/ai/mcp/oauth';

/**
 * PATCH handler - Update an OAuth app (name and scopes)
 */
export const PATCH: RequestHandler = async ({ request, locals, params }) => {
	if (!locals.user) {
		return error(401, 'Authentication required');
	}

	const clientId = params.clientId;

	// Verify the client exists
	const existingClient = await oauthClientsStore.getClient(clientId);
	if (!existingClient) {
		return error(404, 'OAuth app not found');
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return error(400, 'Invalid request body');
	}

	if (typeof body !== 'object' || body === null) {
		return error(400, 'Invalid request body');
	}

	const { name, scopes } = body as { name?: string; scopes?: string[] };

	// Build updates object
	const updates: {
		name?: string;
		scopes?: string[];
	} = {};

	if (name !== undefined) {
		if (typeof name !== 'string') {
			return error(400, 'name must be a string');
		}
		if (name.trim().length === 0) {
			return error(400, 'name cannot be empty');
		}
		if (name.length > 100) {
			return error(400, 'name must be less than 100 characters');
		}
		updates.name = name.trim();
	}

	if (scopes !== undefined) {
		if (!Array.isArray(scopes)) {
			return error(400, 'scopes must be an array');
		}
		// Validate scopes
		for (const scope of scopes) {
			if (typeof scope !== 'string') {
				return error(400, 'All scopes must be strings');
			}
		}
		updates.scopes = scopes;
	}

	if (Object.keys(updates).length === 0) {
		return error(400, 'No updates provided');
	}

	try {
		// Update the client
		const updated = await oauthClientsStore.updateClient(clientId, locals.user.id, updates);

		if (!updated) {
			return error(404, 'Failed to update OAuth app');
		}

		return json({
			client_id: updated.client_id,
			client_id_issued_at: updated.client_id_issued_at,
			name: updated.client_name,
			redirect_uris: updated.redirect_uris.map((u: URL) => u.toString()),
			scopes: updated.scope ? updated.scope.split(' ') : [],
			token_endpoint_auth_method: updated.token_endpoint_auth_method
		});
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Failed to update OAuth app';

		return json(
			{
				error: 'update_failed',
				error_description: errorMessage
			},
			{ status: 400 }
		);
	}
};

/**
 * DELETE handler - Delete an OAuth app
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return error(401, 'Authentication required');
	}

	const { clientId } = params;

	// Delete the client (only if it belongs to this user)
	const deleted = await oauthClientsStore.deleteClient(clientId, locals.user.id);

	if (!deleted) {
		return error(404, 'OAuth app not found');
	}

	return new Response(null, { status: 204 });
};
