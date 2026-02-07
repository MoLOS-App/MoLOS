/**
 * MCP Resources Management Endpoint
 *
 * CRUD operations for MCP resources.
 *
 * GET    /api/ai/mcp/resources        - List all resources for user
 * POST   /api/ai/mcp/resources        - Create new resource
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { McpResourceRepository } from '$lib/repositories/ai/mcp';
import type { CreateResourceInput, UpdateResourceInput, ResourceFilters } from '$lib/models/ai/mcp';

/**
 * GET - List resources for the authenticated user
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const repo = new McpResourceRepository();

	// Parse query parameters
	const filters: ResourceFilters = {
		moduleId: url.searchParams.get('moduleId') ?? undefined,
		enabled:
			url.searchParams.get('enabled') === 'true'
				? true
				: url.searchParams.get('enabled') === 'false'
					? false
					: undefined,
		search: url.searchParams.get('search') ?? undefined
	};

	const page = parseInt(url.searchParams.get('page') ?? '1');
	const limit = parseInt(url.searchParams.get('limit') ?? '50');

	const result = await repo.listByUserId(locals.user.id, filters, { page, limit });

	return json(result);
};

/**
 * POST - Create a new resource
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();

	// Validate input
	const input: CreateResourceInput = {
		name: body.name,
		description: body.description ?? '',
		uri: body.uri,
		moduleId: body.moduleId ?? null,
		resourceType: body.resourceType ?? 'static',
		url: body.url ?? null,
		enabled: body.enabled ?? true
	};

	// Validate name
	if (!input.name || input.name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	if (input.name.length > 200) {
		return json({ error: 'Name must be less than 200 characters' }, { status: 400 });
	}

	// Validate URI
	if (!input.uri || input.uri.trim().length === 0) {
		return json({ error: 'URI is required' }, { status: 400 });
	}

	if (input.uri.length > 500) {
		return json({ error: 'URI must be less than 500 characters' }, { status: 400 });
	}

	// Validate description
	if (input.description && input.description.length > 1000) {
		return json({ error: 'Description must be less than 1000 characters' }, { status: 400 });
	}

	// Validate resource type and URL
	if (input.resourceType === 'url') {
		if (!input.url || input.url.trim().length === 0) {
			return json({ error: 'URL is required for URL-based resources' }, { status: 400 });
		}
		try {
			new URL(input.url);
		} catch {
			return json({ error: 'Invalid URL format' }, { status: 400 });
		}
		if (input.url.length > 2000) {
			return json({ error: 'URL must be less than 2000 characters' }, { status: 400 });
		}
	}

	const repo = new McpResourceRepository();
	const resource = await repo.create(locals.user.id, input);

	return json(resource, { status: 201 });
};
