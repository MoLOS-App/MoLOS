/**
 * MCP API Key Individual Operations Endpoint
 *
 * GET    /api/ai/mcp/keys/:keyId  - Get API key details
 * PATCH  /api/ai/mcp/keys/:keyId  - Update API key
 * DELETE /api/ai/mcp/keys/:keyId  - Delete/revoke API key
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ApiKeyRepository } from '$lib/repositories/ai/mcp';
import { McpLogRepository } from '$lib/repositories/ai/mcp';
import type { UpdateApiKeyInput } from '$lib/models/ai/mcp';
import { getAvailableModuleIds } from '$lib/server/ai/mcp/mcp-utils';
import { MCPApiKeyStatus } from '$lib/server/db/schema';

/**
 * GET - Get API key details
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const repo = new ApiKeyRepository();
	const apiKey = await repo.getByUserIdAndId(locals.user.id, params.keyId);

	if (!apiKey) {
		throw error(404, 'API key not found');
	}

	// Get recent usage logs
	const logRepo = new McpLogRepository();
	const recentLogs = await logRepo.listByApiKey(apiKey.id, 10);

	// Get stats
	const stats = await logRepo.getStats(locals.user.id, apiKey.id);

	return json({
		apiKey,
		recentLogs,
		stats
	});
};

/**
 * PATCH - Update API key
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

	if (body.allowedModules !== undefined) {
		// Validate module IDs
		const { valid, invalid } = await validateModuleIds(body.allowedModules);

		if (invalid.length > 0) {
			return json(
				{
					error: 'Invalid module IDs',
					invalid
				},
				{ status: 400 }
			);
		}

		input.allowedModules = valid;
	}

	if (body.expiresAt !== undefined) {
		input.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
	}

	const apiKey = await repo.update(params.keyId, locals.user.id, input);

	if (!apiKey) {
		throw error(404, 'API key not found');
	}

	return json({ apiKey });
};

/**
 * DELETE - Delete/revoke API key
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const repo = new ApiKeyRepository();
	const success = await repo.delete(params.keyId, locals.user.id);

	if (!success) {
		throw error(404, 'API key not found');
	}

	return json({ success: true });
};

/**
 * Validate module IDs against available external modules
 */
async function validateModuleIds(moduleIds: string[]): Promise<{
	valid: string[];
	invalid: string[];
}> {
	const available = getAvailableModuleIds();
	const valid: string[] = [];
	const invalid: string[] = [];

	for (const moduleId of moduleIds) {
		if (available.includes(moduleId)) {
			valid.push(moduleId);
		} else {
			invalid.push(moduleId);
		}
	}

	return { valid, invalid };
}
