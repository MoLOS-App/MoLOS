/**
 * OAuth App Management Endpoint
 *
 * Handles deleting OAuth applications.
 *
 * DELETE /api/ai/mcp/oauth/apps/[clientId]
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { oauthClientsStore } from '$lib/server/ai/mcp/oauth';

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
