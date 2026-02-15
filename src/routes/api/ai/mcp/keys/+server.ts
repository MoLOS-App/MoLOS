/**
 * MCP API Keys Management Endpoint
 *
 * CRUD operations for MCP API keys.
 *
 * GET    /api/ai/mcp/keys        - List all API keys for user
 * POST   /api/ai/mcp/keys        - Create new API key
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ApiKeyRepository } from '$lib/repositories/ai/mcp';
import type { CreateApiKeyInput, UpdateApiKeyInput, ApiKeyFilters } from '$lib/models/ai/mcp';
import { getAvailableModuleIds } from '$lib/server/ai/mcp/mcp-utils';
import { MCPApiKeyStatus } from '$lib/server/db/schema';

/**
 * GET - List API keys for the authenticated user
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const repo = new ApiKeyRepository();

	// Parse query parameters
	const filters: ApiKeyFilters = {
		status: (url.searchParams.get('status') as any) ?? undefined,
		search: url.searchParams.get('search') ?? undefined
	};

	const page = parseInt(url.searchParams.get('page') ?? '1');
	const limit = parseInt(url.searchParams.get('limit') ?? '50');

	const result = await repo.listByUserId(locals.user.id, filters, { page, limit });

	return json(result);
};

/**
 * POST - Create a new API key
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();

	// Validate input
	const allowedModules = body.allowedModules ?? [];

	// Validate module IDs
	const { valid, invalid } = await validateModuleIds(allowedModules);

	if (invalid.length > 0) {
		return json(
			{
				error: 'Invalid module IDs',
				invalid
			},
			{ status: 400 }
		);
	}

	const input: CreateApiKeyInput = {
		name: body.name,
		allowedModules: valid,
		expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
	};

	// Validate name
	if (!input.name || input.name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	if (input.name.length > 100) {
		return json({ error: 'Name must be less than 100 characters' }, { status: 400 });
	}

	const repo = new ApiKeyRepository();
	const result = await repo.create(locals.user.id, input);

	return json({
		apiKey: result.apiKey,
		fullKey: result.fullKey // Only returned once on creation
	});
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
