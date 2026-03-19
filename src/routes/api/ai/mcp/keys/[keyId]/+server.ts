/**
 * MCP Auth Key Individual Operations Endpoint
 *
 * GET    /api/ai/mcp/keys/:keyId  - Get auth key details
 * PATCH  /api/ai/mcp/keys/:keyId  - Update auth key
 * DELETE /api/ai/mcp/keys/:keyId  - Delete/revoke auth key
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ApiKeyRepository } from '$lib/repositories/ai/mcp';
import { McpLogRepository } from '$lib/repositories/ai/mcp';
import type { UpdateApiKeyInput } from '$lib/models/ai/mcp';
import { validateScopes, validateKeyName } from '$lib/server/ai/mcp/validation/scope-validator';
import { MCPApiKeyStatus } from '@molos/database/schema';

/**
 * GET - Get auth key details
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const repo = new ApiKeyRepository();
	const apiKey = await repo.getByUserIdAndId(locals.user.id, params.keyId);

	if (!apiKey) {
		throw error(404, 'Auth key not found');
	}

	// Get recent usage logs
	const logRepo = new McpLogRepository();
	const recentLogs = await logRepo.listByApiKey(apiKey.id, 10);

	// Get stats
	const stats = await logRepo.getStats(locals.user.id, apiKey.id);

	return json({
		apiKey: {
			...apiKey,
			allowedScopes: apiKey.allowedScopes
		},
		recentLogs,
		stats
	});
};

/**
 * PATCH - Update auth key
 */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();
	const repo = new ApiKeyRepository();

	// Build update input
	const input: UpdateApiKeyInput = {};

	if (body.name !== undefined) {
		if (body.name.trim().length === 0) {
			return json({ error: 'Name cannot be empty' }, { status: 400 });
		}
		if (body.name.length > 100) {
			return json({ error: 'Name must be less than 100 characters' }, { status: 400 });
		}
		input.name = body.name;
	}

	if (body.status !== undefined) {
		if (!Object.values(MCPApiKeyStatus).includes(body.status)) {
			return json({ error: 'Invalid status' }, { status: 400 });
		}
		input.status = body.status;
	}

	if (body.allowedScopes !== undefined) {
		// Validate scopes
		const { valid, invalid } = validateScopes(body.allowedScopes);

		if (invalid.length > 0) {
			return json(
				{
					error: 'Invalid scopes',
					invalid
				},
				{ status: 400 }
			);
		}

		input.allowedScopes = valid;
	}

	if (body.expiresAt !== undefined) {
		input.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
	}

	const apiKey = await repo.update(params.keyId, locals.user.id, input);

	if (!apiKey) {
		throw error(404, 'Auth key not found');
	}

	return json({ apiKey });
};

/**
 * DELETE - Delete/revoke auth key
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const repo = new ApiKeyRepository();
	const success = await repo.delete(params.keyId, locals.user.id);

	if (!success) {
		throw error(404, 'Auth key not found');
	}

	return json({ success: true });
};
