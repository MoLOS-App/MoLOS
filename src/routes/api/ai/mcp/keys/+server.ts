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
import type { CreateApiKeyInput, ApiKeyFilters } from '$lib/models/ai/mcp';
import { validateScopes, validateKeyName } from '$lib/server/ai/mcp/validation/scope-validator';

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
	const allowedScopes = body.allowedScopes ?? [];

	// Validate scopes
	const { valid, invalid } = validateScopes(allowedScopes);

	if (invalid.length > 0) {
		return json(
			{
				error: 'Invalid scopes',
				invalid
			},
			{ status: 400 }
		);
	}

	// Validate name
	const nameError = validateKeyName(body.name);
	if (nameError) {
		return json({ error: nameError.message }, { status: 400 });
	}

	const input: CreateApiKeyInput = {
		name: body.name,
		allowedScopes: valid,
		expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
	};

	const repo = new ApiKeyRepository();
	const result = await repo.create(locals.user.id, input);

	return json({
		apiKey: result.apiKey,
		fullKey: result.fullKey // Only returned once on creation
	});
};
