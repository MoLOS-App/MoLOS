/**
 * MCP Resource Individual Endpoint
 *
 * CRUD operations for individual MCP resources.
 *
 * GET    /api/ai/mcp/resources/:id     - Get resource by ID
 * PUT    /api/ai/mcp/resources/:id     - Update resource
 * DELETE /api/ai/mcp/resources/:id     - Delete resource
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { McpResourceRepository } from '$lib/repositories/ai/mcp';
import type { UpdateResourceInput } from '$lib/models/ai/mcp';

/**
 * GET - Get resource by ID
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const repo = new McpResourceRepository();
	const resource = await repo.getByUserIdAndId(locals.user.id, params.resourceId);

	if (!resource) {
		throw error(404, 'Resource not found');
	}

	return json(resource);
};

/**
 * PUT - Update a resource
 */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();

	// Validate input
	const input: UpdateResourceInput = {};

	if (body.name !== undefined) {
		if (!body.name || body.name.trim().length === 0) {
			return json({ error: 'Name is required' }, { status: 400 });
		}
		if (body.name.length > 200) {
			return json({ error: 'Name must be less than 200 characters' }, { status: 400 });
		}
		input.name = body.name;
	}

	if (body.description !== undefined) {
		if (body.description.length > 1000) {
			return json({ error: 'Description must be less than 1000 characters' }, { status: 400 });
		}
		input.description = body.description;
	}

	if (body.uri !== undefined) {
		if (!body.uri || body.uri.trim().length === 0) {
			return json({ error: 'URI is required' }, { status: 400 });
		}
		if (body.uri.length > 500) {
			return json({ error: 'URI must be less than 500 characters' }, { status: 400 });
		}
		input.uri = body.uri;
	}

	if (body.moduleId !== undefined) {
		input.moduleId = body.moduleId;
	}

	if (body.resourceType !== undefined) {
		input.resourceType = body.resourceType;
	}

	if (body.url !== undefined) {
		input.url = body.url;
	}

	if (body.enabled !== undefined) {
		input.enabled = body.enabled;
	}

	// Validate URL if resource type is 'url'
	if (body.resourceType === 'url' || input.resourceType === 'url') {
		const urlToCheck = body.url ?? input.url;
		if (!urlToCheck || urlToCheck.trim().length === 0) {
			return json({ error: 'URL is required for URL-based resources' }, { status: 400 });
		}
		try {
			new URL(urlToCheck);
		} catch {
			return json({ error: 'Invalid URL format' }, { status: 400 });
		}
		if (urlToCheck.length > 2000) {
			return json({ error: 'URL must be less than 2000 characters' }, { status: 400 });
		}
	}

	const repo = new McpResourceRepository();
	const resource = await repo.update(params.resourceId, locals.user.id, input);

	if (!resource) {
		throw error(404, 'Resource not found');
	}

	return json(resource);
};

/**
 * DELETE - Delete a resource
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const repo = new McpResourceRepository();
	const success = await repo.delete(params.resourceId, locals.user.id);

	if (!success) {
		throw error(404, 'Resource not found');
	}

	return json({ success: true });
};
